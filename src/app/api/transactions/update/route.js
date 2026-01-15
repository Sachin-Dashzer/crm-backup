import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

const handler = async (req) => {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.name || !session?.user?.email || !session?.user?.branch) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const data = await req.json();

    // Validate transaction ID
    if (!data._id || !mongoose.Types.ObjectId.isValid(data._id)) {
      return NextResponse.json(
        { success: false, message: "Valid transaction ID is required" },
        { status: 400 }
      );
    }

    // Find existing transaction
    const existingTransaction = await Transactions.findById(data._id);
    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, message: "Transaction not found" },
        { status: 404 }
      );
    }

    // Basic validations
    if (data.costType !== undefined && !data.costType) {
      return NextResponse.json(
        { success: false, message: "Cost type is required" },
        { status: 400 }
      );
    }

    if (data.method !== undefined && !data.method) {
      return NextResponse.json(
        { success: false, message: "Payment method is required" },
        { status: 400 }
      );
    }

    if (data.amount !== undefined && data.amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Validate discount
    if (data.discount !== undefined) {
      const checkAmount = data.amount !== undefined ? data.amount : existingTransaction.amount;
      if (data.discount < 0 || data.discount > checkAmount) {
        return NextResponse.json(
          { success: false, message: "Invalid discount amount" },
          { status: 400 }
        );
      }
    }

    // Store original values
    const originalPatientId = existingTransaction.patient?.toString();
    const originalAmount = existingTransaction.amount || 0;
    const originalCostType = existingTransaction.costType;
    const originalProcedure = existingTransaction.procedure;
    const originalDiscount = existingTransaction.discount || 0;

    // New values
    const newPatientId = data.patient?.toString();
    const newAmount = data.amount !== undefined ? Number(data.amount) : originalAmount;
    const newCostType = data.costType || originalCostType;
    const newProcedure = data.procedure || originalProcedure;
    const newDiscount = data.discount !== undefined ? Number(data.discount) : originalDiscount;

    // Helper function
    const isMedicine = (procedure) => procedure?.toLowerCase() === "medicine";

    // Track changed fields
    const updatedFields = [];
    const fieldMapping = {
      patient: { name: "Patient", getValue: (val) => val?.toString() || "" },
      costType: { name: "Cost Type", getValue: (val) => val || "" },
      procedure: { name: "Procedure", getValue: (val) => val || "" },
      amount: { name: "Amount", getValue: (val) => val?.toString() || "0" },
      discount: { name: "Discount", getValue: (val) => val?.toString() || "0" },
      method: { name: "Payment Method", getValue: (val) => val || "" },
      description: { name: "Description", getValue: (val) => val || "" },
      date: { name: "Date", getValue: (val) => val ? new Date(val).toISOString() : "" },
      branch: { name: "Branch", getValue: (val) => val || "" },
      referredBy: { name: "Referred By", getValue: (val) => val || "" },
    };

    // Compare fields and track changes
    Object.keys(data).forEach((key) => {
      if (key === "_id") return; // Skip ID field
      
      if (fieldMapping[key]) {
        const mapping = fieldMapping[key];
        const previousValue = mapping.getValue(existingTransaction[key]);
        const newValue = mapping.getValue(data[key]);
        
        if (previousValue !== newValue) {
          updatedFields.push({
            name: mapping.name,
            previousValue: previousValue,
            newValue: newValue,
          });
        }
      }
    });

    // Prepare update data
    const { _id, ...updateData } = data;
    if (updateData.amount !== undefined) {
      updateData.amount = Number(updateData.amount);
    }
    if (updateData.discount !== undefined) {
      updateData.discount = Number(updateData.discount);
    }

    // Add editor to transaction with tracked fields
    const editorEntry = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
      updatedFields: updatedFields,
    };

    // Update the transaction with editor
    const updatedTransaction = await Transactions.findByIdAndUpdate(
      _id,
      {
        $set: updateData,
        $push: { editors: editorEntry },
      },
      { new: true, runValidators: true }
    );

    // Function to recalculate patient payments
    const recalculatePatientPayments = async (patientId) => {
      if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
        return null;
      }

      const patient = await Patient.findById(patientId);
      if (!patient) return null;

      // Initialize payments
      patient.payments = patient.payments || {
        amountReceived: 0,
        pendingAmount: 0,
        medicineAmount: 0,
        discount: 0,
        totalAmount: 0,
        transactions: [],
      };

      // Fetch all revenue transactions
      const allTransactions = await Transactions.find({
        _id: { $in: patient.payments.transactions },
        costType: "Revenue",
      });

      // Recalculate from scratch
      let totalAmountReceived = 0;
      let totalMedicineAmount = 0;
      let totalDiscount = 0;

      allTransactions.forEach((transaction) => {
        const amount = transaction.amount || 0;
        if (isMedicine(transaction.procedure)) {
          totalMedicineAmount += amount;
        } else {
          totalAmountReceived += amount;
        }
        totalDiscount += transaction.discount || 0;
      });

      patient.payments.amountReceived = totalAmountReceived;
      patient.payments.medicineAmount = totalMedicineAmount;
      patient.payments.discount = totalDiscount;

      const adjustedTotal = Math.max(0, patient.payments.totalAmount - totalDiscount);
      patient.payments.pendingAmount = Math.max(0, adjustedTotal - totalAmountReceived);

      // Add editor to patient
      patient.editors = patient.editors || [];
      patient.editors.push(editorEntry);

      return await patient.save();
    };

    // Handle patient updates for revenue transactions
    if (newCostType === "Revenue") {
      const patientChanged = originalPatientId !== newPatientId;
      const dataChanged =
        originalAmount !== newAmount ||
        isMedicine(originalProcedure) !== isMedicine(newProcedure) ||
        originalDiscount !== newDiscount;

      // Patient changed - update both patients
      if (patientChanged) {
        // Remove from original patient
        if (originalPatientId) {
          const originalPatient = await Patient.findById(originalPatientId);
          if (originalPatient?.payments) {
            originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
              (tid) => tid.toString() !== _id.toString()
            );
            await originalPatient.save();
            await recalculatePatientPayments(originalPatientId);
          }
        }

        // Add to new patient
        if (newPatientId) {
          const newPatient = await Patient.findById(newPatientId);
          if (newPatient) {
            newPatient.payments = newPatient.payments || {
              amountReceived: 0,
              pendingAmount: 0,
              medicineAmount: 0,
              discount: 0,
              totalAmount: 0,
              transactions: [],
            };
            if (!newPatient.payments.transactions.includes(_id)) {
              newPatient.payments.transactions.push(_id);
            }
            await newPatient.save();
            await recalculatePatientPayments(newPatientId);
          }
        }
      }
      // Same patient but data changed
      else if (originalPatientId && dataChanged) {
        await recalculatePatientPayments(originalPatientId);
      }
    }
    // Cost type changed from Revenue to Expenses - remove from patient
    else if (originalCostType === "Revenue" && newCostType === "Expenses" && originalPatientId) {
      const originalPatient = await Patient.findById(originalPatientId);
      if (originalPatient?.payments) {
        originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
          (tid) => tid.toString() !== _id.toString()
        );
        await originalPatient.save();
        await recalculatePatientPayments(originalPatientId);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaction updated successfully",
        data: updatedTransaction,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating transaction:", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
};

export const PUT = withDB(handler);