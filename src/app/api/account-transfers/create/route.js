import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import AccountTransfer from "@/models/AccountTransfer";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { getAccountBalance } from "@/lib/accountBalances";

// Contra entries move money between company-level accounts, so they are admin-only. The gate
// lives here, not only in the UI — a UI-only restriction is bypassed by calling the endpoint.
const ALLOWED_ROLES = ["admin", "super-admin"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { fromAccount, toAccount, amount, date, reference, remarks, receipts, branch } =
      await req.json();

    // Reject rather than silently correct — each of these is a data-entry mistake the user
    // needs to see, not something to normalise away.
    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: "Both accounts are required" }, { status: 400 });
    }
    if (!ACCOUNTS.includes(fromAccount) || !ACCOUNTS.includes(toAccount)) {
      return NextResponse.json({ error: "Invalid account" }, { status: 400 });
    }
    if (fromAccount === toAccount) {
      return NextResponse.json(
        { error: "A contra entry must move money between two different accounts." },
        { status: 400 },
      );
    }
    const parsedAmount = parseFloat(amount);
    if (!(parsedAmount > 0)) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }
    // Optional. Note this is a BRANCH, not an account — "Cash ( backend )" is an account and is
    // rejected here even though a transfer can move money into it. Left null, the transfer is
    // company-level and shows only in unfiltered views.
    if (branch && !ALL_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: `branch must be one of: ${ALL_BRANCHES.join(", ")}` },
        { status: 400 },
      );
    }

    const transfer = new AccountTransfer({
      fromAccount,
      toAccount,
      amount: parsedAmount,
      branch: branch || null,
      date: date ? new Date(date) : new Date(),
      reference: reference || "",
      remarks: remarks || "",
      receipts: Array.isArray(receipts) ? receipts : [],
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });
    transfer.log.push({
      action: "Created",
      newValue: String(parsedAmount),
      note: `${fromAccount} → ${toAccount}`,
      performedBy: { name: session.user.name, email: session.user.email },
      performedAt: new Date(),
    });

    await transfer.save();

    // Warn, never block. The user may legitimately be entering transactions out of order, and
    // refusing the write would force them to fabricate a date to get the real one in. Computed
    // AFTER the save so the figure reflects the balance they actually left behind.
    let warning = null;
    try {
      const balance = await getAccountBalance(fromAccount, transfer.date);
      if (balance < 0) {
        warning = `${fromAccount} is now negative (${balance.toFixed(2)}) as of this date. The entry was saved — check whether an earlier deposit is still missing.`;
      }
    } catch (balanceError) {
      // A balance-check failure must not fail the write that already succeeded.
      console.error("Contra entry saved but balance check failed:", balanceError);
    }

    return NextResponse.json({ message: "Contra entry created", transfer, warning }, { status: 201 });
  } catch (error) {
    // Surface the model's own validation messages rather than a generic 500.
    if (error?.name === "ValidationError" || error?.message?.includes("contra entry")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error creating contra entry:", error);
    return NextResponse.json({ error: "Failed to create contra entry" }, { status: 500 });
  }
}
