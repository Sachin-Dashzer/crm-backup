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

    // Only admins can update medicine transactions
    // if (session.user.role !== "admin") {
    //   return NextResponse.json(
    //     { error: "Only admins can update medicine transactions" },
    //     { status: 403 }
    //   );
    // }

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

    // Check if it's a MEDICINE transaction
    if (existingTransaction.transactionCategory !== "MEDICINE") {
      return NextResponse.json(
        { error: "This is not a medicine transaction" },
        { status: 400 }
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

    // Get old medicine ID and quantity
    const oldMedicineId = (existingTransaction.medicineId || existingTransaction.stock)?.toString();
    const oldQuantity = existingTransaction.quantity;
    const newMedicineId = medicineId.toString();
    const newQuantity = parseInt(quantity);

    // Verify new medicine exists
    const newMedicine = await Stock.findById(newMedicineId);
    if (!newMedicine) {
      return NextResponse.json(
        { error: "Medicine not found" },
        { status: 404 }
      );
    }

    // Handle stock updates based on what changed
    if (oldMedicineId !== newMedicineId) {
      // Medicine changed - restore old medicine stock and deduct from new medicine
      
      // Restore stock to old medicine
      if (oldMedicineId) {
        await Stock.findByIdAndUpdate(oldMedicineId, {
          $inc: { totalQuantity: oldQuantity },
        });
      }

      // Check if new medicine has sufficient stock
      if (newMedicine.totalQuantity < newQuantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${newMedicine.name}. Available: ${newMedicine.totalQuantity}`,
          },
          { status: 400 }
        );
      }

      // Deduct from new medicine
      await Stock.findByIdAndUpdate(newMedicineId, {
        $inc: { totalQuantity: -newQuantity },
      });
    } else if (oldQuantity !== newQuantity) {
      // Same medicine, different quantity - adjust the difference
      const quantityDifference = newQuantity - oldQuantity;

      // Check if we have sufficient stock for the additional quantity
      if (quantityDifference > 0 && newMedicine.totalQuantity < quantityDifference) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${newMedicine.name}. Available: ${newMedicine.totalQuantity}, Additional needed: ${quantityDifference}`,
          },
          { status: 400 }
        );
      }

      // Update stock by the difference (negative if reducing quantity, positive if increasing)
      await Stock.findByIdAndUpdate(newMedicineId, {
        $inc: { totalQuantity: -quantityDifference },
      });
    }
    // If same medicine and same quantity, no stock update needed

    // Calculate amounts
    const subtotal = newQuantity * parseFloat(perUnitCost);
    const finalAmount = subtotal - (discount || 0);

    // Track changes for audit
    const updatedFields = [];
    const trackChange = (fieldName, oldValue, newValue) => {
      if (String(oldValue) !== String(newValue)) {
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
    trackChange("amount", existingTransaction.amount, finalAmount);
    trackChange("method", existingTransaction.method, method);
    trackChange("paymentId", existingTransaction.paymentId, paymentId);
    trackChange("branch", existingTransaction.branch, branch);
    trackChange("date", existingTransaction.date, date);
    trackChange("remarks", existingTransaction.remarks, remarks);

    // Update transaction
    existingTransaction.patient = patientId || null;
    existingTransaction.patientName = patientName || "";
    existingTransaction.patientPhone = patientPhone || "";
    existingTransaction.medicineId = medicineId;
    existingTransaction.quantity = newQuantity;
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
      message: "Medicine sale updated successfully",
      transaction: existingTransaction,
    });
  } catch (error) {
    console.error("Error updating medicine transaction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}