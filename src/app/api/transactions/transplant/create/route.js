// /api/transactions/transplant/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Validation
    if (!patientId || !procedure || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    // Calculate final amount
    const finalAmount = parseFloat(amount) - (discount || 0);

    // Create transaction
    const transaction = new Transactions({
      transactionCategory: "TRANSPLANT",
      costType: "Revenue",
      patient: patientId,
      procedure,
      paymentType,
      amount: parseFloat(amount),
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
    });

    await transaction.save();

    // Update patient payment records
    if (patient.payments) {
      patient.payments.amountReceived =
        (patient.payments.amountReceived || 0) + finalAmount;
      patient.payments.pendingAmount =
        (patient.payments.totalAmount || 0) -
        (patient.payments.amountReceived || 0);
      await patient.save();
    }

    return NextResponse.json(
      {
        message: "Transplant transaction created successfully",
        transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating transplant transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}