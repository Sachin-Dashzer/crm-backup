import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const data = await req.json();

    if (!data.costType || !data.method || !data.amount) {
      return NextResponse.json(
        { message: "All fields are required", success: false },
        { status: 400 }
      );
    }

    if (data.amount <= 0) {
      return NextResponse.json(
        { message: "Amount must be a positive number", success: false },
        { status: 400 }
      );
    }

    if (data.patient && !mongoose.Types.ObjectId.isValid(data.patient)) {
      return NextResponse.json(
        { message: "Invalid patient ID", success: false },
        { status: 400 }
      );
    }

    // For revenue transactions, patient is required
    if (data.costType === "Revenue" && !data.patient) {
      return NextResponse.json(
        { message: "Patient is required for revenue transactions", success: false },
        { status: 400 }
      );
    }

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

    const newTransaction = await Transactions.create({
      ...data,
      date: data.date || new Date(),
    });

    // Update patient payments only for revenue transactions
    if (data.patient && data.costType === "Revenue") {
      const patient = await Patient.findById(data.patient);
      
      if (!patient) {
        console.warn(`Patient ${data.patient} not found after transaction creation`);
      } else {
        // Initialize payments object if it doesn't exist
        if (!patient.payments) {
          patient.payments = {
            amountReceived: 0,
            pendingAmount: 0,
            medicineAmount: 0,
            totalAmount: 0,
            transactions: []
          };
        }
        
        // Initialize transactions array if it doesn't exist
        if (!patient.payments.transactions) {
          patient.payments.transactions = [];
        }
        
        // Add the new transaction ID to the array
        patient.payments.transactions.push(newTransaction._id);
        
        // Check if procedure is medicine
        const isMedicine = data.procedure?.toLowerCase() === 'medicine';
        
        // Update the payment amounts based on procedure type
        if (isMedicine) {
          // Add to medicine amount
          const currentMedicineAmount = patient.payments.medicineAmount || 0;
          patient.payments.medicineAmount = currentMedicineAmount + parseFloat(data.amount);
        } else {
          // Add to regular amount received
          const currentAmountReceived = patient.payments.amountReceived || 0;
          patient.payments.amountReceived = currentAmountReceived + parseFloat(data.amount);
        }
        
        // Calculate pending amount (totalAmount - (amountReceived + medicineAmount))
        const totalAmount = patient.payments.totalAmount || 0;
        const totalReceived = (patient.payments.amountReceived || 0) + (patient.payments.medicineAmount || 0);
        patient.payments.pendingAmount = Math.max(0, totalAmount - totalReceived);
        
        // Save the updated patient
        const updatedPatient = await patient.save();

        if (!updatedPatient) {
          console.warn(
            `Transaction created but failed to update patient ${data.patient}`
          );
        } else {
          console.log(`Successfully updated patient ${data.patient} payments:`, {
            amountReceived: updatedPatient.payments.amountReceived,
            medicineAmount: updatedPatient.payments.medicineAmount,
            pendingAmount: updatedPatient.payments.pendingAmount,
            totalAmount: updatedPatient.payments.totalAmount
          });
        }
      }
    }

    return NextResponse.json(
      {
        message: "Transaction created successfully",
        data: newTransaction,
        success: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating transaction:", error);

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