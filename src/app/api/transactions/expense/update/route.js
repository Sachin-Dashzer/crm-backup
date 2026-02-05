import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import Transaction from "@/models/Transactions";
import connectDB from "@/lib/db";

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can update expenses
    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update expense transactions" },
        { status: 403 }
      );
    }

    await connectDB();

    const body = await req.json();
    const {
      transactionId,
      expenseCategory,
      expenseGiver,
      amount,
      method,
      paymentId,
      branch,
      date,
      remarks,
    } = body;

    // Validation
    if (!transactionId || !expenseCategory || !expenseGiver || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate expenseGiver structure
    if (!expenseGiver.type || !expenseGiver.name) {
      return NextResponse.json(
        { error: "Invalid expense giver information" },
        { status: 400 }
      );
    }

    if (expenseGiver.type === "VENDOR" && !expenseGiver.vendorId) {
      return NextResponse.json(
        { error: "Vendor ID is required for vendor expenses" },
        { status: 400 }
      );
    }

    // Find existing transaction
    const existingTransaction = await Transaction.findById(transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Check if it's an expense transaction
    if (existingTransaction.transactionCategory !== "EXPENSE") {
      return NextResponse.json(
        { error: "This is not an expense transaction" },
        { status: 400 }
      );
    }

    // Track changes for audit
    const updatedFields = [];
    const trackField = (fieldName, oldVal, newVal) => {
      if (String(oldVal) !== String(newVal)) {
        updatedFields.push({
          name: fieldName,
          previousValue: String(oldVal || ""),
          newValue: String(newVal || ""),
        });
      }
    };

    trackField("expenseCategory", existingTransaction.expense, expenseCategory);
    trackField("expenseGiverType", existingTransaction.expenseGiver?.type, expenseGiver.type);
    trackField("expenseGiverName", existingTransaction.expenseGiver?.name, expenseGiver.name);
    if (expenseGiver.type === "VENDOR") {
      trackField("vendorId", existingTransaction.expenseGiver?.vendorId, expenseGiver.vendorId);
    }
    trackField("amount", existingTransaction.amount, amount);
    trackField("method", existingTransaction.method, method);
    trackField("paymentId", existingTransaction.paymentId, paymentId);
    trackField("branch", existingTransaction.branch, branch);
    trackField("date", existingTransaction.date, date);
    trackField("remarks", existingTransaction.remarks, remarks);

    // Update transaction
    existingTransaction.expense = expenseCategory;
    existingTransaction.expenseGiver = {
      type: expenseGiver.type,
      vendorId: expenseGiver.type === "VENDOR" ? expenseGiver.vendorId : null,
      name: expenseGiver.name,
    };
    existingTransaction.amount = amount;
    existingTransaction.method = method;
    existingTransaction.paymentId = paymentId || "";
    existingTransaction.branch = branch;
    existingTransaction.date = date;
    existingTransaction.remarks = remarks || "";

    // Add edit tracking
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
      message: "Expense transaction updated successfully",
      transaction: existingTransaction,
    });
  } catch (error) {
    console.error("Error updating expense transaction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}