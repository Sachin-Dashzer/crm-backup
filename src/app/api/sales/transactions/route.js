import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    if (session?.user?.role === "sales") {
      return NextResponse.json({ success: false, message: "Forbidden. Use standard transaction endpoints." }, { status: 403 });
    }
    const transactions = await Transactions.find({ costType: "Revenue" })
      .populate({
        path: "patient",
        select: "personal.name personal.phone personal.branch personal.email",
      })
      .sort({ date: -1 });

    const revenueData = transactions.map((transaction) => ({
      _id: transaction._id,
      patient: transaction.patient,
      branch: transaction.branch,
      procedure: transaction.procedure,
      paymentType: transaction.paymentType,
      method: transaction.method,
      amount: transaction.amount,
      date: transaction.date,
      remarks: transaction.remarks,
      costType: transaction.costType,
      createdAt: transaction.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: revenueData,
      count: revenueData.length,
    });
  } catch (error) {
    console.error("Error fetching sales transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch transactions",
        message: error.message,
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);