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

    // Basic validations
    if (!data.costType || !data.method || !data.amount) {
      return NextResponse.json(
        { success: false, message: "Cost type, method, and amount are required" },
        { status: 400 }
      );
    }

    if (data.amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Revenue transactions require patient
    if (data.costType === "Revenue" && !data.patient) {
      return NextResponse.json(
        { success: false, message: "Patient is required for revenue transactions" },
        { status: 400 }
      );
    }

    // Validate patient if provided
    if (data.patient) {
      if (!mongoose.Types.ObjectId.isValid(data.patient)) {
        return NextResponse.json(
          { success: false, message: "Invalid patient ID" },
          { status: 400 }
        );
      }

      const patientExists = await Patient.findById(data.patient);
      if (!patientExists) {
        return NextResponse.json(
          { success: false, message: "Patient not found" },
          { status: 404 }
        );
      }
    }

    // Create transaction
    const newTransaction = await Transactions.create({
      ...data,
      amount: Math.floor(Number(data.amount)),
      paymentId: data.paymentId || "",
      discount: data.discount || 0,
      date: data.date || new Date(),
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
      editors: [],
    });

    let updatedPatient = null;

    // Update patient payments for Revenue transactions
    if (data.patient && data.costType === "Revenue") {
      const patient = await Patient.findById(data.patient);

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

        // Update amounts based on procedure type
        const isMedicine = data.procedure?.toLowerCase() === "medicine";
        if (isMedicine) {
          patient.payments.medicineAmount += parseFloat(data.amount);
        } else {
          patient.payments.amountReceived += parseFloat(data.amount);
        }

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

        updatedPatient = await patient.save();
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaction created successfully",
        data: newTransaction,
        updatedPatient: updatedPatient
          ? {
              _id: updatedPatient._id,
              payments: updatedPatient.payments,
            }
          : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Transaction creation error:", error);

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

export const POST = withDB(handler);