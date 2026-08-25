import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableGroupedStages, buildPayableAggregationStages } from "@/lib/payableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { loadClosedPeriodSnapshot, blockReasonFromSnapshot } from "@/lib/periodLock";
import { resolveBranchFilter } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Grouped payables for the Liabilities drill-down (DrillDownTable, mode: "documents"):
//   level=1  -> one row per expenseCategory (HEAD)
//   level=2  -> one row per expenseSubType within ?category= (SUB-TYPE)
//   level=3  -> one row per Payable DOCUMENT within the HEAD (+ optional SUB-TYPE) bucket, with
//               live paid/pending/status/ageing — reuses buildPayableAggregationStages (Task 5,
//               Step 2), never a second paid/pending calculation.
//   level=4  -> the actual settling Transactions for ONE document (?documentId=), with a
//               running "paid so far" balance.
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
    // Vendors page (Task: vendor ledger) — rolls up by payee.refId instead of expenseCategory,
    // single level (no sub-type tier), then jumps straight to that vendor's documents at level 3
    // via vendorId instead of category. See buildPayableGroupedStages' groupBy param.
    const groupBy = searchParams.get("groupBy") === "vendor" ? "vendor" : "category";
    const vendorId = searchParams.get("vendorId") || "";
    // Never trust a raw branch string from the client — same resolver every branch-scoped route
    // uses. Extracted back to a plain string since buildPayableGroupedStages and the match below
    // both key on a single branch NAME (a collab session's expanded {$in: [...]} shape, were one
    // ever to reach this admin-only route, falls back to no filter rather than crashing).
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
      const rows = await Payable.aggregate(
        buildPayableGroupedStages(Transactions.collection.name, {
          level,
          category,
          subType,
          branch,
          from,
          to,
          groupBy,
        }),
      );
      return NextResponse.json({ success: true, rows });
    }

    if (level === 4) {
      if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        return NextResponse.json({ error: "A valid documentId is required at level 4" }, { status: 400 });
      }
      const txMatch = {
        payableId: new mongoose.Types.ObjectId(documentId),
        approvalStatus: "APPROVED",
        method: { $nin: UNSETTLED_METHODS },
      };
      if (from || to) {
        txMatch.date = {};
        if (from) txMatch.date.$gte = new Date(from);
        if (to) txMatch.date.$lte = new Date(to);
      }

      const [rows, total] = await Promise.all([
        Transactions.aggregate([
          { $match: txMatch },
          { $sort: { date: 1, _id: 1 } },
          {
            $setWindowFields: {
              sortBy: { date: 1, _id: 1 },
              output: {
                runningBalance: { $sum: "$amount", window: { documents: ["unbounded", "current"] } },
              },
            },
          },
          { $sort: { date: -1, _id: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              date: 1,
              narration: { $ifNull: [{ $ifNull: ["$remarks", "$expenseType"] }, "$expense"] },
              amount: 1,
              method: 1,
              account: "$furtherMode",
              runningBalance: 1,
              branch: 1,
              transactionCategory: 1,
              payableId: 1,
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

    // level 3 — one row per document, live-aggregated (never a stored paid/pending figure).
    // Vendor mode skips the category/sub-type tier entirely and matches on payee.refId instead —
    // a vendor's bills can legitimately span several expense categories.
    let match;
    if (groupBy === "vendor") {
      if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
        return NextResponse.json({ error: "A valid vendorId is required at level 3 in vendor mode" }, { status: 400 });
      }
      match = { "payee.kind": "VENDOR", "payee.refId": new mongoose.Types.ObjectId(vendorId) };
    } else {
      if (!category) {
        return NextResponse.json({ error: "category is required at level 3" }, { status: 400 });
      }
      match = { expenseCategory: category };
      if (subType) match.expenseSubType = subType;
    }
    // Cancelled documents are excluded from the base match by default (same as every other
    // payables view); the one exception is when the caller explicitly asked to see them.
    match.isCancelled = status === "Cancelled" ? true : { $ne: true };
    if (branch) match.branch = branch;
    if (party) match["payee.label"] = { $regex: party, $options: "i" };

    const stages = [
      { $match: match },
      ...buildPayableAggregationStages(Transactions.collection.name),
    ];
    if (status && status !== "Cancelled") stages.push({ $match: { status } });
    // Matches the ageing chips' own definition (/api/payables/summary?ageing=1, which sums
    // { pending: { $gt: 0 } } into these buckets) — a document that's since been fully paid off
    // still carries whatever ageingBucket its (now irrelevant) dueDate computes to, so without
    // this a cleared document could appear in a "90+ days" filter the chip's own count says is 0.
    if (ageing) stages.push({ $match: { ageingBucket: ageing, pending: { $gt: 0 } } });
    stages.push({ $sort: { dueDate: 1, createdAt: -1 } });

    // Paginate INSIDE the pipeline. This used to aggregate every matching document — each with
    // its own $lookup into Transactions — serialise the lot into Node, and only then .slice() one
    // page out of it, so `limit` bounded what was returned but not what was computed.
    const [facet] = await Payable.aggregate([
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
    // A document has no account of its own — the "every account closed" fallback (account: null)
    // is the right semantics for an accrual with no cash side yet.
    //
    // One snapshot for the whole page instead of a per-row checkPeriodLock: that fanned out to 11
    // AccountPeriod queries PER ROW, so a full 200-row page cost ~2,200 queries just to render
    // lock badges. This is the display path; write guards still call checkPeriodLock directly.
    const closedPeriods = await loadClosedPeriodSnapshot();
    const rows = pageRows.map((r) => ({
      ...r,
      lockReason: blockReasonFromSnapshot(closedPeriods, null, r.dueDate || r.createdAt || new Date()),
    }));

    return NextResponse.json({ success: true, rows, total, page, limit });
  } catch (error) {
    console.error("Error building grouped payables:", error);
    return NextResponse.json({ error: "Failed to load grouped payables" }, { status: 500 });
  }
}
