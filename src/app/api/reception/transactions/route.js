import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const costType = searchParams.get("costType");
    const method = searchParams.get("method");

    // Build query
    const query = {};

    // Date filters
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query.date.$gte = fromDate;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        query.date.$lte = toDate;
      }
    }

    // Cost type filter
    if (costType && costType !== "all") {
      query.costType = costType;
    }

    // Method filter
    if (method && method !== "all") {
      query.method = method;
    }

    // Fetch transactions with patient details
    const transactions = await Transactions.find(query)
      .populate("patient", "personal")
      .sort({ date: -1 })
      .limit(100);

    // Calculate stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [revenueStats, expenseStats, todayRevenueStats] = await Promise.all([
      Transactions.aggregate([
        { $match: { costType: "Revenue" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transactions.aggregate([
        { $match: { costType: "Expenses" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transactions.aggregate([
        {
          $match: {
            costType: "Revenue",
            date: { $gte: today, $lt: tomorrow },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const stats = {
      totalRevenue: revenueStats[0]?.total || 0,
      totalExpenses: expenseStats[0]?.total || 0,
      todayRevenue: todayRevenueStats[0]?.total || 0,
      transactionCount: (revenueStats[0]?.count || 0) + (expenseStats[0]?.count || 0),
    };

    return NextResponse.json({
      transactions,
      stats,
    });
  } catch (error) {
    console.error("Transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);