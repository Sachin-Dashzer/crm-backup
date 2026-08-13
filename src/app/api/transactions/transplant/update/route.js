// app/api/transactions/transplant/update/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import connectDB from "@/lib/db";
import { periodLockResponse } from "@/lib/periodLock";
import { withDbTransaction, syncExternalPartyOnUpdate } from "@/lib/externalPartyDerivation";
import mongoose from "mongoose";

export async function PUT(req) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.name || !session?.user?.email || !session?.user?.branch) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    await connectDB();

    const data = await req.json();

    // Validate transaction ID
    if (!data.transactionId || !mongoose.Types.ObjectId.isValid(data.transactionId)) {
      return NextResponse.json(
        { success: false, message: "Valid transaction ID is required" },
        { status: 400 }
      );
    }

    // Find existing transaction
    const existingTransaction = await Transactions.findById(data.transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        { success: false, message: "Transaction not found" },
        { status: 404 }
      );
    }

    // Verify it's a TRANSPLANT transaction
    if (existingTransaction.transactionCategory !== "TRANSPLANT") {
      return NextResponse.json(
        { success: false, message: "Not a transplant transaction" },
        { status: 400 }
      );
    }

    // Closed-period guard. Checks both where this transaction currently sits and where the
    // edit would move it, so a change can neither leave nor enter a frozen period.
    const locked = await periodLockResponse(existingTransaction, {
      date: data.date,
      furtherMode: data.furtherMode,
    });
    if (locked) {
      return NextResponse.json({ ...locked.body, message: locked.body.error }, { status: locked.status });
    }

    // Basic validations
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

    // Validate procedure if provided
    if (data.procedure !== undefined) {
      const validTransplantProcedures = ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"];
      if (!validTransplantProcedures.includes(data.procedure)) {
        return NextResponse.json(
          { success: false, message: "Invalid procedure for transplant transaction" },
          { status: 400 }
        );
      }
    }

    // Store original values
    const originalPatientId = existingTransaction.patient?.toString();
    const originalAmount = existingTransaction.amount || 0;
    const originalProcedure = existingTransaction.procedure;
    const originalDiscount = existingTransaction.discount || 0;

    // New values
    const newPatientId = data.patientId?.toString();
    const newAmount = data.amount !== undefined ? Number(data.amount) : originalAmount;
    const newProcedure = data.procedure || originalProcedure;
    const newDiscount = data.discount !== undefined ? Number(data.discount) : originalDiscount;

    // Track changed fields
    const updatedFields = [];
    const fieldMapping = {
      patientId: { name: "Patient", getValue: (val) => val?.toString() || "" },
      procedure: { name: "Procedure", getValue: (val) => val || "" },
      paymentType: { name: "Payment Type", getValue: (val) => val || "" },
      amount: { name: "Amount", getValue: (val) => val?.toString() || "0" },
      discount: { name: "Discount", getValue: (val) => val?.toString() || "0" },
      method: { name: "Payment Method", getValue: (val) => val || "" },
      paymentId: { name: "Payment ID", getValue: (val) => val || "" },
      date: { name: "Date", getValue: (val) => val ? new Date(val).toISOString() : "" },
      branch: { name: "Branch", getValue: (val) => val || "" },
      remarks: { name: "Remarks", getValue: (val) => val || "" },
    };

    // Compare fields and track changes
    Object.keys(data).forEach((key) => {
      if (key === "transactionId") return; // Skip ID field
      
      if (fieldMapping[key]) {
        const mapping = fieldMapping[key];
        const fieldKey = key === "patientId" ? "patient" : key;
        const previousValue = mapping.getValue(existingTransaction[fieldKey]);
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
    const { transactionId, patientId, ...updateData } = data;
    
    // Map patientId to patient field
    if (patientId !== undefined) {
      updateData.patient = patientId;
    }
    
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

    // Editing into / out of / within "Paid to External" has to move the linked Receivable with
    // it, or the amount leaves the books entirely — see syncExternalPartyOnUpdate. Wrapped in a
    // session so the receivable write and this transaction write commit or roll back together.
    let updatedTransaction;
    try {
      updatedTransaction = await withDbTransaction(async (dbSession) => {
        const patch = await syncExternalPartyOnUpdate({
          session: dbSession,
          transaction: existingTransaction,
          nextMethod: updateData.method !== undefined ? updateData.method : existingTransaction.method,
          nextAmount: updateData.amount !== undefined ? updateData.amount : existingTransaction.amount,
          nextExternalParty: data.externalParty,
          branch: updateData.branch || existingTransaction.branch,
          transactionCategory: "TRANSPLANT",
          relatedPatient: updateData.patient || existingTransaction.patient,
          actor: { name: session.user.name, email: session.user.email, branch: session.user.branch },
        });

        return Transactions.findByIdAndUpdate(
          data.transactionId,
          {
            $set: { ...updateData, ...(patch || {}) },
            $push: { editors: editorEntry },
          },
          { new: true, runValidators: true, session: dbSession },
        );
      });
    } catch (syncError) {
      // These are deliberate refusals (money already settled against the linked receivable),
      // not faults — surface the reason rather than a generic 500.
      return NextResponse.json({ success: false, message: syncError.message }, { status: 400 });
    }

    // Function to recalculate patient payments for TRANSPLANT
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

      // Fetch all revenue transactions for this patient
      const allTransactions = await Transactions.find({
        _id: { $in: patient.payments.transactions },
        costType: "Revenue",
      });

      // Recalculate from scratch (TRANSPLANT: all amounts go to amountReceived)
      let totalAmountReceived = 0;
      let totalDiscount = 0;

      allTransactions.forEach((transaction) => {
        const amount = transaction.amount || 0;
        totalAmountReceived += amount;
        totalDiscount += transaction.discount || 0;
      });

      patient.payments.amountReceived = totalAmountReceived;
      patient.payments.discount = totalDiscount;

      // Calculate pending amount
      const adjustedTotal = Math.max(0, patient.payments.totalAmount - totalDiscount);
      patient.payments.pendingAmount = Math.max(0, adjustedTotal - totalAmountReceived);

      // Add editor to patient
      patient.editors = patient.editors || [];
      patient.editors.push(editorEntry);

      return await patient.save();
    };

    // Handle patient updates
    const patientChanged = originalPatientId !== newPatientId;
    const dataChanged =
      originalAmount !== newAmount ||
      originalDiscount !== newDiscount;

    // Patient changed - update both patients
    if (patientChanged) {
      // Remove from original patient
      if (originalPatientId) {
        const originalPatient = await Patient.findById(originalPatientId);
        if (originalPatient?.payments) {
          originalPatient.payments.transactions = originalPatient.payments.transactions.filter(
            (tid) => tid.toString() !== data.transactionId.toString()
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
          if (!newPatient.payments.transactions.some(tid => tid.toString() === data.transactionId.toString())) {
            newPatient.payments.transactions.push(data.transactionId);
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

    return NextResponse.json(
      {
        success: true,
        message: "Transplant transaction updated successfully",
        data: updatedTransaction,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating transplant transaction:", error);

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
}