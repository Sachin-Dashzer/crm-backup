// app/api/transactions/get-all/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import Stock from "@/models/Stock";
import Employee from "@/models/Employee";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please login.",
        },
        { status: 401 },
      );
    }

    const userBranch = session.user.branch;

    let query = {};

    if (userBranch && userBranch !== "All") {
      query.branch = userBranch;
    }
    await connectDB();

    const transactions = await Transactions.find(query)
      .populate({
        path: "patient",
        select: "personal payments counselling.counsellor",
        populate: {
          path: "counselling.counsellor",
          select: "name",
        },
      })
      .populate("medicineId", "name")
      .populate("expenseGiver.vendorId", "name contact")
      .sort({ date: -1 })
      .lean();

    console.log(`✅ Found ${transactions.length} transactions`);

    // Map transactions to ensure consistent field names
    const mappedTransactions = transactions.map((transaction) => ({
      ...transaction,
      // Map 'category' to 'transactionCategory' if it exists
      transactionCategory:
        transaction.transactionCategory || transaction.category,
    }));

    console.log(
      "Sample mapped transaction:",
      mappedTransactions[0]
        ? {
            _id: mappedTransactions[0]._id,
            transactionCategory: mappedTransactions[0].transactionCategory,
            category: mappedTransactions[0].category,
            date: mappedTransactions[0].date,
            amount: mappedTransactions[0].amount,
          }
        : "No transactions found",
    );

    return NextResponse.json(
      {
        success: true,
        transactions: mappedTransactions,
        count: mappedTransactions.length,
        message: `Successfully fetched ${mappedTransactions.length} transactions`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error fetching all transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
