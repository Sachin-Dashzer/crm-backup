import { NON_CASH_METHODS } from "@/constants/bankRouting";
import { APPROVAL_EXCLUDED } from "@/lib/accountBalances";

// Receipts & Payments is PURE CASH BASIS — the exact inverse of the P&L's inclusion rule:
//
//              | P&L                | Receipts & Payments
//   isSettlement: true      | EXCLUDE             | INCLUDE — cash genuinely moved
//   paid_to_external/_by_other | EXCLUDE          | EXCLUDE — cash never touched us
//   offset_settlement, including-package | INCLUDE| EXCLUDE — no cash moved
//   reversals (negative rows) | INCLUDE           | INCLUDE — they net out correctly
//
// NON_CASH_METHODS already covers both the offset/package pair AND the two "someone else
// handled the cash" methods (see src/constants/bankRouting.js), so excluding it here gets all
// three EXCLUDE rows in one filter. isSettlement is deliberately NOT filtered — that's the
// entire point of a cash-basis report.
//
// `branchFilter` is the object returned by resolveBranchFilter(session, branch) — e.g.
// `{ branch: "Delhi" }` or `{ branch: { $in: COLLAB_BRANCHES } } }` or `{}` — spread in as-is so
// a collab-role session's expanded city list is respected, not just a single string match.
//
// approvalStatus deliberately uses APPROVAL_EXCLUDED ($nin PENDING/REJECTED), NOT a strict
// equality against "APPROVED" — the spec's own pseudocode shows the strict form, but
// src/lib/accountBalances.js's identical comment explains why that's wrong: ~22k historical
// rows predate the approvalStatus field and carry null, and a strict equality check would drop
// them, breaking the reconciliation invariant this whole page exists to prove. Matching
// accountBalances.js's rule exactly is what makes the reconciliation strip tie out to the rupee.
export function buildCashBasisMatch({ costType, branchFilter, to, account, receiptMode } = {}) {
  const match = {
    approvalStatus: { $nin: APPROVAL_EXCLUDED },
    method: { $nin: NON_CASH_METHODS },
    furtherMode: { $nin: ["", null] },
    ...(branchFilter || {}),
  };
  if (costType) match.costType = costType;
  if (account) match.furtherMode = account;
  if (receiptMode) match.receiptMode = receiptMode;
  // Upper bound only, deliberately — buildCashFlowGroupedStages needs rows BEFORE `from` too,
  // to compute each bucket's opening figure. The lower bound is applied inside that function.
  if (to) match.date = { $lte: new Date(to) };
  return match;
}

// Revenue-side Level-1 bucket. A row with receivableId set is a receipt AGAINST a receivable
// (patient due, refund, collab settlement, or the external-party settlement flow) regardless of
// its transactionCategory, so that takes priority over the Transplant/Services/Medicine split —
// mirrors how Task 1's entryType badge treats a linked document as the primary fact about a row.
export function receiptHeadMatch(head) {
  if (!head) return {};
  if (head === "Receivable Settlement") return { receivableId: { $ne: null } };
  const byHead = { Transplant: "TRANSPLANT", Services: "SERVICE", Medicine: "MEDICINE" };
  if (byHead[head]) return { receivableId: null, transactionCategory: byHead[head] };
  // "Other": no receivable, and not one of the three known revenue categories.
  return { receivableId: null, transactionCategory: { $nin: ["TRANSPLANT", "SERVICE", "MEDICINE"] } };
}

const RECEIPT_HEAD_EXPR = {
  $switch: {
    branches: [
      { case: { $ne: [{ $ifNull: ["$receivableId", null] }, null] }, then: "Receivable Settlement" },
      { case: { $eq: ["$transactionCategory", "TRANSPLANT"] }, then: "Transplant" },
      { case: { $eq: ["$transactionCategory", "SERVICE"] }, then: "Services" },
      { case: { $eq: ["$transactionCategory", "MEDICINE"] }, then: "Medicine" },
    ],
    default: "Other",
  },
};

// Level-1/Level-2 rollup, shared by both /api/receipts/grouped and /api/payments/grouped.
//
//   Receipts  Level 1 = RECEIPT_HEAD_EXPR (Transplant/Services/Medicine/Receivable Settlement/Other)
//             Level 2 = furtherMode (Account) or receiptMode (Receipt Mode), per `groupBy`
//   Payments  Level 1 = expense (Expense Category head, from EXPENSE_CATEGORY_TREE)
//             Level 2 = expenseType (sub-type)
//
// opening/movement/settled/closing mirror buildPayableGroupedStages' carry-forward shape so
// DrillDownTable's existing group-level columns render unmodified. There is no "raised vs
// settled" split in a cash-basis report — every row here IS already-settled cash — so `settled`
// is always 0 and `closing` is simply `opening + movement`. `opening` = this bucket's total
// dated strictly before `from`; `movement` = this bucket's total within [from, to].
export function buildCashFlowGroupedStages({ level, costType, head, groupBy = "account", branchFilter, from, to }) {
  const match = buildCashBasisMatch({ costType, branchFilter, to });

  if (level !== 1 && head) {
    Object.assign(match, costType === "Revenue" ? receiptHeadMatch(head) : { expense: head });
  }

  const headExpr = costType === "Revenue" ? RECEIPT_HEAD_EXPR : { $ifNull: ["$expense", "Uncategorised"] };
  const subExpr =
    costType === "Revenue"
      ? groupBy === "mode"
        ? { $ifNull: ["$receiptMode", "Unspecified"] }
        : { $ifNull: ["$furtherMode", "Unspecified"] }
      : { $ifNull: ["$expenseType", "Uncategorised"] };

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const inRange = {
    $and: [
      fromDate ? { $gte: ["$date", fromDate] } : { $literal: true },
      toDate ? { $lte: ["$date", toDate] } : { $literal: true },
    ],
  };
  const beforeRange = fromDate ? { $lt: ["$date", fromDate] } : { $literal: false };

  return [
    { $match: match },
    {
      $addFields: {
        _bucket: level === 1 ? headExpr : subExpr,
        _before: { $cond: [beforeRange, "$amount", 0] },
        _inRange: { $cond: [inRange, "$amount", 0] },
        _counted: { $cond: [inRange, 1, 0] },
      },
    },
    {
      $group: {
        _id: "$_bucket",
        opening: { $sum: "$_before" },
        movement: { $sum: "$_inRange" },
        count: { $sum: "$_counted" },
      },
    },
    {
      $project: {
        _id: 0,
        key: "$_id",
        label: "$_id",
        opening: 1,
        movement: 1,
        settled: { $literal: 0 },
        closing: { $add: ["$opening", "$movement"] },
        count: 1,
      },
    },
    { $sort: { key: 1 } },
  ];
}

// Level-3 leaf match — the actual transactions for a selected head (+ sub), date-bounded on
// both ends (unlike the grouped rollup above, a leaf listing has no "opening" concept to
// preserve pre-range rows for).
export function buildCashFlowLeafMatch({ costType, head, sub, groupBy = "account", branchFilter, from, to }) {
  const match = buildCashBasisMatch({ costType, branchFilter, to });
  if (from) match.date = { ...(match.date || {}), $gte: new Date(from) };

  if (costType === "Revenue") {
    if (head) Object.assign(match, receiptHeadMatch(head));
    if (sub) {
      if (groupBy === "mode") match.receiptMode = sub;
      else match.furtherMode = sub;
    }
  } else {
    if (head) match.expense = head;
    if (sub) match.expenseType = sub;
  }
  return match;
}
