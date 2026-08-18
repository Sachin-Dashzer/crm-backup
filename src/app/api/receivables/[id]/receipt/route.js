import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { REVENUE_METHODS } from "@/constants/paymentMethods";
import { getBankRoutingDefaults, UNSETTLED_METHODS, NON_CASH_METHODS } from "@/constants/bankRouting";

// Record a receipt against a receivable.
//
// This is the ONLY manual path by which a receivable's `received` total becomes non-zero. It
// replaces the "Apply to Receivable" picker that used to sit on the revenue forms: same
// resulting document — an ordinary Revenue transaction carrying receivableId — just initiated
// from the receivable side, where the outstanding balance is known and can be validated
// against. See src/models/Receivable.js: received/pending are ALWAYS aggregated from these
// transactions and never stored on the receivable, so creating this row is the whole update.
//
// The receivable's own `log` is deliberately not touched. That array is an audit trail of the
// receivable (created / revised / cancelled), explicitly not a receipt log — the receipts are
// the transactions.

const ALLOWED_ROLES = ["admin", "super-admin"];

const ALLOWED_METHODS = REVENUE_METHODS.map((m) => m.value);

// Receivable.revenueCategory mirrors the revenue taxonomy in prose ("Transplant"/"Services"/
// "Medicine"); Transactions.transactionCategory is the enum. Map when we know, and leave it
// unset when we don't — inventing a category would silently inflate that category's revenue
// reports. An unset category still counts toward account balances, which filter on
// approvalStatus/costType/furtherMode, not on category.
const CATEGORY_BY_REVENUE_CATEGORY = {
  transplant: "TRANSPLANT",
  service: "SERVICE",
  services: "SERVICE",
  medicine: "MEDICINE",
};

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const {
      amount,
      date,
      method,
      paymentId, // the reference / UTR / cheque number
      remarks,
      receipts,
      allowOverpayment,
      // §1.2 — routing now comes FROM the form. The server still derives a default below when
      // the client sends nothing (older callers), but a value sent explicitly always wins:
      // the whole point is that the user can override what the map guessed.
      receiptMode: receiptModeInput,
      furtherMode: furtherModeInput,
      branch: branchInput,
      externalParty,
    } = await req.json();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json({ error: "A receipt amount greater than zero is required" }, { status: 400 });
    }
    // §1.2 — a settlement moving real cash MUST name the account it landed in, or it is
    // invisible to Close Book and the reconciliation this receipt exists for is impossible.
    // Enforced here and not only in the modal: a UI-only rule is bypassed by calling the
    // endpoint directly, which is exactly how the unattributed backlog grew.
    if (
      furtherModeInput !== undefined &&
      !furtherModeInput &&
      !NON_CASH_METHODS.includes(method)
    ) {
      return NextResponse.json(
        { error: "furtherMode is required — name the account this money landed in" },
        { status: 400 },
      );
    }
    if (!method || !ALLOWED_METHODS.includes(method)) {
      return NextResponse.json(
        { error: `method must be one of: ${ALLOWED_METHODS.join(", ")}` },
        { status: 400 },
      );
    }

    const receivable = await Receivable.findById(id);
    if (!receivable) {
      return NextResponse.json({ error: "Receivable not found" }, { status: 404 });
    }
    if (receivable.isCancelled) {
      return NextResponse.json({ error: "This receivable has been cancelled" }, { status: 400 });
    }

    // Received-so-far is computed live from the transactions, under exactly the same rule the
    // list/summary aggregation uses (see lib/receivableAggregation.js) — otherwise this
    // validation could pass against a figure the receivables page never shows.
    const [receivedAgg] = await Transactions.aggregate([
      {
        $match: {
          receivableId: receivable._id,
          costType: "Revenue",
          approvalStatus: "APPROVED",
          method: { $nin: UNSETTLED_METHODS },
        },
      },
      { $group: { _id: null, received: { $sum: "$amount" } } },
    ]);
    const received = receivedAgg?.received || 0;
    const remaining = receivable.totalAmount - received;

    if (parsedAmount > remaining && !allowOverpayment) {
      return NextResponse.json(
        {
          error: `Receipt (₹${parsedAmount}) exceeds the outstanding balance (₹${remaining}) on this receivable. Pass allowOverpayment to record it anyway.`,
        },
        { status: 400 },
      );
    }

    const branch = branchInput || receivable.branch || session.user.branch;
    const transactionCategory =
      CATEGORY_BY_REVENUE_CATEGORY[String(receivable.revenueCategory || "").toLowerCase()] ||
      undefined;

    // Same pre-fill the revenue forms apply, so a receipt lands in the account the branch's
    // routing says it should. Blank when the combination has no configured default — the
    // close-book page surfaces unattributed rows rather than guessing.
    const routing = transactionCategory
      ? getBankRoutingDefaults(branch, transactionCategory, method)
      : { receiptMode: "", furtherMode: "" };

    // A PATIENT-kind receivable carries the patient on relatedPatient, or on payer.refId when
    // it was raised straight against a patient record.
    const patient =
      receivable.relatedPatient ||
      (receivable.payer?.kind === "PATIENT" ? receivable.payer.refId : null);

    const transaction = await Transactions.create({
      transactionCategory,
      costType: "Revenue",
      patient: patient || undefined,
      amount: parsedAmount,
      method,
      paymentId: paymentId || "",
      branch,
      date: date ? new Date(date) : new Date(),
      remarks: remarks || `Receipt against receivable — ${receivable.payer?.label || ""}`.trim(),
      // Explicit client value wins over the derived default; `?? ` not `||` so a deliberate
      // blank is respected rather than silently re-filled from the map.
      receiptMode: receiptModeInput ?? routing.receiptMode ?? "",
      furtherMode: furtherModeInput ?? routing.furtherMode ?? "",
      receipts: receipts || [],
      receivableId: receivable._id,
      // A receipt is a settlement ONLY when the revenue was already recognised elsewhere — the
      // receivable's own recorded fact, not an assumption made here.
      //
      // This used to be an unconditional `true`, which holds for a receivable the
      // paid_to_external flow (or the collab gross-revenue flow) created, but is wrong for one
      // raised by hand — PATIENT_DUE, REFUND_DUE, ADVANCE_RECOVERY, OTHER. Nothing books revenue
      // when those are created, so the receipt is the only revenue transaction that will ever
      // exist for that sale, and flagging it a settlement removed it from every
      // SETTLEMENT_EXCLUSION revenue total with nothing else counting it.
      isSettlement: receivable.costAlreadyRecognised === true,
      externalParty: externalParty && externalParty.name ? externalParty : undefined,
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
      editors: [],
    });

    return NextResponse.json(
      {
        message: "Receipt recorded",
        transaction,
        receivable: {
          _id: receivable._id,
          totalAmount: receivable.totalAmount,
          received: received + parsedAmount,
          pending: Math.max(receivable.totalAmount - (received + parsedAmount), 0),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error recording receipt:", error);
    return NextResponse.json({ error: "Failed to record receipt" }, { status: 500 });
  }
}
