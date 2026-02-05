import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import Transaction from "@/models/Transactions";
import Patient from "@/models/Patient";
import connectDB from "@/lib/db";

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const {
      transactionId,
      patientId,
      procedure,
      paymentType,
      amount,
      discount = 0,
      method,
      paymentId,
      branch,
      date,
      remarks,
    } = body;

    // Validation
    if (!transactionId || !patientId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find existing transaction
    const existingTransaction = await Transaction.findById(transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if it's a transplant transaction
    if (existingTransaction.transactionCategory !== "TRANSPLANT") {
      return NextResponse.json(
        { error: "This is not a transplant transaction" },
        { status: 400 }
      );
    }

    // Check permissions
    if (session.user.role !== "admin") {
      if (existingTransaction.branch !== session.user.branch) {
        return NextResponse.json(
          { error: "You don't have permission to edit this transaction" },
          { status: 403 }
        );
      }
    }

    // Find patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    // Calculate old and new amounts
    const oldAmount = parseFloat(existingTransaction.amount) || 0;
    const oldDiscount = parseFloat(existingTransaction.discount) || 0;
    const oldNetAmount = oldAmount - oldDiscount;

    const newAmount = parseFloat(amount) || 0;
    const newDiscount = parseFloat(discount) || 0;
    const newNetAmount = newAmount - newDiscount;

    // Track changes for audit
    const updatedFields = [];
    const trackField = (fieldName, oldVal, newVal) => {
      if (String(oldVal) !== String(newVal)) {
        updatedFields.push({
          name: fieldName,
          previousValue: String(oldVal || ""),
          newValue: String(newVal || ""),
        });
      }
    };

    trackField("procedure", existingTransaction.procedure, procedure);
    trackField("paymentType", existingTransaction.paymentType, paymentType);
    trackField("amount", existingTransaction.amount, amount);
    trackField("discount", existingTransaction.discount, discount);
    trackField("method", existingTransaction.method, method);
    trackField("paymentId", existingTransaction.paymentId, paymentId);
    trackField("branch", existingTransaction.branch, branch);
    trackField("date", existingTransaction.date, date);
    trackField("remarks", existingTransaction.remarks, remarks);

    // Update patient's payment info if amount changed
    const oldPatientId = existingTransaction.patient?.toString();
    const newPatientId = patientId.toString();
    const patientChanged = oldPatientId !== newPatientId;

    if (patientChanged || oldNetAmount !== newNetAmount || oldDiscount !== newDiscount) {
      // Revert old patient's amounts
      if (oldPatientId && oldPatientId !== newPatientId) {
        const oldPatient = await Patient.findById(oldPatientId);
        if (oldPatient) {
          oldPatient.payments.amountReceived = Math.max(
            0,
            (oldPatient.payments.amountReceived || 0) - oldNetAmount
          );
          oldPatient.payments.discount = Math.max(
            0,
            (oldPatient.payments.discount || 0) - oldDiscount
          );
          oldPatient.payments.pendingAmount =
            (oldPatient.payments.totalAmount || 0) -
            oldPatient.payments.amountReceived -
            oldPatient.payments.discount;
          await oldPatient.save();
        }
      }

      // Apply to new/same patient
      if (patientChanged) {
        // New patient gets full new amounts
        patient.payments.amountReceived =
          (patient.payments.amountReceived || 0) + newNetAmount;
        patient.payments.discount = (patient.payments.discount || 0) + newDiscount;
      } else {
        // Same patient gets the difference
        const amountDiff = newNetAmount - oldNetAmount;
        const discountDiff = newDiscount - oldDiscount;
        patient.payments.amountReceived =
          (patient.payments.amountReceived || 0) + amountDiff;
        patient.payments.discount = (patient.payments.discount || 0) + discountDiff;
      }

      patient.payments.pendingAmount =
        (patient.payments.totalAmount || 0) -
        patient.payments.amountReceived -
        patient.payments.discount;

      await patient.save();
    }

    // Update transaction
    existingTransaction.patient = patientId;
    existingTransaction.procedure = procedure;
    existingTransaction.paymentType = paymentType;
    existingTransaction.amount = amount;
    existingTransaction.discount = discount;
    existingTransaction.method = method;
    existingTransaction.paymentId = paymentId || "";
    existingTransaction.branch = branch;
    existingTransaction.date = date;
    existingTransaction.remarks = remarks || "";

    // Add edit tracking
    if (updatedFields.length > 0) {
      const editorInfo = {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
        updatedFields,
      };

      existingTransaction.editors = existingTransaction.editors || [];
      existingTransaction.editors.push(editorInfo);
      existingTransaction.totalEdits = (existingTransaction.totalEdits || 0) + 1;
      existingTransaction.lastEditedBy = editorInfo;
    }

    await existingTransaction.save();

    return NextResponse.json({
      success: true,
      message: "Transplant transaction updated successfully",
      transaction: existingTransaction,
    });
  } catch (error) {
    console.error("Error updating transplant transaction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}