import { buildAgeingStages } from "@/lib/ageing";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

// Shared aggregation stages for computing a Payable's paid/pending/status
// from the EXPENSE Transactions linked to it via payableId. Paid/pending is
// NEVER stored on the Payable — always computed here, at query time, from
// the Transactions collection (the single source of truth for money moved).
// Used by both /api/payables/list and /api/payables/summary so the two
// routes can never disagree on what "pending" means.
//
// Ageing (daysOverdue / daysToDue / ageingBucket) is appended from the shared
// buildAgeingStages() so the header summary and the table age rows identically.
export function buildPayableAggregationStages(txCollectionName) {
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
      $addFields: {
        paid: { $ifNull: [{ $arrayElemAt: ["$paymentAgg.paid", 0] }, 0] },
        paymentCount: { $ifNull: [{ $arrayElemAt: ["$paymentAgg.paymentCount", 0] }, 0] },
      },
    },
    {
      $addFields: {
        pending: { $max: [{ $subtract: ["$totalAmount", "$paid"] }, 0] },
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
    { $project: { paymentAgg: 0 } },
  ];
}
