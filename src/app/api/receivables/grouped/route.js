import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableGroupedStages, buildReceivableAggregationStages } from "@/lib/receivableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Grouped receivables for the Assets drill-down (DrillDownTable, mode: "documents") — mirror of
// /api/payables/grouped:
//   level=1  -> one row per revenueCategory (HEAD)
//   level=2  -> one row per purpose within ?category= (SUB-TYPE)
//   level=3  -> one row per Receivable DOCUMENT within the HEAD (+ optional SUB-TYPE) bucket,
//               with live received/pending/status/ageing — reuses
//               buildReceivableAggregationStages (Task 5, Step 2).
//   level=4  -> the actual receipt Transactions for ONE document (?documentId=), split-payment
//               allocations included — same contribution rule the old flat level had.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const level = Math.min(4, Math.max(1, parseInt(searchParams.get("level") || "1")));
    const category = searchParams.get("category") || "";
    const subType = searchParams.get("subType") || "";
    const branch = searchParams.get("branch") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const party = searchParams.get("party") || "";
    const status = searchParams.get("status") || "";
    const ageing = searchParams.get("ageing") || "";
    const documentId = searchParams.get("documentId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    if (level < 3) {
      const rows = await Receivable.aggregate(
        buildReceivableGroupedStages(Transactions.collection.name, {
          level,
          category,
          subType,
          branch,
          from,
          to,
        }),
      );
      return NextResponse.json({ success: true, rows });
    }

    if (level === 4) {
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        return NextResponse.json({ error: "A valid documentId is required at level 4" }, { status: 400 });
      }
      const receivableObjectId = new mongoose.Types.ObjectId(documentId);
      const idStr = String(documentId);

      const txMatch = {
        costType: "Revenue",
        approvalStatus: "APPROVED",
        method: { $nin: UNSETTLED_METHODS },
        $or: [
          { receivableId: receivableObjectId },
          { "receivableAllocations.receivableId": receivableObjectId },
        ],
      };
      if (from || to) {
        txMatch.date = {};
        if (from) txMatch.date.$gte = new Date(from);
        if (to) txMatch.date.$lte = new Date(to);
      }

      const [rows, total] = await Promise.all([
        Transactions.aggregate([
          { $match: txMatch },
          {
            // A split payment's receivableAllocations may reference receivables OUTSIDE this
            // document too — only count the slice that belongs here, exactly like
            // buildReceivableAggregationStages does for the summary figure.
            $addFields: {
              contribution: {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$receivableAllocations", []] } }, 0] },
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$receivableAllocations",
                            cond: { $eq: [{ $toString: "$$this.receivableId" }, idStr] },
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
          { $sort: { date: 1, _id: 1 } },
          {
            $setWindowFields: {
              sortBy: { date: 1, _id: 1 },
              output: {
                runningBalance: {
                  $sum: "$contribution",
                  window: { documents: ["unbounded", "current"] },
                },
              },
            },
          },
          { $sort: { date: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              date: 1,
              narration: { $ifNull: ["$remarks", "$procedure"] },
              amount: "$contribution",
              method: 1,
              account: "$furtherMode",
              runningBalance: 1,
              branch: 1,
              transactionCategory: 1,
            },
          },
        ]),
        Transactions.countDocuments(txMatch),
      ]);

      const rowsWithLock = await Promise.all(
        rows.map(async (r) => ({
          ...r,
          lockReason: await checkPeriodLock({ furtherMode: r.account, date: r.date }),
        })),
      );

      return NextResponse.json({ success: true, rows: rowsWithLock, total, page, limit });
    }

    // level 3 — one row per document, live-aggregated (never a stored received/pending figure).
    if (!category) {
      return NextResponse.json({ error: "category is required at level 3" }, { status: 400 });
    }
    const match = { revenueCategory: category };
    // Cancelled documents are excluded from the base match by default (same as every other
    // receivables view); the one exception is when the caller explicitly asked to see them.
    match.isCancelled = status === "Cancelled" ? true : { $ne: true };
    if (subType) match.purpose = subType;
    if (branch) match.branch = branch;
    if (party) match["payer.label"] = { $regex: party, $options: "i" };

    const stages = [
      { $match: match },
      ...buildReceivableAggregationStages(Transactions.collection.name),
    ];
    if (status && status !== "Cancelled") stages.push({ $match: { status } });
    if (ageing) stages.push({ $match: { ageingBucket: ageing } });
    stages.push({ $sort: { dueDate: 1, createdAt: -1 } });

    const allRows = await Receivable.aggregate(stages);
    const total = allRows.length;
    const pageRows = allRows.slice((page - 1) * limit, (page - 1) * limit + limit);
    // A document has no account of its own — checkPeriodLock's "every account closed" fallback
    // (furtherMode: null) is the right semantics for an accrual with no cash side yet. Bounded
    // by `limit` (<=200), same cost as every other per-row lock check in this codebase.
    const rows = await Promise.all(
      pageRows.map(async (r) => ({
        ...r,
        lockReason: await checkPeriodLock({ furtherMode: null, date: r.dueDate || r.createdAt || new Date() }),
      })),
    );

    return NextResponse.json({ success: true, rows, total, page, limit });
  } catch (error) {
    console.error("Error building grouped receivables:", error);
    return NextResponse.json({ error: "Failed to load grouped receivables" }, { status: 500 });
  }
}
