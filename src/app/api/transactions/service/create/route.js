// app/api/transactions/service/create/route.js
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

    const body = await req.json();
    const {
      patientId,
      patientName,
      patientPhone,
      discount,
      method,
      paymentId,
      branch,
      date,
      remarks,
    } = body;

    // Check if it's multiple services or single service
    const services = body.services || [
      {
        procedure: body.procedure,
        quantity: body.quantity,
        perSessionCost: body.perSessionCost,
      },
    ];

    // Validation
    if (!services || services.length === 0) {
      return NextResponse.json(
        { error: "At least one service is required" },
        { status: 400 }
      );
    }

    // Validate patient (either registered or walk-in)
    if (!patientId && (!patientName || !patientPhone)) {
      return NextResponse.json(
        { error: "Either select a patient or provide walk-in details" },
        { status: 400 }
      );
    }

    // If patientId provided, verify it exists
    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return NextResponse.json(
          { error: "Patient not found" },
          { status: 404 }
        );
      }
    }

    // Validate all services
    for (const item of services) {
      if (!item.procedure || !item.quantity || !item.perSessionCost) {
        return NextResponse.json(
          { error: "Missing required fields in service items" },
          { status: 400 }
        );
      }
    }

    // Generate batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Calculate total amount
    const subtotal = services.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.perSessionCost),
      0
    );
    const totalDiscount = discount || 0;
    const finalTotal = subtotal - totalDiscount;

    // Create transactions
    const transactions = [];

    for (const item of services) {
      const itemSubtotal = item.quantity * parseFloat(item.perSessionCost);

      // Calculate proportional discount
      const itemDiscount =
        subtotal > 0 ? (itemSubtotal / subtotal) * totalDiscount : 0;
      const itemFinalAmount = itemSubtotal - itemDiscount;

      const transaction = new Transactions({
        transactionCategory: "SERVICE",
        costType: "Revenue",
        batchId,
        patient: patientId || null,
        patientName: patientName || "",
        patientPhone: patientPhone || "",
        procedure: item.procedure,
        quantity: item.quantity,
        perSessionCost: parseFloat(item.perSessionCost),
        amount: itemFinalAmount,
        discount: itemDiscount,
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

      transactions.push(transaction);
    }

    // Save all transactions
    const savedTransactions = await Transactions.insertMany(transactions);

    return NextResponse.json(
      {
        message: `${savedTransactions.length} service transaction(s) created successfully`,
        transactions: savedTransactions,
        batchId,
        summary: {
          totalItems: services.length,
          subtotal,
          discount: totalDiscount,
          finalTotal,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating service transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}