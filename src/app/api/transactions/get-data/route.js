// app/api/transactions/get-data/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import "@/models/Patient";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please login." },
        { status: 401 },
      );
    }

    await connectDB();

    const userBranch = session.user.branch;
    const query = userBranch && userBranch !== "All" ? { branch: userBranch } : {};

    const transactions = await Transactions.find(query)
      .populate({
        path: "patient",
        select:
          "personal.name personal.phone surgery.technique payments.totalAmount payments.amountReceived payments.pendingAmount payments.medicineAmount payments.discount createdAt",
      })
      .sort({ date: -1 })
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
