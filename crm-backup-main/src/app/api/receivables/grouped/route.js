import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableGroupedStages, buildReceivableAggregationStages } from "@/lib/receivableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { loadClosedPeriodSnapshot, blockReasonFromSnapshot } from "@/lib/periodLock";
import { resolveBranchFilter } from "@/lib/branches";

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
    // Never trust a raw branch string from the client — same resolver every branch-scoped route
    // uses; extracted back to a plain string since buildReceivableGroupedStages and the match
    // below both key on a single branch NAME.
    const branchFilterObj = resolveBranchFilter(session, searchParams.get("branch") || "");
    const branch = typeof branchFilterObj.branch === "string" ? branchFilterObj.branch : "";
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

      // One snapshot for the page rather than a query per row — display path only.
      const closedPeriods = await loadClosedPeriodSnapshot();
      const rowsWithLock = rows.map((r) => ({
        ...r,
        lockReason: blockReasonFromSnapshot(closedPeriods, r.account, r.date),
      }));

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
    // Matches the ageing chips' own definition (pending: { $gt: 0 }) — see the identical fix and
    // comment in payables/grouped/route.js.
    if (ageing) stages.push({ $match: { ageingBucket: ageing, pending: { $gt: 0 } } });
    stages.push({ $sort: { dueDate: 1, createdAt: -1 } });

    // Paginate INSIDE the pipeline — see the identical change in payables/grouped/route.js.
    // Previously every matching receivable was aggregated (each with its own $lookup into
    // Transactions) and serialised before one page was .slice()d out in JavaScript.
    const [facet] = await Receivable.aggregate([
      ...stages,
      {
        $facet: {
          rows: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ]);
    const pageRows = facet?.rows || [];
    const total = facet?.total?.[0]?.count || 0;
    // One snapshot for the whole page instead of a per-row checkPeriodLock — see the identical
    // change and reasoning in payables/grouped/route.js.
    const closedPeriods = await loadClosedPeriodSnapshot();
    const rows = pageRows.map((r) => ({
      ...r,
      lockReason: blockReasonFromSnapshot(closedPeriods, null, r.dueDate || r.createdAt || new Date()),
    }));

    return NextResponse.json({ success: true, rows, total, page, limit });
  } catch (error) {
    console.error("Error building grouped receivables:", error);
    return NextResponse.json({ error: "Failed to load grouped receivables" }, { status: 500 });
  }
}
