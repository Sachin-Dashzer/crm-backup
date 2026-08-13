import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { periodLockResponse } from "@/lib/periodLock";
import Transaction from "@/models/Transactions";
import Stock from "@/models/Stock";
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

    // Get transaction ID or batch ID from request body
    const { transactionId, batchId } = await req.json();

    if (!transactionId && !batchId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID or Batch ID is required" },
        { status: 400 }
      );
    }

    // Find transactions to delete
    let transactionsToDelete;
    
    if (batchId) {
      // Delete all transactions in the batch
      transactionsToDelete = await Transaction.find({ 
        batchId,
        transactionCategory: "MEDICINE" 
      });
      
      if (!transactionsToDelete || transactionsToDelete.length === 0) {
        return NextResponse.json(
          { success: false, error: "No transactions found for this batch" },
          { status: 404 }
        );
      }
    } else {
      // Delete single transaction
      const transaction = await Transaction.findById(transactionId);
      
      if (!transaction) {
        return NextResponse.json(
          { success: false, error: "Transaction not found" },
          { status: 404 }
        );
      }

      // Verify it's a MEDICINE transaction
      if (transaction.transactionCategory !== "MEDICINE") {
        return NextResponse.json(
          { success: false, error: "Not a medicine transaction" },
          { status: 400 }
        );
      }

      transactionsToDelete = [transaction];
    }

    // Closed-period guard. A batch delete spans several rows, so EVERY row is checked — if
    // any one of them sits in a frozen period the whole batch is refused, rather than
    // deleting the open rows and leaving the batch half-gone.
    for (const txn of transactionsToDelete) {
      const locked = await periodLockResponse(txn);
      if (locked) {
        return NextResponse.json(locked.body, { status: locked.status });
      }
    }

    // Restore stock for all transactions
    const restoredItems = [];
    
    for (const transaction of transactionsToDelete) {
      const medicineId = transaction.medicineId || transaction.stock;
      const quantityToRestore = parseInt(transaction.quantity) || 0;

      if (!medicineId) {
        console.warn(`Transaction ${transaction._id} has no associated medicine`);
        continue;
      }

      // Find the medicine/stock
      const medicine = await Stock.findById(medicineId);
      
      if (!medicine) {
        console.warn(`Medicine ${medicineId} not found for transaction ${transaction._id}`);
        continue;
      }

      // Store original stock for response
      const originalStock = medicine.totalQuantity || 0;

      // Restore the stock (add back the quantity that was sold)
      await Stock.findByIdAndUpdate(
        medicineId,
        { $inc: { totalQuantity: quantityToRestore } },
        { new: true }
      );

      restoredItems.push({
        transactionId: transaction._id,
        medicineName: medicine.name,
        medicineId: medicine._id,
        quantityRestored: quantityToRestore,
        originalStock,
        newStock: originalStock + quantityToRestore,
        amount: transaction.amount,
      });
    }

    // Log the deletions
    for (const tx of transactionsToDelete) {
      await DeleteLog.create({
        entityType: "Transaction",
        entityId: tx._id.toString(),
        entityName: tx.patientName || "Medicine Sale",
        entityDetails: {
          category: "MEDICINE",
          quantity: tx.quantity,
          amount: tx.amount,
          method: tx.method,
          branch: tx.branch,
          date: tx.date,
          batchId: tx.batchId,
        },
        deletedBy: {
          name: session.user.name,
          email: session.user.email,
          branch: session.user.branch,
        },
        branch: tx.branch,
      });
    }

    // Delete the transaction(s)
    if (batchId) {
      await Transaction.deleteMany({
        batchId,
        transactionCategory: "MEDICINE"
      });
    } else {
      await Transaction.findByIdAndDelete(transactionId);
    }

    return NextResponse.json({
      success: true,
      message: batchId 
        ? `Batch deleted and stock restored for ${restoredItems.length} item(s)`
        : "Medicine transaction deleted and stock restored successfully",
      data: {
        deletedCount: transactionsToDelete.length,
        restoredItems,
        batchId: batchId || transactionsToDelete[0]?.batchId,
      },
    });
  } catch (error) {
    console.error("Error deleting medicine transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to delete medicine transaction",
      },
      { status: 500 }
    );
  }
}