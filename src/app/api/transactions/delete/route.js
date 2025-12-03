import { NextResponse } from "next/server";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

export async function DELETE(request) {
  try {
    // Connect to database
    await dbConnect();

    // Parse request body
    const body = await request.json();
    const { _id } = body;

    // Validate _id
    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction ID is required",
        },
        { status: 400 }
      );
    }

    // Validate _id format
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid transaction ID format",
        },
        { status: 400 }
      );
    }

    // Find the transaction before deleting to get patient info
    const transactionToDelete = await Transactions.findById(_id);

    // Check if transaction exists
    if (!transactionToDelete) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404 }
      );
    }

    // Store transaction details before deletion
    const patientId = transactionToDelete.patient;
    const transactionAmount = transactionToDelete.amount || 0;
    const transactionDiscount = transactionToDelete.discount || 0;
    const transactionCostType = transactionToDelete.costType;
    const transactionProcedure = transactionToDelete.procedure;

    // Delete the transaction
    const deletedTransaction = await Transactions.findByIdAndDelete(_id);

    // Update patient payments if this was a revenue transaction with a patient
    if (transactionCostType === "Revenue" && patientId) {
      try {
        const patient = await Patient.findById(patientId);

        if (patient) {
          // Initialize payments object if it doesn't exist
          if (!patient.payments) {
            patient.payments = {
              amountReceived: 0,
              pendingAmount: 0,
              medicineAmount: 0,
              discount: 0,
              totalAmount: 0,
              transactions: []
            };
          }

          // Remove transaction reference from patient
          if (patient.payments.transactions) {
            patient.payments.transactions = patient.payments.transactions.filter(
              transId => transId.toString() !== _id.toString()
            );
          }

          // Fetch all remaining transactions for this patient
          const remainingTransactions = await Transactions.find({
            _id: { $in: patient.payments.transactions },
            costType: "Revenue"
          });

          // Recalculate amounts from remaining transactions
          let totalAmountReceived = 0;
          let totalMedicineAmount = 0;
          let totalDiscount = 0;

          remainingTransactions.forEach(transaction => {
            const amount = transaction.amount || 0;
            const discount = transaction.discount || 0;
            const procedure = transaction.procedure;

            // Check if it's a medicine transaction
            const isMedicine = procedure?.toLowerCase() === 'medicine';

            if (isMedicine) {
              totalMedicineAmount += amount;
            } else {
              totalAmountReceived += amount;
            }

            totalDiscount += discount;
          });

          // Update patient payments
          patient.payments.amountReceived = totalAmountReceived;
          patient.payments.medicineAmount = totalMedicineAmount;
          patient.payments.discount = totalDiscount;

          // Calculate pending amount
          // Formula: Pending = (TotalAmount - TotalDiscount) - AmountReceived
          const totalAmount = patient.payments.totalAmount || 0;
          const adjustedTotal = Math.max(0, totalAmount - totalDiscount);
          patient.payments.pendingAmount = Math.max(0, adjustedTotal - totalAmountReceived);

          // Save updated patient
          await patient.save();

          console.log(`Patient ${patientId} payments updated after transaction deletion`);
        } else {
          console.warn(`Patient ${patientId} not found for payment update`);
        }
      } catch (patientUpdateError) {
        console.error("Error updating patient payments after transaction deletion:", patientUpdateError);
        // Don't fail the deletion if patient update fails
        // Transaction is already deleted at this point
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaction deleted successfully",
        data: {
          deletedTransaction,
          patientUpdated: transactionCostType === "Revenue" && patientId ? true : false
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting transaction:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid transaction ID format",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete transaction",
        error: error.message,
      },
      { status: 500 }
    );
  }
}