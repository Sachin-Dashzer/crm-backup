// app/api/transactions/medicine/delete/route.js

import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Transaction from "@/models/Transactions";
import Medicine from "@/models/Stock";
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
    const transaction = await Transaction.findById(transactionId).populate('medicineId');

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify it's a MEDICINE transaction
    const category = transaction.transactionCategory || transaction.category;
    if (category !== "MEDICINE") {
      return NextResponse.json(
        { success: false, error: "Not a medicine transaction" },
        { status: 400 }
      );
    }

    // Get medicine ID and quantity to restore
    const medicineId = transaction.medicineId?._id || transaction.medicineId;
    const quantityToRestore = parseInt(transaction.quantity) || 0;

    if (!medicineId) {
      return NextResponse.json(
        { success: false, error: "Transaction has no associated medicine" },
        { status: 400 }
      );
    }

    // Find the medicine
    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      return NextResponse.json(
        { success: false, error: "Medicine not found" },
        { status: 404 }
      );
    }

    // Store original stock for response
    const originalStock = medicine.stock || 0;

    // Restore the stock (add back the quantity that was sold)
    medicine.stock = originalStock + quantityToRestore;

    // Save medicine
    await medicine.save();

    // Store transaction details for response
    const deletedData = {
      transactionId: transaction._id,
      medicineName: medicine.name,
      medicineId: medicine._id,
      quantityRestored: quantityToRestore,
      originalStock,
      newStock: medicine.stock,
      amount: transaction.amount,
      batchId: transaction.batchId,
      date: transaction.date,
    };

    // Delete the transaction
    await Transaction.findByIdAndDelete(transactionId);

    return NextResponse.json({
      success: true,
      message: "Medicine transaction deleted and stock restored successfully",
      data: deletedData,
    });
  } catch (error) {
    console.error("Error deleting medicine transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete medicine transaction",
      },
      { status: 500 }
    );
  }
}