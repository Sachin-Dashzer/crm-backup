import AccountPeriod from "@/models/AccountPeriod";
import { ACCOUNTS, NON_CASH_METHODS } from "@/constants/bankRouting";
export const APPROVAL_EXCLUDED = ["PENDING", "REJECTED"];

// The single source of truth for "does this row move an account balance".
export function buildBalanceMatch({
  account,
  accounts,
  from,
  to,
  transactionCategory,
  method,
  branch,
} = {}) {
  const match = {
    approvalStatus: { $nin: APPROVAL_EXCLUDED },
    method: { $nin: NON_CASH_METHODS },
  };

  if (account) match.furtherMode = account;
  else match.furtherMode = { $in: accounts || ACCOUNTS };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  // Optional ledger filters — narrow the view without changing the balance rules.
  if (transactionCategory) match.transactionCategory = transactionCategory;
  if (method) {
    // A caller-supplied method must still respect the non-cash exclusion.
    if (NON_CASH_METHODS.includes(method)) {
      // Asking for a non-cash method can only ever return nothing; make that explicit
      // rather than silently ANDing two contradictory conditions.
      match.method = { $in: [], $nin: NON_CASH_METHODS };
    } else {
      match.method = method;
    }
  }
  if (branch) match.branch = branch;

  return match;
}

// Revenue adds to the account, expenses subtract. Used by both pipelines.
export const SIGNED_AMOUNT = {
  $cond: [{ $eq: ["$costType", "Revenue"] }, "$amount", { $multiply: ["$amount", -1] }],
};

// ── Contra entries (AccountTransfer) ────────────────────────────────────────────────────
//
// Internal transfers live in their own collection so they cannot contaminate any query that
// filters Transactions — see the header of src/models/AccountTransfer.js. They are folded
// into balances here with $unionWith, which keeps it to a single round trip.
//
// One transfer becomes TWO pipeline rows: an outflow on fromAccount and an inflow on
// toAccount. That is what makes a transfer visible in both accounts' ledgers (§5.4) and what
// guarantees the balances still sum to the same total — every rupee added on one side is
// subtracted on the other, so the net contribution across all accounts is exactly zero.
//
// BRANCH FILTER: a transfer may carry a branch, and many don't. A branch-filtered view shows
// only transfers tagged with THAT branch; untagged ones are company-level money that cannot
// honestly be attributed to any single branch, so they stay out of every branch view and appear
// only in the unfiltered one.
//
// This used to exclude contra from branch views wholesale, because AccountTransfer had no branch
// at all. Tagged transfers now reconcile branch-side; untagged ones still don't, which is why
// the sum of branch views can be less than the unfiltered view rather than equal to it.
export function buildContraMatch({ from, to, branch } = {}) {
  const match = { isCancelled: { $ne: true } };
  if (branch) match.branch = branch;
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  return match;
}

// Emits { account, in, out, isContra } rows — the same shape the transaction side is
// projected into — so a single $group downstream sums both sources together.
export function buildContraUnionStage({ from, to, branch, collectionName = "accounttransfers" } = {}) {
  return {
    $unionWith: {
      coll: collectionName,
      pipeline: [
        { $match: buildContraMatch({ from, to, branch }) },
        {
          $project: {
            rows: [
              { account: "$fromAccount", in: 0, out: "$amount", isContra: true },
              { account: "$toAccount", in: "$amount", out: 0, isContra: true },
            ],
          },
        },
        { $unwind: "$rows" },
        { $replaceRoot: { newRoot: "$rows" } },
      ],
    },
  };
}

// Emits FULL LEDGER ROWS — one per contra entry touching `account` — so the account ledger can
// show internal transfers inline with ordinary movements, each with its own running balance.
//
// Distinct from buildContraUnionStage above: same source data, different shape. That one
// collapses a transfer into { account, in, out } for the balance sheet's $group; this one keeps
// the per-row detail (date, counterparty, reference) a summed row throws away.
//
// One transfer produces exactly ONE row here, not two — the outflow row lands in fromAccount's
// ledger and the inflow row in toAccount's, and a ledger only ever shows one account. (The model
// rejects fromAccount === toAccount, so the two can never collide in the same ledger.)
//
// Returns null when the requested row set cannot contain a contra entry at all, so the caller
// skips the union entirely. A transfer has no transactionCategory and no method, so under either
// of those filters it could only ever be a false positive:
//   - transactionCategory -> a transfer is neither revenue nor expense
//   - method              -> no cash instrument is involved, the money never leaves the business
//
// A branch filter is different now that transfers can be tagged: it narrows to that branch's
// transfers rather than removing them all. See BRANCH FILTER above.
export function buildContraLedgerUnionStage({
  account,
  from,
  to,
  branch,
  transactionCategory,
  method,
  collectionName = "accounttransfers",
} = {}) {
  if (transactionCategory || method) return null;

  return {
    $unionWith: {
      coll: collectionName,
      pipeline: [
        {
          $match: {
            ...buildContraMatch({ from, to, branch }),
            $or: [{ fromAccount: account }, { toAccount: account }],
          },
        },
        {
          $project: {
            date: 1,
            amount: 1,
            reference: 1,
            remarks: 1,
            fromAccount: 1,
            toAccount: 1,
            isContra: { $literal: true },
            // Task 3: an explicit discriminator so the client never has to infer row type from
            // isContra/isSuspense absence — a contra transfer lives in AccountTransfer, not
            // Transactions, and /admin/transactions/edit/[id] cannot resolve its _id.
            sourceKind: { $literal: "CONTRA" },
            // Inflow when the money lands in this account, outflow when it leaves it.
            signedAmount: {
              $cond: [
                { $eq: ["$toAccount", account] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      ],
    },
  };
}

// ── Suspense entries ────────────────────────────────────────────────────────────────────
//
// Unexplained bank movement, living in its own collection for the same isolation reason contra
// does — see src/models/SuspenseEntry.js. Folded into ACCOUNT BALANCES only: a suspense entry
// moves a bank balance so the CRM reconciles with the statement, and never appears in a
// revenue or expense total, because unidentified money is not income.
//
// ONLY OPEN ENTRIES COUNT. Once resolved, the real transaction carries that money and is itself
// counted; leaving the suspense row in would double it. Same for cancelled. This is the whole
// correctness condition of the feature, so it lives in the match builder rather than at each
// call site where one caller could forget it.
export function buildSuspenseMatch({ from, to, branch } = {}) {
  const match = { isResolved: { $ne: true }, isCancelled: { $ne: true } };
  if (branch) match.branch = branch;
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }
  return match;
}

// Emits { account, in, out, isContra } rows for the balance-sheet group. isContra is false —
// a suspense entry is not a transfer; it is counted as ordinary movement on one account, and
// unlike contra it does NOT net to zero across accounts. That asymmetry is correct: the money
// genuinely entered (or left) the business from an unknown counterparty.
export function buildSuspenseUnionStage({ from, to, branch, collectionName = "suspenseentries" } = {}) {
  return {
    $unionWith: {
      coll: collectionName,
      pipeline: [
        { $match: buildSuspenseMatch({ from, to, branch }) },
        {
          $project: {
            account: "$account",
            in: { $cond: [{ $eq: ["$direction", "OUT"] }, 0, "$amount"] },
            out: { $cond: [{ $eq: ["$direction", "OUT"] }, "$amount", 0] },
            isContra: { $literal: false },
            isSuspense: { $literal: true },
          },
        },
      ],
    },
  };
}

// Full ledger rows for ONE account, so an unexplained credit appears inline in the ledger with
// its own running balance rather than as an unexplained gap between the CRM and the bank.
//
// Null under a category or method filter: a suspense entry has neither, so it could only ever
// be a false match. A branch filter narrows rather than excludes, as with contra.
export function buildSuspenseLedgerUnionStage({
  account,
  from,
  to,
  branch,
  transactionCategory,
  method,
  collectionName = "suspenseentries",
} = {}) {
  if (transactionCategory || method) return null;

  return {
    $unionWith: {
      coll: collectionName,
      pipeline: [
        { $match: { ...buildSuspenseMatch({ from, to, branch }), account } },
        {
          $project: {
            date: 1,
            amount: 1,
            reference: 1,
            remarks: 1,
            direction: 1,
            branch: 1,
            isSuspense: { $literal: true },
            isContra: { $literal: false },
            sourceKind: { $literal: "SUSPENSE" },
            signedAmount: {
              $cond: [{ $eq: ["$direction", "OUT"] }, { $multiply: ["$amount", -1] }, "$amount"],
            },
          },
        },
      ],
    },
  };
}

// Suspense movement totals for one account over one period, in the same { totalIn, totalOut }
// shape computeMovements() returns — so a period snapshot includes unexplained bank movement
// and its closing balance still matches the statement.
export async function computeSuspenseMovements(account, from, to, session = null, branch = null) {
  const { default: SuspenseEntry } = await import("@/models/SuspenseEntry");

  const [agg] = await SuspenseEntry.aggregate([
    { $match: { ...buildSuspenseMatch({ from, to, branch }), account } },
    {
      $group: {
        _id: null,
        totalIn: { $sum: { $cond: [{ $eq: ["$direction", "OUT"] }, 0, "$amount"] } },
        totalOut: { $sum: { $cond: [{ $eq: ["$direction", "OUT"] }, "$amount", 0] } },
        suspenseCount: { $sum: 1 },
      },
    },
  ]).session(session);

  return {
    totalIn: round2(agg?.totalIn || 0),
    totalOut: round2(agg?.totalOut || 0),
    suspenseCount: agg?.suspenseCount || 0,
  };
}

// Projects a matched Transactions row into the same { account, in, out } shape.
export const TRANSACTION_TO_MOVEMENT = {
  $project: {
    account: "$furtherMode",
    in: { $cond: [{ $eq: ["$costType", "Revenue"] }, "$amount", 0] },
    out: { $cond: [{ $eq: ["$costType", "Revenue"] }, 0, "$amount"] },
    isContra: { $literal: false },
  },
};

// An account's opening balance for a period is the closing balance of the most recent
// CLOSED snapshot ending on or before the period start. With no snapshot (nothing seeded
// or closed yet) the opening balance is 0 and the caller should say so rather than imply
// the account genuinely held nothing.
// `branch` selects WHICH position is being asked for:
//   a branch name  -> that branch's own opening row
//   null (default) -> the WHOLE-COMPANY position
//
// A branch with no row of its own returns 0 / seeded:false rather than falling back to the
// company figure. Falling back would hand one branch the entire company's opening balance and
// make its ledger read as though every other branch's money were sitting in it.
//
// The company position is resolved in this order, and the order matters:
//
//   1. The most recent company-level CLOSED PERIOD (one that spans time). This is a frozen,
//      already-reported figure produced by the close action — it outranks anything derived,
//      because the entire point of closing a period is that its numbers stop moving.
//   2. Otherwise, the SUM of each branch's most recent row. Opening balances are entered per
//      branch, so the company's opening position is what the branches add up to.
//   3. Otherwise, a company-level SEED, for books that were only ever seeded company-wide.
//   4. Otherwise 0, and seeded:false so the caller can say "not set" rather than imply the
//      account genuinely held nothing.
//
// Step 2 is why entering a branch balance now shows up in the unfiltered close book. Note it
// sums OPENING rows only — contra entries still carry no branch, so a branch-filtered view of
// MOVEMENT will not reconcile with the unfiltered one. Openings reconcile; movements don't.
// A stored row is a SEED when it spans no time — it states a position as of a date rather than
// summarising a period. The distinction decides the carry-forward boundary below.
const isSeedRow = (p) =>
  !!p && new Date(p.periodStart).getTime() === new Date(p.periodEnd).getTime();

// Finds the most recent stored figure at or before `asOf`, and the boundary from which later
// movement still has to be added. Returns null when nothing has ever been stored.
async function resolveAnchor(account, asOf, branch) {
  if (branch) {
    const prior = await AccountPeriod.findOne({
      account,
      branch,
      isClosed: true,
      periodEnd: { $lte: asOf },
    })
      .sort({ periodEnd: -1 })
      .lean();
    if (!prior) return null;
    return {
      value: prior.closingBalance,
      anchorDate: prior.periodEnd,
      isSeed: isSeedRow(prior),
      source: { periodEnd: prior.periodEnd, id: prior._id },
      derivedFromBranches: false,
    };
  }

  // 1. A real closed period beats anything derived.
  const closedPeriod = await AccountPeriod.findOne({
    account,
    branch: null,
    isClosed: true,
    periodEnd: { $lte: asOf },
    $expr: { $ne: ["$periodStart", "$periodEnd"] },
  })
    .sort({ periodEnd: -1 })
    .lean();

  if (closedPeriod) {
    return {
      value: closedPeriod.closingBalance,
      anchorDate: closedPeriod.periodEnd,
      isSeed: false,
      source: { periodEnd: closedPeriod.periodEnd, id: closedPeriod._id },
      derivedFromBranches: false,
    };
  }

  // 2. Sum the branches — newest row per branch at or before the date.
  const perBranch = await AccountPeriod.aggregate([
    { $match: { account, branch: { $ne: null }, isClosed: true, periodEnd: { $lte: asOf } } },
    { $sort: { periodEnd: -1 } },
    {
      $group: {
        _id: "$branch",
        closingBalance: { $first: "$closingBalance" },
        periodStart: { $first: "$periodStart" },
        periodEnd: { $first: "$periodEnd" },
      },
    },
  ]);

  if (perBranch.length > 0) {
    const latest = perBranch.reduce(
      (l, b) => (!l || b.periodEnd > l ? b.periodEnd : l),
      null,
    );
    return {
      value: perBranch.reduce((t, b) => t + (b.closingBalance || 0), 0),
      anchorDate: latest,
      // Branch rows are only ever opening seeds — closes are company-level.
      isSeed: true,
      source: {
        periodEnd: latest,
        branches: perBranch.map((b) => ({ branch: b._id, openingBalance: b.closingBalance })),
      },
      derivedFromBranches: true,
    };
  }

  // 3. A company-wide seed, for books never split by branch.
  const companySeed = await AccountPeriod.findOne({
    account,
    branch: null,
    isClosed: true,
    periodEnd: { $lte: asOf },
  })
    .sort({ periodEnd: -1 })
    .lean();

  if (!companySeed) return null;
  return {
    value: companySeed.closingBalance,
    anchorDate: companySeed.periodEnd,
    isSeed: isSeedRow(companySeed),
    source: { periodEnd: companySeed.periodEnd, id: companySeed._id },
    derivedFromBranches: false,
  };
}

// Net change to an account's balance over a window, from EVERY source that moves it —
// transactions, contra transfers and open suspense entries. One place, so a caller cannot
// accidentally count two of the three.
export async function computeNetMovement(account, from, to, branch = null, session = null) {
  const { default: Transactions } = await import("@/models/Transactions");

  const [txAgg] = await Transactions.aggregate([
    { $match: buildBalanceMatch({ account, from, to, branch }) },
    { $group: { _id: null, net: { $sum: SIGNED_AMOUNT } } },
  ]).session(session);

  const contra = await computeContraMovements(account, from, to, session, branch);
  const suspense = await computeSuspenseMovements(account, from, to, session, branch);

  return round2(
    (txAgg?.net || 0) +
      (contra.totalIn - contra.totalOut) +
      (suspense.totalIn - suspense.totalOut),
  );
}

// The opening balance for a period = the last stored figure, PLUS everything that has moved
// since it. That carry-forward is the whole point: opening balances are anchored once and roll
// forward on their own, so a period does not need its own manually entered figure.
//
// Without it, the ledger for 2 April reported 1 April's seeded number — both dates resolve to
// the same stored row, and 1 April's own activity was never added on top. Every later date
// repeated the same stale figure.
//
// CARRY BOUNDARY, and the two kinds of stored row differ:
//   SEED (spans no time)          — states the position at the START of its date, so movement ON
//                                   that date still counts. Carry from the anchor date inclusive.
//   CLOSED PERIOD (spans time)    — its closingBalance already contains everything through
//                                   periodEnd. Carry from periodEnd exclusive, or that period's
//                                   own movement is counted twice.
// With no stored row at all, carry from the beginning of time — the balance is then simply
// everything that ever happened before this period, which needs no manual seeding to be right.
//
// `branch` selects WHICH position is asked for:
//   a branch name  -> that branch's own row, plus that branch's movement
//   null (default) -> the whole-company position
//
// A branch with no row of its own does not fall back to the company figure — that would hand one
// branch the entire company's opening balance and make its ledger read as though every other
// branch's money were sitting in it.
//
// The company anchor is resolved in a deliberate order — closed period, then the sum of branch
// seeds, then a company-wide seed — see resolveAnchor above.
export async function getOpeningBalance(account, periodStart, branch = null) {
  const asOf = new Date(periodStart);
  const anchor = await resolveAnchor(account, asOf, branch);

  const carryFrom = anchor
    ? anchor.isSeed
      ? new Date(anchor.anchorDate)
      : new Date(new Date(anchor.anchorDate).getTime() + 1)
    : null;
  // Strictly before the period opens — movement ON the first day belongs to the period itself,
  // not to its opening balance.
  const carryTo = new Date(asOf.getTime() - 1);

  let carried = 0;
  if (!carryFrom || carryFrom.getTime() <= carryTo.getTime()) {
    carried = await computeNetMovement(account, carryFrom, carryTo, branch);
  }

  const base = anchor?.value ?? 0;
  return {
    openingBalance: round2(base + carried),
    source: anchor?.source ?? null,
    seeded: !!anchor,
    derivedFromBranches: anchor?.derivedFromBranches ?? false,
    // Split out so the UI can show where the figure came from: the anchored number, and how
    // much has accumulated on top of it since.
    anchorBalance: round2(base),
    carriedForward: round2(carried),
  };
}

export async function getOpeningBalances(accounts, periodStart, branch = null) {
  const entries = await Promise.all(
    accounts.map(async (a) => [a, await getOpeningBalance(a, periodStart, branch)]),
  );
  return Object.fromEntries(entries);
}

// Round to paise so a long chain of additions can't drift on binary-float edges.
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Contra movement totals for ONE account over one period, in the same { totalIn, totalOut }
// shape computeMovements() returns for transactions — so a period snapshot can fold internal
// transfers in without re-deriving the direction rule for the third time.
//
// This exists because a closed period's closingBalance becomes the NEXT period's opening
// balance. A snapshot computed without contra therefore doesn't just misreport its own period,
// it hands every later period a wrong opening and the error compounds forward silently — the
// drift failure recomputeChain() is built to prevent.
//
// Lazily imported for the same reason getAccountBalance() below does it.
export async function computeContraMovements(account, from, to, session = null, branch = null) {
  const { default: AccountTransfer } = await import("@/models/AccountTransfer");

  const [agg] = await AccountTransfer.aggregate([
    {
      $match: {
        ...buildContraMatch({ from, to, branch }),
        $or: [{ fromAccount: account }, { toAccount: account }],
      },
    },
    {
      $group: {
        _id: null,
        totalIn: { $sum: { $cond: [{ $eq: ["$toAccount", account] }, "$amount", 0] } },
        totalOut: { $sum: { $cond: [{ $eq: ["$fromAccount", account] }, "$amount", 0] } },
        contraCount: { $sum: 1 },
      },
    },
  ]).session(session);

  return {
    totalIn: round2(agg?.totalIn || 0),
    totalOut: round2(agg?.totalOut || 0),
    contraCount: agg?.contraCount || 0,
  };
}

// Live balance for ONE account as of a date: the last stored figure plus every movement since,
// across transactions, contra transfers and open suspense entries.
//
// Expressed as "the opening balance of the instant AFTER `asOfDate`", which is by definition the
// closing position at `asOfDate`. getOpeningBalance already anchors and carries forward, so
// asking it this way reuses that logic rather than restating it — this function used to repeat
// all three aggregations by hand, and once opening balances began carrying forward that
// duplicate would have counted the same movement twice.
//
// No caching, no stored aggregate: computed from the collections each call, so a new transaction
// is reflected immediately with nothing to invalidate. Used by the contra form's live balance
// display and by the negative-balance warning on save.
export async function getAccountBalance(account, asOfDate, branch = null) {
  const to = asOfDate ? new Date(asOfDate) : new Date();
  const { openingBalance } = await getOpeningBalance(
    account,
    new Date(to.getTime() + 1),
    branch,
  );
  return openingBalance;
}
