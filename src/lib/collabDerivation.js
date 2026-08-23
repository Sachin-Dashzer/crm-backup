import mongoose from "mongoose";
import Transactions from "@/models/Transactions";
import CollabCase from "@/models/CollabCase";
import Patient from "@/models/Patient";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { deriveClinicSettlement } from "@/lib/collabFormula";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";

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
  paymentId,
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
      //    Not pushed onto Patient.payments.transactions here — money the patient handed
      //    the partner clinic must not advance the patient's payment status until the
      //    clinic settles (see Patient.payments rule). Money collected DIRECTLY BY US is
      //    handled separately in step 2c below, since that reasoning doesn't apply to it —
      //    we already physically hold that cash, same as any normal payment.
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
            paymentId: paymentId || "",
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

      // 2c. The ourReceived portion is money we already physically hold — exactly like any
      // normal transplant/service payment — so it must advance the patient's own payment
      // record the same way, or the patient permanently shows full pendingAmount despite
      // having actually paid (only visible here, on the collab side, not on their own
      // profile/dashboard/status, which all read Patient.payments). Only ourReceived; money
      // the clinic holds is deliberately left untouched until it's actually settled (see the
      // comment on step 2 above). Mirrors reverseTransaction.js's identical pattern: recompute
      // pendingAmount explicitly here rather than relying on the Patient pre-save hook, which
      // only auto-derives it when counselling.finlpackage is set.
      if (ourReceived > 0) {
        const patient = await Patient.findById(patientId).session(session);
        if (patient) {
          patient.payments = patient.payments || {};
          patient.payments.amountReceived =
            Math.round(((patient.payments.amountReceived || 0) + ourReceived) * 100) / 100;
          patient.payments.transactions = patient.payments.transactions || [];
          patient.payments.transactions.push(transaction._id);
          const total = patient.payments.totalAmount || patient.counselling?.finlpackage || 0;
          patient.payments.pendingAmount = Math.max(
            0,
            total - patient.payments.amountReceived - (patient.payments.discount || 0),
          );
          await patient.save({ session });
        }
      }

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

// ─────────────────────────────────────────────────────────────────────────────
// Appends a clinicCollections entry (money the PATIENT paid DIRECTLY TO THE PARTNER CLINIC)
// and keeps the case's own Payable/Receivable — the obligation BETWEEN THE CLINIC AND US —
// resized to match. Deliberately does NOT create a settling payment: recording that the
// patient paid the clinic does not establish that the clinic has forwarded that money to us:
// that is a separate real event (see settlements/create/route.js's "Settle" flow). Called by
// cases/[id]/collection/route.js; separated out (same reasoning as createCollabCaseAtomic) so
// it can be exercised directly by a test/verification script without a mocked HTTP session.
//
// Refuses (throws) if the direction needs to flip (PAYABLE <-> RECEIVABLE <-> NONE) and the
// EXISTING document already has a real payment/receipt against it — resolving which of two
// different obligations that payment actually belongs to is a human decision, not something to
// silently guess at.
export async function recordClinicCollectionAtomic({ caseId, amount, discount, date, mode, reference, receiptMode, furtherMode, note, actor }) {
  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    throw new Error("Collection amount must be greater than 0");
  }
  const parsedDiscount = Number(discount) || 0;
  if (parsedDiscount < 0) {
    throw new Error("Discount cannot be negative");
  }

  const performedBy = { name: actor?.name, email: actor?.email };
  const when = date ? new Date(date) : new Date();

  const collabCase = await CollabCase.findById(caseId);
  if (!collabCase) throw new Error("Collab case not found");
  if (collabCase.status === "CANCELLED") throw new Error("This case has been cancelled");

  const originTx = await Transactions.findOne({ "collabRef.caseId": collabCase._id, costType: "Revenue" });

  // ADDITIVE, not clinicCollections alone — same fix already applied to the read-side
  // aggregation in cases/route.js (see its comment). originTx.collabSplit.clinicReceived is a
  // snapshot of what the clinic had collected AT CASE-CREATION time; clinicCollections[] is
  // every collection recorded AFTER that via this same function. Using clinicCollections alone
  // silently ignored the case-creation split entirely — deriveClinicSettlement computed the
  // wrong kind/amount from a baseline of 0, looked for the (wrong, nonexistent) Payable/
  // Receivable, found nothing, and did nothing, while the REAL linked document sat untouched.
  const clinicReceivedAtCreation = originTx?.collabSplit?.clinicReceived || 0;
  const oldCollectedByClinic =
    clinicReceivedAtCreation + collabCase.clinicCollections.reduce((sum, c) => sum + c.amount, 0);
  const newCollectedByClinic = oldCollectedByClinic + parsedAmount;
  const clinicShare = collabCase.clinicShare;

  const oldSettlement = deriveClinicSettlement({ clinicReceived: oldCollectedByClinic, clinicShare });
  const newSettlement = deriveClinicSettlement({ clinicReceived: newCollectedByClinic, clinicShare });

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      collabCase.clinicCollections.push({
        amount: parsedAmount,
        discount: parsedDiscount,
        date: when,
        mode,
        reference: reference || "",
        receiptMode: receiptMode || "",
        furtherMode: furtherMode || "",
        note: note || "",
        recordedBy: performedBy,
        recordedAt: new Date(),
      });
      collabCase.log.push({
        action: "Collection Added",
        newValue: String(parsedAmount),
        note,
        performedBy,
        performedAt: new Date(),
      });

      // ── Top up the clinic-share expense (mirrors step 2b above) ──
      const oldClinicSettledNow = Math.min(oldCollectedByClinic, clinicShare);
      const newClinicSettledNow = Math.min(newCollectedByClinic, clinicShare);
      const topUp = Math.round((newClinicSettledNow - oldClinicSettledNow) * 100) / 100;
      if (topUp > 0.005) {
        await Transactions.create(
          [
            {
              transactionCategory: "EXPENSE",
              costType: "Expenses",
              expense: "Collab Clinic Payment",
              expenseType: "Collab Clinic Payment",
              expenseGiver: { type: "MANUAL", name: collabCase.clinic },
              amount: topUp,
              method: "offset_settlement",
              branch: collabCase.clinic,
              date: when,
              remarks: `Clinic share retained by ${collabCase.clinic} — top-up from a new collection`,
              approvalStatus: "APPROVED",
              collabRef: { caseId: collabCase._id },
              createdBy: { ...performedBy, date: new Date() },
            },
          ],
          { session },
        );
      }

      // ── Resize / flip the case's own Payable or Receivable to match the new obligation ──
      if (oldSettlement.kind === newSettlement.kind && newSettlement.kind !== "NONE") {
        if (Math.abs(oldSettlement.amount - newSettlement.amount) > 0.005) {
          const Model = newSettlement.kind === "PAYABLE" ? Payable : Receivable;
          const docId = newSettlement.kind === "PAYABLE" ? collabCase.clinicSharePayable : collabCase.clinicShareReceivable;
          const doc = docId ? await Model.findById(docId).session(session) : null;
          if (doc) {
            doc.log.push({
              action: "Amount Revised",
              previousValue: String(doc.totalAmount),
              newValue: String(newSettlement.amount),
              note: `Resized after a new clinic collection of ₹${parsedAmount} — clinicReceived ${newCollectedByClinic}, clinicShare ${clinicShare}`,
              performedBy,
              performedAt: new Date(),
            });
            doc.totalAmount = newSettlement.amount;
            await doc.save({ session });
          }
        }
      } else if (oldSettlement.kind !== newSettlement.kind) {
        if (oldSettlement.kind === "PAYABLE" && collabCase.clinicSharePayable) {
          const [agg] = await Payable.aggregate([
            { $match: { _id: collabCase.clinicSharePayable } },
            ...buildPayableAggregationStages(Transactions.collection.name),
          ]).session(session);
          if ((agg?.paid || 0) > 0) {
            throw new Error(
              `This case's payable already has ₹${agg.paid} paid against it. Recording this collection would flip it to a different obligation — settle or reconcile that payment first.`,
            );
          }
          const oldPayable = await Payable.findById(collabCase.clinicSharePayable).session(session);
          if (oldPayable) {
            oldPayable.isCancelled = true;
            oldPayable.log.push({
              action: "Cancelled",
              previousValue: "false",
              newValue: "true",
              note: `Superseded — a new clinic collection changed the obligation direction (now ${newSettlement.kind === "NONE" ? "balanced" : newSettlement.kind}).`,
              performedBy,
              performedAt: new Date(),
            });
            await oldPayable.save({ session });
          }
          collabCase.clinicSharePayable = null;
          if (originTx) originTx.collabRef.payableId = null;
        } else if (oldSettlement.kind === "RECEIVABLE" && collabCase.clinicShareReceivable) {
          const [agg] = await Receivable.aggregate([
            { $match: { _id: collabCase.clinicShareReceivable } },
            ...buildReceivableAggregationStages(Transactions.collection.name),
          ]).session(session);
          if ((agg?.received || 0) > 0) {
            throw new Error(
              `This case's receivable already has ₹${agg.received} received against it. Recording this collection would flip it to a different obligation — settle or reconcile that receipt first.`,
            );
          }
          const oldReceivable = await Receivable.findById(collabCase.clinicShareReceivable).session(session);
          if (oldReceivable) {
            oldReceivable.isCancelled = true;
            oldReceivable.log.push({
              action: "Cancelled",
              previousValue: "false",
              newValue: "true",
              note: `Superseded — a new clinic collection changed the obligation direction (now ${newSettlement.kind === "NONE" ? "balanced" : newSettlement.kind}).`,
              performedBy,
              performedAt: new Date(),
            });
            await oldReceivable.save({ session });
          }
          collabCase.clinicShareReceivable = null;
          if (originTx) originTx.collabRef.receivableId = null;
        }

        if (newSettlement.kind === "RECEIVABLE") {
          const [receivable] = await Receivable.create(
            [
              {
                payer: { kind: "COLLAB_CLINIC", label: collabCase.clinic },
                purpose: "COLLAB_SETTLEMENT",
                revenueCategory: categoryForProcedure(collabCase.procedure),
                relatedPatient: collabCase.patient,
                totalAmount: newSettlement.amount,
                branch: collabCase.clinic,
                costAlreadyRecognised: true,
                remarks: `Collab settlement — ${collabCase.clinic} collected ${newCollectedByClinic} against a ${clinicShare} share`,
                createdBy: { ...performedBy, date: new Date() },
                log: [
                  {
                    action: "Created",
                    newValue: String(newSettlement.amount),
                    note: `Derived after a new clinic collection: clinicReceived ${newCollectedByClinic} - clinicShare ${clinicShare}`,
                    performedBy,
                    performedAt: new Date(),
                  },
                ],
              },
            ],
            { session },
          );
          collabCase.clinicShareReceivable = receivable._id;
          if (originTx) originTx.collabRef.receivableId = receivable._id;
        } else if (newSettlement.kind === "PAYABLE") {
          const [payable] = await Payable.create(
            [
              {
                payee: { kind: "COLLAB_CLINIC", label: collabCase.clinic },
                purpose: "COLLAB_CLINIC",
                expenseCategory: "Collab Clinic Payment",
                expenseSubType: "Collab Clinic Payment",
                relatedPatient: collabCase.patient,
                totalAmount: newSettlement.amount,
                branch: collabCase.clinic,
                costAlreadyRecognised: false,
                remarks: `Collab settlement — ${collabCase.clinic} collected ${newCollectedByClinic} against a ${clinicShare} share`,
                createdBy: { ...performedBy, date: new Date() },
                log: [
                  {
                    action: "Created",
                    newValue: String(newSettlement.amount),
                    note: `Derived after a new clinic collection: clinicShare ${clinicShare} - clinicReceived ${newCollectedByClinic}`,
                    performedBy,
                    performedAt: new Date(),
                  },
                ],
              },
            ],
            { session },
          );
          collabCase.clinicSharePayable = payable._id;
          if (originTx) originTx.collabRef.payableId = payable._id;
        }
      }

      if (originTx) await originTx.save({ session });
      await collabCase.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return { collabCase, oldSettlement, newSettlement };
}
