import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const data = await req.json();

    console.log("Update transaction data:", data);

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

    // Store original values for patient payment calculations
    const originalPatientId = existingTransaction.patient;
    const originalAmount = existingTransaction.amount || 0;
    const originalCostType = existingTransaction.costType;
    const originalProcedure = existingTransaction.procedure;
    
    const newPatientId = data.patient;
    const newAmount = data.amount ? Number(data.amount) : originalAmount;
    const newCostType = data.costType || originalCostType;
    const newProcedure = data.procedure || originalProcedure;

    // Check if procedure is medicine
    const isMedicine = (procedure) => procedure?.toLowerCase() === 'medicine';
    const wasMedicine = isMedicine(originalProcedure);
    const isNowMedicine = isMedicine(newProcedure);

    // Prepare update data
    const { _id, ...updateData } = data;
    
    // Convert amount to number if it exists
    if (updateData.amount !== undefined) {
      updateData.amount = Number(updateData.amount);
      
      // Validate that conversion was successful
      if (isNaN(updateData.amount)) {
        return NextResponse.json(
          { message: "Invalid amount format", success: false },
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

    // Handle patient payment updates for revenue transactions
    if (newCostType === "Revenue") {
      const patientUpdatePromises = [];

      // Function to update patient payment amounts
      const updatePatientPaymentAmounts = async (patientId, amountChange, operation, isMedicineProcedure = false) => {
        if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
          try {
            const patient = await Patient.findById(patientId);
            if (!patient) {
              console.warn(`Patient ${patientId} not found for payment update`);
              return null;
            }

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

            if (operation === 'add') {
              if (isMedicineProcedure) {
                // Add to medicine amount
                patient.payments.medicineAmount = (patient.payments.medicineAmount || 0) + amountChange;
              } else {
                // Add to regular amount received
                patient.payments.amountReceived = (patient.payments.amountReceived || 0) + amountChange;
              }
              
              // Add transaction reference if not already present
              if (!patient.payments.transactions.includes(_id)) {
                patient.payments.transactions.push(_id);
              }
            } else if (operation === 'remove') {
              if (isMedicineProcedure) {
                // Remove from medicine amount
                patient.payments.medicineAmount = Math.max(0, (patient.payments.medicineAmount || 0) - amountChange);
              } else {
                // Remove from regular amount received
                patient.payments.amountReceived = Math.max(0, (patient.payments.amountReceived || 0) - amountChange);
              }
              
              // Remove transaction reference
              patient.payments.transactions = patient.payments.transactions.filter(
                transId => transId.toString() !== _id.toString()
              );
            } else if (operation === 'update') {
              // Calculate the difference between old and new amount
              const amountDifference = amountChange;
              
              if (wasMedicine && isNowMedicine) {
                // Both old and new are medicine - update medicine amount
                patient.payments.medicineAmount = (patient.payments.medicineAmount || 0) + amountDifference;
              } else if (wasMedicine && !isNowMedicine) {
                // Changed from medicine to non-medicine
                patient.payments.medicineAmount = Math.max(0, (patient.payments.medicineAmount || 0) - originalAmount);
                patient.payments.amountReceived = (patient.payments.amountReceived || 0) + newAmount;
              } else if (!wasMedicine && isNowMedicine) {
                // Changed from non-medicine to medicine
                patient.payments.amountReceived = Math.max(0, (patient.payments.amountReceived || 0) - originalAmount);
                patient.payments.medicineAmount = (patient.payments.medicineAmount || 0) + newAmount;
              } else {
                // Both are non-medicine - update regular amount
                patient.payments.amountReceived = (patient.payments.amountReceived || 0) + amountDifference;
              }
            }

            // Recalculate pending amount (totalAmount - (amountReceived + medicineAmount))
            const totalAmount = patient.payments.totalAmount || 0;
            const totalReceived = (patient.payments.amountReceived || 0) + (patient.payments.medicineAmount || 0);
            patient.payments.pendingAmount = Math.max(0, totalAmount - totalReceived);

            // Ensure amounts don't go negative
            patient.payments.amountReceived = Math.max(0, patient.payments.amountReceived);
            patient.payments.medicineAmount = Math.max(0, patient.payments.medicineAmount);

            return await patient.save();
          } catch (error) {
            console.error(`Error updating patient ${patientId} payments:`, error);
            return null;
          }
        }
        return null;
      };

      // Scenario 1: Patient changed (both original and new patient exist)
      if (originalPatientId && newPatientId && originalPatientId.toString() !== newPatientId.toString()) {
        console.log(`Patient changed from ${originalPatientId} to ${newPatientId}`);

        // Remove amount and reference from original patient
        patientUpdatePromises.push(
          updatePatientPaymentAmounts(originalPatientId, originalAmount, 'remove', wasMedicine)
        );

        // Add amount and reference to new patient
        patientUpdatePromises.push(
          updatePatientPaymentAmounts(newPatientId, newAmount, 'add', isNowMedicine)
        );

      } 
      // Scenario 2: New patient assigned (no original patient)
      else if (!originalPatientId && newPatientId) {
        console.log(`New patient assigned: ${newPatientId}`);
        
        patientUpdatePromises.push(
          updatePatientPaymentAmounts(newPatientId, newAmount, 'add', isNowMedicine)
        );

      } 
      // Scenario 3: Patient removed (original patient exists but new patient is empty)
      else if (originalPatientId && !newPatientId) {
        console.log(`Patient removed: ${originalPatientId}`);
        
        patientUpdatePromises.push(
          updatePatientPaymentAmounts(originalPatientId, originalAmount, 'remove', wasMedicine)
        );

      } 
      // Scenario 4: Same patient, amount or procedure changed
      else if (originalPatientId && newPatientId && originalPatientId.toString() === newPatientId.toString() && 
               (originalAmount !== newAmount || wasMedicine !== isNowMedicine)) {
        console.log(`Changes for patient ${originalPatientId}: Amount ${originalAmount}->${newAmount}, Medicine ${wasMedicine}->${isNowMedicine}`);
        
        if (wasMedicine === isNowMedicine) {
          // Same procedure type, just amount changed
          const amountDifference = newAmount - originalAmount;
          patientUpdatePromises.push(
            updatePatientPaymentAmounts(originalPatientId, amountDifference, 'update', isNowMedicine)
          );
        } else {
          // Procedure type changed - need special handling
          patientUpdatePromises.push(
            updatePatientPaymentAmounts(originalPatientId, newAmount - originalAmount, 'update', isNowMedicine)
          );
        }

      }
      // Scenario 5: Same patient, same amount, same procedure - no payment update needed
      else {
        console.log("No payment amount changes needed");
      }

      // Execute all patient updates
      if (patientUpdatePromises.length > 0) {
        const results = await Promise.all(patientUpdatePromises);
        const successfulUpdates = results.filter(result => result !== null);
        console.log(`Successfully updated ${successfulUpdates.length} patient payment records`);
      }
    } 
    // Handle expense transactions - remove from patient payments if cost type changed from Revenue to Expenses
    else if (originalCostType === "Revenue" && newCostType === "Expenses" && originalPatientId) {
      console.log(`Transaction type changed from Revenue to Expenses, removing from patient ${originalPatientId}`);
      
      // Remove the amount from the original patient
      await updatePatientPaymentAmounts(originalPatientId, originalAmount, 'remove', wasMedicine);
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

    // Handle specific MongoDB errors
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