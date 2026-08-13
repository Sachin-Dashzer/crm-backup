import mongoose from "mongoose";
import Transactions from "@/models/Transactions";
import CollabCase from "@/models/CollabCase";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { deriveClinicSettlement } from "@/lib/collabFormula";

// THE formula lives in src/lib/collabFormula.js (dependency-free) so the client
// form imports the identical function for its live preview. Re-exported here so
// server-side callers have one obvious import.
//
// Worked examples (the three rows the spec requires, and the three cases the
// verification script exercises end to end):
//   paid us 50k:      0     - 20000 = -20000 -> Payable    20,000
//   paid clinic 50k:  50000 - 20000 =  30000 -> Receivable 30,000
//   split 20k/30k:    30000 - 20000 =  10000 -> Receivable 10,000
export { deriveClinicSettlement };

// Maps a procedure onto the same transactionCategory the transplant/service
// routes derive, so collab revenue reports identically to direct revenue.
const TRANSPLANT_PROCEDURES = ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"];
const SERVICE_PROCEDURES = ["PRP", "GFC", "Alopecia", "Headwash", "Canacot"];

function categoryForProcedure(procedure) {
  if (TRANSPLANT_PROCEDURES.includes(procedure)) return "TRANSPLANT";
  if (SERVICE_PROCEDURES.includes(procedure)) return "SERVICE";
  if (procedure === "Medicine") return "MEDICINE";
  return "TRANSPLANT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Atomic creation.
//
// ATOMICITY APPROACH: MongoDB sessions/transactions. Verified empirically against
// this deployment rather than assumed — the Atlas cluster reports replica set
// "atlas-ool7b4-shard-0", and a probe confirmed both a committed multi-document
// transaction and a rolled-back aborted one. Because a real replica set is
// present, compensating deletes are unnecessary and would be strictly worse:
// they leave a window where a crash between insert and compensation orphans the
// transaction, which is exactly the silent corruption this guards against.
//
// If this ever gets pointed at a standalone mongod, withTransaction throws
// IllegalOperation rather than silently degrading — the error is surfaced, not
// swallowed, so the failure is loud instead of leaving half-written books.
// ─────────────────────────────────────────────────────────────────────────────
export async function createCollabCaseAtomic({
  patientId,
  patientName,
  clinic,
  procedure,
  totalPackage,
  ourShare,
  clinicShare,
  ourReceived,
  clinicReceived,
  method,
  date,
  remarks,
  actor, // { name, email, branch }
}) {
  // Defence in depth: the schema enum and the API layer both check this too. A
  // main-branch value must never reach a collab collection.
  if (!COLLAB_BRANCHES.includes(clinic)) {
    throw new Error(`"${clinic}" is not a collab clinic branch`);
  }

  const settlement = deriveClinicSettlement({ clinicReceived, clinicShare });
  const createdBy = { ...actor, date: new Date() };
  const performedBy = { name: actor?.name, email: actor?.email };
  const when = date ? new Date(date) : new Date();

  const created = { collabCase: null, transaction: null, payable: null, receivable: null };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. The case record (metadata: who, which clinic, what package).
      const [collabCase] = await CollabCase.create(
        [
          {
            patient: patientId,
            clinic,
            packageAmount: totalPackage,
            clinicShare,
            procedure,
            remarks: remarks || "",
            createdBy,
            log: [
              {
                action: "Created",
                newValue: String(totalPackage),
                note: `Split — ours ${ourShare}, clinic ${clinicShare}; collected — us ${ourReceived}, clinic ${clinicReceived}`,
                performedBy,
                performedAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );
      created.collabCase = collabCase;

      // 2. GROSS revenue transaction — the full package, never the net margin.
      //    Deliberately NOT pushed onto Patient.payments.transactions: money the
      //    patient handed the partner clinic must not advance the patient's
      //    payment status until the clinic settles (see Patient.payments rule).
      const [transaction] = await Transactions.create(
        [
          {
            transactionCategory: categoryForProcedure(procedure),
            costType: "Revenue",
            patient: patientId,
            procedure,
            amount: totalPackage,
            method: method || "cash",
            branch: clinic,
            date: when,
            remarks: remarks || "",
            approvalStatus: "APPROVED",
            collabSplit: { ourShare, clinicShare, ourReceived, clinicReceived },
            collabRef: { caseId: collabCase._id },
            createdBy,
          },
        ],
        { session },
      );
      created.transaction = transaction;

      // 3. Whatever the formula says follows from the actual numbers — never
      //    from a UI checkbox.
      if (settlement.kind === "RECEIVABLE") {
        const [receivable] = await Receivable.create(
          [
            {
              payer: { kind: "COLLAB_CLINIC", label: clinic },
              purpose: "COLLAB_SETTLEMENT",
              revenueCategory: categoryForProcedure(procedure),
              relatedPatient: patientId,
              totalAmount: settlement.amount,
              branch: clinic,
              remarks: `Collab settlement — ${clinic} collected ${clinicReceived} against a ${clinicShare} share for ${patientName || "patient"}`,
              createdBy,
              log: [
                {
                  action: "Created",
                  newValue: String(settlement.amount),
                  note: `Derived: clinicReceived ${clinicReceived} - clinicShare ${clinicShare}`,
                  performedBy,
                  performedAt: new Date(),
                },
              ],
            },
          ],
          { session },
        );
        created.receivable = receivable;
        transaction.collabRef.receivableId = receivable._id;
        await transaction.save({ session });
      } else if (settlement.kind === "PAYABLE") {
        const [payable] = await Payable.create(
          [
            {
              payee: { kind: "COLLAB_CLINIC", label: clinic },
              purpose: "COLLAB_CLINIC",
              expenseCategory: "Collab Clinic Payment",
              expenseSubType: "Collab Clinic Payment",
              relatedPatient: patientId,
              totalAmount: settlement.amount,
              branch: clinic,
              remarks: `Collab settlement — ${clinic} collected ${clinicReceived} against a ${clinicShare} share for ${patientName || "patient"}`,
              createdBy,
              log: [
                {
                  action: "Created",
                  newValue: String(settlement.amount),
                  note: `Derived: clinicShare ${clinicShare} - clinicReceived ${clinicReceived}`,
                  performedBy,
                  performedAt: new Date(),
                },
              ],
            },
          ],
          { session },
        );
        created.payable = payable;
        transaction.collabRef.payableId = payable._id;
        await transaction.save({ session });
      }

      // Back-link the case to whichever document carries the clinic balance.
      if (created.payable) {
        collabCase.clinicSharePayable = created.payable._id;
        await collabCase.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }

  return {
    ...created,
    settlement,
    // Exact statement of what landed, for the caller to report back.
    summary: {
      collabCaseId: created.collabCase?._id,
      transactionId: created.transaction?._id,
      payableId: created.payable?._id || null,
      receivableId: created.receivable?._id || null,
      derived: settlement.kind,
      derivedAmount: settlement.amount,
    },
  };
}
