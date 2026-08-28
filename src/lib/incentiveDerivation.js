import Payable from "@/models/Payable";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";
import { checkPeriodLock } from "@/lib/periodLock";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export class IncentiveError extends Error {
  constructor(status, body) {
    super(body?.error || "Incentive operation failed");
    this.status = status;
    this.body = body;
  }
}

export async function findOrCreateIncentivePayable({
  session,
  employeeId,
  employeeLabel,
  branch,
  period,
  relatedPatient,
  date,
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
  if (!withPaid) return;

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
