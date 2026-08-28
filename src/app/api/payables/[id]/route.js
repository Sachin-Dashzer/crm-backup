import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import Advance from "@/models/Advance";
import DeleteLog from "@/models/DeleteLog";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Single-payable read, computed the exact same way the list/summary routes are — see
// buildPayableAggregationStages. Used by the transaction detail view to show "current pending"
// on a linked payable without duplicating the aggregation.
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid payable ID" }, { status: 400 });
    }

    const [payable] = await Payable.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      ...buildPayableAggregationStages(Transactions.collection.name),
    ]);
    if (!payable) {
      return NextResponse.json({ error: "Payable not found" }, { status: 404 });
    }

    return NextResponse.json({ payable });
  } catch (error) {
    console.error("Error fetching payable:", error);
    return NextResponse.json({ error: "Failed to fetch payable" }, { status: 500 });
  }
}

// Revises totalAmount / dueDate, or cancels a Payable (soft-close via
// isCancelled — never hard-deleted). Every change appends to log[]; existing
// log entries are never edited or removed.
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const { totalAmount, dueDate, isCancelled, note, cascadeTds } = await req.json();

    const payable = await Payable.findById(id);
    if (!payable) {
      return NextResponse.json({ error: "Payable not found" }, { status: 404 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    if (totalAmount != null && parseFloat(totalAmount) !== payable.totalAmount) {
      payable.log.push({
        action: "Amount Revised",
        previousValue: String(payable.totalAmount),
        newValue: String(parseFloat(totalAmount)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      payable.totalAmount = parseFloat(totalAmount);
    }

    if (dueDate !== undefined) {
      const newDue = dueDate ? new Date(dueDate) : null;
      const prevDue = payable.dueDate ? payable.dueDate.toISOString() : null;
      const nextDue = newDue ? newDue.toISOString() : null;
      if (prevDue !== nextDue) {
        payable.log.push({
          action: "Due Date Changed",
          previousValue: prevDue || "none",
          newValue: nextDue || "none",
          note,
          performedBy,
          performedAt: new Date(),
        });
        payable.dueDate = newDue;
      }
    }

    let linkedTdsPayable = null;
    if (isCancelled === true && !payable.isCancelled) {
      // §4.4 — refuse to cancel a payable an open advance is settling (settlesPayableId — see
      // src/models/Advance.js). The advance's own paid/pending netting depends on this payable
      // still claiming to be owed; cancelling it out from under an open settlement would strand
      // that link with nothing left to net against.
      const settlingAdvance = await Advance.findOne({
        settlesPayableId: payable._id,
        isCancelled: { $ne: true },
      });
      if (settlingAdvance) {
        return NextResponse.json(
          {
            error:
              `An open advance (₹${settlingAdvance.amount.toLocaleString("en-IN")} to ` +
              `${settlingAdvance.party?.label || "a party"}) is settling this payable. Unsettle it first.`,
          },
          { status: 409 },
        );
      }

      // Never silently orphan a linked TDS payable — require explicit confirmation to cascade.
      if (payable.tdsLink?.role === "PARENT" && payable.tdsLink?.linkedId) {
        const linked = await Payable.findById(payable.tdsLink.linkedId);
        if (linked && !linked.isCancelled) {
          if (!cascadeTds) {
            return NextResponse.json(
              {
                error:
                  "This payable has a linked TDS payable. Pass cascadeTds: true to cancel both, or handle the TDS payable separately.",
                linkedTdsPayableId: linked._id,
                requiresCascadeConfirmation: true,
              },
              { status: 409 },
            );
          }
          linked.isCancelled = true;
          linked.log.push({
            action: "Cancelled",
            previousValue: "false",
            newValue: "true",
            note: note || `Cascaded from linked payable ${payable._id}`,
            performedBy,
            performedAt: new Date(),
          });
          await linked.save();
          linkedTdsPayable = linked;
        }
      }

      payable.isCancelled = true;
      payable.log.push({
        action: "Cancelled",
        previousValue: "false",
        newValue: "true",
        note,
        performedBy,
        performedAt: new Date(),
      });
    } else if (isCancelled === false && payable.isCancelled) {
      payable.isCancelled = false;
      payable.log.push({
        action: "Cancelled",
        previousValue: "true",
        newValue: "false",
        note: note || "Reinstated",
        performedBy,
        performedAt: new Date(),
      });
    }

    if (note && totalAmount == null && dueDate === undefined && isCancelled === undefined) {
      payable.log.push({
        action: "Note Added",
        note,
        performedBy,
        performedAt: new Date(),
      });
    }

    await payable.save();

    return NextResponse.json({ message: "Payable updated", payable, linkedTdsPayable });
  } catch (error) {
    console.error("Error updating payable:", error);
    return NextResponse.json({ error: "Failed to update payable" }, { status: 500 });
  }
}

// Hard-deletes a Payable, recording it in DeleteLog first so the removal is auditable.
//
// REFUSES when money has already been paid against it: those transactions carry payableId and
// are what the paid/pending aggregation sums, so deleting the document they point at would
// strand them — the payments stay on the books while the obligation they settled disappears.
// Cancelling (PATCH isCancelled) is the reversible route; this is for entries created in error.
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid payable ID" }, { status: 400 });
    }

    const payable = await Payable.findById(id);
    if (!payable) {
      return NextResponse.json({ error: "Payable not found" }, { status: 404 });
    }

    const linked = await Transactions.countDocuments({ payableId: payable._id });
    if (linked > 0) {
      return NextResponse.json(
        {
          error:
            `${linked} payment(s) have already been made against this payable. ` +
            `Delete or re-link those first, or cancel this payable instead — deleting it now ` +
            `would leave those payments pointing at nothing.`,
        },
        { status: 409 },
      );
    }

    // A "Borrowings" payable's rows (the IN that raised it, every repayment OUT) live in the
    // Borrowing collection, not Transactions — the check above never sees them. Without this,
    // a loan with real activity could be hard-deleted here, leaving every Borrowing row pointing
    // at a payableId that no longer exists. See src/models/Borrowing.js.
    const { default: Borrowing } = await import("@/models/Borrowing");
    const linkedBorrowings = await Borrowing.countDocuments({ payableId: payable._id });
    if (linkedBorrowings > 0) {
      return NextResponse.json(
        {
          error:
            `${linkedBorrowings} borrowing row(s) are recorded against this loan. ` +
            `Cancel those first (see /admin/financing), or cancel this payable instead of ` +
            `deleting it — deleting it now would leave those rows pointing at nothing.`,
        },
        { status: 409 },
      );
    }

    await DeleteLog.create({
      entityType: "Payable",
      entityId: String(payable._id),
      entityName: payable.payee?.label || "Payable",
      entityDetails: {
        purpose: payable.purpose,
        expenseCategory: payable.expenseCategory,
        expenseSubType: payable.expenseSubType,
        totalAmount: payable.totalAmount,
        branch: payable.branch,
        payeeKind: payable.payee?.kind,
        remarks: payable.remarks,
        createdBy: payable.createdBy?.name,
      },
      deletedBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
      },
      branch: payable.branch,
    });

    await payable.deleteOne();

    return NextResponse.json({ message: "Payable deleted" });
  } catch (error) {
    console.error("Error deleting payable:", error);
    return NextResponse.json({ error: "Failed to delete payable" }, { status: 500 });
  }
}
