import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import { checkPeriodLock } from "@/lib/periodLock";
import { checkCascadeOnDelete } from "@/lib/cascadeIntegrity";

// The core of POST /api/transactions/[id]/reverse, extracted so a second caller (loan
// cancellation — src/app/api/transactions/[id]/cancel-loan/route.js) can run the EXACT same
// reversal — same five guards, same negative-row write, same patient rollback — inside its OWN
// db session, atomically alongside a second write (reversing a loan's settlement transfer).
// Nothing about the guards or the write changed in this move; only their packaging did. The
// route handler below still owns auth, body parsing, and response shaping — this owns the
// decision of whether the reversal may happen and what it writes when it does.
//
// Why negative rather than a flag — see the reversalOf comment in src/models/Transactions.js.
// A negative row nets out correctly in every existing aggregation without editing any of them.

// Copied onto the reversal so it lands in exactly the same buckets as the original — same
// account, same branch, same category. furtherMode especially: the money must come back out of
// the account it went into, or the totals net to zero while the per-account balances do not.
const MIRRORED_FIELDS = [
  "patient",
  "patientName",
  "patientPhone",
  "procedure",
  "transactionCategory",
  "costType",
  "branch",
  "method",
  "furtherMode",
  "receiptMode",
  "expense",
  "expenseType",
  "payableId",
  "receivableId",
];

// Thrown for every rejection this function makes. Callers catch it and translate `status`/`body`
// straight into an HTTP response, so the two routes that call this can never phrase the same
// rejection two different ways.
export class ReversalError extends Error {
  constructor(status, body) {
    super(body?.error || "Reversal failed");
    this.status = status;
    this.body = body;
  }
}

/**
 * Runs every guard the reverse route enforces, then writes the reversal. `dbSession` MUST be an
 * active session from `session.withTransaction(...)` — the caller owns opening and committing it
 * (this function never calls startSession itself), so a caller doing a second write in the same
 * transaction (loan cancellation's transfer reversal) can share one atomic unit with this write.
 *
 * Returns { reversal, original, fullyReversed, patientStatus, alreadyReversed, remaining, requested }.
 * Throws ReversalError for every rejection — never returns a partial/error result.
 */
export async function reverseTransaction({
  transactionId,
  amount,
  reason,
  remarks,
  date,
  actor,
  dbSession,
}) {
  if (!reason || !String(reason).trim()) {
    throw new ReversalError(400, { error: "A reason is required to reverse a transaction" });
  }

  const original = await Transactions.findById(transactionId).session(dbSession);
  if (!original) {
    throw new ReversalError(404, { error: "Transaction not found" });
  }

  // ── Guard: never reverse a reversal ────────────────────────────────────────────────
  if (original.reversalOf) {
    throw new ReversalError(400, {
      error:
        "This row is itself a reversal. Reverse the ORIGINAL transaction instead — a chain of reversals is impossible to read in an audit.",
    });
  }

  if ((original.amount || 0) <= 0) {
    throw new ReversalError(400, { error: "Only a positive-amount transaction can be reversed." });
  }

  // ── Guard: no double reversal ──────────────────────────────────────────────────────
  // Amounts are stored negative, so their absolute sum is what has already been returned.
  const [alreadyAgg] = await Transactions.aggregate([
    { $match: { reversalOf: original._id } },
    { $group: { _id: null, total: { $sum: "$amount" }, n: { $sum: 1 } } },
  ]).session(dbSession);
  const alreadyReversed = Math.abs(alreadyAgg?.total || 0);
  const remaining = Math.round(((original.amount || 0) - alreadyReversed) * 100) / 100;

  if (remaining <= 0) {
    throw new ReversalError(400, {
      error: `This transaction is already fully reversed (₹${alreadyReversed.toLocaleString("en-IN")} of ₹${(original.amount || 0).toLocaleString("en-IN")}).`,
      alreadyReversed,
    });
  }

  // Defaults to the full remaining balance — the common case is a complete reversal.
  const requested = amount === undefined || amount === null ? remaining : Number(amount);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new ReversalError(400, { error: "Reversal amount must be greater than zero" });
  }
  if (requested > remaining) {
    throw new ReversalError(400, {
      error:
        `Reversing ₹${requested.toLocaleString("en-IN")} would take the total past the original. ` +
        `₹${alreadyReversed.toLocaleString("en-IN")} of ₹${(original.amount || 0).toLocaleString("en-IN")} has already been reversed; ` +
        `₹${remaining.toLocaleString("en-IN")} remains.`,
      alreadyReversed,
      remaining,
    });
  }

  // ── Guard: closed periods ──────────────────────────────────────────────────────────
  // A closed period stays closed and the correction lands in the open one, so the reversal is
  // dated TODAY rather than back-dated to the original. Only the reversal's own date is
  // checked — the original is not being edited, so its period is not being disturbed.
  const originalLocked = await checkPeriodLock(original);
  const reversalDate = originalLocked ? new Date() : date ? new Date(date) : new Date(original.date);

  const reversalLock = await checkPeriodLock({
    furtherMode: original.furtherMode,
    date: reversalDate,
  });
  if (reversalLock) {
    throw new ReversalError(423, {
      error: `The reversal cannot be dated ${reversalDate.toLocaleDateString("en-IN")}: ${reversalLock}`,
      periodLocked: true,
    });
  }

  // ── Guard: cascade ─────────────────────────────────────────────────────────────────
  // A FULL reversal leaves the original recognising nothing, so any payable/receivable it
  // created is in the same position it would be after a delete. Reuses the delete-side check
  // rather than restating the rule, so a reversal cannot orphan what a delete would refuse to.
  const isFullReversal = Math.abs(requested - remaining) < 0.01;
  if (isFullReversal) {
    const cascade = await checkCascadeOnDelete(original, dbSession);
    if (cascade.blocked) {
      throw new ReversalError(409, {
        error: "This transaction cannot be fully reversed yet.",
        reasons: cascade.reasons,
        // Partial is still available — it does not fully unwind the linked document.
        hint: `A partial reversal below ₹${remaining.toLocaleString("en-IN")} is still possible.`,
      });
    }
  }

  // Self-explanatory in a bank reconciliation months later: what, who, and which original.
  const narration = [
    `REVERSAL — ${String(reason).trim()}`,
    original.patientName || undefined,
    original.paymentId ? `ref ${original.paymentId}` : undefined,
    `against ${original._id}`,
    remarks ? String(remarks).trim() : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const doc = {};
  for (const f of MIRRORED_FIELDS) {
    if (original[f] !== undefined && original[f] !== null) doc[f] = original[f];
  }

  const [reversal] = await Transactions.create(
    [
      {
        ...doc,
        amount: -Math.abs(requested),
        // Never inherited: a reversal of a settlement is itself a settlement only in the
        // same sense the original was, and isSettlement already governs that via the
        // mirrored payableId/receivableId. Copying the original's flag keeps the pair
        // symmetric so they net to zero in whichever totals counted the original.
        isSettlement: original.isSettlement === true,
        reversalOf: original._id,
        reversalReason: String(reason).trim(),
        date: reversalDate,
        remarks: narration,
        paymentId: original.paymentId || "",
        approvalStatus: "APPROVED",
        createdBy: { ...actor, date: new Date() },
      },
    ],
    { session: dbSession },
  );

  // Only a FULL reversal closes the original. A partial one leaves it open so the rest can
  // still be reversed later.
  const nowReversed = alreadyReversed + Math.abs(requested);
  const fullyReversed = nowReversed >= (original.amount || 0) - 0.01;
  if (fullyReversed) {
    original.isReversed = true;
    original.editors = original.editors || [];
    original.editors.push({
      ...actor,
      date: new Date(),
      updatedFields: [{ name: "isReversed", previousValue: "false", newValue: "true" }],
    });
    await original.save({ session: dbSession });
  }

  // Patient money. Mirrors what transplant/create does on the way in, with the sign
  // flipped — the patient's received figure must agree with the sum of their transactions.
  // The Patient pre-save hook re-derives ops.status from the new amountReceived, which is
  // intended: a reversed payment means the patient did not, in fact, pay.
  let patientStatus = null;
  if (original.patient && original.costType === "Revenue") {
    const patient = await Patient.findById(original.patient).session(dbSession);
    if (patient) {
      patient.payments = patient.payments || {};
      const before = patient.ops?.status;
      patient.payments.amountReceived =
        Math.round(((patient.payments.amountReceived || 0) - Math.abs(requested)) * 100) / 100;
      if (patient.payments.amountReceived < 0) patient.payments.amountReceived = 0;
      patient.payments.transactions = patient.payments.transactions || [];
      patient.payments.transactions.push(reversal._id);

      // The hook only re-derives pendingAmount when counselling.finlpackage is set. Without
      // it a stale pendingAmount <= 0 would leave the patient on SURGERY_BOOKED even though
      // the money is gone — see the original route's history for the 22-patient incident this
      // fixed. Recompute it here so the status the hook derives is based on a current figure.
      if (!patient.counselling?.finlpackage) {
        const total = patient.payments.totalAmount || 0;
        patient.payments.pendingAmount = Math.max(
          0,
          total - patient.payments.amountReceived - (patient.payments.discount || 0),
        );
      }

      await patient.save({ session: dbSession });
      patientStatus = { before, after: patient.ops?.status, amountReceived: patient.payments.amountReceived };
    }
  }

  return {
    reversal,
    original,
    fullyReversed,
    patientStatus,
    alreadyReversed: nowReversed,
    remaining: Math.round((remaining - Math.abs(requested)) * 100) / 100,
    requested: Math.abs(requested),
  };
}
