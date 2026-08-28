import Transactions from "@/models/Transactions";
import AccountPeriod, { isOpeningSeed } from "@/models/AccountPeriod";
import {
  buildBalanceMatch,
  computeContraMovements,
  computeSuspenseMovements,
  getOpeningBalance,
  round2,
} from "@/lib/accountBalances";

export async function computeMovements(account, periodStart, periodEnd, session = null) {
  const [[agg], contra, suspense] = await Promise.all([
    Transactions.aggregate([
      { $match: buildBalanceMatch({ account, from: periodStart, to: periodEnd }) },
      {
        $group: {
          _id: null,
          totalIn: { $sum: { $cond: [{ $eq: ["$costType", "Revenue"] }, "$amount", 0] } },
          totalOut: { $sum: { $cond: [{ $eq: ["$costType", "Revenue"] }, 0, "$amount"] } },
          transactionCount: { $sum: 1 },
        },
      },
    ]).session(session),
    computeContraMovements(account, periodStart, periodEnd, session),
    computeSuspenseMovements(account, periodStart, periodEnd, session),
  ]);

  return {
    totalIn: round2((agg?.totalIn || 0) + contra.totalIn + suspense.totalIn),
    totalOut: round2((agg?.totalOut || 0) + contra.totalOut + suspense.totalOut),
    transactionCount: agg?.transactionCount || 0,
    contraCount: contra.contraCount,
    suspenseCount: suspense.suspenseCount,
  };
}

export async function computePeriodFigures(account, periodStart, periodEnd, session = null) {
  const { openingBalance } = await getOpeningBalance(account, periodStart);
  const movements = await computeMovements(account, periodStart, periodEnd, session);
  return {
    openingBalance: round2(openingBalance),
    ...movements,
    closingBalance: round2(openingBalance + movements.totalIn - movements.totalOut),
  };
}

export async function recomputeChain({ account, fromDate, actor, reason, session = null }) {
  const periods = await AccountPeriod.find({
    account,
    branch: null,
    periodStart: { $gte: new Date(fromDate) },
  })
    .sort({ periodStart: 1, periodEnd: 1 })
    .session(session);

  const touched = [];

  let carriedClosing = null;

  for (const period of periods) {
    if (isOpeningSeed(period)) {
      carriedClosing = period.closingBalance;
      continue;
    }

    const previousClosing = period.closingBalance;

    const openingBalance =
      carriedClosing !== null
        ? carriedClosing
        : (await getOpeningBalance(account, period.periodStart)).openingBalance;

    const movements = await computeMovements(
      account,
      period.periodStart,
      period.periodEnd,
      session,
    );
    const closingBalance = round2(openingBalance + movements.totalIn - movements.totalOut);

    const changed =
      round2(period.openingBalance) !== round2(openingBalance) ||
      round2(period.totalIn) !== movements.totalIn ||
      round2(period.totalOut) !== movements.totalOut ||
      round2(period.closingBalance) !== closingBalance;

    period.openingBalance = round2(openingBalance);
    period.totalIn = movements.totalIn;
    period.totalOut = movements.totalOut;
    period.transactionCount = movements.transactionCount;
    period.contraCount = movements.contraCount;
    period.closingBalance = closingBalance;

    if (changed) {
      period.log.push({
        action: "Recomputed",
        reason: reason || "Recomputed after an earlier period changed",
        previousClosingBalance: previousClosing,
        newClosingBalance: closingBalance,
        performedBy: { name: actor?.name, email: actor?.email },
        performedAt: new Date(),
      });
    }

    await period.save({ session });
    carriedClosing = closingBalance;

    touched.push({
      _id: period._id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      previousClosingBalance: previousClosing,
      closingBalance,
      changed,
    });
  }

  return touched;
}
