import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { periodLockResponse } from "@/lib/periodLock";
import { checkCascadeOnDelete } from "@/lib/cascadeIntegrity";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import DeleteLog from "@/models/DeleteLog";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function DELETE(req) {
  let session;
  try {
    // Check authentication
    session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    // Get transaction ID from request body
    const { transactionId } = await req.json();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Find the transaction to delete
    const transaction = await Transactions.findById(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Closed-period guard — a delete inside a frozen period would invalidate its snapshot.
    const locked = await periodLockResponse(transaction);
    if (locked) {
      return NextResponse.json(locked.body, { status: locked.status });
    }

    // §3.2 Direction A — refuse to orphan a Receivable/Payable this transaction created.
    // Direction B (this row merely PAYS a linked document) needs no cascade: paid/pending is
    // aggregated from transactions, so deleting it self-corrects.
    const cascade = await checkCascadeOnDelete(transaction);
    if (cascade.blocked) {
      return NextResponse.json(
        { success: false, error: cascade.reasons.join(" "), cascadeBlocked: true },
        { status: 409 },
      );
    }

    // Verify it's an EXPENSE transaction
    const category = transaction.transactionCategory || transaction.category;
    if (category !== "EXPENSE") {
      return NextResponse.json(
        { success: false, error: "Not an expense transaction" },
        { status: 400 }
      );
    }

    // Store transaction details for response
    const deletedData = {
      transactionId: transaction._id,
      expense: transaction.expense || transaction.expenseCategory,
      expenseGiver: transaction.expenseGiver,
      amount: transaction.amount,
      method: transaction.method,
      date: transaction.date,
      branch: transaction.branch,
    };

    // If this transaction is linked to a vendor, remove the reference
    if (
      transaction.expenseGiver?.type === "VENDOR" &&
      transaction.expenseGiver?.vendorId
    ) {
      const vendorDoc = await Vendor.findById(
        transaction.expenseGiver.vendorId
      );

      if (vendorDoc) {
        // Check if this transaction is the one referenced in the vendor
        if (
          vendorDoc.Transactions &&
          vendorDoc.Transactions.toString() === transactionId
        ) {
          vendorDoc.Transactions = null;

          // Add editor information
          vendorDoc.editors.push({
            name: session.user.name,
            email: session.user.email,
            branch: session.user.branch,
            date: new Date(),
            updatedFields: [
              {
                name: "Transactions",
                previousValue: transactionId,
                newValue: "null",
              },
            ],
          });

          await vendorDoc.save();
        }
      }
    }

    // Also check the legacy vendor field for backward compatibility
    if (transaction.vendor) {
      const vendorDoc = await Vendor.findById(transaction.vendor);

      if (vendorDoc) {
        // Check if this transaction is the one referenced in the vendor
        if (
          vendorDoc.Transactions &&
          vendorDoc.Transactions.toString() === transactionId
        ) {
          vendorDoc.Transactions = null;

          // Add editor information
          vendorDoc.editors.push({
            name: session.user.name,
            email: session.user.email,
            branch: session.user.branch,
            date: new Date(),
            updatedFields: [
              {
                name: "Transactions",
                previousValue: transactionId,
                newValue: "null",
              },
            ],
          });

          await vendorDoc.save();
        }
      }
    }

    // Log the deletion
    await DeleteLog.create({
      entityType: "Transaction",
      entityId: transactionId,
      entityName: transaction.expense || transaction.expenseGiverOld || "Expense",
      entityDetails: {
        category: "EXPENSE",
        expense: transaction.expense,
        amount: transaction.amount,
        method: transaction.method,
        branch: transaction.branch,
        date: transaction.date,
      },
      deletedBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
      },
      branch: transaction.branch,
    });

    // Delete the transaction
    await Transactions.findByIdAndDelete(transactionId);

    return NextResponse.json({
      success: true,
      message: "Expense transaction deleted successfully",
      data: deletedData,
    });
  } catch (error) {
    console.error("Error deleting expense transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete expense transaction",
      },
      { status: 500 }
    );
  }
}