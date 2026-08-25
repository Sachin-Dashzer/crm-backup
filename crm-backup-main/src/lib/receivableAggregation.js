import { buildAgeingStages } from "@/lib/ageing";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

// Mirror of buildPayableAggregationStages (src/lib/payableAggregation.js) — keys off
// Transactions.receivableId instead of payableId, and only counts Revenue-side transactions
// (a receivable is only ever settled by money coming in). Used identically by both the
// list and summary routes so they can never disagree.
//
// Ageing comes from the same shared buildAgeingStages() the payable side uses, so "31–60 days"
// means the same thing on both pages.
export function buildReceivableAggregationStages(txCollectionName) {
  return [
    {
      $lookup: {
        from: txCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$costType", "Revenue"] },
                  { $eq: ["$approvalStatus", "APPROVED"] },
                  // A paid_to_external/paid_by_other row never actually settles a receivable —
                  // the money wasn't physically collected. In practice the allocator never links
                  // one of these to a receivable in the first place (see
                  // resolveReceivableAllocations), so this is a defensive consistency guard, not
                  // a behavior change.
                  { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                  {
                    $or: [
                      { $eq: ["$receivableId", "$$receivableId"] },
                      // Equivalent to the previous $size($filter(...)) > 0 — both ask "does any
                      // allocation on this row reference this receivable" — but this reads the
                      // ids straight off the array instead of materialising a filtered copy of
                      // the sub-documents for every transaction considered. `$ifNull` keeps rows
                      // with no allocations array behaving exactly as before (no match).
                      {
                        $in: [
                          "$$receivableId",
                          { $ifNull: ["$receivableAllocations.receivableId", []] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            // A row with a non-empty receivableAllocations array is always authoritative —
            // sum only the entries that belong to THIS receivable (a split payment's other
            // entries belong to other receivables). Only a row with no allocations array at
            // all (every pre-existing transaction, and every non-split new one) falls back to
            // its flat receivableId + full amount.
            $addFields: {
              _allocContribution: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$receivableAllocations", []] } }, 0] },
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$receivableAllocations",
                            cond: { $eq: ["$$this.receivableId", "$$receivableId"] },
                          },
                        },
                        as: "a",
                        in: "$$a.amount",
                      },
                    },
                  },
                  "$amount",
                ],
              },
            },
          },
          { $group: { _id: null, received: { $sum: "$_allocContribution" }, receiptCount: { $sum: 1 } } },
        ],
        as: "receiptAgg",
      },
    },
    {
      $addFields: {
        received: { $ifNull: [{ $arrayElemAt: ["$receiptAgg.received", 0] }, 0] },
        receiptCount: { $ifNull: [{ $arrayElemAt: ["$receiptAgg.receiptCount", 0] }, 0] },
      },
    },
    {
      $addFields: {
        pending: { $max: [{ $subtract: ["$totalAmount", "$received"] }, 0] },
        status: {
          $switch: {
            branches: [
              { case: { $lte: ["$totalAmount", "$received"] }, then: "Received" },
              {
                case: {
                  $and: [
                    // $ifNull is load-bearing. A bare { $ne: ["$dueDate", null] } is TRUE when
                    // the field is ABSENT (as opposed to explicitly null) — and an absent date
                    // also satisfies $lt against $$NOW, because missing sorts below every date.
                    // Receivables created without a due date store no field at all, so the bare
                    // form marked every one of them Overdue while the ageing column next to it
                    // correctly showed "—". Same guard ageing.js uses; keep the two in step.
                    { $ne: [{ $ifNull: ["$dueDate", null] }, null] },
                    { $lt: ["$dueDate", "$$NOW"] },
                    { $lt: ["$received", "$totalAmount"] },
                  ],
                },
                then: "Overdue",
              },
              { case: { $gt: ["$received", 0] }, then: "Partially Received" },
            ],
            default: "Pending",
          },
        },
      },
    },
    ...buildAgeingStages(),
    { $project: { receiptAgg: 0 } },
  ];
}

// ── Grouped rollup for the accounting drill-down UI (Assets page) ─────────────────────────
//
// Mirror of buildPayableGroupedStages — see its header for the opening/movement/settled/closing
// carry-forward rule, identical here. Grouped by revenueCategory (HEAD, level 1) then purpose
// (SUB-TYPE, level 2) since Receivable has no expenseSubType-equivalent field; purpose (
// PATIENT_DUE / COLLAB_SETTLEMENT / REFUND_DUE / ADVANCE_RECOVERY / OTHER) is the closest
// second-level split that already exists on the model.
export function buildReceivableGroupedStages(txCollectionName, { level, category, subType, branch, from, to } = {}) {
  const match = { isCancelled: { $ne: true } };
  if (branch) match.branch = branch;
  if (level !== 1 && category) match.revenueCategory = category;
  if (level === 2 && subType) match.purpose = subType;

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const inRange = (field) => ({
    $and: [
      fromDate ? { $gte: [field, fromDate] } : { $literal: true },
      toDate ? { $lte: [field, toDate] } : { $literal: true },
    ],
  });
  const beforeRange = (field) => (fromDate ? { $lt: [field, fromDate] } : { $literal: false });

  const groupId =
    level === 1
      ? { bucket: { $ifNull: ["$revenueCategory", "Uncategorised"] } }
      : { bucket: "$purpose" };

  return [
    { $match: match },
    {
      $lookup: {
        from: txCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
          // Anything dated after `to` contributes to neither bucket below: receivedBeforeRange
          // needs date < from and receivedInRange needs from <= date <= to. Excluding those rows
          // here is exactly equivalent and keeps future-dated receipts out of the join entirely.
          // There is deliberately no lower bound — receivedBeforeRange needs all prior history.
          ...(toDate ? [{ $match: { date: { $lte: toDate } } }] : []),
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$costType", "Revenue"] },
                  { $eq: ["$approvalStatus", "APPROVED"] },
                  { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                  {
                    $or: [
                      { $eq: ["$receivableId", "$$receivableId"] },
                      // Equivalent to the previous $size($filter(...)) > 0 — both ask "does any
                      // allocation on this row reference this receivable" — but this reads the
                      // ids straight off the array instead of materialising a filtered copy of
                      // the sub-documents for every transaction considered. `$ifNull` keeps rows
                      // with no allocations array behaving exactly as before (no match).
                      {
                        $in: [
                          "$$receivableId",
                          { $ifNull: ["$receivableAllocations.receivableId", []] },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              date: 1,
              amount: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$receivableAllocations", []] } }, 0] },
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$receivableAllocations",
                            cond: { $eq: ["$$this.receivableId", "$$receivableId"] },
                          },
                        },
                        as: "a",
                        in: "$$a.amount",
                      },
                    },
                  },
                  "$amount",
                ],
              },
            },
          },
        ],
        as: "receipts",
      },
    },
    {
      $addFields: {
        receivedBeforeRange: {
          $sum: {
            $map: {
              input: { $filter: { input: "$receipts", cond: beforeRange("$$this.date") } },
              as: "r",
              in: "$$r.amount",
            },
          },
        },
        receivedInRange: {
          $sum: {
            $map: {
              input: { $filter: { input: "$receipts", cond: inRange("$$this.date") } },
              as: "r",
              in: "$$r.amount",
            },
          },
        },
        raisedBeforeRange: { $cond: [beforeRange("$createdAt"), "$totalAmount", 0] },
        raisedInRange: { $cond: [inRange("$createdAt"), "$totalAmount", 0] },
      },
    },
    {
      $addFields: {
        openingRow: { $max: [{ $subtract: ["$raisedBeforeRange", "$receivedBeforeRange"] }, 0] },
      },
    },
    {
      $group: {
        _id: groupId,
        opening: { $sum: "$openingRow" },
        movement: { $sum: "$raisedInRange" },
        settled: { $sum: "$receivedInRange" },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        key: "$_id.bucket",
        label: "$_id.bucket",
        opening: 1,
        movement: 1,
        settled: 1,
        closing: { $add: ["$opening", { $subtract: ["$movement", "$settled"] }] },
        count: 1,
      },
    },
    { $sort: { key: 1 } },
  ];
}
