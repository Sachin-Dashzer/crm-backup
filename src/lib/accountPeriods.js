import Transactions from "@/models/Transactions";
import AccountPeriod, { isOpeningSeed } from "@/models/AccountPeriod";
import {
  buildBalanceMatch,
  computeContraMovements,
  computeSuspenseMovements,
  getOpeningBalance,
  round2,
} from "@/lib/accountBalances";

// Closing, reopening and — critically — recomputing the chain of periods that follow.
//
// A stale chain is the worst failure mode this feature has: if April's opening balance still
// reflects March's pre-edit closing figure, every month after it is wrong by the same delta,
// and nothing looks broken. Every figure still adds up internally; it is simply not the
// truth. So any change to a period ALWAYS walks forward and recomputes every later period
// for that account, in date order, and logs each one it touched.

// Movement totals for one account over one period. Reuses the exact same match builder the
// ledger and balance sheet use, so a period snapshot can never be computed under different
// rules than the view that was checked before closing.
//
// CONTRA ENTRIES COUNT HERE. They move real money between our own accounts, so a period that
// contains one has a genuinely different closing balance because of it. Leaving them out did
// not merely misreport the period: this closingBalance is what getOpeningBalance() hands the
// NEXT period, so the omission propagated forward into every later period — and the balance
// sheet (which has always included contra) disagreed with the snapshot the whole time.
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
    // Open suspense entries move the bank balance too, so a snapshot that omitted them would
    // close at a figure the statement disagrees with — and hand that error to the next period.
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

// Full figures for a period: opening carried from whatever closed period precedes it, plus
// freshly-computed movement.
export async function computePeriodFigures(account, periodStart, periodEnd, session = null) {
  const { openingBalance } = await getOpeningBalance(account, periodStart);
  const movements = await computeMovements(account, periodStart, periodEnd, session);
  return {
    openingBalance: round2(openingBalance),
    ...movements,
    closingBalance: round2(openingBalance + movements.totalIn - movements.totalOut),
  };
}

// Walks every period for `account` starting at or after `fromDate`, in chronological order,
// recomputing each one's opening from the previous period's closing and its movement from
// the transactions themselves. Returns one entry per period touched.
//
// Opening seeds are skipped as anchors, not recomputed: a seed is a hand-entered statement
// of fact about a date before the system had data, and recomputing it from transactions
// (of which there are none) would silently zero it and cascade that zero forward.
export async function recomputeChain({ account, fromDate, actor, reason, session = null }) {
  // branch: null — the chain is company-level. Branch opening seeds are hand-entered statements
  // of fact with no movement behind them; sweeping them into a recompute would zero them from
  // transactions that were never attributed to them and cascade that zero forward.
  const periods = await AccountPeriod.find({
    account,
    branch: null,
    periodStart: { $gte: new Date(fromDate) },
  })
    .sort({ periodStart: 1, periodEnd: 1 })
    .session(session);

  const touched = [];

  // The closing balance carried forward from the period we just recomputed.
  //
  // This MUST be carried explicitly rather than re-derived per period via
  // getOpeningBalance(), which only considers CLOSED periods. During a reopen the period
  // being fixed is by definition open, so a per-period lookup would skip straight past it to
  // the last closed period before it and hand every later period a stale opening — the exact
  // silent-drift failure this whole function exists to prevent. Caught by the three-period
  // chain test, which saw February inherit December's figure instead of January's.
  let carriedClosing = null;

  for (const period of periods) {
    if (isOpeningSeed(period)) {
      // A seed states the opening position at its date; anything after it continues from there.
      carriedClosing = period.closingBalance;
      continue;
    }

    const previousClosing = period.closingBalance;

    // First real period in the walk anchors off whatever closed period precedes it; every
    // period after that continues from the one immediately before it in this same walk.
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
