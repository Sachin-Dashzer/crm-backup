import { NextResponse } from "next/server";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import dbConnect from "@/lib/db";

export async function POST(request) {
  try {
    const { branch, dateRange, customDates, procedure } = await request.json();

    await dbConnect();

    // Calculate date range
    const { startDate, endDate } = getDateRange(dateRange, customDates);

    // Build query
    const query = {
      date: { $gte: startDate, $lte: endDate },
      costType: "Revenue",
    };

    if (branch !== "All") {
      query.branch = branch;
    }

    if (procedure !== "all") {
      query.procedure = procedure;
    }

    // Get transactions
    const transactions = await Transactions.find(query).sort({ date: 1 });

    // Calculate daily revenue
    const dailyRevenue = calculateDailyRevenue(transactions);

    // Calculate branch performance
    const branchPerformance = await calculateBranchPerformance(startDate, endDate);

    // Calculate procedure performance
    const procedurePerformance = await calculateProcedurePerformance(startDate, endDate, branch);

    return NextResponse.json({
      success: true,
      daily: dailyRevenue,
      branches: branchPerformance,
      procedures: procedurePerformance,
    });
  } catch (error) {
    console.error("Performance API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch performance data" },
      { status: 500 }
    );
  }
}

// Helper: Get date range
function getDateRange(dateRange, customDates) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate = new Date();
  let endDate = today;

  if (dateRange === "Today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (dateRange === "Yesterday") {
    startDate.setDate(today.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setDate(today.getDate() - 1);
  } else if (dateRange === "Last 7 Days") {
    startDate.setDate(today.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  } else if (dateRange === "Custom" && customDates.from) {
    startDate = new Date(customDates.from);
    endDate = customDates.to ? new Date(customDates.to) : new Date(customDates.from);
  }

  return { startDate, endDate };
}

// Helper: Calculate daily revenue
function calculateDailyRevenue(transactions) {
  const dailyMap = {};

  transactions.forEach((txn) => {
    const dateKey = new Date(txn.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = 0;
    }
    dailyMap[dateKey] += txn.amount;
  });

  return Object.entries(dailyMap).map(([date, revenue]) => ({
    date,
    revenue,
  }));
}

// Helper: Calculate branch performance
async function calculateBranchPerformance(startDate, endDate) {
  const branches = ["Delhi", "Mumbai", "Hyderabad"];
  const branchStats = [];

  for (const branch of branches) {
    // Current period
    const currentRevenue = await Transactions.aggregate([
      {
        $match: {
          branch,
          date: { $gte: startDate, $lte: endDate },
          costType: "Revenue",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Previous period (same duration)
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

    const prevRevenue = await Transactions.aggregate([
      {
        $match: {
          branch,
          date: { $gte: prevStartDate, $lte: prevEndDate },
          costType: "Revenue",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Patient count
    const patientCount = await Patient.countDocuments({
      "personal.branch": branch,
      "personal.visitDate": { $gte: startDate, $lte: endDate },
    });

    const currentTotal = currentRevenue[0]?.total || 0;
    const prevTotal = prevRevenue[0]?.total || 0;
    const growth = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;

    branchStats.push({
      name: branch,
      revenue: currentTotal,
      patients: patientCount,
      growth: Math.round(growth * 10) / 10,
    });
  }

  return branchStats;
}

// Helper: Calculate procedure performance
async function calculateProcedurePerformance(startDate, endDate, branch) {
  const matchQuery = {
    date: { $gte: startDate, $lte: endDate },
    costType: "Revenue",
  };

  if (branch !== "All") {
    matchQuery.branch = branch;
  }

  const procedureStats = await Transactions.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$procedure",
        count: { $sum: 1 },
        revenue: { $sum: "$amount" },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  return procedureStats.map((proc) => ({
    name: proc._id || "Other",
    count: proc.count,
    revenue: proc.revenue,
  }));
}