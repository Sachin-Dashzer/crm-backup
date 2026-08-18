// /api/transactions/expense/create/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Vendor from "@/models/Vendor";
import Payable from "@/models/Payable";
import { getExpenseTypes } from "@/constants/expenseCategories";
import {
  withExternalPartyLink,
  createExternalPayable,
  validateExternalParty,
} from "@/lib/externalPartyDerivation";
import { UNSETTLED_METHODS, NON_CASH_METHODS } from "@/constants/bankRouting";

// Expense categories driven by the Agent/Patient/Rent/Collab tabs never use
// the vendor/manual "Paid To" picker — only the Other Expense tab does.
const NO_GIVER_CATEGORIES = [
  "Salary",
  "Incentive",
  "Commision",
  "Patient Related Expenses",
  "Rent",
  "Electricity Bill",
  "Collab Clinic Payment",
];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const {
      expenseCategory,
      expenseType,
      expenseGiver,
      amount,
      method,
      paymentId,
      branch,
      date,
      remarks,
      patientId,
      commissionReceiver,
      // Links this expense as a payment against an existing Payable. Optional —
      // absent for every "direct" (Type B) expense.
      payableId,
      allowOverpayment,
      receipts,
      furtherMode,
      receiptMode,
      externalParty,
      // GST breakdown for a Direct Payment entered with "Include GST". Display/audit only —
      // GST never becomes a payable. `amount` above is already the invoice total.
      taxDetails,
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
    if (!expenseCategory || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // §1.2 — a settlement (payment against a payable) moving real cash must name the account it
    // left from, or it is invisible to Close Book. Scoped to payableId payments deliberately:
    // direct expenses keep today's behaviour, since tightening those is not in scope here.
    // Enforced server-side because a UI-only rule is bypassed by calling the endpoint directly.
    if (payableId && furtherMode !== undefined && !furtherMode && !NON_CASH_METHODS.includes(method)) {
      return NextResponse.json(
        { error: "furtherMode is required — name the account this payment left from" },
        { status: 400 },
      );
    }

    const needsGiver = !NO_GIVER_CATEGORIES.includes(expenseCategory);
    if (needsGiver && !expenseGiver) {
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

    // Validate expenseGiver structure per type (Other Expense tab only —
    // VENDOR keeps its existing rule; EMPLOYEE/PATIENT need refId + name;
    // MANUAL needs name only).
    if (needsGiver) {
      if (!expenseGiver.type) {
        return NextResponse.json({ error: "Invalid expense giver data" }, { status: 400 });
      }
      if (
        (expenseGiver.type === "EMPLOYEE" || expenseGiver.type === "PATIENT") &&
        (!expenseGiver.refId || !expenseGiver.name)
      ) {
        return NextResponse.json(
          { error: "Employee/patient reference and name are required" },
          { status: 400 }
        );
      }
      if (expenseGiver.type === "MANUAL" && !expenseGiver.name) {
        return NextResponse.json({ error: "Payee name is required" }, { status: 400 });
      }
    }

    let vendorDoc = null;

    // If vendor type, verify vendor exists (unchanged)
    if (expenseGiver?.type === "VENDOR") {
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

    // If this payment is against a Payable, verify it exists, isn't
    // cancelled, and (unless explicitly overridden) doesn't overpay it.
    // Paid-so-far is computed live from Transactions — never cached.
    let payableDoc = null;
    if (payableId) {
      payableDoc = await Payable.findById(payableId);
      if (!payableDoc) {
        return NextResponse.json({ error: "Payable not found" }, { status: 404 });
      }
      if (payableDoc.isCancelled) {
        return NextResponse.json(
          { error: "This payable has been cancelled" },
          { status: 400 }
        );
      }

      const [paidAgg] = await Transactions.aggregate([
        {
          $match: {
            payableId: payableDoc._id,
            approvalStatus: "APPROVED",
            method: { $nin: UNSETTLED_METHODS },
          },
        },
        { $group: { _id: null, paid: { $sum: "$amount" } } },
      ]);
      const currentPaid = paidAgg?.paid || 0;
      const remaining = payableDoc.totalAmount - currentPaid;

      if (parseFloat(amount) > remaining && !allowOverpayment) {
        return NextResponse.json(
          {
            error: `Payment (₹${amount}) exceeds the remaining balance (₹${remaining}) on this payable. Pass allowOverpayment to record it anyway.`,
          },
          { status: 400 }
        );
      }
    }

    // "Paid by Other" — someone else physically paid this cost on our behalf.
    // The expense still books in full here; a Payable tracks what we owe them.
    if (method === "paid_by_other") {
      const partyError = validateExternalParty(externalParty, "PAID_BY");
      if (partyError) {
        return NextResponse.json({ error: partyError }, { status: 400 });
      }
    }

    // WhatsApp approval step is temporarily disabled — expenses are auto-approved on creation.
    const transactionData = {
      transactionCategory: "EXPENSE",
      costType: "Expenses",
      expense: expenseCategory,
      expenseType: expenseType || "",
      expenseGiver: expenseGiver
        ? {
            type: expenseGiver.type,
            vendorId: expenseGiver.type === "VENDOR" ? expenseGiver.vendorId : null,
            refId:
              expenseGiver.type === "EMPLOYEE" || expenseGiver.type === "PATIENT"
                ? expenseGiver.refId
                : null,
            name: expenseGiver.name,
          }
        : undefined,
      patient: patientId || undefined,
      commissionReceiver:
        expenseCategory === "Commision" && commissionReceiver
          ? {
              type: commissionReceiver.type,
              refId: commissionReceiver.type === "MANUAL" ? undefined : commissionReceiver.refId,
              name: commissionReceiver.name,
            }
          : undefined,
      payableId: payableId || null,
      amount: parseFloat(amount),
      method,
      paymentId: paymentId || "",
      branch: branch || session.user.branch,
      date: date ? new Date(date) : new Date(),
      remarks: remarks || "",
      receipts: receipts || [],
      furtherMode: furtherMode || "",
      receiptMode: receiptMode || "",
      // A payment is a settlement ONLY when the cost was already recognised elsewhere — which is
      // the payable's own recorded fact, not something inferable from the presence of payableId.
      //
      // This used to read `!!payableId`, which was wrong for every MANUALLY raised payable (rent,
      // salary, tax, electricity): nothing books an expense when those are created, so their
      // payment is the only expense transaction that will ever exist for that cost. Flagging it a
      // settlement dropped it from every SETTLEMENT_EXCLUSION report — admin/reports and
      // super-admin/reports both compute Total Expenses that way — with nothing else counting it.
      isSettlement: payableDoc ? payableDoc.costAlreadyRecognised === true : false,
      taxDetails: taxDetails || undefined,
      vendor: expenseGiver?.type === "VENDOR" ? expenseGiver.vendorId : null,
      approvalStatus: "APPROVED",
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    };

    const resolvedBranch = branch || session.user.branch;
    let transaction;
    if (method === "paid_by_other") {
      transaction = await withExternalPartyLink(async (dbSession) => {
        const [txn] = await Transactions.create(
          [
            {
              ...transactionData,
              externalParty: {
                direction: "PAID_BY",
                name: externalParty.name,
                method: externalParty.method,
                partyKind: externalParty.partyKind || "MANUAL",
                partyRefId:
                  externalParty.partyKind && externalParty.partyKind !== "MANUAL"
                    ? externalParty.partyRefId
                    : null,
              },
            },
          ],
          { session: dbSession },
        );
        const payable = await createExternalPayable({
          session: dbSession,
          amount: transactionData.amount,
          name: externalParty.name,
          method: externalParty.method,
          partyKind: externalParty.partyKind || "MANUAL",
          partyRefId: externalParty.partyRefId,
          branch: resolvedBranch,
          relatedPatient: patientId || undefined,
          actor: transactionData.createdBy,
        });
        txn.externalParty.linkedPayableId = payable._id;
        await txn.save({ session: dbSession });
        return txn;
      });
    } else {
      transaction = new Transactions(transactionData);
      await transaction.save();
    }

    if (vendorDoc) {
      const previousValue = vendorDoc.Transactions?.toString() || "null";
      vendorDoc.Transactions = transaction._id;
      vendorDoc.editors.push({
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
        updatedFields: [
          { name: "Transactions", previousValue, newValue: transaction._id.toString() },
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
