import mongoose from "mongoose";
import Transactions from "@/models/Transactions";
import CollabCase from "@/models/CollabCase";
import Patient from "@/models/Patient";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { deriveClinicSettlement, round2 } from "@/lib/collabFormula";
import { checkPeriodLock } from "@/lib/periodLock";
import { reverseTransaction, ReversalError } from "@/lib/reverseTransaction";

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
    // Mirrors transactions/transplant/create/route.js's update — INCLUDING its
    // patient.payments.discount recompute, which this previously omitted: that field is never
    // incremented by hand, it's re-summed from every linked transaction's own `discount` every
    // time one is added, or a discount entered on a collab collection silently never reached the
    // patient's own record (pendingAmount then stayed wrong by exactly that amount). Also mirrors
    // reverseTransaction.js's pattern of recomputing pendingAmount explicitly rather than relying
    // on the Patient pre-save hook (which only auto-derives it when counselling.finlpackage is
    // set).
    const patient = await Patient.findById(patientId).session(session);
    if (patient) {
      patient.payments = patient.payments || {};
      patient.payments.amountReceived = round2((patient.payments.amountReceived || 0) + amount);
      patient.payments.transactions = patient.payments.transactions || [];
      patient.payments.transactions.push(transaction._id);

      const linkedTransactions = await Transactions.find({
        _id: { $in: patient.payments.transactions },
        costType: "Revenue",
      }).session(session);
      patient.payments.discount = round2(
        linkedTransactions.reduce((sum, t) => sum + (t.discount || 0), 0),
      );

      const total = patient.payments.totalAmount || patient.counselling?.finlpackage || 0;
      patient.payments.pendingAmount = Math.max(
        0,
        round2(total - patient.payments.amountReceived - patient.payments.discount),
      );
      await patient.save({ session });
    }

    return transaction;
  }

  // collectedBy === "CLINIC": revenue earned, cash not received. furtherMode/receiptMode are
  // deliberately blank — nothing landed with us, so there is no account to route it through.
  // paymentId, however, IS kept — it's the clinic's own transaction reference (UTR/receipt no.),
  // same top-level slot every other paid_to_external/paid_by_other transaction in the app uses
  // for the external party's own reference (see MethodField + ExternalPartyFields, used
  // together). This used to be silently dropped here — the caller always threaded a `paymentId`
  // through, but this branch never read it.
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
        paymentId: paymentId || "",
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
// collected money — idempotent: a no-op once its total already matches, so this can run after
// every collection (at case creation, and at every later instalment) and always converges to the
// correct total no matter how many times or in what increments the clinic's money came in.
//
// WHY THE RECEIVABLE IS RAISED AT THE FULL AMOUNT, NOT NETTED — close-book/pnl's Income formula is
// "direct revenue transactions + every Receivable's totalAmount raised in the period" (see that
// route's own header comment), exactly the same convention externalPartyDerivation.js's
// createExternalReceivable already uses (totalAmount = the FULL transaction amount, never
// netted). Raising it net of the clinic's share would silently drop that share's worth of revenue
// out of P&L, since nothing else in the formula would ever have counted it.
//
// Does NOT touch the clinic's fixed fee at all any more — that only happens once, at
// crystallisation (see crystalliseClinicShare below), when the case's running total first reaches
// its package amount. Before that point this function's only job is "how much has the clinic
// collected so far", which is exactly what topUpClinicShare originally did in step 1; step 2 (the
// per-instalment proportional offset) has been removed — see crystalliseClinicShare's header
// comment for why recognising the fee per-instalment was wrong.
//
// MUST run inside the caller's session. Mutates and saves `collabCase` when a Receivable is
// created for the first time (clinicShareReceivable). Returns the Receivable id, if any, so the
// caller can link the collection's own transaction to it.
async function growClinicReceivable({
  session,
  collabCase,
  newCumulativeClinicReceived,
  branch,
  procedure,
  patientId,
  performedBy,
  noteSuffix = "",
}) {
  let receivableId = collabCase.clinicShareReceivable;
  if (collabCase.clinicShareReceivable) {
    await resizeClinicReceivable({
      session,
      receivableId: collabCase.clinicShareReceivable,
      newTotal: newCumulativeClinicReceived,
      note: `Resized after a new clinic collection${noteSuffix}`,
      performedBy,
    });
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
          // offset at crystallisation) moves cash/settles a debt for revenue already recognised,
          // so that receipt must be excluded from P&L.
          costAlreadyRecognised: true,
          remarks: `Collab settlement — money ${branch} has collected on this case's behalf`,
          createdBy: performedBy,
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

  return receivableId;
}

// Small shared primitive: resize an EXISTING Receivable's totalAmount and log it. Used by
// growClinicReceivable (raising it upward as new collections arrive) and by
// unwindClinicShareCrystallisation (re-syncing it downward after a reversal genuinely reduces
// what the clinic has collected — a real reversal event, never an accounting-convenience netting;
// see crystalliseClinicShare's header comment on why crystallisation itself never resizes this).
// A no-op if the receivable is missing or already at that total. MUST run inside the caller's
// session.
async function resizeClinicReceivable({ session, receivableId, newTotal, note, performedBy }) {
  const receivable = await Receivable.findById(receivableId).session(session);
  if (!receivable || receivable.totalAmount === newTotal) return;
  receivable.log.push({
    action: "Amount Revised",
    previousValue: String(receivable.totalAmount),
    newValue: String(newTotal),
    note,
    performedBy,
    performedAt: new Date(),
  });
  receivable.totalAmount = newTotal;
  await receivable.save({ session });
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
// Live "how much of this case's package has been accounted for" — the single definition shared by
// the over-collection guard (cases/[id]/collection/route.js), the crystallisation trigger in both
// atomic write functions below, and the reversal-driven unwind check
// (api/transactions/[id]/reverse/route.js), so the three can never compute a different "remaining"
// for the same case.
//
// Every collabRef-linked revenue transaction, both collected-by-us and collected-by-clinic (a
// paid_to_external transaction still represents money genuinely off the patient's outstanding
// balance, even though it hasn't reached one of our own accounts). receivableId: null excludes
// crystallisation's own offset-revenue rows and any later THEY_PAID settlement collecting against
// that same Receivable — counting either here would double an amount already collected once.
export async function computeCaseBalance(caseId, session = null) {
  const [agg] = await Transactions.aggregate([
    {
      $match: {
        "collabRef.caseId": caseId,
        costType: "Revenue",
        approvalStatus: { $nin: ["PENDING", "REJECTED"] },
        receivableId: null,
      },
    },
    { $group: { _id: null, totalCollected: { $sum: "$amount" }, totalDiscount: { $sum: "$discount" } } },
  ]).session(session || null);
  return { totalCollected: agg?.totalCollected || 0, totalDiscount: agg?.totalDiscount || 0 };
}

// Whether a case's running total has reached its (net, discount-adjusted) package amount — the
// single gate crystalliseClinicShare fires on. `balance` comes from computeCaseBalance, always
// read AFTER the collection that might complete the case has been written.
export function isFullyCollected(collabCase, balance) {
  return round2(collabCase.packageAmount - balance.totalCollected - balance.totalDiscount) <= 0.005;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recognises the clinic's fixed fee EXACTLY ONCE, at the moment a case's running total first
// reaches its package amount — never progressively per instalment. The fee is earned on the case,
// not per collection: recognising min(cumulativeClinicReceived, clinicShare) as expense on every
// clinic top-up (the old topUpClinicShare's step 2) overstated expense on every incomplete case,
// and had to be unwound by hand if the case was abandoned before completing. Guarded by
// collabCase.clinicShareSettledAt so this can safely be called after every collection without
// ever double-firing.
//
// Let C = cumulative clinic-collected, S = the clinic's fixed fee (clinicShare):
//
//   C >= S  the clinic already holds enough to cover its own fee out of what it collected.
//           No Payable is created — nothing is owed TO the clinic. A direct expense of S is
//           booked (no payableId, so close-book/pnl's direct-expense sum counts it), matched by
//           an offset revenue of S against the existing clinicShareReceivable (isSettlement:true,
//           since that revenue was already recognised in full when the Receivable was raised) —
//           this nets the Receivable's live pending down to C-S without ever rewriting its
//           totalAmount (see the big comment below on why not).
//   C <  S  the clinic holds less than its fee — we owe it the shortfall. A Payable is created
//           for S-C. Whatever the clinic already holds (C) is expensed the same way as above
//           (direct expense + offset revenue against the receivable, if C > 0), netting the
//           receivable's pending to 0. Either branch recognises exactly S of expense, once.
//
// WHY THIS NEVER REWRITES Receivable.totalAmount: growClinicReceivable already raised it to the
// full cumulative C as collections came in, and close-book/pnl sums every Receivable's
// totalAmount, unconditionally, as Income the moment it's raised. Rewriting it downward here
// would silently erase already-recognised revenue — exactly what "revenue stays exactly what it
// is today, only the clinic-share TIMING changes" forbids. Posting an offset transaction against
// the unchanged totalAmount and letting pending (= totalAmount - paid, always computed live) net
// down is the same mechanism the old code already used; only the AMOUNT and the FIRING POINT
// change (once, at completion, instead of progressively).
//
// MUST run inside the caller's session.
export async function crystalliseClinicShare({
  session,
  collabCase,
  branch,
  procedure,
  patientId,
  when,
  createdBy,
  performedBy,
  noteSuffix = "",
}) {
  if (collabCase.clinicShareSettledAt) return; // idempotent — fires exactly once per case

  const S = collabCase.clinicShare || 0;
  const C = await cumulativeClinicReceived(collabCase._id, session);

  const postOffsetPair = async (amount) => {
    if (amount <= 0.005) return;
    await assertNotLocked("", when, "the clinic-share expense");
    await Transactions.create(
      [
        {
          transactionCategory: "EXPENSE",
          costType: "Expenses",
          expense: "Collab Clinic Payment",
          expenseType: "Collab Clinic Payment",
          expenseGiver: { type: "MANUAL", name: branch },
          amount,
          method: "offset_settlement",
          furtherMode: "",
          branch,
          date: when,
          remarks: `Clinic share crystallised — ${branch} kept this out of money it collected${noteSuffix}`,
          approvalStatus: "APPROVED",
          collabRef: { caseId: collabCase._id, crystallisation: true },
          createdBy,
        },
      ],
      { session },
    );

    if (collabCase.clinicShareReceivable) {
      await Transactions.create(
        [
          {
            transactionCategory: categoryForProcedure(procedure),
            costType: "Revenue",
            procedure,
            amount,
            method: "offset_settlement",
            receivableId: collabCase.clinicShareReceivable,
            isSettlement: true,
            branch,
            date: when,
            remarks: `Clinic share crystallised — offset against money ${branch} collected${noteSuffix}`,
            approvalStatus: "APPROVED",
            collabRef: { caseId: collabCase._id, crystallisation: true },
            createdBy,
          },
        ],
        { session },
      );
    }
  };

  if (C >= S) {
    // The clinic keeps its whole fee out of what it already holds. No Payable — nothing is owed
    // to it.
    await postOffsetPair(S);
  } else {
    // We owe the clinic the shortfall. Whatever it already holds (C) is expensed the same way;
    // the rest (S-C) becomes a real Payable.
    const shortfall = round2(S - C);
    if (shortfall > 0.005) {
      await assertNotLocked("", when, "the clinic-share payable");
      const [payable] = await Payable.create(
        [
          {
            payee: { kind: "COLLAB_CLINIC", label: branch },
            purpose: "COLLAB_CLINIC",
            expenseCategory: "Collab Clinic Payment",
            expenseSubType: "Collab Clinic Payment",
            relatedPatient: patientId,
            totalAmount: shortfall,
            branch,
            // Nothing else recognises this shortfall as expense — its own raise is what does, via
            // close-book/pnl's unconditional payablesRaisedAgg. See settlements/create/route.js's
            // WE_PAID branch for how this eventually gets paid down.
            costAlreadyRecognised: false,
            remarks: `Collab clinic fee shortfall — crystallised at case completion${noteSuffix}`,
            createdBy,
            log: [
              {
                action: "Created",
                newValue: String(shortfall),
                note: `Crystallised — clinic collected ₹${C} of its ₹${S} fee`,
                performedBy,
                performedAt: new Date(),
              },
            ],
          },
        ],
        { session },
      );
      collabCase.clinicSharePayable = payable._id;
    }
    await postOffsetPair(C);
  }

  collabCase.clinicShareSettledAt = new Date();
  collabCase.log.push({
    action: "Clinic Share Crystallised",
    newValue: String(S),
    note: `Clinic collected ₹${C} of its ₹${S} fee${noteSuffix}`,
    performedBy,
    performedAt: new Date(),
  });
  await collabCase.save({ session });
}

// Undoes whatever crystalliseClinicShare wrote, restoring the case to its pre-crystallisation
// partial state — called when a reversed collection drops a previously-completed case back under
// its package total (see api/transactions/[id]/reverse/route.js) or when the case itself is
// cancelled (cases/[id]/route.js). A no-op if the case never crystallised.
//
// Refuses (mirroring the guard cascadeIntegrity.js applies to creator-linked documents, though
// this Payable/Receivable pair is never creator-linked to a transaction the way that module
// expects) if a REAL settlement has already paid against the crystallisation Payable — unwinding
// then would strand that payment against an obligation that no longer claims to exist.
//
// MUST run inside the caller's session. Throws ReversalError (same class reverseTransaction uses)
// so callers already catching it need no new error-handling branch.
export async function unwindClinicShareCrystallisation({ session, collabCase, actor, reason }) {
  if (!collabCase.clinicShareSettledAt) return { unwound: false };

  const performedBy = { name: actor?.name, email: actor?.email };

  if (collabCase.clinicSharePayable) {
    const realPayments = await Transactions.countDocuments({
      payableId: collabCase.clinicSharePayable,
      "collabRef.crystallisation": { $ne: true },
    }).session(session);
    if (realPayments > 0) {
      throw new ReversalError(409, {
        error:
          `Cannot unwind this case's clinic-share crystallisation: ${realPayments} payment(s) ` +
          `have already been settled against its clinic payable. Reverse or reallocate ` +
          `${realPayments === 1 ? "that settlement" : "those settlements"} first.`,
      });
    }
  }

  const crystallisationTx = await Transactions.find({
    "collabRef.caseId": collabCase._id,
    "collabRef.crystallisation": true,
    reversalOf: { $exists: false },
    isReversed: { $ne: true },
  }).session(session);

  for (const tx of crystallisationTx) {
    await reverseTransaction({
      transactionId: tx._id,
      reason: reason || "Clinic share crystallisation unwound",
      actor,
      dbSession: session,
    });
  }

  if (collabCase.clinicSharePayable) {
    const payable = await Payable.findById(collabCase.clinicSharePayable).session(session);
    if (payable && !payable.isCancelled) {
      payable.isCancelled = true;
      payable.log.push({
        action: "Cancelled",
        previousValue: "false",
        newValue: "true",
        note: "Clinic-share crystallisation unwound — a reversed collection brought the case back under its package total",
        performedBy,
        performedAt: new Date(),
      });
      await payable.save({ session });
    }
    collabCase.clinicSharePayable = null;
  }

  if (collabCase.clinicShareReceivable) {
    const C = await cumulativeClinicReceived(collabCase._id, session);
    await resizeClinicReceivable({
      session,
      receivableId: collabCase.clinicShareReceivable,
      newTotal: C,
      note: "Resized back to the cumulative clinic-collected total — crystallisation unwound",
      performedBy,
    });
  }

  collabCase.clinicShareSettledAt = null;
  collabCase.log.push({
    action: "Note Added",
    note: "Clinic-share crystallisation unwound — case dropped back under its package total",
    performedBy,
    performedAt: new Date(),
  });
  await collabCase.save({ session });

  return { unwound: true };
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
// THE CLINIC'S FIXED FEE IS NO LONGER RAISED AT CASE CREATION. It used to be — a Payable for the
// full clinicShare, unconditionally, the moment the case was created — but close-book/pnl counts
// every non-cancelled Payable's totalAmount as expense the instant it's raised, so that booked the
// clinic's whole fee as expense before the patient had paid anything, and permanently if the case
// was later abandoned. The fee is earned when the case COMPLETES, not when it's opened: see
// crystalliseClinicShare, called once below after every collection this function records, exactly
// the same way recordCollabCollectionAtomic calls it for every later instalment.
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

      // 2. Money collected by US at creation time — an ordinary cash-in revenue transaction,
      //    advancing Patient.payments exactly like a direct payment.
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

      // 3. Money collected by the CLINIC at creation time — revenue earned, cash not received.
      //    Also grows the case's collab Receivable to the new cumulative total.
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
          // Which instrument the clinic collected with, and its own reference — previously
          // never threaded through at all for the at-creation clinic branch (only the later,
          // per-instalment recordCollabCollectionAtomic path passed these), so this data was
          // silently dropped whenever a case was created with clinicReceived already collected.
          collectionMode: method,
          paymentId,
          branch: clinic,
          when,
          remarks,
          createdBy,
        });
        created.clinicTransaction = tx;

        const receivableId = await growClinicReceivable({
          session,
          collabCase,
          newCumulativeClinicReceived: clinicReceivedNum,
          branch: clinic,
          procedure,
          patientId,
          performedBy,
          noteSuffix: " at case creation",
        });
        // Deliberately NOT linked onto `tx` via collabRef.receivableId / externalParty.
        // linkedReceivableId — those are cascadeIntegrity.js's "creator" markers, which assume
        // ONE transaction exclusively owns the document it points at (the standard external-party
        // pattern: one paid_to_external transaction, one dedicated receivable). This case's
        // Receivable is the opposite: ONE shared, resizable document fed by potentially many
        // collection transactions over the case's life, tracked instead via the case's own
        // clinicShareReceivable field.
        if (receivableId) {
          created.receivable = { _id: receivableId };
        }
      }

      // Do NOT create any transaction for the uncollected remainder. It lives on
      // Patient.payments.pendingAmount, exactly as for direct patients — not revenue, not a
      // Receivable, until it's actually collected by one of the two branches above.

      // 4. If the collections just recorded already bring the case to its full package amount —
      //    the new "patient paid the full package" path — crystallise the clinic's fee right now,
      //    in the same transaction. The common case (a partial collection) leaves this a no-op.
      const balance = await computeCaseBalance(collabCase._id, session);
      if (isFullyCollected(collabCase, balance)) {
        await crystalliseClinicShare({
          session,
          collabCase,
          branch: clinic,
          procedure,
          patientId,
          when,
          createdBy,
          performedBy,
          noteSuffix: " at case creation",
        });
      }
      created.payable = collabCase.clinicSharePayable
        ? await Payable.findById(collabCase.clinicSharePayable).select("totalAmount").session(session)
        : null;
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
// After recording, checks whether this collection brings the case's running total to its full
// package amount and, if so, crystallises the clinic's fixed fee (see crystalliseClinicShare) —
// exactly once, however many instalments it took to get there.
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
        await growClinicReceivable({
          session,
          collabCase,
          newCumulativeClinicReceived: round2(previousCumulative + parsedAmount),
          branch: collabCase.clinic,
          procedure: collabCase.procedure,
          patientId: collabCase.patient,
          performedBy,
          noteSuffix: ` of ₹${parsedAmount}`,
        });
      }

      await collabCase.save({ session });

      // If this instalment brings the case's running total to its full package amount,
      // crystallise the clinic's fixed fee now — exactly once, however many instalments it took.
      const balance = await computeCaseBalance(collabCase._id, session);
      if (isFullyCollected(collabCase, balance)) {
        await crystalliseClinicShare({
          session,
          collabCase,
          branch: collabCase.clinic,
          procedure: collabCase.procedure,
          patientId: collabCase.patient,
          when,
          createdBy,
          performedBy,
          noteSuffix: ` of ₹${parsedAmount}`,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  return { collabCase, transaction };
}
