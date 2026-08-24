import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import CollabCase from "@/models/CollabCase";
import CollabSettlement from "@/models/CollabSettlement";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import DeleteLog from "@/models/DeleteLog";
import { reverseTransaction, ReversalError } from "@/lib/reverseTransaction";

const ALLOWED_ROLES = ["admin", "super-admin"];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

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
      // §2.4 — refuse outright if a real settlement has already been allocated against this
      // case (mirrors DELETE's own guard below): a WE_PAID/THEY_PAID settlement moved real cash
      // against this case's Payable/Receivable, and blindly reversing everything underneath it
      // would strand that settlement pointing at nothing.
      const settledAgainst = await CollabSettlement.countDocuments({
        "coveredCases.case": collabCase._id,
      });
      if (settledAgainst > 0) {
        return NextResponse.json(
          {
            error:
              `${settledAgainst} settlement(s) have already been allocated against this case. ` +
              `Delete those settlements first — cancelling the case now would leave them ` +
              `pointing at nothing.`,
          },
          { status: 409 },
        );
      }

      const reason = note && note.trim() ? note.trim() : "Collab case cancelled";

      const dbSession = await mongoose.startSession();
      let reversedCount = 0;
      try {
        await dbSession.withTransaction(async () => {
          // Every transaction this case's own money-collection path generated — both
          // createCollabCaseAtomic (at creation) and recordCollabCollectionAtomic (every later
          // instalment): the gross-package booking never happens any more, so this is the case's
          // complete revenue/expense trail. The settlementId filter is defence in depth — the
          // upfront count above already refuses before any settlement-linked transaction could
          // reach here.
          const linkedTx = await Transactions.find({
            "collabRef.caseId": collabCase._id,
            "collabRef.settlementId": { $exists: false },
            reversalOf: { $exists: false },
            isReversed: { $ne: true },
          }).session(dbSession);

          for (const tx of linkedTx) {
            const result = await reverseTransaction({
              transactionId: tx._id,
              reason,
              remarks: `Collab case ${collabCase._id} cancelled`,
              actor: performedBy,
              dbSession,
            });
            reversedCount += 1;

            // reverseTransaction unconditionally unwinds Patient.payments.amountReceived for any
            // Revenue transaction that carries a patient — correct for a collectedBy:"US" row
            // (createCollectionTransaction advances it exactly like a direct payment), but a
            // collectedBy:"CLINIC" row (method: paid_to_external) never touched Patient.payments
            // in the first place — see collabDerivation.js's §2.1 split, collab money only
            // reaches the patient's own record via the US branch. Undo the wrongly-applied
            // decrement so a clinic-collected reversal doesn't understate a patient who never
            // actually received that money from us.
            if (tx.method === "paid_to_external" && tx.costType === "Revenue" && tx.patient) {
              const patient = await Patient.findById(tx.patient).session(dbSession);
              if (patient) {
                patient.payments = patient.payments || {};
                patient.payments.amountReceived = round2(
                  (patient.payments.amountReceived || 0) + result.requested,
                );
                const total = patient.payments.totalAmount || patient.counselling?.finlpackage || 0;
                patient.payments.pendingAmount = Math.max(
                  0,
                  round2(total - patient.payments.amountReceived - (patient.payments.discount || 0)),
                );
                await patient.save({ session: dbSession });
              }
            }
          }

          // The clinic's fixed fee (and, if the clinic over-collected, its Receivable) no longer
          // means anything once the case is cancelled — soft-cancel both, same as
          // cascadeIntegrity.js does for every other flow (never hard-delete: the audit trail is
          // the point). Safe unconditionally here — the settledAgainst check above already
          // refused if either had a real settlement against it.
          if (collabCase.clinicSharePayable) {
            const payable = await Payable.findById(collabCase.clinicSharePayable).session(dbSession);
            if (payable && !payable.isCancelled) {
              payable.isCancelled = true;
              payable.log.push({
                action: "Cancelled",
                previousValue: "false",
                newValue: "true",
                note: `Collab case ${collabCase._id} was cancelled`,
                performedBy,
                performedAt: new Date(),
              });
              await payable.save({ session: dbSession });
            }
          }
          if (collabCase.clinicShareReceivable) {
            const receivable = await Receivable.findById(collabCase.clinicShareReceivable).session(
              dbSession,
            );
            if (receivable && !receivable.isCancelled) {
              receivable.isCancelled = true;
              receivable.log.push({
                action: "Cancelled",
                previousValue: "false",
                newValue: "true",
                note: `Collab case ${collabCase._id} was cancelled`,
                performedBy,
                performedAt: new Date(),
              });
              await receivable.save({ session: dbSession });
            }
          }

          collabCase.status = "CANCELLED";
          collabCase.log.push({
            action: "Cancelled",
            previousValue: "OPEN",
            newValue: "CANCELLED",
            note: note || `Reversed ${linkedTx.length} linked transaction(s)`,
            performedBy,
            performedAt: new Date(),
          });
          await collabCase.save({ session: dbSession });
        });
      } catch (err) {
        if (err instanceof ReversalError) {
          return NextResponse.json(err.body, { status: err.status });
        }
        throw err;
      } finally {
        await dbSession.endSession();
      }

      return NextResponse.json({
        message: "Collab case cancelled",
        reversedTransactions: reversedCount,
        collabCase,
      });
    }

    if (isCancelled === false && collabCase.status === "CANCELLED") {
      // Reinstating only flips status back — it does NOT recreate whatever was reversed above.
      // Any money still owed has to be recorded fresh as a new collection.
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
      .select("transactionCategory costType amount date method receivableId collabRef")
      .lean();

    // Money collected DIRECTLY BY US advances the patient's own payment record at creation/
    // collection time (see createCollectionTransaction's collectedBy:"US" branch) — deleting the
    // case that recorded it must reverse that too, or the patient permanently shows money
    // "received" with no transaction left to back it up. Two kinds of Revenue row are excluded
    // here, neither of which ever touched Patient.payments: a collectedBy:"CLINIC" row
    // (method: "paid_to_external") and topUpClinicShare's own offset_settlement contra against
    // the collab Receivable (receivableId set — see collabDerivation.js). collabSplit is no
    // longer set on any transaction under the current write path, so this can no longer be read
    // off collabSplit.ourReceived the way it was before that fix.
    const ourReceivedTotal = linkedTx.reduce(
      (sum, t) =>
        sum +
        (t.costType === "Revenue" && t.method !== "paid_to_external" && !t.receivableId
          ? t.amount || 0
          : 0),
      0,
    );

    const payableIds = [
      collabCase.clinicSharePayable,
      ...linkedTx.map((t) => t.collabRef?.payableId).filter(Boolean),
    ].filter(Boolean);
    // Read off the case itself, not off any transaction's collabRef.receivableId — no
    // transaction claims to "own" this receivable any more (see collabDerivation.js: it's one
    // shared, resizable document fed by potentially many collections, not a 1:1 creator link).
    const receivableIds = [collabCase.clinicShareReceivable].filter(Boolean);

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
        if (ourReceivedTotal > 0 && collabCase.patient) {
          const patient = await Patient.findById(collabCase.patient).session(dbSession);
          if (patient) {
            patient.payments = patient.payments || {};
            patient.payments.amountReceived = Math.max(
              0,
              Math.round(((patient.payments.amountReceived || 0) - ourReceivedTotal) * 100) / 100,
            );
            patient.payments.transactions = (patient.payments.transactions || []).filter(
              (txId) => !linkedTx.some((t) => String(t._id) === String(txId)),
            );
            const total = patient.payments.totalAmount || patient.counselling?.finlpackage || 0;
            patient.payments.pendingAmount = Math.max(
              0,
              total - patient.payments.amountReceived - (patient.payments.discount || 0),
            );
            await patient.save({ session: dbSession });
          }
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
