// app/api/transactions/medicine/update/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import Stock from "@/models/Stock";

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
      medicineId,
      quantity,
      perUnitCost,
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
    if (!medicineId || !quantity || !perUnitCost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate patient
    if (!patientId && (!patientName || !patientPhone)) {
      return NextResponse.json(
        { error: "Either select a patient or provide customer details" },
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

    // Verify new medicine exists
    const newMedicine = await Stock.findById(medicineId);
    if (!newMedicine) {
      return NextResponse.json(
        { error: "Medicine not found" },
        { status: 404 }
      );
    }

    // Restore stock for old medicine if changed
    if (
      existingTransaction.medicineId &&
      existingTransaction.medicineId.toString() !== medicineId
    ) {
      await Stock.findByIdAndUpdate(existingTransaction.medicineId, {
        $inc: { totalQuantity: existingTransaction.quantity },
      });
    } else if (existingTransaction.quantity !== quantity) {
      // If same medicine but different quantity, restore old quantity
      await Stock.findByIdAndUpdate(existingTransaction.medicineId, {
        $inc: { totalQuantity: existingTransaction.quantity },
      });
    }

    // Check if new medicine has sufficient stock
    if (newMedicine.totalQuantity < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient stock for ${newMedicine.name}. Available: ${newMedicine.totalQuantity}`,
        },
        { status: 400 }
      );
    }

    // Calculate amounts
    const subtotal = quantity * parseFloat(perUnitCost);
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
    trackChange("medicineId", existingTransaction.medicineId, medicineId);
    trackChange("quantity", existingTransaction.quantity, quantity);
    trackChange("perUnitCost", existingTransaction.perUnitCost, perUnitCost);
    trackChange("discount", existingTransaction.discount, discount);
    trackChange("method", existingTransaction.method, method);
    trackChange("paymentId", existingTransaction.paymentId, paymentId);
    trackChange("branch", existingTransaction.branch, branch);
    trackChange("remarks", existingTransaction.remarks, remarks);

    // Update transaction
    existingTransaction.patient = patientId || null;
    existingTransaction.patientName = patientName || "";
    existingTransaction.patientPhone = patientPhone || "";
    existingTransaction.medicineId = medicineId;
    existingTransaction.quantity = quantity;
    existingTransaction.perUnitCost = parseFloat(perUnitCost);
    existingTransaction.amount = finalAmount;
    existingTransaction.discount = discount || 0;
    existingTransaction.method = method;
    existingTransaction.paymentId = paymentId || "";
    existingTransaction.branch = branch;
    existingTransaction.date = date ? new Date(date) : existingTransaction.date;
    existingTransaction.remarks = remarks || "";
    existingTransaction.stock = medicineId; // For backward compatibility

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

    // Update new medicine stock
    await Stock.findByIdAndUpdate(medicineId, {
      $inc: { totalQuantity: -quantity },
    });

    return NextResponse.json({
      message: "Medicine sale updated successfully",
      transaction: existingTransaction,
    });
  } catch (error) {
    console.error("Error updating medicine transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}