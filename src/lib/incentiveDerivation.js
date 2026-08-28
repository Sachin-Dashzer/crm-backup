import Payable from "@/models/Payable";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";
import { checkPeriodLock } from "@/lib/periodLock";

// §3 — the two pieces every per-patient-incentive write path (add/edit/cancel) shares: finding or
// opening this month's Incentive payable for an employee, and keeping that payable's totalAmount
// in sync with the incentive rows that actually back it. Both MUST run inside the caller's
// mongoose session.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Thrown for every rejection these functions make. Callers catch it and translate status/body
// straight into an HTTP response, mirroring reverseTransaction.js's ReversalError.
export class IncentiveError extends Error {
  constructor(status, body) {
    super(body?.error || "Incentive operation failed");
    this.status = status;
    this.body = body;
  }
}

// Finds this employee's ALREADY-OPEN Incentive payable for the given month, or opens a new one at
// totalAmount: 0 (the caller always calls recomputeIncentivePayable right after adding the row
// that prompted this call, so the payable's total is never left wrong even briefly).
//
// Discriminated by expenseSubType: "Incentive" — the literal string this flow always writes —
// specifically so it can never match (or be topped up by mistake into) a Payable the OLD Agent >
// Incentive tab on transactions/create created, which always writes one of getExpenseTypes
// ("Incentive")'s specific sub-type strings (e.g. "Sales Incentive-Agents"), never the bare word.
// That's also why "INCENTIVE" is deliberately absent from Payable.js's MONTHLY_PURPOSES unique
// index (several per employee per month is normal for that older, unlinked flow) — this feature's
// own one-per-employee-per-month rule is enforced here, at the application level, instead.
export async function findOrCreateIncentivePayable({
  session,
  employeeId,
  employeeLabel,
  branch,
  period, // { month, year }
  relatedPatient,
  date, // the actual incentive date — what the period-lock check runs against
  actor,
}) {
  const existing = await Payable.findOne({
    "payee.kind": "EMPLOYEE",
    "payee.refId": employeeId,
    purpose: "INCENTIVE",
    expenseSubType: "Incentive",
    "period.month": period.month,
    "period.year": period.year,
    isCancelled: { $ne: true },
  }).session(session);
  if (existing) return existing;

  // Same semantics as payables/create/route.js: a raised-but-unsettled obligation has no account
  // yet, so this checks periodLock.js's "every account closed" fallback.
  const lockReason = await checkPeriodLock({ furtherMode: null, date: date || new Date() });
  if (lockReason) {
    throw new IncentiveError(423, { error: lockReason, periodLocked: true });
  }

  const performedBy = { name: actor?.name, email: actor?.email };
  const [created] = await Payable.create(
    [
      {
        payee: { kind: "EMPLOYEE", refId: employeeId, label: employeeLabel },
        purpose: "INCENTIVE",
        expenseCategory: "Incentive",
        expenseSubType: "Incentive",
        period,
        relatedPatient: relatedPatient || undefined,
        totalAmount: 0,
        branch,
        // This total IS the sum of active incentive rows recognised as owed — there is nothing
        // else to recognise later.
        costAlreadyRecognised: false,
        remarks: `Per-patient incentives — ${employeeLabel}, ${period.month}/${period.year}`,
        createdBy: { ...actor, date: new Date() },
        log: [
          {
            action: "Created",
            newValue: "0",
            note: "Opened for this month's per-patient incentives",
            performedBy,
            performedAt: new Date(),
          },
        ],
      },
    ],
    { session },
  );
  return created;
}

// Recomputes a single Incentive payable's totalAmount from a LIVE sum of every non-cancelled
// incentives[] row (across every patient) that points at it via payableId — never incremented or
// decremented by a delta, so it can never drift regardless of how many patients' rows feed it or
// in what order they're added/cancelled. Refuses (throws) if the recomputed total would fall
// below what has already been paid against the payable — reducing it further would strand that
// payment against an obligation that no longer claims to be owed.
//
// Auto-cancels the payable when the recomputed total is exactly 0 rather than leaving a stale ₹0
// row behind — only reachable when `paid` is also 0 (the guard above would otherwise have already
// refused), so this never cancels a payable with real money against it.
//
// MUST run inside the caller's session.
export async function recomputeIncentivePayable({ session, payableId, actor }) {
  if (!payableId) return;

  const [rowAgg] = await Patient.aggregate([
    { $unwind: "$incentives" },
    { $match: { "incentives.payableId": payableId, "incentives.isCancelled": { $ne: true } } },
    { $group: { _id: null, total: { $sum: "$incentives.amount" } } },
  ]).session(session);
  const recomputedTotal = round2(rowAgg?.total || 0);

  const [withPaid] = await Payable.aggregate([
    { $match: { _id: payableId } },
    ...buildPayableAggregationStages(Transactions.collection.name),
  ]).session(session);
  if (!withPaid) return; // payable no longer exists — nothing to sync

  const paid = withPaid.paid || 0;
  if (recomputedTotal < paid) {
    throw new IncentiveError(409, {
      error:
        `Cannot reduce this incentive: ₹${paid.toLocaleString("en-IN")} has already been paid ` +
        `against the linked payable, which the remaining active incentives would only justify ` +
        `₹${recomputedTotal.toLocaleString("en-IN")} of. Reverse or reallocate that payment first.`,
    });
  }

  const payable = await Payable.findById(payableId).session(session);
  if (!payable) return;
  const performedBy = { name: actor?.name, email: actor?.email };

  if (recomputedTotal === 0 && !payable.isCancelled) {
    payable.isCancelled = true;
    payable.log.push({
      action: "Cancelled",
      previousValue: "false",
      newValue: "true",
      note: "No active incentives remain against this payable",
      performedBy,
      performedAt: new Date(),
    });
    await payable.save({ session });
    return;
  }

  if (payable.totalAmount !== recomputedTotal) {
    payable.log.push({
      action: "Amount Revised",
      previousValue: String(payable.totalAmount),
      newValue: String(recomputedTotal),
      note: "Recomputed from this month's active incentive rows",
      performedBy,
      performedAt: new Date(),
    });
    payable.totalAmount = recomputedTotal;
    await payable.save({ session });
  }
}
