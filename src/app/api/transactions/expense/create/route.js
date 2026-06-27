// /api/transactions/expense/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";

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

    // Create transaction
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
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });

    await transaction.save();

    // Update vendor with transaction reference if it's a vendor expense
    if (expenseGiver.type === "VENDOR" && vendorDoc) {
      vendorDoc.Transactions = transaction._id;
      
      // Add editor information
      vendorDoc.editors.push({
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
        updatedFields: [
          {
            name: "Transactions",
            previousValue: vendorDoc.Transactions?.toString() || "null",
            newValue: transaction._id.toString(),
          },
        ],
      });

      await vendorDoc.save();
    }

    return NextResponse.json(
      {
        message: "Expense transaction created successfully",
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