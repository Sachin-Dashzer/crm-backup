import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const data = await req.json();

    // Check if data is an array (multiple transactions) or single object
    const isBulk = Array.isArray(data);
    const transactionsData = isBulk ? data : [data];

    if (transactionsData.length === 0) {
      return NextResponse.json(
        { message: "No transaction data provided", success: false },
        { status: 400 }
      );
    }

    // Validate all transactions
    const validationErrors = [];
    const patientIds = new Set();

    for (let i = 0; i < transactionsData.length; i++) {
      const transaction = transactionsData[i];
      
      if (!transaction.costType || !transaction.method || !transaction.amount) {
        validationErrors.push(`Transaction ${i + 1}: All fields (costType, method, amount) are required`);
        continue;
      }

      if (transaction.amount <= 0) {
        validationErrors.push(`Transaction ${i + 1}: Amount must be a positive number`);
        continue;
      }

      if (transaction.patient) {
        if (!mongoose.Types.ObjectId.isValid(transaction.patient)) {
          validationErrors.push(`Transaction ${i + 1}: Invalid patient ID`);
          continue;
        }
        patientIds.add(transaction.patient);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          message: "Validation errors", 
          errors: validationErrors, 
          success: false 
        },
        { status: 400 }
      );
    }

    // Verify all patients exist
    if (patientIds.size > 0) {
      const existingPatients = await Patient.find({
        _id: { $in: Array.from(patientIds) }
      }).select('_id');

      const existingPatientIds = new Set(existingPatients.map(p => p._id.toString()));
      
      for (let i = 0; i < transactionsData.length; i++) {
        const transaction = transactionsData[i];
        if (transaction.patient && !existingPatientIds.has(transaction.patient)) {
          validationErrors.push(`Transaction ${i + 1}: Patient not found`);
        }
      }

      if (validationErrors.length > 0) {
        return NextResponse.json(
          { 
            message: "Patient validation errors", 
            errors: validationErrors, 
            success: false 
          },
          { status: 404 }
        );
      }
    }

    // Prepare transactions with dates
    const transactionsToCreate = transactionsData.map(transaction => ({
      ...transaction,
      date: transaction.date || new Date(),
    }));

    // Create all transactions
    const newTransactions = await Transactions.insertMany(transactionsToCreate);

    // Update patient records for transactions with patients
    const patientUpdates = [];
    const patientTransactionMap = new Map();

    // Group transactions by patient
    newTransactions.forEach((transaction, index) => {
      if (transaction.patient) {
        if (!patientTransactionMap.has(transaction.patient.toString())) {
          patientTransactionMap.set(transaction.patient.toString(), []);
        }
        patientTransactionMap.get(transaction.patient.toString()).push({
          transactionId: transaction._id,
          amount: transactionsData[index].amount
        });
      }
    });

    // Update each patient
    for (const [patientId, transactions] of patientTransactionMap.entries()) {
      try {
        const patient = await Patient.findById(patientId);
        
        if (patient) {
          // Initialize payments object if it doesn't exist
          if (!patient.payments) {
            patient.payments = {
              totalAmount: 0,
              amountReceived: 0,
              pendingAmount: 0,
              medicineAmount: 0,
              transactions: []
            };
          }
          
          // Initialize transactions array if it doesn't exist
          if (!patient.payments.transactions) {
            patient.payments.transactions = [];
          }
          
          // Add all transaction IDs and calculate total amount
          const totalAmountForPatient = transactions.reduce((sum, t) => sum + t.amount, 0);
          
          transactions.forEach(t => {
            patient.payments.transactions.push(t.transactionId);
          });
          
          // Update payment amounts
          patient.payments.amountReceived = (patient.payments.amountReceived || 0) + totalAmountForPatient;
          patient.payments.pendingAmount = (patient.payments.totalAmount || 0) - patient.payments.amountReceived;
          
          // Save the updated patient
          const updatedPatient = await patient.save();
          patientUpdates.push({
            patientId,
            success: true,
            updatedPatient
          });
        }
      } catch (patientError) {
        console.error(`Error updating patient ${patientId}:`, patientError);
        patientUpdates.push({
          patientId,
          success: false,
          error: patientError.message
        });
      }
    }

    // Log any patient update failures (but don't fail the entire operation)
    const failedPatientUpdates = patientUpdates.filter(update => !update.success);
    if (failedPatientUpdates.length > 0) {
      console.warn("Some patient updates failed:", failedPatientUpdates);
    }

    return NextResponse.json(
      {
        message: isBulk 
          ? `${newTransactions.length} transactions created successfully` 
          : "Transaction created successfully",
        data: isBulk ? newTransactions : newTransactions[0],
        patientUpdates: {
          total: patientUpdates.length,
          successful: patientUpdates.filter(u => u.success).length,
          failed: failedPatientUpdates.length
        },
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating transaction(s):", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Validation Error", error: error.message, success: false },
        { status: 400 }
      );
    }

    if (error.name === "CastError") {
      return NextResponse.json(
        {
          message: "Invalid data format",
          error: error.message,
          success: false,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: "Internal Server Error",
        error: error.message,
        success: false,
      },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);