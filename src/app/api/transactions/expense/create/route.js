// /api/transactions/expense/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import { sendExpenseApprovalRequest } from "@/lib/whatsapp";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const {
      expenseCategory,
      expenseGiver,
      amount,
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
          { error: "Back-dated entries are not allowed for your role" },
          { status: 403 }
        );
      }
    }

    // Validation
    if (!expenseCategory || !amount || !expenseGiver) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate expenseGiver structure
    if (!expenseGiver.type || !expenseGiver.name) {
      return NextResponse.json(
        { error: "Invalid expense giver data" },
        { status: 400 }
      );
    }

    let vendorDoc = null;

    // If vendor type, verify vendor exists
    if (expenseGiver.type === "VENDOR") {
      if (!expenseGiver.vendorId) {
        return NextResponse.json(
          { error: "Vendor ID required for vendor expenses" },
          { status: 400 }
        );
      }

      vendorDoc = await Vendor.findById(expenseGiver.vendorId);
      if (!vendorDoc) {
        return NextResponse.json(
          { error: "Vendor not found" },
          { status: 404 }
        );
      }
    }

    // Create transaction — held as PENDING until a WhatsApp admin approves it.
    // Vendor linking is deferred to approval time (see whatsapp webhook), so a
    // rejected expense never touches the vendor's transaction reference.
    const transaction = new Transactions({
      transactionCategory: "EXPENSE",
      costType: "Expenses",
      expense: expenseCategory,
      expenseGiver: {
        type: expenseGiver.type,
        vendorId: expenseGiver.vendorId || null,
        name: expenseGiver.name,
      },
      amount: parseFloat(amount),
      method,
      paymentId: paymentId || "",
      branch: branch || session.user.branch,
      date: date ? new Date(date) : new Date(),
      remarks: remarks || "",
      vendor: expenseGiver.type === "VENDOR" ? expenseGiver.vendorId : null,
      approvalStatus: "PENDING",
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });

    await transaction.save();

    // Fail-safe: WhatsApp outages must not crash transaction creation — the
    // transaction already exists as PENDING regardless of whether this succeeds.
    try {
      const sent = await sendExpenseApprovalRequest(transaction);
      if (sent.length > 0) {
        transaction.whatsappApprovalMessages = sent;
        await transaction.save();
      }
    } catch (waError) {
      console.error("Failed to send WhatsApp expense approval request:", waError);
    }

    return NextResponse.json(
      {
        message: "Expense transaction submitted for admin approval via WhatsApp",
        transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating expense transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}