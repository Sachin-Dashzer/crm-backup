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
                      {
                        $gt: [
                          {
                            $size: {
                              $filter: {
                                input: { $ifNull: ["$receivableAllocations", []] },
                                cond: { $eq: ["$$this.receivableId", "$$receivableId"] },
                              },
                            },
                          },
                          0,
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
