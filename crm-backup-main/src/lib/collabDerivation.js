import mongoose from "mongoose";
import Transactions from "@/models/Transactions";
import CollabCase from "@/models/CollabCase";
import Patient from "@/models/Patient";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { deriveClinicSettlement, round2 } from "@/lib/collabFormula";
import { checkPeriodLock } from "@/lib/periodLock";

// deriveClinicSettlement is re-exported for anything that still imports it from here (the form's
// live preview imports src/lib/collabFormula.js directly). It is NO LONGER used by the write path
// below — see the big comment above createCollabCaseAtomic for why.
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

// Throws (never silently no-ops) when the (furtherMode, date) pair being written falls in a
// closed period — every collab write path funnels through this instead of each call site
// remembering to check.
async function assertNotLocked(furtherMode, date, label) {
  const reason = await checkPeriodLock({ furtherMode: furtherMode || "", date });
  if (reason) {
    throw new Error(`Cannot record ${label}: ${reason}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Records ONE collection event (money that came in, either to us or to the partner clinic) as a
// real revenue Transaction. The single implementation both createCollabCaseAtomic (the
// collections already known at case-creation time) and recordCollabCollectionAtomic (every later
// instalment) call, so the two paths can never diverge on what "money came in" means — which is
// exactly the divergence that caused this bug (creation booked the gross package; later
// collections were never booked as revenue at all).
//
// collectedBy: "US"     -> ordinary cash-in revenue transaction, exactly like a direct patient
//                           payment (src/app/api/transactions/transplant/create/route.js). Also
//                           advances Patient.payments the same way that route does — money the
//                           patient handed US is indistinguishable from a direct payment, and
//                           excluding it is why collab patients' payment status was wrong.
// collectedBy: "CLINIC" -> paid_to_external revenue transaction. Booked as full revenue (the sale
//                           happened) while staying out of every cash/bank balance — the same
//                           mechanism src/lib/externalPartyDerivation.js uses, applied by hand
//                           here rather than through createExternalReceivable (see the big
//                           comment on ensureClinicReceivable below for why).
//
// MUST run inside the caller's session.
async function createCollectionTransaction({
  session,
  collabCase,
  patientId,
  procedure,
  amount,
  discount = 0,
  collectedBy,
  method,
  paymentId,
  receiptMode,
  furtherMode,
  collectionMode,
  branch,
  when,
  remarks,
  createdBy,
}) {
  if (collectedBy === "US") {
    await assertNotLocked(furtherMode, when, "this collection");

    const [transaction] = await Transactions.create(
      [
        {
          transactionCategory: categoryForProcedure(procedure),
          costType: "Revenue",
          patient: patientId,
          procedure,
          amount,
          discount: discount || 0,
          method: method || "cash",
          paymentId: paymentId || "",
          receiptMode: receiptMode || "",
          furtherMode: furtherMode || "",
          branch,
          date: when,
          remarks: remarks || "",
          approvalStatus: "APPROVED",
          collabRef: { caseId: collabCase._id },
          createdBy,
        },
      ],
      { session },
    );

    // The ourReceived portion is money we already physically hold — exactly like any normal
    // transplant/service payment — so it must advance the patient's own payment record the same
    // way, or the patient permanently shows full pendingAmount despite having actually paid.
    // Mirrors transactions/transplant/create/route.js's update, and reverseTransaction.js's
    // pattern of recomputing pendingAmount explicitly rather than relying on the Patient
    // pre-save hook (which only auto-derives it when counselling.finlpackage is set).
    const patient = await Patient.findById(patientId).session(session);
    if (patient) {
      patient.payments = patient.payments || {};
      patient.payments.amountReceived = round2((patient.payments.amountReceived || 0) + amount);
      patient.payments.transactions = patient.payments.transactions || [];
      patient.payments.transactions.push(transaction._id);
      const total = patient.payments.totalAmount || patient.counselling?.finlpackage || 0;
      patient.payments.pendingAmount = Math.max(
        0,
        round2(total - patient.payments.amountReceived - (patient.payments.discount || 0)),
      );
      await patient.save({ session });
    }

    return transaction;
  }

  // collectedBy === "CLINIC": revenue earned, cash not received. furtherMode/receiptMode are
  // deliberately blank — nothing landed with us, so there is no account to route it through.
  await assertNotLocked("", when, "this collection");

  const [transaction] = await Transactions.create(
    [
      {
        transactionCategory: categoryForProcedure(procedure),
        costType: "Revenue",
        patient: patientId,
        procedure,
        amount,
        discount: discount || 0,
        method: "paid_to_external",
        receiptMode: "",
        furtherMode: "",
        branch,
        date: when,
        remarks: remarks || "",
        approvalStatus: "APPROVED",
        externalParty: {
          direction: "RECEIVED_BY",
          name: branch,
          partyKind: "MANUAL",
          method: collectionMode || "",
        },
        collabRef: { caseId: collabCase._id },
        createdBy,
      },
    ],
    { session },
  );

  return transaction;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raises/resizes the case's single collab Receivable to the FULL running total of clinic-
// collected money, then settles as much of it as the clinic's own fixed fee covers via a
// two-sided contra entry against the ALWAYS-EXISTING Payable. Idempotent: the contra only ever
// posts the DELTA since the last time this ran, and the Receivable resize is a no-op once its
// total already matches — so this can run after every collection (at case creation, and at every
// later instalment) and always converges to the same correct totals no matter how many times or
// in what increments the clinic's money came in.
//
// WHY THE RECEIVABLE IS RAISED AT THE FULL AMOUNT, NOT NETTED — this changed from an earlier
// version of this function that raised it net of the clinic's share (10,000 in the worked example
// below, instead of 30,000). That was wrong: close-book/pnl's Income formula is
// "direct revenue transactions + every Receivable's totalAmount raised in the period" (see that
// route's own header comment) — exactly the same convention externalPartyDerivation.js's
// createExternalReceivable already uses (totalAmount = the FULL transaction amount, never
// netted). Raising it net of the clinic's share would have silently dropped that share's worth of
// revenue out of P&L, since nothing else in the formula would ever have counted it. The Payable
// side has the opposite convention already — payablesRaisedAgg counts a Payable's full totalAmount
// as expense the moment it's raised, regardless of how much has since been paid/offset — which is
// exactly why the Payable is, and always was, raised at the FULL clinicShare unconditionally.
//
// THE FORMULA:
//
//   clinicSettledNow = min(cumulativeClinicReceived, clinicShare)   — how much of the clinic's
//                       fixed fee has been "self-paid" out of money it collected
//   receivable.totalAmount = cumulativeClinicReceived               — the full amount collected;
//                       ALL of it is real revenue (the sale happened), same as any other
//                       paid_to_external-derived receivable
//   receivable.pending (computed live, never stored) = totalAmount - clinicSettledNow — what the
//                       clinic must still actually send us
//
// clinicSettledNow is posted as a CONTRA PAIR for the delta since last time — an offset_settlement
// EXPENSE against the Payable (pays it down) and a matching offset_settlement REVENUE against the
// Receivable (pays IT down too), the latter flagged isSettlement:true because the revenue it
// represents was already counted in full when the Receivable was raised above; without that flag
// (or without receivableId set) it would double the same rupee into P&L a second time. Neither
// contra transaction carries `patient` — this is a pure inter-document netting entry, not a
// distinct patient-attributable sale — which also keeps it out of reverseTransaction's Patient.
// payments unwind on cancellation (see cases/[id]/route.js's §2.4 cancellation, which would
// otherwise need to compensate for it the same way it already does for collectedBy:"CLINIC" rows).
//
// Worked example — package 50,000, clinic share 20,000, clinic collects 30,000 in one go:
//   Receivable raised at 30,000. Contra posts 20,000 (min(30000,20000)) both ways ->
//   Payable pending 20,000-20,000=0, Receivable pending 30,000-20,000=10,000. Income (P&L) sees
//   the Receivable's raised 30,000 in full; Expense sees the Payable's raised 20,000 in full;
//   the contra pair is invisible to both (isSettlement / payableId-linkage excludes it) — margin
//   nets to exactly 30,000-20,000=10,000 on this collection, the same margin cash would have
//   produced. This is what makes the acceptance checklist's worked example foot end to end.
//
// MUST run inside the caller's session. Mutates and saves `collabCase` when a Receivable is
// created for the first time (clinicShareReceivable). Returns the Receivable id, if any, so the
// caller can link the collection's own transaction to it.
async function topUpClinicShare({
  session,
  collabCase,
  oldCumulativeClinicReceived,
  newCumulativeClinicReceived,
  branch,
  procedure,
  patientId,
  when,
  createdBy,
  performedBy,
  noteSuffix = "",
}) {
  const clinicShare = collabCase.clinicShare || 0;

  // 1. Raise/resize the Receivable to the full cumulative amount. Callers only ever invoke this
  //    function after an actual clinic collection, so newCumulativeClinicReceived is always
  //    greater than oldCumulativeClinicReceived — this always runs.
  let receivableId = collabCase.clinicShareReceivable;
  if (collabCase.clinicShareReceivable) {
    const receivable = await Receivable.findById(collabCase.clinicShareReceivable).session(session);
    if (receivable) {
      receivable.log.push({
        action: "Amount Revised",
        previousValue: String(receivable.totalAmount),
        newValue: String(newCumulativeClinicReceived),
        note: `Resized after a new clinic collection${noteSuffix}`,
        performedBy,
        performedAt: new Date(),
      });
      receivable.totalAmount = newCumulativeClinicReceived;
      await receivable.save({ session });
    }
  } else {
    const [receivable] = await Receivable.create(
      [
        {
          payer: { kind: "COLLAB_CLINIC", label: branch },
          purpose: "COLLAB_SETTLEMENT",
          revenueCategory: categoryForProcedure(procedure),
          relatedPatient: patientId,
          totalAmount: newCumulativeClinicReceived,
          branch,
          // The revenue this represents is booked in full right here, at the moment it's raised
          // — collecting it later (whether by real cash settlement or by the clinic-share
          // contra below) moves cash/settles a debt for revenue already recognised, so that
          // receipt must be excluded from P&L.
          costAlreadyRecognised: true,
          remarks: `Collab settlement — money ${branch} has collected on this case's behalf`,
          createdBy,
          log: [
            {
              action: "Created",
              newValue: String(newCumulativeClinicReceived),
              note: `Raised for the full amount ${branch} has collected so far${noteSuffix}`,
              performedBy,
              performedAt: new Date(),
            },
          ],
        },
      ],
      { session },
    );
    receivableId = receivable._id;
    collabCase.clinicShareReceivable = receivableId;
    await collabCase.save({ session });
  }

  // 2. Contra pair for the delta of the clinic's self-paid fee — see the header comment above.
  const oldSettledNow = Math.min(oldCumulativeClinicReceived, clinicShare);
  const newSettledNow = Math.min(newCumulativeClinicReceived, clinicShare);
  const topUp = round2(newSettledNow - oldSettledNow);

  if (topUp > 0.005 && collabCase.clinicSharePayable) {
    await assertNotLocked("", when, "the clinic-share offset");
    await Transactions.create(
      [
        {
          transactionCategory: "EXPENSE",
          costType: "Expenses",
          expense: "Collab Clinic Payment",
          expenseType: "Collab Clinic Payment",
          expenseGiver: { type: "MANUAL", name: branch },
          amount: topUp,
          method: "offset_settlement",
          furtherMode: "",
          payableId: collabCase.clinicSharePayable,
          branch,
          date: when,
          remarks: `Clinic share retained by ${branch} out of money it collected${noteSuffix}`,
          approvalStatus: "APPROVED",
          collabRef: { caseId: collabCase._id },
          createdBy,
        },
      ],
      { session },
    );

    if (receivableId) {
      await Transactions.create(
        [
          {
            transactionCategory: categoryForProcedure(procedure),
            costType: "Revenue",
            procedure,
            amount: topUp,
            method: "offset_settlement",
            receivableId,
            isSettlement: true,
            branch,
            date: when,
            remarks: `Clinic share retained by ${branch} out of money it collected${noteSuffix}`,
            approvalStatus: "APPROVED",
            collabRef: { caseId: collabCase._id },
            createdBy,
          },
        ],
        { session },
      );
    }
  }

  return receivableId;
}

// Live sum of every paid_to_external Revenue transaction linked to this case — "how much has the
// clinic collected so far", computed fresh every time rather than trusted from a stored counter
// (global rule: never store computed paid/pending). Self-heals if a collection is later reversed:
// the next collection's "old" total simply recomputes correctly from what's actually on the books.
async function cumulativeClinicReceived(caseId, session) {
  const [agg] = await Transactions.aggregate([
    {
      $match: {
        "collabRef.caseId": caseId,
        costType: "Revenue",
        method: "paid_to_external",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session || null);
  return agg?.total || 0;
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
//
// REVENUE IS RECOGNISED WHEN MONEY IS ACTUALLY COLLECTED — never at case creation, and never for
// the uncollected remainder. This used to book the FULL package as revenue the instant the case
// was created (collabSplit.ourReceived/clinicReceived were stored for reference but never
// affected the revenue amount), which contradicts how every direct patient already works
// (src/app/api/transactions/transplant/create/route.js books revenue per payment) and produced
// three real problems: part payments were never booked at all (clinicCollections[] existed but
// nothing read it back into revenue), revenue was overstated by the uncollected balance on every
// partly-paid case, and the books didn't balance (revenue recognised with no matching cash or
// Receivable for what the patient still owed). See scripts/diagnose-collab-revenue.mjs for the
// read-only measurement of this against real data before this fix landed.
//
// The clinic's share is now a FIXED CONTRACTUAL FEE, not a derived net figure: a Payable for the
// full clinicShare is created unconditionally here, every time, regardless of what's been
// collected so far. What the clinic has already "self-paid" out of money it's holding is
// expensed against that same Payable via an offset_settlement transaction (topUpClinicShare,
// above) rather than by varying the Payable's own size — so "how much is still owed to the
// clinic" is always paid/pending on ONE document, computed the normal aggregation way, never a
// second document that has to be resized or flipped.
//
//   paid us 50k, share 20k:      ourReceived 50000, clinicReceived 0
//                                -> Payable 20,000 raised, pending 20,000 (nothing collected by
//                                   clinic to offset it), no Receivable
//   paid clinic 50k, share 20k:  ourReceived 0, clinicReceived 50000
//                                -> Payable 20,000 raised, pending 0 (fully offset); Receivable
//                                   raised 50,000 (the full amount collected), pending 30,000
//                                   (50,000 - the 20,000 settled by the same offset)
//   split 20k/30k, share 20k:    ourReceived 20000, clinicReceived 30000
//                                -> Payable 20,000 raised, pending 0 (fully offset); Receivable
//                                   raised 30,000, pending 10,000
// (See topUpClinicShare's header comment for why the Receivable is raised at the full collected
// amount rather than net of the offset — that netting happens on the PENDING side, live, not on
// what gets raised.)
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

  const createdBy = { ...actor, date: new Date() };
  const performedBy = { name: actor?.name, email: actor?.email };
  const when = date ? new Date(date) : new Date();

  const created = {
    collabCase: null,
    ourTransaction: null,
    clinicTransaction: null,
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

      // 2. The clinic's fee — a fixed Payable, created unconditionally, always for the full
      //    clinicShare. See the header comment above for why this is no longer conditional.
      await assertNotLocked("", when, "the clinic-share payable");
      const [payable] = await Payable.create(
        [
          {
            payee: { kind: "COLLAB_CLINIC", label: clinic },
            purpose: "COLLAB_CLINIC",
            expenseCategory: "Collab Clinic Payment",
            expenseSubType: "Collab Clinic Payment",
            relatedPatient: patientId,
            totalAmount: clinicShare,
            branch: clinic,
            // Nothing has expensed this yet — the expense is booked when it's actually paid,
            // whether via an offset (topUpClinicShare) or a real settlement payment
            // (settlements/create/route.js's WE_PAID branch). Both carry payableId, so paid/
            // pending is always correct however this gets settled.
            costAlreadyRecognised: false,
            remarks: `Collab clinic fee — ${clinic}, ${procedure} for ${patientName || "patient"}`,
            createdBy,
            log: [
              {
                action: "Created",
                newValue: String(clinicShare),
                note: "Fixed contractual fee for this case",
                performedBy,
                performedAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );
      created.payable = payable;
      collabCase.clinicSharePayable = payable._id;
      await collabCase.save({ session });

      // 3a. Money collected by US at creation time — an ordinary cash-in revenue transaction,
      //     advancing Patient.payments exactly like a direct payment.
      const ourReceivedNum = Number(ourReceived) || 0;
      if (ourReceivedNum > 0) {
        const tx = await createCollectionTransaction({
          session,
          collabCase,
          patientId,
          procedure,
          amount: ourReceivedNum,
          discount: discount || 0,
          collectedBy: "US",
          method,
          paymentId,
          receiptMode,
          furtherMode,
          branch: clinic,
          when,
          remarks,
          createdBy,
        });
        created.ourTransaction = tx;
      }

      // 3b. Money collected by the CLINIC at creation time — revenue earned, cash not received.
      //     Also tops up the clinic-share offset and the case's collab Receivable.
      const clinicReceivedNum = Number(clinicReceived) || 0;
      if (clinicReceivedNum > 0) {
        const tx = await createCollectionTransaction({
          session,
          collabCase,
          patientId,
          procedure,
          // If a discount already went onto the "us" transaction above, don't double it here.
          discount: ourReceivedNum > 0 ? 0 : discount || 0,
          amount: clinicReceivedNum,
          collectedBy: "CLINIC",
          branch: clinic,
          when,
          remarks,
          createdBy,
        });
        created.clinicTransaction = tx;

        const receivableId = await topUpClinicShare({
          session,
          collabCase,
          oldCumulativeClinicReceived: 0,
          newCumulativeClinicReceived: clinicReceivedNum,
          branch: clinic,
          procedure,
          patientId,
          when,
          createdBy,
          performedBy,
          noteSuffix: " at case creation",
        });
        // Deliberately NOT linked onto `tx` via collabRef.receivableId / externalParty.
        // linkedReceivableId — those are cascadeIntegrity.js's "creator" markers, which assume
        // ONE transaction exclusively owns the document it points at (the standard external-party
        // pattern: one paid_to_external transaction, one dedicated receivable). This case's
        // Receivable is the opposite: ONE shared, resizable document fed by potentially many
        // collection transactions over the case's life, tracked instead via the case's own
        // clinicShareReceivable field. Marking any one of them a "creator" would make
        // checkCascadeOnDelete block its reversal the moment topUpClinicShare's contra posts a
        // settlement against that same receivable — which happens on every real collection past
        // the first — stranding case cancellation (§2.4) on every case with a clinic-share offset.
        if (receivableId) {
          created.receivable = { _id: receivableId };
        }
      }

      // Do NOT create any transaction for the uncollected remainder. It lives on
      // Patient.payments.pendingAmount, exactly as for direct patients — not revenue, not a
      // Receivable, until it's actually collected by one of the two branches above.
    });
  } finally {
    await session.endSession();
  }

  return {
    ...created,
    // Exact statement of what landed, for the caller to report back.
    summary: {
      collabCaseId: created.collabCase?._id,
      ourTransactionId: created.ourTransaction?._id || null,
      ourTransactionAmount: created.ourTransaction?.amount || 0,
      clinicTransactionId: created.clinicTransaction?._id || null,
      clinicTransactionAmount: created.clinicTransaction?.amount || 0,
      payableId: created.payable?._id || null,
      payableAmount: created.payable?.totalAmount || 0,
      receivableId: created.receivable?._id || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Records a LATER collection — either the patient paying US more, or the clinic collecting more
// directly. Both are given the exact same treatment as an at-creation one (createCollectionTransaction
// above); this is the "instalment 2 onward" fix — the previous version of this function only ever
// appended to clinicCollections[] and explicitly never created a Transaction, so every collection
// after the first was invisible to revenue, to Patient.payments, and to the clinic's Receivable.
//
// Called by cases/[id]/collection/route.js; separated out (same reasoning as
// createCollabCaseAtomic) so it can be exercised directly by a test/verification script without
// a mocked HTTP session.
// ─────────────────────────────────────────────────────────────────────────────
export async function recordCollabCollectionAtomic({
  caseId,
  amount,
  discount,
  date,
  collectedBy = "CLINIC", // matches clinicCollections[].collectedBy's default — see CollabCase.js
  method, // "US" only — the patient's real payment method
  mode, // "CLINIC" only — descriptive collection mode
  reference,
  receiptMode,
  furtherMode,
  note,
  actor,
}) {
  const parsedAmount = Number(amount);
  if (!parsedAmount || parsedAmount <= 0) {
    throw new Error("Collection amount must be greater than 0");
  }
  const parsedDiscount = Number(discount) || 0;
  if (parsedDiscount < 0) {
    throw new Error("Discount cannot be negative");
  }
  if (!["US", "CLINIC"].includes(collectedBy)) {
    throw new Error('collectedBy must be "US" or "CLINIC"');
  }

  const performedBy = { name: actor?.name, email: actor?.email };
  const createdBy = { ...actor, date: new Date() };
  const when = date ? new Date(date) : new Date();

  const collabCase = await CollabCase.findById(caseId);
  if (!collabCase) throw new Error("Collab case not found");
  if (collabCase.status === "CANCELLED") throw new Error("This case has been cancelled");

  const session = await mongoose.startSession();
  let transaction = null;
  try {
    await session.withTransaction(async () => {
      collabCase.clinicCollections.push({
        amount: parsedAmount,
        discount: parsedDiscount,
        collectedBy,
        date: when,
        mode: collectedBy === "CLINIC" ? mode : undefined,
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
        note: note ? `${collectedBy}: ${note}` : `Collected by ${collectedBy}`,
        performedBy,
        performedAt: new Date(),
      });

      // Read the running total BEFORE creating this collection's transaction — simple addition
      // for the "new" figure afterward, rather than creating the transaction first and having to
      // back the just-added amount back out of a post-write aggregate.
      const previousCumulative =
        collectedBy === "CLINIC" ? await cumulativeClinicReceived(collabCase._id, session) : 0;

      transaction = await createCollectionTransaction({
        session,
        collabCase,
        patientId: collabCase.patient,
        procedure: collabCase.procedure,
        amount: parsedAmount,
        discount: parsedDiscount,
        collectedBy,
        method,
        paymentId: reference,
        receiptMode,
        furtherMode,
        collectionMode: mode,
        branch: collabCase.clinic,
        when,
        remarks: note,
        createdBy,
      });

      if (collectedBy === "CLINIC") {
        // See the identical comment in createCollabCaseAtomic: deliberately not linked back onto
        // `transaction` via collabRef.receivableId / externalParty.linkedReceivableId — those
        // mark cascadeIntegrity.js "creator" ownership, which this case's shared, resizable
        // Receivable (tracked via collabCase.clinicShareReceivable instead) does not fit.
        await topUpClinicShare({
          session,
          collabCase,
          oldCumulativeClinicReceived: previousCumulative,
          newCumulativeClinicReceived: round2(previousCumulative + parsedAmount),
          branch: collabCase.clinic,
          procedure: collabCase.procedure,
          patientId: collabCase.patient,
          when,
          createdBy,
          performedBy,
          noteSuffix: ` of ₹${parsedAmount}`,
        });
      }

      await collabCase.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return { collabCase, transaction };
}
