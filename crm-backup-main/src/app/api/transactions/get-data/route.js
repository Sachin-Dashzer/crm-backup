// app/api/transactions/get-data/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import "@/models/Patient";
import { resolveDateRange, toDateQuery } from "@/lib/dateHelpers";

// NOTE: as of this change nothing in the app calls this route — see the comment at
// src/app/api/close-book/ledger/route.js:27, which explicitly avoids modelling on it. It is left
// in place rather than deleted, but it is bounded below: it is an authenticated endpoint that
// previously returned the ENTIRE Transactions collection, sorted, with every referenced Patient
// populated, and accepted no date parameter at all. If it is genuinely unused, delete it.
const MAX_ROWS = 2000;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const userBranch = session.user.branch;
    const query = userBranch && userBranch !== "All" ? { branch: userBranch } : {};

    // Defaults to the current calendar month; `?all=1` opts out.
    const dateRange = resolveDateRange(searchParams);
    const dateQuery = toDateQuery(dateRange);
    if (dateQuery) query.date = dateQuery;

    const transactions = await Transactions.find(query)
      // Only the fields the reducer below emits.
      .select(
        "costType patient branch procedure paymentType paymentId method amount discount date remarks transactionCategory createdBy editors",
      )
      .populate({
        path: "patient",
        select:
          "personal.name personal.phone surgery.technique payments.totalAmount payments.amountReceived payments.pendingAmount payments.medicineAmount payments.discount createdAt",
      })
      .sort({ date: -1 })
      .limit(MAX_ROWS)
      .lean();

    const finaldata = transactions.reduce((acc, transaction) => {
      const type = transaction.costType || "other";
      if (!acc[type]) acc[type] = [];

      acc[type].push({
        _id:          transaction._id,
        patient:      transaction.patient,
        branch:       transaction.branch,
        procedure:    transaction.procedure,
        paymentType:  transaction.paymentType,
        paymentId:    transaction.paymentId,
        method:       transaction.method,
        amount:       transaction.amount,
        discount:     transaction.discount || 0,
        date:         transaction.date,
        remarks:      transaction.remarks,
        transactionCategory: transaction.transactionCategory,
        createdBy:    transaction.createdBy || null,
        editors:      transaction.editors || [],
        totalEdits:   transaction.editors?.length || 0,
      });

      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data:    finaldata,
      types:   Object.keys(finaldata),
    });
  } catch (error) {
    console.error("Error fetching transaction data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions", message: error.message },
      { status: 500 },
    );
  }
}
