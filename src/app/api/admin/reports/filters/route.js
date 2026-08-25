import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee"; // Add this import

const handler = async (req) => {
  try {
    // Get sample transactions
    const sampleTransactions = await Transactions.find({})
      .limit(10)
      .sort({ createdAt: -1 });

    // Get revenue transactions
    const revenueCount = await Transactions.countDocuments({ costType: "Revenue" });
    const expensesCount = await Transactions.countDocuments({ costType: "Expenses" });

    // Get transactions by branch (dynamic — picks up any branch value present in the data)
    const distinctBranches = (await Transactions.distinct("branch")).filter(Boolean);
    const branchCounts = Object.fromEntries(
      await Promise.all(
        distinctBranches.map(async (b) => [b, await Transactions.countDocuments({ branch: b })])
      )
    );

    // Get transactions with dates
    const withDates = await Transactions.countDocuments({ date: { $exists: true, $ne: null } });
    const withoutDates = await Transactions.countDocuments({ 
      $or: [
        { date: { $exists: false } },
        { date: null }
      ]
    });

    // Get unique procedures
    const procedures = await Transactions.distinct("procedure");

    // Get sample revenue transaction
    const sampleRevenue = await Transactions.findOne({ costType: "Revenue" });
    
    // Get sample expense transaction
    const sampleExpense = await Transactions.findOne({ costType: "Expenses" });

    // Get filter options
    const staff = await Employee.find({}, { name: 1, role: 1 }).lean();
    const techniques = await Transactions.distinct("procedure");
    const status = await Transactions.distinct("status");

    return NextResponse.json({
      success: true,
      data: {
        staff: staff.map(s => ({ _id: s._id, name: s.name, role: s.role })),
        techniques: techniques.filter(Boolean),
        status: status.filter(Boolean)
      },
      statistics: {
        total: await Transactions.countDocuments({}),
        revenue: revenueCount,
        expenses: expensesCount,
        byBranch: {
          ...branchCounts,
          unassigned: await Transactions.countDocuments({
            $or: [
              { branch: { $exists: false } },
              { branch: null },
              { branch: "" }
            ]
          })
        },
        dates: {
          withDates,
          withoutDates
        },
        uniqueProcedures: procedures
      },
      samples: {
        recent: sampleTransactions.map(t => ({
          _id: t._id,
          costType: t.costType,
          branch: t.branch,
          date: t.date,
          amount: t.amount,
          procedure: t.procedure,
          expense: t.expense,
          method: t.method,
          hasPatient: !!t.patient,
          createdAt: t.createdAt
        })),
        sampleRevenue: sampleRevenue ? {
          _id: sampleRevenue._id,
          costType: sampleRevenue.costType,
          branch: sampleRevenue.branch,
          date: sampleRevenue.date,
          amount: sampleRevenue.amount,
          procedure: sampleRevenue.procedure,
          method: sampleRevenue.method,
          paymentType: sampleRevenue.paymentType,
          hasPatient: !!sampleRevenue.patient,
          createdAt: sampleRevenue.createdAt
        } : null,
        sampleExpense: sampleExpense ? {
          _id: sampleExpense._id,
          costType: sampleExpense.costType,
          branch: sampleExpense.branch,
          date: sampleExpense.date,
          amount: sampleExpense.amount,
          expense: sampleExpense.expense,
          method: sampleExpense.method,
          createdAt: sampleExpense.createdAt
        } : null
      }
    });

  } catch (error) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to fetch transaction data", 
        error: error.message 
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);