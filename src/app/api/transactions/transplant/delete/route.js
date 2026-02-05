// app/api/transactions/transplant/delete/route.js

import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Patient from "@/models/Patient";
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
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify it's a TRANSPLANT transaction
    const category = transaction.transactionCategory || transaction.category;
    if (category !== "TRANSPLANT") {
      return NextResponse.json(
        { success: false, error: "Not a transplant transaction" },
        { status: 400 }
      );
    }

    // Get patient ID
    const patientId = transaction.patient;
    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "Transaction has no associated patient" },
        { status: 400 }
      );
    }

    // Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    // Calculate the amount to restore
    const deletedAmount = parseFloat(transaction.amount) || 0;

    // Update patient's payment information
    // Subtract from totalPaid and add back to pending
    const currentTotalPaid = parseFloat(patient.payments?.totalPaid || 0);
    const currentPending = parseFloat(patient.payments?.pending || 0);

    const newTotalPaid = Math.max(0, currentTotalPaid - deletedAmount);
    const newPending = currentPending + deletedAmount;

    // Update patient
    patient.payments = {
      ...patient.payments,
      totalPaid: newTotalPaid,
      pending: newPending,
      // Remove this transaction from transactions array if it exists
      transactions: (patient.payments?.transactions || []).filter(
        (txnId) => txnId.toString() !== transactionId.toString()
      ),
    };

    // Save patient
    await patient.save();

    // Delete the transaction
    await Transaction.findByIdAndDelete(transactionId);

    return NextResponse.json({
      success: true,
      message: "Transplant transaction deleted successfully",
      data: {
        deletedAmount,
        restoredPending: deletedAmount,
        patientId: patient._id,
        newTotalPaid,
        newPending,
      },
    });
  } catch (error) {
    console.error("Error deleting transplant transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete transplant transaction",
      },
      { status: 500 }
    );
  }
}