// app/api/transactions/medicine/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import Stock from "@/models/Stock";

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

    // Back-date entry prevention — only admin/super-admin can enter past dates
    if (date) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const inputDate = new Date(date);
      inputDate.setUTCHours(0, 0, 0, 0);
      if (inputDate < todayStart && !["admin", "super-admin"].includes(session.user.role)) {
        return NextResponse.json(
          { error: "Back-dated entries are not allowed for your role" },
          { status: 403 }
        );
      }
    }

    // Check if it's multiple medicines or single medicine
    const medicines = body.medicines || [
      {
        medicineId: body.medicineId,
        quantity: body.quantity,
        perUnitCost: body.perUnitCost,
      },
    ];

    // Validation
    if (!medicines || medicines.length === 0) {
      return NextResponse.json(
        { error: "At least one medicine is required" },
        { status: 400 }
      );
    }

    // Validate patient (either registered or walk-in)
    if (!patientId && (!patientName || !patientPhone)) {
      return NextResponse.json(
        { error: "Either select a patient or provide customer details" },
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

    // Validate all medicines
    for (const item of medicines) {
      if (!item.medicineId || !item.quantity || !item.perUnitCost) {
        return NextResponse.json(
          { error: "Missing required fields in medicine items" },
          { status: 400 }
        );
      }

      const medicine = await Stock.findById(item.medicineId);
      if (!medicine) {
        return NextResponse.json(
          { error: `Medicine not found: ${item.medicineId}` },
          { status: 404 }
        );
      }

      if (medicine.totalQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${medicine.name}. Available: ${medicine.totalQuantity}`,
          },
          { status: 400 }
        );
      }
    }

    // Generate batch ID
    const batchId = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Calculate total amount
    const subtotal = medicines.reduce(
      (sum, item) => sum + item.quantity * parseFloat(item.perUnitCost),
      0
    );
    const totalDiscount = discount || 0;
    const finalTotal = subtotal - totalDiscount;

    // Create transactions
    const transactions = [];

    for (const item of medicines) {
      const itemSubtotal = item.quantity * parseFloat(item.perUnitCost);

      // Calculate proportional discount
      const itemDiscount =
        subtotal > 0 ? (itemSubtotal / subtotal) * totalDiscount : 0;
      const itemFinalAmount = itemSubtotal - itemDiscount;

      const transaction = new Transactions({
        transactionCategory: "MEDICINE",
        costType: "Revenue",
        batchId,
        patient: patientId || null,
        patientName: patientName || "",
        patientPhone: patientPhone || "",
        procedure: "Medicine",
        medicineId: item.medicineId,
        quantity: item.quantity,
        perUnitCost: parseFloat(item.perUnitCost),
        amount: itemFinalAmount,
        discount: itemDiscount,
        method,
        paymentId: paymentId || "",
        branch: branch || session.user.branch,
        date: date ? new Date(date) : new Date(),
        remarks: remarks || "",
        stock: item.medicineId,
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

    // Update stock for all medicines
    for (const item of medicines) {
      await Stock.findByIdAndUpdate(item.medicineId, {
        $inc: { totalQuantity: -item.quantity },
      });
    }

    return NextResponse.json(
      {
        message: `${savedTransactions.length} medicine sale(s) created successfully`,
        transactions: savedTransactions,
        batchId,
        summary: {
          totalItems: medicines.length,
          subtotal,
          discount: totalDiscount,
          finalTotal,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating medicine transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}