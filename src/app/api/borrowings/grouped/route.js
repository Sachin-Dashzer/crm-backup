import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import Borrowing from "@/models/Borrowing";
import { buildPayableGroupedStages, buildPayableAggregationStages } from "@/lib/payableAggregation";
import { loadClosedPeriodSnapshot, blockReasonFromSnapshot } from "@/lib/periodLock";
import { resolveBranchFilter } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];
const CATEGORY = "Borrowings";

// Grouped borrowings for the Liabilities page's "Borrowings" section (DrillDownTable, mode:
// "documents") — same 4-level shape as /api/payables/grouped, restricted to the one
// expenseCategory this feature ever creates:
//   level=1  -> a single "Borrowings" bucket (so the section's own drill path matches every
//               other DrillDownTable section rather than starting at a different level)
//   level=2  -> one row per expenseSubType (Deposit Received / Loan from Party / Advance
//               Received) within it
//   level=3  -> one row per loan (Payable) DOCUMENT, live paid/pending — reuses
//               buildPayableAggregationStages, which already folds in Borrowing OUT rows
//               (see payableAggregation.js), so "paid" here means the same thing as everywhere
//               else a Payable is shown.
//   level=4  -> the actual Borrowing rows (IN + OUT) against ONE document (?documentId=), with
//               a running balance-owed.
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
    const subType = searchParams.get("subType") || "";
    const branchFilterObj = resolveBranchFilter(session, searchParams.get("branch") || "");
    const branch = typeof branchFilterObj.branch === "string" ? branchFilterObj.branch : "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const party = searchParams.get("party") || "";
    const status = searchParams.get("status") || "";
    const documentId = searchParams.get("documentId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    if (level === 1) {
      const rows = await Payable.aggregate([
        { $match: { expenseCategory: CATEGORY } },
        ...buildPayableGroupedStages(Transactions.collection.name, { level: 1, branch, from, to }),
      ]);
      return NextResponse.json({ success: true, rows });
    }

    if (level === 2) {
      const rows = await Payable.aggregate(
        buildPayableGroupedStages(Transactions.collection.name, {
          level: 2,
          category: CATEGORY,
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
      const rowMatch = {
        payableId: new mongoose.Types.ObjectId(documentId),
        isCancelled: { $ne: true },
      };
      if (from || to) {
        rowMatch.date = {};
        if (from) rowMatch.date.$gte = new Date(from);
        if (to) rowMatch.date.$lte = new Date(to);
      }

      const [rows, total] = await Promise.all([
        Borrowing.aggregate([
          { $match: rowMatch },
          { $sort: { date: 1, _id: 1 } },
          {
            $setWindowFields: {
              sortBy: { date: 1, _id: 1 },
              output: {
                // IN raises what's owed, OUT pays it down — the running balance is the
                // liability's own outstanding total at each point in time, not a cash balance.
                runningBalance: {
                  $sum: { $cond: [{ $eq: ["$direction", "OUT"] }, { $multiply: ["$amount", -1] }, "$amount"] },
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
              narration: { $ifNull: ["$remarks", "$reference"] },
              amount: 1,
              direction: 1,
              account: 1,
              reference: 1,
              runningBalance: 1,
              branch: 1,
              payableId: 1,
              createdBy: 1,
            },
          },
        ]),
        Borrowing.countDocuments(rowMatch),
      ]);

      const closedPeriods = await loadClosedPeriodSnapshot();
      const rowsWithLock = rows.map((r) => ({
        ...r,
        lockReason: blockReasonFromSnapshot(closedPeriods, r.account, r.date),
      }));

      return NextResponse.json({ success: true, rows: rowsWithLock, total, page, limit });
    }

    // level 3 — one row per loan (Payable) document, live-aggregated.
    if (!subType && !CATEGORY) {
      return NextResponse.json({ error: "subType is required at level 3" }, { status: 400 });
    }
    const match = { expenseCategory: CATEGORY };
    if (subType) match.expenseSubType = subType;
    match.isCancelled = status === "Cancelled" ? true : { $ne: true };
    if (branch) match.branch = branch;
    if (party) match["payee.label"] = { $regex: party, $options: "i" };

    const stages = [
      { $match: match },
      ...buildPayableAggregationStages(Transactions.collection.name),
    ];
    if (status && status !== "Cancelled") stages.push({ $match: { status } });
    stages.push({ $sort: { createdAt: -1 } });

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
    const closedPeriods = await loadClosedPeriodSnapshot();
    const rows = pageRows.map((r) => ({
      ...r,
      lockReason: blockReasonFromSnapshot(closedPeriods, null, r.createdAt || new Date()),
    }));

    return NextResponse.json({ success: true, rows, total, page, limit });
  } catch (error) {
    console.error("Error building grouped borrowings:", error);
    return NextResponse.json({ error: "Failed to load grouped borrowings" }, { status: 500 });
  }
}
