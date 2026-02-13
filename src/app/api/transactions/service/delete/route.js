// app/api/transactions/service/delete/route.js

import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function DELETE(req) {
  let session;
  try {
    // Check authentication
    session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    // Get transaction ID from request body
    const { transactionId } = await req.json();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Find the transaction to delete
    const transaction = await Transactions.findById(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify it's a SERVICE transaction
    const category = transaction.transactionCategory || transaction.category;
    if (category !== "SERVICE") {
      return NextResponse.json(
        { success: false, error: "Not a service transaction" },
        { status: 400 }
      );
    }

    // Store transaction details for response
    const deletedData = {
      transactionId: transaction._id,
      procedure: transaction.procedure,
      amount: transaction.amount,
      quantity: transaction.quantity,
      batchId: transaction.batchId,
      date: transaction.date,
    };

    // Delete the transaction
    await Transactions.findByIdAndDelete(transactionId);

    return NextResponse.json({
      success: true,
      message: "Service transaction deleted successfully",
      data: deletedData,
    });
  } catch (error) {
    console.error("Error deleting service transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete service transaction",
      },
      { status: 500 }
    );
  }
}