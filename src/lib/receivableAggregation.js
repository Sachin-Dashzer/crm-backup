import { buildAgeingStages } from "@/lib/ageing";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

export function buildReceivableAggregationStages(
  txCollectionName,
  advancesCollectionName = "advances",
  borrowingsCollectionName = "borrowings",
) {
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
                  { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                  {
                    $or: [
                      { $eq: ["$receivableId", "$$receivableId"] },
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
      $lookup: {
        from: advancesCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$receivableId", "$$receivableId"] },
                  { $eq: ["$direction", "IN"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $group: { _id: null, received: { $sum: "$amount" }, receiptCount: { $sum: 1 } } },
        ],
        as: "advanceAgg",
      },
    },
    {
      $lookup: {
        from: borrowingsCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$settlesReceivableId", "$$receivableId"] },
                  { $eq: ["$direction", "IN"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $group: { _id: null, received: { $sum: "$amount" }, receiptCount: { $sum: 1 } } },
        ],
        as: "borrowingSettlementAgg",
      },
    },
    {
      $addFields: {
        received: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$receiptAgg.received", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$advanceAgg.received", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$borrowingSettlementAgg.received", 0] }, 0] },
          ],
        },
        receiptCount: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$receiptAgg.receiptCount", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$advanceAgg.receiptCount", 0] }, 0] },
            { $ifNull: [{ $arrayElemAt: ["$borrowingSettlementAgg.receiptCount", 0] }, 0] },
          ],
        },
      },
    },
    {
      $addFields: {
        pending: { $max: [{ $subtract: ["$totalAmount", "$received"] }, 0] },
        netPending: { $subtract: ["$totalAmount", "$received"] },
        advanceInHand: { $max: [{ $subtract: ["$received", "$totalAmount"] }, 0] },
        status: {
          $switch: {
            branches: [
              { case: { $lte: ["$totalAmount", "$received"] }, then: "Received" },
              {
                case: {
                  $and: [
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
    { $project: { receiptAgg: 0, advanceAgg: 0, borrowingSettlementAgg: 0 } },
  ];
}

export function buildReceivableGroupedStages(
  txCollectionName,
  {
    level,
    category,
    subType,
    branch,
    from,
    to,
    subTypeField = "purpose",
    advancesCollectionName = "advances",
  } = {},
) {
  const match = { isCancelled: { $ne: true } };
  if (branch) match.branch = branch;
  if (level !== 1 && category) match.revenueCategory = category;
  if (level === 2 && subType) match[subTypeField] = subType;

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
      : { bucket: { $ifNull: [`$${subTypeField}`, "Uncategorised"] } };

  return [
    { $match: match },
    {
      $lookup: {
        from: txCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
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
      $lookup: {
        from: advancesCollectionName,
        let: { receivableId: "$_id" },
        pipeline: [
          ...(toDate ? [{ $match: { date: { $lte: toDate } } }] : []),
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$receivableId", "$$receivableId"] },
                  { $eq: ["$direction", "IN"] },
                  { $ne: ["$isCancelled", true] },
                ],
              },
            },
          },
          { $project: { date: 1, amount: 1 } },
        ],
        as: "advanceRecoveries",
      },
    },
    {
      $addFields: {
        receipts: { $concatArrays: ["$receipts", "$advanceRecoveries"] },
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
