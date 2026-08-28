import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Advance from "@/models/Advance";
import Receivable from "@/models/Receivable";
import Payable from "@/models/Payable";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

async function loadOr404(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: "Invalid advance id", status: 400 };
  const advance = await Advance.findById(id);
  if (!advance) return { error: "Advance not found", status: 404 };
  return { advance };
}

// Single read — used by the document-level "Further Advance"/"Record Recovery" UI to show the
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
    return NextResponse.json({ advance: found.advance });
  } catch (error) {
    console.error("Error fetching advance:", error);
    return NextResponse.json({ error: "Failed to fetch advance" }, { status: 500 });
  }
}

// Re-sums every non-cancelled OUT row against an advance and writes that figure onto the
// Receivable's totalAmount — exact mirror of resyncPayableTotal in
// /api/borrowings/[id]/route.js. MUST run inside the caller's session, and MUST run AFTER the
// row whose isCancelled/amount just changed has itself been saved on that same session.
async function resyncReceivableTotal({ receivableId, session, performedBy, note }) {
  const receivable = await Receivable.findById(receivableId).session(session);
  if (!receivable) return null;

  const [agg] = await Advance.aggregate([
    { $match: { receivableId, direction: "OUT", isCancelled: { $ne: true } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session);
  const newTotal = Math.round((agg?.total || 0) * 100) / 100;

  if (newTotal === receivable.totalAmount) return receivable;

  receivable.log.push({
    action: "Amount Revised",
    previousValue: String(receivable.totalAmount),
    newValue: String(newTotal),
    note,
    performedBy,
    performedAt: new Date(),
  });
  receivable.totalAmount = newTotal;
  if (newTotal <= 0 && !receivable.isCancelled) {
    receivable.isCancelled = true;
    receivable.log.push({
      action: "Cancelled",
      previousValue: "false",
      newValue: "true",
      note: "No advance rows remain against this receivable",
      performedBy,
      performedAt: new Date(),
    });
  } else if (newTotal > 0 && receivable.isCancelled) {
    receivable.isCancelled = false;
    receivable.log.push({
      action: "Cancelled",
      previousValue: "true",
      newValue: "false",
      note: "Advance row(s) restored — reopened",
      performedBy,
      performedAt: new Date(),
    });
  }
  await receivable.save({ session });
  return receivable;
}

// Cancel / reinstate / settle / unsettle — never hard-deleted (see DELETE below), same convention
// as /api/borrowings/[id]. A cancelled row stops counting toward both the account balance
// (accountBalances.js) and the linked Receivable's received/pending (receivableAggregation.js).
//
// Cancelling an OUT row is refused while any IN row exists against the same Receivable — that
// money has already been (at least partly) recovered against the claim this OUT created, and
// erasing the OUT out from under it would strand those recoveries with nothing to point at.
//
// §4.3 — settle/unsettle link this row (the advance's own creating OUT row only — the same one
// the aggregation's settlesPayableId $lookup filters on, see payableAggregation.js) to an
// UNRELATED, pre-existing Payable for the same party (e.g. an advance paid to a rent vendor,
// settled against their own outstanding rent payable). Never mutates the target Payable's
// totalAmount — only its live paid/pending aggregation changes, the moment this field is set.
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
    const advance = found.advance;

    const body = await req.json();
    const { action, note } = body;
    if (!["cancel", "reinstate", "settle", "unsettle"].includes(action)) {
      return NextResponse.json({ error: "action must be: cancel, reinstate, settle, or unsettle" }, { status: 400 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    if (action === "settle" || action === "unsettle") {
      if (advance.isCancelled) {
        return NextResponse.json({ error: "Reinstate this advance before settling it" }, { status: 400 });
      }
      if (advance.direction !== "OUT") {
        return NextResponse.json(
          { error: "Only the advance's own paid-out (OUT) row can settle a payable" },
          { status: 400 },
        );
      }

      if (action === "unsettle") {
        if (!advance.settlesPayableId) {
          return NextResponse.json({ error: "This advance isn't settling a payable" }, { status: 400 });
        }
        const dbSession = await mongoose.startSession();
        try {
          await dbSession.withTransaction(async () => {
            const target = await Payable.findById(advance.settlesPayableId).session(dbSession);
            advance.log.push({
              action: "Note Added",
              note: note || `Unlinked from payable ${advance.settlesPayableId}`,
              performedBy,
              performedAt: new Date(),
            });
            advance.settlesPayableId = null;
            await advance.save({ session: dbSession });
            if (target) {
              target.log.push({
                action: "Note Added",
                note: note || `No longer settled by advance ${advance._id}`,
                performedBy,
                performedAt: new Date(),
              });
              await target.save({ session: dbSession });
            }
          });
        } finally {
          await dbSession.endSession();
        }
        return NextResponse.json({ message: "Settlement unlinked", advance });
      }

      // action === "settle"
      if (advance.settlesPayableId) {
        return NextResponse.json(
          { error: "Already settling a payable — unsettle it first" },
          { status: 400 },
        );
      }
      const { settlesPayableId } = body;
      if (!settlesPayableId || !mongoose.Types.ObjectId.isValid(settlesPayableId)) {
        return NextResponse.json({ error: "A valid settlesPayableId is required" }, { status: 400 });
      }
      const target = await Payable.findById(settlesPayableId);
      if (!target) {
        return NextResponse.json({ error: "Payable not found" }, { status: 404 });
      }
      if (target.isCancelled) {
        return NextResponse.json({ error: "This payable has been cancelled" }, { status: 400 });
      }
      // §4.3 — same-party restriction: cross-party settlement is almost always a data-entry
      // error. A party with no refId (kind "OTHER") can never be matched this way.
      if (!advance.party.refId || !target.payee?.refId || String(advance.party.refId) !== String(target.payee.refId)) {
        return NextResponse.json(
          { error: "This payable belongs to a different party than this advance — settlement is restricted to the same party" },
          { status: 400 },
        );
      }

      const dbSession = await mongoose.startSession();
      try {
        await dbSession.withTransaction(async () => {
          advance.settlesPayableId = target._id;
          advance.log.push({
            action: "Note Added",
            note: note || `Settling against payable ${target._id} (${target.payee?.label || "party"})`,
            performedBy,
            performedAt: new Date(),
          });
          await advance.save({ session: dbSession });

          target.log.push({
            action: "Note Added",
            note: note || `Settled by advance ${advance._id} (${advance.party.label})`,
            performedBy,
            performedAt: new Date(),
          });
          await target.save({ session: dbSession });
        });
      } finally {
        await dbSession.endSession();
      }
      return NextResponse.json({ message: "Settlement linked", advance });
    }

    if (action === "cancel" && advance.isCancelled) {
      return NextResponse.json({ error: "This advance is already cancelled" }, { status: 400 });
    }
    if (action === "reinstate" && !advance.isCancelled) {
      return NextResponse.json({ error: "This advance is not cancelled" }, { status: 400 });
    }

    const nextCancelled = action === "cancel";

    if (advance.direction === "OUT" && action === "cancel") {
      const inCount = await Advance.countDocuments({
        receivableId: advance.receivableId,
        direction: "IN",
        isCancelled: { $ne: true },
      });
      if (inCount > 0) {
        return NextResponse.json(
          {
            error:
              "Recoveries already exist against this advance — cancel or reverse those first, or this would strand them.",
          },
          { status: 400 },
        );
      }
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        advance.isCancelled = nextCancelled;
        advance.log.push({
          action: "Cancelled",
          previousValue: String(!nextCancelled),
          newValue: String(nextCancelled),
          note: note || (nextCancelled ? "Cancelled" : "Reinstated"),
          performedBy,
          performedAt: new Date(),
        });
        // Saved BEFORE the resync below — resyncReceivableTotal re-aggregates the Advance
        // collection by isCancelled, on this same session, so it must see this row's own new
        // isCancelled value or it will count (or fail to count) itself.
        await advance.save({ session: dbSession });

        if (advance.direction === "OUT") {
          await resyncReceivableTotal({
            receivableId: advance.receivableId,
            session: dbSession,
            performedBy,
            note: note || `Advance row ${advance._id} ${action}led`,
          });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({
      message: nextCancelled ? "Advance cancelled" : "Advance reinstated",
      advance,
    });
  } catch (error) {
    console.error("Error updating advance:", error);
    return NextResponse.json({ error: "Failed to update advance" }, { status: 500 });
  }
}

// Edits the row's own fields — amount, date, account, branch, reference, remarks, receipts.
// direction and receivableId are structural and never change here — see the identical note in
// /api/borrowings/[id]'s PUT.
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
    const advance = found.advance;

    if (advance.isCancelled) {
      return NextResponse.json({ error: "Reinstate this advance before editing it" }, { status: 400 });
    }

    const body = await req.json();
    const { amount, date, account, branch, reference, remarks, receipts, allowOverRecovery } = body;

    if (account !== undefined && !ACCOUNTS.includes(account)) {
      return NextResponse.json({ error: `account must be one of: ${ACCOUNTS.join(", ")}` }, { status: 400 });
    }
    if (branch && !ALL_BRANCHES.includes(branch)) {
      return NextResponse.json({ error: `branch must be one of: ${ALL_BRANCHES.join(", ")}` }, { status: 400 });
    }
    const parsedAmount = amount !== undefined ? parseFloat(amount) : advance.amount;
    if (!(parsedAmount > 0)) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    const nextAccount = account ?? advance.account;
    const nextDate = date ? new Date(date) : advance.date;
    const lockReason = await checkPeriodLock(
      { furtherMode: advance.account, date: advance.date },
      { furtherMode: nextAccount, date: nextDate },
    );
    if (lockReason) {
      return NextResponse.json({ error: lockReason, periodLocked: true }, { status: 423 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };
    const amountChanged = parsedAmount !== advance.amount;

    if (advance.direction === "IN" && amountChanged) {
      const [recoveredAgg] = await Advance.aggregate([
        { $match: { receivableId: advance.receivableId, direction: "IN", isCancelled: { $ne: true }, _id: { $ne: advance._id } } },
        { $group: { _id: null, recovered: { $sum: "$amount" } } },
      ]);
      const receivable = await Receivable.findById(advance.receivableId).lean();
      const pendingExcludingThis = Math.max(0, Math.round(((receivable?.totalAmount || 0) - (recoveredAgg?.recovered || 0)) * 100) / 100);
      if (parsedAmount > pendingExcludingThis && !allowOverRecovery) {
        return NextResponse.json(
          {
            error: `That amount would exceed the outstanding balance of ₹${pendingExcludingThis.toLocaleString("en-IN")}. Pass allowOverRecovery to save it anyway.`,
            pending: pendingExcludingThis,
          },
          { status: 400 },
        );
      }
    }

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const previousAmount = advance.amount;
        advance.amount = parsedAmount;
        if (account !== undefined) advance.account = account;
        if (date) advance.date = nextDate;
        if (branch !== undefined) advance.branch = branch || null;
        if (reference !== undefined) advance.reference = reference;
        if (remarks !== undefined) advance.remarks = remarks;
        if (Array.isArray(receipts)) advance.receipts = receipts;

        if (amountChanged) {
          advance.log.push({
            action: "Amount Revised",
            previousValue: String(previousAmount),
            newValue: String(parsedAmount),
            performedBy,
            performedAt: new Date(),
          });
        }

        // Saved BEFORE the resync below — same reason as PATCH above.
        await advance.save({ session: dbSession });

        if (amountChanged && advance.direction === "OUT") {
          await resyncReceivableTotal({
            receivableId: advance.receivableId,
            session: dbSession,
            performedBy,
            note: `Advance row ${advance._id} amount edited`,
          });
        }
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({ message: "Advance updated", advance });
  } catch (error) {
    console.error("Error editing advance:", error);
    return NextResponse.json({ error: "Failed to edit advance" }, { status: 500 });
  }
}

// Hard delete — refused unless the row is ALREADY cancelled, same guard and reasoning as
// /api/borrowings/[id]'s DELETE.
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
    const advance = found.advance;

    if (!advance.isCancelled) {
      return NextResponse.json(
        { error: "Cancel this advance before deleting it — deleting an active row would silently drop its effect on the receivable." },
        { status: 400 },
      );
    }

    await Advance.deleteOne({ _id: advance._id });

    return NextResponse.json({ message: "Advance deleted" });
  } catch (error) {
    console.error("Error deleting advance:", error);
    return NextResponse.json({ error: "Failed to delete advance" }, { status: 500 });
  }
}
