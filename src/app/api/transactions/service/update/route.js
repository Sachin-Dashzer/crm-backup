// app/api/transactions/service/update/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const {
      transactionId,
      patientId,
      patientName,
      patientPhone,
      procedure,
      quantity,
      perSessionCost,
      discount,
      method,
      paymentId,
      branch,
      date,
      remarks,
    } = await req.json();

    // Find existing transaction
    const existingTransaction = await Transactions.findById(transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Validation
    if (!procedure || !quantity || !perSessionCost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate patient
    if (!patientId && (!patientName || !patientPhone)) {
      return NextResponse.json(
        { error: "Either select a patient or provide walk-in details" },
        { status: 400 }
      );
    }

    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return NextResponse.json(
          { error: "Patient not found" },
          { status: 404 }
        );
      }
    }

    // Calculate amounts
    const subtotal = quantity * parseFloat(perSessionCost);
    const finalAmount = subtotal - (discount || 0);

    // Track changes for audit
    const updatedFields = [];
    const trackChange = (fieldName, oldValue, newValue) => {
      if (oldValue !== newValue) {
        updatedFields.push({
          name: fieldName,
          previousValue: String(oldValue || ""),
          newValue: String(newValue || ""),
        });
      }
    };

    trackChange("patient", existingTransaction.patient, patientId);
    trackChange("patientName", existingTransaction.patientName, patientName);
    trackChange("patientPhone", existingTransaction.patientPhone, patientPhone);
    trackChange("procedure", existingTransaction.procedure, procedure);
    trackChange("quantity", existingTransaction.quantity, quantity);
    trackChange(
      "perSessionCost",
      existingTransaction.perSessionCost,
      perSessionCost
    );
    trackChange("discount", existingTransaction.discount, discount);
    trackChange("method", existingTransaction.method, method);
    trackChange("paymentId", existingTransaction.paymentId, paymentId);
    trackChange("branch", existingTransaction.branch, branch);
    trackChange("remarks", existingTransaction.remarks, remarks);

    // Update transaction
    existingTransaction.patient = patientId || null;
    existingTransaction.patientName = patientName || "";
    existingTransaction.patientPhone = patientPhone || "";
    existingTransaction.procedure = procedure;
    existingTransaction.quantity = quantity;
    existingTransaction.perSessionCost = parseFloat(perSessionCost);
    existingTransaction.amount = finalAmount;
    existingTransaction.discount = discount || 0;
    existingTransaction.method = method;
    existingTransaction.paymentId = paymentId || "";
    existingTransaction.branch = branch;
    existingTransaction.date = date ? new Date(date) : existingTransaction.date;
    existingTransaction.remarks = remarks || "";

    // Add editor info
    if (updatedFields.length > 0) {
      existingTransaction.editors.push({
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
        updatedFields,
      });
    }

    await existingTransaction.save();

    return NextResponse.json({
      message: "Service transaction updated successfully",
      transaction: existingTransaction,
    });
  } catch (error) {
    console.error("Error updating service transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}