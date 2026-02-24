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

    const services = body.services || [
      {
        procedure: body.procedure,
        quantity: body.quantity,
        perSessionCost: body.perSessionCost,
      },
    ];

    if (!services || services.length === 0) {
      return NextResponse.json(
        { error: "At least one service is required" },
        { status: 400 }
      );
    }

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

    for (const item of services) {
      if (!item.procedure || !item.quantity || !item.perSessionCost) {
        return NextResponse.json(
          { error: "Missing required fields in service items" },
          { status: 400 }
        );
      }
    }

    const batchId = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const subtotal = services.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.perSessionCost),
      0
    );
    const totalDiscount = discount || 0;
    const finalTotal = subtotal - totalDiscount;

    const transactions = [];

    for (const item of services) {
      const itemSubtotal = item.quantity * parseFloat(item.perSessionCost);
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

    const savedTransactions = await Transactions.insertMany(transactions);

    // ── Patient payment update (only if a registered patient is linked) ──
    let updatedPatient = null;

    if (patientId) {
      const patient = await Patient.findById(patientId);

      if (patient) {
        // Ensure payments object is initialised
        patient.payments = patient.payments || {
          amountReceived: 0,
          pendingAmount: 0,
          medicineAmount: 0,
          discount: 0,
          totalAmount: 0,
          transactions: [],
        };

        // Push all new transaction IDs
        const newIds = savedTransactions.map((t) => t._id);
        patient.payments.transactions.push(...newIds);

        // Add finalTotal (amount actually paid) to amountReceived
        patient.payments.amountReceived += finalTotal;

        // Recalculate total discount from ALL revenue transactions on this patient
        const allTransactions = await Transactions.find({
          _id: { $in: patient.payments.transactions },
          costType: "Revenue",
        });
        patient.payments.discount = allTransactions.reduce(
          (sum, t) => sum + (t.discount || 0),
          0
        );

        // Recalculate pending amount
        const adjustedTotal = Math.max(
          0,
          patient.payments.totalAmount - patient.payments.discount
        );
        patient.payments.pendingAmount = Math.max(
          0,
          adjustedTotal - patient.payments.amountReceived
        );

        // Audit trail
        patient.editors = patient.editors || [];
        patient.editors.push({
          name: session.user.name,
          email: session.user.email,
          branch: session.user.branch,
          date: new Date(),
        });

        await patient.save();

        updatedPatient = {
          _id: patient._id,
          payments: patient.payments,
        };
      }
    }
    // ────────────────────────────────────────────────────────────────────

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
        updatedPatient,
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