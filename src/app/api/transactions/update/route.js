import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const data = await req.json();

    // Validate transaction ID
    if (!data._id || !mongoose.Types.ObjectId.isValid(data._id)) {
      return NextResponse.json(
        { message: "Valid transaction ID is required", success: false },
        { status: 400 }
      );
    }

    // Find existing transaction
    const existingTransaction = await Transactions.findById(data._id);
    if (!existingTransaction) {
      return NextResponse.json(
        { message: "Transaction not found", success: false },
        { status: 404 }
      );
    }

    // Validate required fields
    if (data.costType !== undefined && !data.costType) {
      return NextResponse.json(
        { message: "Cost type is required", success: false },
        { status: 400 }
      );
    }

    if (data.method !== undefined && !data.method) {
      return NextResponse.json(
        { message: "Payment method is required", success: false },
        { status: 400 }
      );
    }

    if (data.amount !== undefined && data.amount <= 0) {
      return NextResponse.json(
        { message: "Amount must be a positive number", success: false },
        { status: 400 }
      );
    }

    // Validate discount
    if (data.discount !== undefined) {
      if (data.discount < 0) {
        return NextResponse.json(
          { message: "Discount cannot be negative", success: false },
          { status: 400 }
        );
      }
      const checkAmount = data.amount !== undefined ? data.amount : existingTransaction.amount;
      if (data.discount > checkAmount) {
        return NextResponse.json(
          { message: "Discount cannot exceed transaction amount", success: false },
          { status: 400 }
        );
      }
    }

    // Store original values for patient payment calculations
    const originalPatientId = existingTransaction.patient;
    const originalAmount = existingTransaction.amount || 0;
    const originalCostType = existingTransaction.costType;
    const originalProcedure = existingTransaction.procedure;
    const originalDiscount = existingTransaction.discount || 0;
    
    const newPatientId = data.patient;
    const newAmount = data.amount !== undefined ? Number(data.amount) : originalAmount;
    const newCostType = data.costType || originalCostType;
    const newProcedure = data.procedure || originalProcedure;
    const newDiscount = data.discount !== undefined ? Number(data.discount) : originalDiscount;

    // Check if procedure is medicine
    const isMedicine = (procedure) => procedure?.toLowerCase() === 'medicine';
    const wasMedicine = isMedicine(originalProcedure);
    const isNowMedicine = isMedicine(newProcedure);

    // Prepare update data
    const { _id, ...updateData } = data;
    
    // Convert amount and discount to number if they exist
    if (updateData.amount !== undefined) {
      updateData.amount = Number(updateData.amount);
      if (isNaN(updateData.amount)) {
        return NextResponse.json(
          { message: "Invalid amount format", success: false },
          { status: 400 }
        );
      }
    }

    if (updateData.discount !== undefined) {
      updateData.discount = Number(updateData.discount);
      if (isNaN(updateData.discount)) {
        return NextResponse.json(
          { message: "Invalid discount format", success: false },
          { status: 400 }
        );
      }
    }

    // Update the transaction
    const updatedTransaction = await Transactions.findByIdAndUpdate(
      _id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Function to recalculate patient payments from all transactions
    const recalculatePatientPayments = async (patientId) => {
      if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        return null;
      }

      try {
        const patient = await Patient.findById(patientId);
        if (!patient) {
          console.warn(`Patient ${patientId} not found for payment recalculation`);
          return null;
        }

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

        // Fetch all transactions for this patient
        const allTransactions = await Transactions.find({
          _id: { $in: patient.payments.transactions },
          costType: "Revenue"
        });

        // Recalculate amounts from scratch
        let totalAmountReceived = 0;
        let totalMedicineAmount = 0;
        let totalDiscount = 0;

        allTransactions.forEach(transaction => {
          const transAmount = transaction.amount || 0;
          const transDiscount = transaction.discount || 0;
          
          if (isMedicine(transaction.procedure)) {
            totalMedicineAmount += transAmount;
          } else {
            totalAmountReceived += transAmount;
          }
          
          totalDiscount += transDiscount;
        });

        // Update patient payments
        patient.payments.amountReceived = totalAmountReceived;
        patient.payments.medicineAmount = totalMedicineAmount;
        patient.payments.discount = totalDiscount;

        // Calculate pending amount
        const totalAmount = patient.payments.totalAmount || 0;
        const adjustedTotal = Math.max(0, totalAmount - totalDiscount);
        patient.payments.pendingAmount = Math.max(0, adjustedTotal - totalAmountReceived);

        return await patient.save();
      } catch (error) {
        console.error(`Error recalculating patient ${patientId} payments:`, error);
        return null;
      }
    };

    // Handle patient payment updates for revenue transactions
    if (newCostType === "Revenue") {
      // Scenario 1: Patient changed (both original and new patient exist)
      if (originalPatientId && newPatientId && originalPatientId.toString() !== newPatientId.toString()) {
        // Update original patient (remove this transaction)
        const originalPatient = await Patient.findById(originalPatientId);
        if (originalPatient && originalPatient.payments) {
          originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
            transId => transId.toString() !== _id.toString()
          );
          await originalPatient.save();
          await recalculatePatientPayments(originalPatientId);
        }

        // Update new patient (add this transaction)
        const newPatient = await Patient.findById(newPatientId);
        if (newPatient) {
          if (!newPatient.payments) {
            newPatient.payments = {
              amountReceived: 0,
              pendingAmount: 0,
              medicineAmount: 0,
              discount: 0,
              totalAmount: 0,
              transactions: []
            };
          }
          if (!newPatient.payments.transactions.includes(_id)) {
            newPatient.payments.transactions.push(_id);
          }
          await newPatient.save();
          await recalculatePatientPayments(newPatientId);
        }
      } 
      // Scenario 2: New patient assigned (no original patient)
      else if (!originalPatientId && newPatientId) {
        const newPatient = await Patient.findById(newPatientId);
        if (newPatient) {
          if (!newPatient.payments) {
            newPatient.payments = {
              amountReceived: 0,
              pendingAmount: 0,
              medicineAmount: 0,
              discount: 0,
              totalAmount: 0,
              transactions: []
            };
          }
          if (!newPatient.payments.transactions.includes(_id)) {
            newPatient.payments.transactions.push(_id);
          }
          await newPatient.save();
          await recalculatePatientPayments(newPatientId);
        }
      } 
      // Scenario 3: Patient removed (original patient exists but new patient is empty)
      else if (originalPatientId && !newPatientId) {
        const originalPatient = await Patient.findById(originalPatientId);
        if (originalPatient && originalPatient.payments) {
          originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
            transId => transId.toString() !== _id.toString()
          );
          await originalPatient.save();
          await recalculatePatientPayments(originalPatientId);
        }
      } 
      // Scenario 4: Same patient, but amount/procedure/discount changed
      else if (originalPatientId && newPatientId && originalPatientId.toString() === newPatientId.toString()) {
        const amountChanged = originalAmount !== newAmount;
        const procedureChanged = wasMedicine !== isNowMedicine;
        const discountChanged = originalDiscount !== newDiscount;

        if (amountChanged || procedureChanged || discountChanged) {
          await recalculatePatientPayments(originalPatientId);
        }
      }
    } 
    // Handle expense transactions - remove from patient payments if cost type changed from Revenue to Expenses
    else if (originalCostType === "Revenue" && newCostType === "Expenses" && originalPatientId) {
      const originalPatient = await Patient.findById(originalPatientId);
      if (originalPatient && originalPatient.payments) {
        originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
          transId => transId.toString() !== _id.toString()
        );
        await originalPatient.save();
        await recalculatePatientPayments(originalPatientId);
      }
    }

    return NextResponse.json(
      {
        message: "Transaction updated successfully",
        data: updatedTransaction,
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating transaction:", error);

    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { message: "Validation Error", error: error.message, success: false },
        { status: 400 }
      );
    }

    if (error.name === 'CastError') {
      return NextResponse.json(
        { message: "Invalid data format", error: error.message, success: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Internal Server Error", error: error.message, success: false },
      { status: 500 }
    );
  }
};

export const PUT = withDB(handler);