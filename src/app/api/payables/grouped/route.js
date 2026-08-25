import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableGroupedStages, buildPayableAggregationStages } from "@/lib/payableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { checkPeriodLock } from "@/lib/periodLock";
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

      const rowsWithLock = await Promise.all(
        rows.map(async (r) => ({
          ...r,
          lockReason: await checkPeriodLock({ furtherMode: r.account, date: r.date }),
        })),
      );

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

    const allRows = await Payable.aggregate(stages);
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
    console.error("Error building grouped payables:", error);
    return NextResponse.json({ error: "Failed to load grouped payables" }, { status: 500 });
  }
}
