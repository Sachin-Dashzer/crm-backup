import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const data = await req.json();

    // Validation: Required fields
    if (!data.costType || !data.method || !data.amount) {
      return NextResponse.json(
        { message: "All fields are required", success: false },
        { status: 400 }
      );
    }

    // Validation: Amount must be positive
    if (data.amount <= 0) {
      return NextResponse.json(
        { message: "Amount must be a positive number", success: false },
        { status: 400 }
      );
    }

    
    
    // Validation: Patient ID format
    if (data.patient && !mongoose.Types.ObjectId.isValid(data.patient)) {
      return NextResponse.json(
        { message: "Invalid patient ID", success: false },
        { status: 400 }
      );
    }
    
    // For revenue transactions, patient is required
    if (data.costType === "Revenue" && !data.patient) {
      return NextResponse.json(
        {
          message: "Patient is required for revenue transactions",
          success: false,
        },
        { status: 400 }
      );
    }

    // Check if patient exists
    let existingPatient = null;
    if (data.patient) {
      existingPatient = await Patient.findById(data.patient);
      if (!existingPatient) {
        return NextResponse.json(
          { message: "Patient not found", success: false },
          { status: 404 }
        );
      }
    }



    data.amount = Math.floor(Number(data.amount));
    data.amount = Math.floor(data.amount);
    
    // Create the transaction
    const newTransaction = await Transactions.create({
      ...data,
      paymentId : data.paymentId || "",
      discount: data.discount || 0,
      date: data.date || new Date(),
    });

    let updatedPatient = null;
    
    // Update patient payment details for Revenue transactions
    if (data.patient && data.costType === "Revenue") {
      const patient = await Patient.findById(data.patient);

      if (!patient) {
        console.warn(
          `Patient ${data.patient} not found after transaction creation`
        );
      } else {
        // Initialize payments object if not exists
        if (!patient.payments) {
          patient.payments = {
            amountReceived: 0,
            pendingAmount: 0,
            medicineAmount: 0,
            discount: 0,
            totalAmount: 0,
            transactions: [],
          };
        }

        if (!patient.payments.transactions) {
          patient.payments.transactions = [];
        }

        // Add transaction reference
        patient.payments.transactions.push(newTransaction._id);

        // Determine if this is a medicine transaction
        const isMedicine = data.procedure?.toLowerCase() === "medicine";

        // Update amounts
        if (isMedicine) {
          const currentMedicineAmount = patient.payments.medicineAmount || 0;
          patient.payments.medicineAmount =
            currentMedicineAmount + parseFloat(data.amount);
        } else {
          const currentAmountReceived = patient.payments.amountReceived || 0;
          patient.payments.amountReceived =
            currentAmountReceived + parseFloat(data.amount);
        }

        // Recalculate total discount from all transactions
        // This ensures accuracy even if transactions are edited/deleted
        const allTransactions = await Transactions.find({
          _id: { $in: patient.payments.transactions },
          costType: "Revenue",
        });

        const totalDiscount = allTransactions.reduce(
          (sum, transaction) => sum + (transaction.discount || 0),
          0
        );
        patient.payments.discount = totalDiscount;

        // Calculate pending amount
        // Formula: Pending = (TotalAmount - TotalDiscount) - AmountReceived
        const totalAmount = patient.payments.totalAmount || 0;
        const amountReceived = patient.payments.amountReceived || 0;
        const adjustedTotal = Math.max(0, totalAmount - totalDiscount);
        
        patient.payments.pendingAmount = Math.max(
          0,
          adjustedTotal - amountReceived
        );

        // Save the updated patient
        updatedPatient = await patient.save();

        if (!updatedPatient) {
          console.warn(
            `Transaction created but failed to update patient ${data.patient}`
          );
        }
      }
    }

    return NextResponse.json(
      {
        message: "Transaction created successfully",
        data: newTransaction,
        updatedPatient: updatedPatient
          ? {
              _id: updatedPatient._id,
              payments: updatedPatient.payments,
            }
          : null,
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transaction creation error:", error);

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