import { buildAgeingStages } from "@/lib/ageing";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

// Shared aggregation stages for computing a Payable's paid/pending/status
// from the EXPENSE Transactions linked to it via payableId. Paid/pending is
// NEVER stored on the Payable — always computed here, at query time, from
// the Transactions collection (the single source of truth for money moved).
// Used by both /api/payables/list and /api/payables/summary so the two
// routes can never disagree on what "pending" means.
//
// A Borrowing repayment (direction "OUT") also pays a Payable down, but it lives in the
// Borrowing collection, not Transactions — see src/models/Borrowing.js for why. A second
// $lookup folds those rows in the same way, so "paid" means the same thing regardless of which
// collection actually recorded the money movement. For every ordinary (non-borrowing) Payable
// this $lookup simply matches nothing — no Borrowing row is ever created against a payableId
// this route didn't itself hand out — so every existing report is unaffected.
//
// §4.2 — a third source: an Advance that SETTLES this payable (Advance.settlesPayableId — an
// unrelated, pre-existing obligation an advance offsets, e.g. an advance paid to a rent vendor
// settled against their own rent payable). Economically identical to a payment, so it folds into
// the SAME "paid" — this is what makes the payable's pending (and every existing rollup that
// sums it) drop automatically, with no other code needing to know settlement exists. `pending`
// stays clamped at 0 exactly as before — never negative, so no existing consumer that sums it
// across many documents can have one party's overpayment silently cancel another's balance. The
// unclamped signed figure, for the single-document "advance in hand" display (see
// DrillDownTable.jsx), is added separately below as netPending/advanceInHand — never by
// touching this clamp.
//
// Ageing (daysOverdue / daysToDue / ageingBucket) is appended from the shared
// buildAgeingStages() so the header summary and the table age rows identically.
export function buildPayableAggregationStages(
  txCollectionName,
  borrowingsCollectionName = "borrowings",
  advancesCollectionName = "advances",
) {
  return [
    {
      $lookup: {
        from: txCollectionName,
        let: { payableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$payableId", "$$payableId"] },
                  { $eq: ["$approvalStatus", "APPROVED"] },
                  // A paid_by_other row never actually settles a payable — the money wasn't
                  // physically paid by us. Defensive consistency guard, same reasoning as
                  // receivableAggregation.js.
                  { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                ],
              },
            },
          },
          { $group: { _id: null, paid: { $sum: "$amount" }, paymentCount: { $sum: 1 } } },
        ],
        as: "paymentAgg",
      },
    },
    {
      $lookup: {
        from: borrowingsCollectionName,
        let: { payableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$payableId", "$$payableId"] },
                  { $eq: ["$direction", "OUT"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $group: { _id: null, paid: { $sum: "$amount" }, paymentCount: { $sum: 1 } } },
        ],
        as: "borrowingAgg",
      },
    },
    {
      $lookup: {
        from: advancesCollectionName,
        let: { payableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$settlesPayableId", "$$payableId"] },
                  { $eq: ["$direction", "OUT"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $group: { _id: null, paid: { $sum: "$amount" }, paymentCount: { $sum: 1 } } },
        ],
        as: "advanceSettlementAgg",
      },
    },
    {
      $addFields: {
        paid: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$paymentAgg.paid", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$borrowingAgg.paid", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$advanceSettlementAgg.paid", 0] }, 0] },
          ],
        },
        paymentCount: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$paymentAgg.paymentCount", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$borrowingAgg.paymentCount", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$advanceSettlementAgg.paymentCount", 0] }, 0] },
          ],
        },
      },
    },
    {
      $addFields: {
        pending: { $max: [{ $subtract: ["$totalAmount", "$paid"] }, 0] },
        // §4.2 — unclamped signed pending, and the amount by which an advance settling this
        // payable exceeds it ("advance in hand"). Never summed into a roll-up; read only by a
        // single document's own display (see DrillDownTable.jsx's documentColumns).
        netPending: { $subtract: ["$totalAmount", "$paid"] },
        advanceInHand: { $max: [{ $subtract: ["$paid", "$totalAmount"] }, 0] },
        status: {
          $switch: {
            branches: [
              { case: { $lte: ["$totalAmount", "$paid"] }, then: "Paid" },
              {
                case: {
                  $and: [
                    // See the identical guard in receivableAggregation.js: a bare
                    // { $ne: ["$dueDate", null] } is TRUE for an ABSENT field, and an absent
                    // date also passes $lt against $$NOW, so undated payables were all being
                    // reported Overdue. These two files are mirrors — fix them together.
                    { $ne: [{ $ifNull: ["$dueDate", null] }, null] },
                    { $lt: ["$dueDate", "$$NOW"] },
                    { $lt: ["$paid", "$totalAmount"] },
                  ],
                },
                then: "Overdue",
              },
              { case: { $gt: ["$paid", 0] }, then: "Partially Paid" },
            ],
            default: "Pending",
          },
        },
      },
    },
    ...buildAgeingStages(),
    { $project: { paymentAgg: 0, borrowingAgg: 0, advanceSettlementAgg: 0 } },
  ];
}

// ── Grouped rollup for the accounting drill-down UI (Liabilities page) ────────────────────
//
// Same "paid via linked APPROVED, settled Transactions" rule as buildPayableAggregationStages
// above, rolled up by expenseCategory (HEAD, level 1) then expenseSubType (SUB-TYPE, level 2)
// instead of per-document. A bucket's "opening" is the pending amount (raised − paid) carried in
// from BEFORE `from` — the same carry-forward idea accountBalances.js uses for account opening
// balances — so movement/settled inside the window plus opening reproduces closing.
//
// groupBy: "vendor" (Vendors page) rolls up by payee.refId instead of expenseCategory/
// expenseSubType — same carry-forward math, restricted to payee.kind: "VENDOR" (the only kind
// with a stable refId to group on), single level (vendors aren't organised in a category tree,
// so there's no level-2 sub-bucket the way expenseCategory has expenseSubType).
export function buildPayableGroupedStages(txCollectionName, { level, category, subType, branch, from, to, groupBy = "category", borrowingsCollectionName = "borrowings" } = {}) {
  const isVendor = groupBy === "vendor";
  const match = { isCancelled: { $ne: true } };
  if (isVendor) match["payee.kind"] = "VENDOR";
  if (branch) match.branch = branch;
  if (!isVendor) {
    if (level !== 1 && category) match.expenseCategory = category;
    if (level === 2 && subType) match.expenseSubType = subType;
  }

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const inRange = (field) => ({
    $and: [
      fromDate ? { $gte: [field, fromDate] } : { $literal: true },
      toDate ? { $lte: [field, toDate] } : { $literal: true },
    ],
  });
  const beforeRange = (field) => (fromDate ? { $lt: [field, fromDate] } : { $literal: false });

  const groupId = isVendor
    ? { bucket: "$payee.refId" }
    : level === 1
      ? { bucket: { $ifNull: ["$expenseCategory", "Uncategorised"] } }
      : { bucket: { $ifNull: ["$expenseSubType", "Uncategorised"] } };

  return [
    { $match: match },
    {
      $lookup: {
        from: txCollectionName,
        let: { payableId: "$_id" },
        pipeline: [
          // Mirrors receivableAggregation.js: anything dated after `to` contributes to neither
          // paidBeforeRange (date < from) nor paidInRange (from <= date <= to), so excluding it
          // here is exactly equivalent. No lower bound — paidBeforeRange needs prior history.
          ...(toDate ? [{ $match: { date: { $lte: toDate } } }] : []),
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$payableId", "$$payableId"] },
                  { $eq: ["$approvalStatus", "APPROVED"] },
                  { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                ],
              },
            },
          },
          { $project: { amount: 1, date: 1 } },
        ],
        as: "payments",
      },
    },
    // A Borrowing repayment (direction "OUT") pays a Payable down the same way a Transaction
    // does, but lives in the Borrowing collection — see the identical $lookup and its comment
    // in buildPayableAggregationStages above. Concatenated into "payments" before the
    // before/in-range split below, so every bucket that follows treats the two sources as one.
    {
      $lookup: {
        from: borrowingsCollectionName,
        let: { payableId: "$_id" },
        pipeline: [
          ...(toDate ? [{ $match: { date: { $lte: toDate } } }] : []),
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$payableId", "$$payableId"] },
                  { $eq: ["$direction", "OUT"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $project: { amount: 1, date: 1 } },
        ],
        as: "borrowingPayments",
      },
    },
    {
      $addFields: {
        payments: { $concatArrays: ["$payments", "$borrowingPayments"] },
      },
    },
    {
      $addFields: {
        paidBeforeRange: {
          $sum: {
            $map: {
              input: { $filter: { input: "$payments", cond: beforeRange("$$this.date") } },
              as: "p",
              in: "$$p.amount",
            },
          },
        },
        paidInRange: {
          $sum: {
            $map: {
              input: { $filter: { input: "$payments", cond: inRange("$$this.date") } },
              as: "p",
              in: "$$p.amount",
            },
          },
        },
        raisedBeforeRange: { $cond: [beforeRange("$createdAt"), "$totalAmount", 0] },
        raisedInRange: { $cond: [inRange("$createdAt"), "$totalAmount", 0] },
      },
    },
    {
      $addFields: {
        openingRow: { $max: [{ $subtract: ["$raisedBeforeRange", "$paidBeforeRange"] }, 0] },
      },
    },
    {
      $group: {
        _id: groupId,
        ...(isVendor ? { label: { $first: "$payee.label" } } : {}),
        opening: { $sum: "$openingRow" },
        movement: { $sum: "$raisedInRange" },
        settled: { $sum: "$paidInRange" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        // ObjectId as a string — this key rides in a URL query param on the way back for the
        // vendor's document drill, unlike the category/sub-type bucket string it replaces.
        key: isVendor ? { $toString: "$_id.bucket" } : "$_id.bucket",
        label: isVendor ? "$label" : "$_id.bucket",
        opening: 1,
        movement: 1,
        settled: 1,
        closing: { $add: ["$opening", { $subtract: ["$movement", "$settled"] }] },
        count: 1,
      },
    },
    // Vendors sort by outstanding balance (worst first) — an alphabetical vendor-name sort would
    // need the label, which post-dates the group stage; closing is already the field of interest.
    { $sort: isVendor ? { closing: -1 } : { key: 1 } },
  ];
}
