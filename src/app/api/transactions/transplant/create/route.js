// /api/transactions/transplant/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

export async function POST(req) {
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

    const {
      patientId,
      procedure,
      paymentType,
      amount,
      discount,
      method,
      paymentId,
      branch,
      date,
      remarks,
    } = await req.json();

    // Back-date entry prevention — only admin/super-admin can enter past dates
    if (date) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const inputDate = new Date(date);
      inputDate.setUTCHours(0, 0, 0, 0);
      if (inputDate < todayStart && !["admin", "super-admin"].includes(session.user.role)) {
        return NextResponse.json(
          { success: false, message: "Back-dated entries are not allowed for your role" },
          { status: 403 }
        );
      }
    }

    // Basic validations
    if (!patientId || !procedure || !amount || !method) {
      return NextResponse.json(
        { success: false, message: "Patient, procedure, amount, and payment method are required" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Validate procedure is a transplant procedure
    const validTransplantProcedures = ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"];
    if (!validTransplantProcedures.includes(procedure)) {
      return NextResponse.json(
        { success: false, message: "Invalid procedure for transplant transaction. Must be one of: Sapphire FUE, DHI, Turkish DHI, or Beard Transplant" },
        { status: 400 }
      );
    }

    // Validate patient ID format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return NextResponse.json(
        { success: false, message: "Invalid patient ID" },
        { status: 400 }
      );
    }

    // Check if patient exists
    const patientExists = await Patient.findById(patientId);
    if (!patientExists) {
      return NextResponse.json(
        { success: false, message: "Patient not found" },
        { status: 404 }
      );
    }

    // Create transaction
    const newTransaction = await Transactions.create({
      transactionCategory: "TRANSPLANT",
      costType: "Revenue",
      patient: patientId,
      procedure,
      paymentType,
      amount: Math.floor(Number(amount)),
      discount: discount || 0,
      method,
      paymentId: paymentId || "",
      branch: branch || session.user.branch,
      date: date ? new Date(date) : new Date(),
      remarks: remarks || "",
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
      editors: [],
    });

    // Update patient payments (TRANSPLANT-specific logic)
    const patient = await Patient.findById(patientId);
    
    if (patient) {
      // Initialize payments if needed
      patient.payments = patient.payments || {
        amountReceived: 0,
        pendingAmount: 0,
        medicineAmount: 0,
        discount: 0,
        totalAmount: 0,
        transactions: [],
      };

      // Add transaction reference
      patient.payments.transactions.push(newTransaction._id);

      // For TRANSPLANT: always add to amountReceived
      patient.payments.amountReceived += parseFloat(amount);

      // Recalculate discount from all transactions
      const allTransactions = await Transactions.find({
        _id: { $in: patient.payments.transactions },
        costType: "Revenue",
      });
      patient.payments.discount = allTransactions.reduce(
        (sum, t) => sum + (t.discount || 0),
        0
      );

      // Calculate pending amount
      const adjustedTotal = Math.max(
        0,
        patient.payments.totalAmount - patient.payments.discount
      );
      patient.payments.pendingAmount = Math.max(
        0,
        adjustedTotal - patient.payments.amountReceived
      );

      // Add editor entry
      patient.editors = patient.editors || [];
      patient.editors.push({
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      });

      await patient.save();
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transplant transaction created successfully",
        data: newTransaction,
        updatedPatient: patient
          ? {
              _id: patient._id,
              payments: patient.payments,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transplant transaction creation error:", error);

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