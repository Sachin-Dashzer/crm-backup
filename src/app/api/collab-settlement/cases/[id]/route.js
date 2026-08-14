import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import CollabCase from "@/models/CollabCase";
import CollabSettlement from "@/models/CollabSettlement";
import Transactions from "@/models/Transactions";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import DeleteLog from "@/models/DeleteLog";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Revises packageAmount / clinicShare, or cancels a case. Every change
// appends to log[]; existing log entries are never edited or removed.
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
    const { packageAmount, clinicShare, isCancelled, note } = await req.json();

    const collabCase = await CollabCase.findById(id);
    if (!collabCase) {
      return NextResponse.json({ error: "Collab case not found" }, { status: 404 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    if (packageAmount != null && parseFloat(packageAmount) !== collabCase.packageAmount) {
      collabCase.log.push({
        action: "Package Revised",
        previousValue: String(collabCase.packageAmount),
        newValue: String(parseFloat(packageAmount)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      collabCase.packageAmount = parseFloat(packageAmount);
    }

    if (clinicShare != null && parseFloat(clinicShare) !== collabCase.clinicShare) {
      collabCase.log.push({
        action: "Share Revised",
        previousValue: String(collabCase.clinicShare),
        newValue: String(parseFloat(clinicShare)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      collabCase.clinicShare = parseFloat(clinicShare);
    }

    if (isCancelled === true && collabCase.status !== "CANCELLED") {
      collabCase.status = "CANCELLED";
      collabCase.log.push({
        action: "Cancelled",
        previousValue: collabCase.status,
        newValue: "CANCELLED",
        note,
        performedBy,
        performedAt: new Date(),
      });
    } else if (isCancelled === false && collabCase.status === "CANCELLED") {
      collabCase.status = "OPEN";
      collabCase.log.push({
        action: "Note Added",
        note: note || "Reinstated",
        performedBy,
        performedAt: new Date(),
      });
    }

    if (note && packageAmount == null && clinicShare == null && isCancelled === undefined) {
      collabCase.log.push({
        action: "Note Added",
        note,
        performedBy,
        performedAt: new Date(),
      });
    }

    await collabCase.save();

    return NextResponse.json({ message: "Collab case updated", collabCase });
  } catch (error) {
    console.error("Error updating collab case:", error);
    return NextResponse.json({ error: "Failed to update collab case" }, { status: 500 });
  }
}

// Hard-deletes a collab case along with everything createCollabCaseAtomic generated for it:
// the gross revenue transaction, the clinic-share expense, and the Payable/Receivable that
// carries the clinic balance. Those exist only to represent this case — leaving any of them
// behind would keep revenue or a clinic balance on the books with no case explaining it.
//
// REFUSES when a settlement has already been allocated against this case: the settlement is a
// real money movement with its own transactions, and deleting the case underneath it would
// leave that settlement pointing at nothing. Delete the settlement first.
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
      return NextResponse.json({ error: "Invalid case ID" }, { status: 400 });
    }

    const collabCase = await CollabCase.findById(id);
    if (!collabCase) {
      return NextResponse.json({ error: "Collab case not found" }, { status: 404 });
    }

    const settledAgainst = await CollabSettlement.countDocuments({ "coveredCases.case": collabCase._id });
    if (settledAgainst > 0) {
      return NextResponse.json(
        {
          error:
            `${settledAgainst} settlement(s) have already been allocated against this case. ` +
            `Delete those settlements first — removing the case now would leave them pointing ` +
            `at nothing.`,
        },
        { status: 409 },
      );
    }

    // Everything this case spawned, found by its own back-reference rather than by re-deriving
    // the amounts — collabRef.caseId is set on both transactions at creation time.
    const linkedTx = await Transactions.find({ "collabRef.caseId": collabCase._id })
      .select("transactionCategory costType amount date collabRef")
      .lean();

    const payableIds = [
      collabCase.clinicSharePayable,
      ...linkedTx.map((t) => t.collabRef?.payableId).filter(Boolean),
    ].filter(Boolean);
    const receivableIds = linkedTx.map((t) => t.collabRef?.receivableId).filter(Boolean);

    await DeleteLog.create({
      entityType: "CollabSettlement",
      entityId: String(collabCase._id),
      entityName: `Collab case — ${collabCase.clinic}`,
      entityDetails: {
        kind: "CollabCase",
        clinic: collabCase.clinic,
        procedure: collabCase.procedure,
        packageAmount: collabCase.packageAmount,
        clinicShare: collabCase.clinicShare,
        status: collabCase.status,
        patient: String(collabCase.patient || ""),
        clinicCollections: (collabCase.clinicCollections || []).map((c) => ({
          amount: c.amount,
          date: c.date,
          mode: c.mode,
        })),
        deletedTransactions: linkedTx.map((t) => ({
          id: String(t._id),
          category: t.transactionCategory,
          costType: t.costType,
          amount: t.amount,
          date: t.date,
        })),
        deletedPayables: payableIds.map(String),
        deletedReceivables: receivableIds.map(String),
        createdBy: collabCase.createdBy?.name,
      },
      deletedBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
      },
      branch: collabCase.clinic,
    });

    // Session-wrapped for the same reason createCollabCaseAtomic writes them together: a case
    // must never be removed while the revenue, expense or clinic balance it created survives.
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        if (linkedTx.length) {
          await Transactions.deleteMany(
            { _id: { $in: linkedTx.map((t) => t._id) } },
            { session: dbSession },
          );
        }
        if (payableIds.length) {
          await Payable.deleteMany({ _id: { $in: payableIds } }, { session: dbSession });
        }
        if (receivableIds.length) {
          await Receivable.deleteMany({ _id: { $in: receivableIds } }, { session: dbSession });
        }
        await CollabCase.deleteOne({ _id: collabCase._id }, { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({
      message: "Collab case deleted",
      deletedTransactions: linkedTx.length,
      deletedPayables: payableIds.length,
      deletedReceivables: receivableIds.length,
    });
  } catch (error) {
    console.error("Error deleting collab case:", error);
    return NextResponse.json({ error: "Failed to delete collab case" }, { status: 500 });
  }
}
