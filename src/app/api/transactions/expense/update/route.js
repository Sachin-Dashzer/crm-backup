import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import Transaction from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import connectDB from "@/lib/db";
import { periodLockResponse } from "@/lib/periodLock";
import { checkCascadeOnUpdate, applyCascadeOnUpdate } from "@/lib/cascadeIntegrity";
import { withDbTransaction, syncExternalPartyOnUpdate } from "@/lib/externalPartyDerivation";
import { getExpenseTypes } from "@/constants/expenseCategories";

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const {
      transactionId,
      expenseCategory,
      expenseType,
      expenseGiver,
      amount,
      method,
      paymentId,
      branch,
      date,
      remarks,
      receipts,
      furtherMode,
    } = body;

    // Validation
    if (!transactionId || !expenseCategory || !expenseGiver || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (getExpenseTypes(expenseCategory).length > 0 && !expenseType) {
      return NextResponse.json(
        { error: "Expense type is required for this category" },
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

    // Closed-period guard — checks both the current position and where the edit moves it.
    const locked = await periodLockResponse(existingTransaction, { date, furtherMode });
    if (locked) {
      return NextResponse.json(locked.body, { status: locked.status });
    }

    // Check if it's an expense transaction
    if (existingTransaction.transactionCategory !== "EXPENSE") {
      return NextResponse.json(
        { error: "This is not an expense transaction" },
        { status: 400 }
      );
    }

    // §2.2 — an amount change on a transaction that CREATED a Payable/Receivable is ambiguous:
    // a typo correction, or a genuinely changed obligation. Warn and refuse to guess unless the
    // caller says which, via updateLinked. Payments AGAINST a document need no cascade — their
    // paid/pending is aggregated and self-corrects (lib/payableAggregation.js).
    const linkedWarning = await checkCascadeOnUpdate(existingTransaction, { amount });
    if (linkedWarning && !body.updateLinked) {
      return NextResponse.json(linkedWarning, { status: 409 });
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
    trackField("expenseType", existingTransaction.expenseType, expenseType);
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
    trackField("furtherMode", existingTransaction.furtherMode, furtherMode);

    // Handle vendor reference changes
    const oldVendorId = existingTransaction.expenseGiver?.vendorId || existingTransaction.vendor;
    const newVendorId = expenseGiver.type === "VENDOR" ? expenseGiver.vendorId : null;
    const vendorChanged = String(oldVendorId) !== String(newVendorId);

    // If vendor changed, update both old and new vendor documents
    if (vendorChanged) {
      // Remove transaction reference from old vendor
      if (oldVendorId) {
        const oldVendor = await Vendor.findById(oldVendorId);
        if (oldVendor && oldVendor.Transactions?.toString() === transactionId) {
          oldVendor.Transactions = null;
          
          oldVendor.editors.push({
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

          await oldVendor.save();
        }
      }

      // Add transaction reference to new vendor
      if (newVendorId) {
        const newVendor = await Vendor.findById(newVendorId);
        if (!newVendor) {
          return NextResponse.json(
            { error: "New vendor not found" },
            { status: 404 }
          );
        }

        const previousTransactionId = newVendor.Transactions?.toString() || "null";
        newVendor.Transactions = transactionId;

        newVendor.editors.push({
          name: session.user.name,
          email: session.user.email,
          branch: session.user.branch,
          date: new Date(),
          updatedFields: [
            {
              name: "Transactions",
              previousValue: previousTransactionId,
              newValue: transactionId,
            },
          ],
        });

        await newVendor.save();
      }
    }

    // If this transaction is a PAYMENT against a payable (payableId set — Direction B, no
    // cascade needed per the comment above) and the edit moves it to a different expense
    // category, sub-type, or branch than it was recorded under, the OLD payable would keep
    // counting this payment forever (paid/pending is aggregated live off payableId, which this
    // update otherwise never touches), while the payable the transaction is NOW labelled for
    // never sees it at all — exactly the "editing a transaction doesn't update the payable"
    // symptom. There's no safe way to guess which of possibly several open payables under the
    // new category/period it should link to instead (a Transaction carries no period), so the
    // stale link is cleared rather than silently left wrong — re-link via "Pay against payable"
    // if this payment is still meant to settle a specific payable.
    let payableUnlinkedNote = null;
    if (
      existingTransaction.payableId &&
      (existingTransaction.expense !== expenseCategory ||
        (existingTransaction.expenseType || "") !== (expenseType || "") ||
        existingTransaction.branch !== branch)
    ) {
      payableUnlinkedNote =
        "This payment was unlinked from its previous payable — the category, sub-type, or branch changed, so it no longer counts against that payable's pending balance. Use \"Pay against payable\" to re-link it to the correct one if this is still meant to settle a specific payable.";
      existingTransaction.payableId = null;
    }

    // Update transaction
    existingTransaction.expense = expenseCategory;
    existingTransaction.expenseType = expenseType || "";
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
    existingTransaction.furtherMode = furtherMode || "";
    existingTransaction.vendor = expenseGiver.type === "VENDOR" ? expenseGiver.vendorId : null; // For backward compatibility
    if (receipts !== undefined) existingTransaction.receipts = receipts || [];

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

    // Editing into / out of / within "Paid by Other" has to move the linked Payable with it, or
    // the cost leaves the books entirely — see syncExternalPartyOnUpdate.
    try {
      await withDbTransaction(async (dbSession) => {
        const patch = await syncExternalPartyOnUpdate({
          session: dbSession,
          transaction: existingTransaction,
          nextMethod: existingTransaction.method,
          nextAmount: existingTransaction.amount,
          nextExternalParty: body.externalParty,
          branch: existingTransaction.branch,
          transactionCategory: "EXPENSE",
          relatedPatient: existingTransaction.patient,
          actor: { name: session.user.name, email: session.user.email, branch: session.user.branch },
        });
        if (patch) existingTransaction.set(patch);
        await existingTransaction.save({ session: dbSession });
        // Inside the same session as the transaction write, so the linked total can never move
        // while the amount that justified it fails to commit (replica set confirmed live).
        if (linkedWarning && body.updateLinked) {
          await applyCascadeOnUpdate(existingTransaction, { amount }, dbSession, {
            name: session.user.name,
            email: session.user.email,
          });
        }
      });
    } catch (syncError) {
      // A deliberate refusal (money already settled against the linked payable), not a fault.
      return NextResponse.json({ error: syncError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "Expense transaction updated successfully",
      transaction: existingTransaction,
      ...(payableUnlinkedNote ? { warning: payableUnlinkedNote } : {}),
    });
  } catch (error) {
    console.error("Error updating expense transaction:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update transaction" },
      { status: 500 }
    );
  }
}