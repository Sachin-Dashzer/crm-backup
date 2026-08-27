import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Borrowing from "@/models/Borrowing";
import Payable from "@/models/Payable";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

async function loadOr404(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: "Invalid borrowing id", status: 400 };
  const borrowing = await Borrowing.findById(id);
  if (!borrowing) return { error: "Borrowing not found", status: 404 };
  return { borrowing };
}

// Single read — used by the document-level "Add Tranche"/"Record Repayment" UI to show the
// row's own detail without duplicating field names.
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }
    await connectDB();
    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    return NextResponse.json({ borrowing: found.borrowing });
  } catch (error) {
    console.error("Error fetching borrowing:", error);
    return NextResponse.json({ error: "Failed to fetch borrowing" }, { status: 500 });
  }
}

// Re-sums every non-cancelled IN row against a loan and writes that figure onto the Payable's
// totalAmount — the single place that keeps "what's raised" in step with "what IN rows actually
// exist", used by cancel/reinstate/PUT below so none of them can drift from the others.
//
// MUST run inside the caller's session, and MUST run AFTER the row whose isCancelled/amount just
// changed has itself been saved on that same session — this reads the Borrowing collection
// fresh, so it only sees a row's new state once that row's own write has landed.
async function resyncPayableTotal({ payableId, session, performedBy, note }) {
  const payable = await Payable.findById(payableId).session(session);
  if (!payable) return null;

  const [agg] = await Borrowing.aggregate([
    { $match: { payableId, direction: "IN", isCancelled: { $ne: true } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);
  const newTotal = Math.round((agg?.total || 0) * 100) / 100;

  if (newTotal === payable.totalAmount) return payable;

  payable.log.push({
    action: "Amount Revised",
    previousValue: String(payable.totalAmount),
    newValue: String(newTotal),
    note,
    performedBy,
    performedAt: new Date(),
  });
  payable.totalAmount = newTotal;
  // Nothing left owed on this loan at all — close the liability out too.
  if (newTotal <= 0 && !payable.isCancelled) {
    payable.isCancelled = true;
    payable.log.push({
      action: "Cancelled",
      previousValue: "false",
      newValue: "true",
      note: "No borrowing rows remain against this loan",
      performedBy,
      performedAt: new Date(),
    });
  } else if (newTotal > 0 && payable.isCancelled) {
    // A row was reinstated / re-added onto a loan that had been auto-closed — reopen it.
    payable.isCancelled = false;
    payable.log.push({
      action: "Cancelled",
      previousValue: "true",
      newValue: "false",
      note: "Borrowing row(s) restored — loan reopened",
      performedBy,
      performedAt: new Date(),
    });
  }
  await payable.save({ session });
  return payable;
}

// Cancel / reinstate — never hard-deleted (see DELETE below for when a genuine removal is safe),
// same convention as AccountTransfer/SuspenseEntry. A cancelled row stops counting toward both
// the account balance (accountBalances.js) and the linked Payable's paid/pending
// (payableAggregation.js).
//
// Cancelling an IN row is refused while any OUT row exists against the same Payable — that
// money has already been (at least partly) repaid against the liability this IN created, and
// erasing the IN out from under it would strand those repayments with nothing to point at.
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const borrowing = found.borrowing;

    const { action, note } = await req.json();
    if (!["cancel", "reinstate"].includes(action)) {
      return NextResponse.json({ error: "action must be: cancel or reinstate" }, { status: 400 });
    }
    if (action === "cancel" && borrowing.isCancelled) {
      return NextResponse.json({ error: "This borrowing is already cancelled" }, { status: 400 });
    }
    if (action === "reinstate" && !borrowing.isCancelled) {
      return NextResponse.json({ error: "This borrowing is not cancelled" }, { status: 400 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };
    const nextCancelled = action === "cancel";

    if (borrowing.direction === "IN" && action === "cancel") {
      const outCount = await Borrowing.countDocuments({
        payableId: borrowing.payableId,
        direction: "OUT",
        isCancelled: { $ne: true },
      });
      if (outCount > 0) {
        return NextResponse.json(
          {
            error:
              "Repayments already exist against this loan — cancel or reverse those first, or this would strand them.",
          },
          { status: 400 },
        );
      }
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        borrowing.isCancelled = nextCancelled;
        borrowing.log.push({
          action: "Cancelled",
          previousValue: String(!nextCancelled),
          newValue: String(nextCancelled),
          note: note || (nextCancelled ? "Cancelled" : "Reinstated"),
          performedBy,
          performedAt: new Date(),
        });
        // Saved BEFORE the resync below — resyncPayableTotal re-aggregates the Borrowing
        // collection by isCancelled, on this same session, so it must see this row's own new
        // isCancelled value or it will count (or fail to count) itself.
        await borrowing.save({ session: dbSession });

        if (borrowing.direction === "IN") {
          await resyncPayableTotal({
            payableId: borrowing.payableId,
            session: dbSession,
            performedBy,
            note: note || `Borrowing row ${borrowing._id} ${action}led`,
          });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({
      message: nextCancelled ? "Borrowing cancelled" : "Borrowing reinstated",
      borrowing,
    });
  } catch (error) {
    console.error("Error updating borrowing:", error);
    return NextResponse.json({ error: "Failed to update borrowing" }, { status: 500 });
  }
}

// Edits the row's own fields — amount, date, account, branch, reference, remarks, receipts.
// direction and payableId are structural and never change here (moving a row between loans, or
// flipping IN/OUT, would invalidate every guard above — create a new row instead).
//
// An amount change on an IN row re-syncs the Payable's totalAmount to match (same helper the
// cancel/reinstate path uses); on an OUT row it re-checks the new amount against pending (which
// is otherwise always computed live, never stored) unless allowOverpayment is passed.
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const borrowing = found.borrowing;

    if (borrowing.isCancelled) {
      return NextResponse.json({ error: "Reinstate this borrowing before editing it" }, { status: 400 });
    }

    const body = await req.json();
    const { amount, date, account, branch, reference, remarks, receipts, allowOverpayment } = body;

    if (account !== undefined && !ACCOUNTS.includes(account)) {
      return NextResponse.json({ error: `account must be one of: ${ACCOUNTS.join(", ")}` }, { status: 400 });
    }
    if (branch && !ALL_BRANCHES.includes(branch)) {
      return NextResponse.json({ error: `branch must be one of: ${ALL_BRANCHES.join(", ")}` }, { status: 400 });
    }
    const parsedAmount = amount !== undefined ? parseFloat(amount) : borrowing.amount;
    if (!(parsedAmount > 0)) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    const nextAccount = account ?? borrowing.account;
    const nextDate = date ? new Date(date) : borrowing.date;
    const lockReason = await checkPeriodLock(
      { furtherMode: borrowing.account, date: borrowing.date },
      { furtherMode: nextAccount, date: nextDate },
    );
    if (lockReason) {
      return NextResponse.json({ error: lockReason, periodLocked: true }, { status: 423 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };
    const amountChanged = parsedAmount !== borrowing.amount;

    if (borrowing.direction === "OUT" && amountChanged) {
      const [paidAgg] = await Borrowing.aggregate([
        { $match: { payableId: borrowing.payableId, direction: "OUT", isCancelled: { $ne: true }, _id: { $ne: borrowing._id } } },
        { $group: { _id: null, paid: { $sum: "$amount" } } },
      ]);
      const payable = await Payable.findById(borrowing.payableId).lean();
      const pendingExcludingThis = Math.max(0, Math.round(((payable?.totalAmount || 0) - (paidAgg?.paid || 0)) * 100) / 100);
      if (parsedAmount > pendingExcludingThis && !allowOverpayment) {
        return NextResponse.json(
          {
            error: `That amount would exceed the outstanding balance of ₹${pendingExcludingThis.toLocaleString("en-IN")}. Pass allowOverpayment to save it anyway.`,
            pending: pendingExcludingThis,
          },
          { status: 400 },
        );
      }
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const previousAmount = borrowing.amount;
        borrowing.amount = parsedAmount;
        if (account !== undefined) borrowing.account = account;
        if (date) borrowing.date = nextDate;
        if (branch !== undefined) borrowing.branch = branch || null;
        if (reference !== undefined) borrowing.reference = reference;
        if (remarks !== undefined) borrowing.remarks = remarks;
        if (Array.isArray(receipts)) borrowing.receipts = receipts;

        if (amountChanged) {
          borrowing.log.push({
            action: "Amount Revised",
            previousValue: String(previousAmount),
            newValue: String(parsedAmount),
            performedBy,
            performedAt: new Date(),
          });
        }

        // Saved BEFORE the resync below — same reason as PATCH above: resyncPayableTotal
        // re-aggregates this row's own new amount off the collection, on this same session.
        await borrowing.save({ session: dbSession });

        if (amountChanged && borrowing.direction === "IN") {
          await resyncPayableTotal({
            payableId: borrowing.payableId,
            session: dbSession,
            performedBy,
            note: `Borrowing row ${borrowing._id} amount edited`,
          });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({ message: "Borrowing updated", borrowing });
  } catch (error) {
    console.error("Error editing borrowing:", error);
    return NextResponse.json({ error: "Failed to edit borrowing" }, { status: 500 });
  }
}

// Hard delete — refused unless the row is ALREADY cancelled. Cancelling first means every
// financial side effect (the linked Payable's totalAmount, the account balance) has already been
// unwound by the guarded PATCH above, so removing the record afterward has no further effect on
// anything computed from it. This is stricter than Payable's own DELETE (which only checks that
// nothing has been paid yet) because a Borrowing row's IN side is folded directly into the
// Payable's stored totalAmount rather than only ever being read live.
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const borrowing = found.borrowing;

    if (!borrowing.isCancelled) {
      return NextResponse.json(
        { error: "Cancel this borrowing before deleting it — deleting an active row would silently drop its effect on the loan." },
        { status: 400 },
      );
    }

    await Borrowing.deleteOne({ _id: borrowing._id });

    return NextResponse.json({ message: "Borrowing deleted" });
  } catch (error) {
    console.error("Error deleting borrowing:", error);
    return NextResponse.json({ error: "Failed to delete borrowing" }, { status: 500 });
  }
}
