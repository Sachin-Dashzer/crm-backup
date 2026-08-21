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
  return "SERVICE"; // "Other" / unmatched — generic fallback, never TRANSPLANT by default
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
  discount = 0,
  ourShare,
  clinicShare,
  ourReceived,
  clinicReceived,
  method,
  receiptMode,
  furtherMode,
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

  const created = {
    collabCase: null,
    transaction: null,
    clinicShareExpense: null,
    payable: null,
    receivable: null,
  };

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
            discount: discount || 0,
            method: method || "cash",
            receiptMode: receiptMode || "",
            furtherMode: furtherMode || "",
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

      // 2b. The clinic-share EXPENSE that makes the gross booking above net out
      //     correctly. Without it a 50,000 package booked 50,000 revenue and no
      //     cost at all, so every report read the clinic's share as our profit
      //     (see the collabSplit comment in src/models/Transactions.js: "a 50,000
      //     package books 50,000 revenue and a 20,000 clinic-share expense —
      //     net margin 30,000").
      //
      //     Only the part the clinic has ALREADY taken is booked here, i.e. what
      //     it kept out of money it collected itself:
      //
      //         settledNow = min(clinicReceived, clinicShare)
      //
      //     The remainder is money we still owe the clinic; that becomes the
      //     Payable below and is expensed when it is actually paid, by the
      //     WE_PAID branch of settlements/create. Booking the full clinicShare
      //     here instead would double-count it against that later payment.
      //
      //       paid us 50k      -> min(0, 20k)     = 0      (all 20k via Payable)
      //       paid clinic 50k  -> min(50k, 20k)   = 20k    (nothing left to pay)
      //       split 20k/30k    -> min(30k, 20k)   = 20k    (nothing left to pay)
      //       clinic got 5k    -> min(5k, 20k)    = 5k     (15k via Payable)
      //
      //     method "offset_settlement" is load-bearing: no money left one of our
      //     accounts, the clinic simply kept cash it was holding. It is in
      //     NON_CASH_METHODS (src/constants/bankRouting.js) so this never moves an
      //     account balance, and furtherMode is deliberately left blank for the
      //     same reason.
      const clinicSettledNow = Math.min(Number(clinicReceived) || 0, Number(clinicShare) || 0);
      if (clinicSettledNow > 0) {
        const [clinicShareExpense] = await Transactions.create(
          [
            {
              transactionCategory: "EXPENSE",
              costType: "Expenses",
              expense: "Collab Clinic Payment",
              expenseType: "Collab Clinic Payment",
              expenseGiver: { type: "MANUAL", name: clinic },
              amount: clinicSettledNow,
              method: "offset_settlement",
              branch: clinic,
              date: when,
              remarks: `Clinic share retained by ${clinic} from collections for ${patientName || "patient"}`,
              approvalStatus: "APPROVED",
              collabRef: { caseId: collabCase._id },
              createdBy,
            },
          ],
          { session },
        );
        created.clinicShareExpense = clinicShareExpense;
      }

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
              // Step 2 above already booked the GROSS package as revenue, so the money the
              // clinic is holding for us has been counted. Collecting it later moves cash for
              // revenue already recognised — flagged so that receipt is excluded from P&L.
              costAlreadyRecognised: true,
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
              // Deliberately false, and the asymmetry with the RECEIVABLE branch above is the
              // point: step 2b expenses ONLY what the clinic already kept (clinicSettledNow).
              // This payable is the REMAINDER, which is expensed when it is actually paid — see
              // the comment there. Flagging it recognised would drop that payment from expense
              // totals with nothing else ever counting it.
              costAlreadyRecognised: false,
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

      // Back-link the case to whichever document carries the clinic balance, so a later
      // CollabSettlement can find and settle it (see settlements/create/route.js) instead of
      // having no way to locate it at all.
      if (created.payable) {
        collabCase.clinicSharePayable = created.payable._id;
        await collabCase.save({ session });
      } else if (created.receivable) {
        collabCase.clinicShareReceivable = created.receivable._id;
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
      clinicShareExpenseId: created.clinicShareExpense?._id || null,
      clinicShareExpensed: created.clinicShareExpense?.amount || 0,
      payableId: created.payable?._id || null,
      receivableId: created.receivable?._id || null,
      derived: settlement.kind,
      derivedAmount: settlement.amount,
    },
  };
}
