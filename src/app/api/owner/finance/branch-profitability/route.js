// src/app/api/owner/finance/branch-profitability/route.js
//
// The one genuinely new piece of Step 11's finance screen — grouping Transactions by branch to
// compare revenue/expense/profit across branches. Everything else on the Owner finance page
// (P&L, balance sheet, cash flow, payables/receivables summary) is a direct client-side fetch
// against the existing /api/close-book/{pnl,balance-sheet,cash-flow} and /api/{payables,
// receivables}/summary routes — real, already-correct logic, not re-derived here.
//
// Scoping mirrors src/app/api/close-book/pnl/route.js's txBase exactly (approvalStatus not
// PENDING/REJECTED, UNSETTLED_METHODS excluded) so branch totals agree with the P&L card above
// them rather than using a second, slightly different definition of "real revenue".

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { from, to } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const txBase = {
      approvalStatus: { $nin: ["PENDING", "REJECTED"] },
      method: { $nin: UNSETTLED_METHODS },
      date: { $gte: fromDate, $lte: toDate },
    };

    const [revenueByBranch, expenseByBranch] = await Promise.all([
      Transactions.aggregate([
        { $match: { ...txBase, costType: "Revenue" } },
        { $group: { _id: "$branch", total: { $sum: "$amount" } } },
      ]),
      Transactions.aggregate([
        { $match: { ...txBase, costType: "Expenses" } },
        { $group: { _id: "$branch", total: { $sum: "$amount" } } },
      ]),
    ]);

    const revenueMap = Object.fromEntries(revenueByBranch.map((r) => [r._id || "(no branch)", r.total]));
    const expenseMap = Object.fromEntries(expenseByBranch.map((r) => [r._id || "(no branch)", r.total]));
    const allBranches = [...new Set([...Object.keys(revenueMap), ...Object.keys(expenseMap)])];

    const round2 = (n) => Math.round((n || 0) * 100) / 100;
    const rows = allBranches
      .map((branch) => {
        const revenue = round2(revenueMap[branch] || 0);
        const expense = round2(expenseMap[branch] || 0);
        return { branch, revenue, expense, profit: round2(revenue - expense) };
      })
      .sort((a, b) => b.profit - a.profit);

    return NextResponse.json({ success: true, rows });
  } catch (err) {
    console.error("owner branch-profitability error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
