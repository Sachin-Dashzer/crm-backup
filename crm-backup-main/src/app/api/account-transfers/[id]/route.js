import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import mongoose from "mongoose";
import AccountTransfer from "@/models/AccountTransfer";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { getAccountBalance } from "@/lib/accountBalances";

// Edit, cancel or delete one contra entry.
//
// Every write here MOVES MONEY between account balances in the close book — a contra entry is
// subtracted from fromAccount and added to toAccount, so changing its amount or either side
// shifts both. That is why the responses report the resulting balances: the caller can surface
// what the edit actually did rather than the user discovering it later in the balance sheet.
//
// Cancelling is preferred over deleting: it stops the entry counting toward balances while
// keeping the record that the money was once moved. Delete is provided for entries created in
// genuine error, where there is no history worth keeping.
const ALLOWED_ROLES = ["admin", "super-admin"];

// Shared shape checks. Returns an error string, or null when the payload is usable.
function validate({ fromAccount, toAccount, amount, branch }) {
  if (fromAccount !== undefined && !ACCOUNTS.includes(fromAccount)) {
    return `fromAccount must be one of: ${ACCOUNTS.join(", ")}`;
  }
  if (toAccount !== undefined && !ACCOUNTS.includes(toAccount)) {
    return `toAccount must be one of: ${ACCOUNTS.join(", ")}`;
  }
  if (fromAccount && toAccount && fromAccount === toAccount) {
    return "A contra entry must move money between two different accounts.";
  }
  if (amount !== undefined && !(parseFloat(amount) > 0)) {
    return "Amount must be greater than zero";
  }
  // A BRANCH, not an account — the two lists share naming conventions but mean different things.
  if (branch !== undefined && branch && !ALL_BRANCHES.includes(branch)) {
    return `branch must be one of: ${ALL_BRANCHES.join(", ")}`;
  }
  return null;
}

async function loadOr404(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return { error: "Invalid contra entry id", status: 400 };
  const transfer = await AccountTransfer.findById(id);
  if (!transfer) return { error: "Contra entry not found", status: 404 };
  return { transfer };
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const transfer = found.transfer;

    const body = await req.json();
    const { fromAccount, toAccount, amount, date, branch, reference, remarks, receipts } = body;

    // Validated against the MERGED result, not the payload alone: sending only toAccount could
    // otherwise make it equal the existing fromAccount and slip past a payload-only check.
    const err = validate({
      fromAccount: fromAccount ?? transfer.fromAccount,
      toAccount: toAccount ?? transfer.toAccount,
      amount: amount ?? transfer.amount,
      branch,
    });
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const performedBy = { name: session.user.name, email: session.user.email };
    const changes = [];
    const track = (field, next, label) => {
      if (next === undefined) return;
      const prev = transfer[field];
      const same =
        field === "date"
          ? new Date(prev).getTime() === new Date(next).getTime()
          : (prev ?? "") === (next ?? "");
      if (same) return;
      changes.push(`${label}: ${prev ?? "(blank)"} → ${next ?? "(blank)"}`);
      transfer[field] = next;
    };

    const parsedAmount = amount === undefined ? transfer.amount : parseFloat(amount);
    if (parsedAmount !== transfer.amount) {
      transfer.log.push({
        action: "Amount Revised",
        previousValue: String(transfer.amount),
        newValue: String(parsedAmount),
        performedBy,
        performedAt: new Date(),
      });
      transfer.amount = parsedAmount;
    }
    track("fromAccount", fromAccount, "From");
    track("toAccount", toAccount, "To");
    track("date", date ? new Date(date) : undefined, "Date");
    track("branch", branch === "" ? null : branch, "Branch");
    track("reference", reference, "Reference");
    track("remarks", remarks, "Remarks");
    if (receipts !== undefined && Array.isArray(receipts)) transfer.receipts = receipts;

    if (changes.length) {
      transfer.log.push({
        action: "Note Added",
        note: `Edited — ${changes.join("; ")}`,
        performedBy,
        performedAt: new Date(),
      });
    }

    await transfer.save();

    // Warn, never block — the same rule the create route uses. Entering transactions out of
    // order is legitimate, and refusing the write would force a fabricated date to get the real
    // one in. Computed AFTER the save so it reflects the balance actually left behind.
    let warning = null;
    try {
      const balance = await getAccountBalance(transfer.fromAccount, transfer.date);
      if (balance < 0) {
        warning = `${transfer.fromAccount} is now negative (${balance.toFixed(2)}) as of this date. The edit was saved — check whether an earlier deposit is still missing.`;
      }
    } catch (balanceError) {
      console.error("Contra entry saved but balance check failed:", balanceError);
    }

    return NextResponse.json({ message: "Contra entry updated", transfer, warning });
  } catch (error) {
    if (error?.name === "ValidationError" || error?.message?.includes("contra entry")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error editing contra entry:", error);
    return NextResponse.json({ error: "Failed to edit contra entry" }, { status: 500 });
  }
}

// Lifecycle actions: cancel (stop counting, keep the record), reinstate, or annotate.
export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const transfer = found.transfer;

    const { action, note } = await req.json();
    const performedBy = { name: session.user.name, email: session.user.email };

    if (action === "cancel") {
      if (transfer.isCancelled) {
        return NextResponse.json({ error: "This entry is already cancelled" }, { status: 400 });
      }
      transfer.isCancelled = true;
      transfer.log.push({
        action: "Cancelled",
        previousValue: "false",
        newValue: "true",
        note: note || "Cancelled",
        performedBy,
        performedAt: new Date(),
      });
      await transfer.save();
      return NextResponse.json({ message: "Contra entry cancelled — no longer moves balances", transfer });
    }

    if (action === "reinstate") {
      if (!transfer.isCancelled) {
        return NextResponse.json({ error: "This entry is not cancelled" }, { status: 400 });
      }
      transfer.isCancelled = false;
      transfer.log.push({
        action: "Cancelled",
        previousValue: "true",
        newValue: "false",
        note: note || "Reinstated",
        performedBy,
        performedAt: new Date(),
      });
      await transfer.save();
      return NextResponse.json({ message: "Contra entry reinstated — moving balances again", transfer });
    }

    if (action === "note") {
      if (!note) return NextResponse.json({ error: "A note is required" }, { status: 400 });
      transfer.log.push({ action: "Note Added", note, performedBy, performedAt: new Date() });
      await transfer.save();
      return NextResponse.json({ message: "Note added", transfer });
    }

    return NextResponse.json(
      { error: "action must be one of: cancel, reinstate, note" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error updating contra entry:", error);
    return NextResponse.json({ error: "Failed to update contra entry" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const found = await loadOr404(id);
    if (found.error) return NextResponse.json({ error: found.error }, { status: found.status });
    const transfer = found.transfer;

    const snapshot = {
      _id: transfer._id,
      fromAccount: transfer.fromAccount,
      toAccount: transfer.toAccount,
      amount: transfer.amount,
      wasCountingTowardBalance: !transfer.isCancelled,
    };
    await AccountTransfer.deleteOne({ _id: id });

    return NextResponse.json({ message: "Contra entry deleted", deleted: snapshot });
  } catch (error) {
    console.error("Error deleting contra entry:", error);
    return NextResponse.json({ error: "Failed to delete contra entry" }, { status: 500 });
  }
}
