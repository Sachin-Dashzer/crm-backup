import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { checkPeriodLock } from "@/lib/periodLock";
import { withDbTransaction } from "@/lib/externalPartyDerivation";
import { reverseTransaction, ReversalError } from "@/lib/reverseTransaction";

// Creates a REVERSAL: a negative-amount transaction pointing at the row it reverses.
//
// The five guards, the negative-row write, and the patient rollback live in
// src/lib/reverseTransaction.js — extracted so loan cancellation
// (api/transactions/[id]/cancel-loan) can run the exact same reversal inside its own db
// transaction, atomically alongside reversing a loan's settlement transfer, without a second
// reversal implementation. This route is unchanged in behavior: same checks, same order, same
// responses — only the guard+write body moved.
//
// This is the ONLY writer of negative amounts. The normal entry forms never expose them.

const ALLOWED_ROLES = ["admin", "super-admin"];

export async function POST(request, { params }) {
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
    const body = await request.json();
    const { reason, remarks, date, amount } = body;

    const actor = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
    };

    const result = await withDbTransaction((dbSession) =>
      reverseTransaction({ transactionId: id, amount, reason, remarks, date, actor, dbSession }),
    );

    return NextResponse.json(
      {
        success: true,
        message: result.fullyReversed
          ? "Transaction fully reversed"
          : "Partial reversal recorded — the original remains open for further reversal",
        reversal: result.reversal,
        original: {
          _id: result.original._id,
          amount: result.original.amount,
          isReversed: result.fullyReversed,
        },
        alreadyReversed: result.alreadyReversed,
        remaining: result.remaining,
        patientStatus: result.patientStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ReversalError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error reversing transaction:", error);
    return NextResponse.json({ error: error.message || "Failed to reverse transaction" }, { status: 500 });
  }
}

// Read-only companion to the POST above: what has already been reversed against this row.
// The dialog needs it to show the remaining balance and default its amount correctly — without
// it a partial reversal is invisible until the server rejects the second one.
export async function GET(request, { params }) {
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

    const original = await Transactions.findById(id).lean();
    if (!original) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const reversals = await Transactions.find({ reversalOf: original._id })
      .select("_id amount date reversalReason remarks createdBy")
      .sort({ date: 1 })
      .lean();

    const alreadyReversed = Math.abs(reversals.reduce((s, r) => s + (r.amount || 0), 0));
    const remaining = Math.round(((original.amount || 0) - alreadyReversed) * 100) / 100;

    // Why the action is unavailable, in the same words the POST would use, so the dialog can
    // explain itself rather than presenting a form that is guaranteed to fail.
    let blockedReason = null;
    if (original.reversalOf) blockedReason = "This row is itself a reversal. Reverse the original instead.";
    else if ((original.amount || 0) <= 0) blockedReason = "Only a positive-amount transaction can be reversed.";
    else if (remaining <= 0) blockedReason = "This transaction is already fully reversed.";

    const periodLock = await checkPeriodLock(original);

    return NextResponse.json({
      success: true,
      originalAmount: original.amount || 0,
      alreadyReversed,
      remaining,
      isReversed: original.isReversed === true,
      reversals,
      blockedReason,
      // When the original sits in a closed period the reversal must be dated today — the dialog
      // says so up front rather than letting the user pick a date the POST will refuse.
      originalPeriodLocked: !!periodLock,
      periodLockReason: periodLock || null,
    });
  } catch (error) {
    console.error("Error reading reversal state:", error);
    return NextResponse.json({ error: "Failed to read reversal state" }, { status: 500 });
  }
}
