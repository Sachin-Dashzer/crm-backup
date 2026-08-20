import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import AccountTransfer from "@/models/AccountTransfer";
import { reverseTransaction, ReversalError } from "@/lib/reverseTransaction";
import { checkPeriodLock } from "@/lib/periodLock";

// Loan cancellation — the purpose-built front end onto the existing, proven reversal mechanism
// (src/lib/reverseTransaction.js, the same guards api/transactions/[id]/reverse enforces),
// plus — only when the loan was already settled — a second write per settlement reversing that
// settlement's AccountTransfer. NOT a second reversal implementation: reverseTransaction() is
// called exactly as the reverse route calls it, just inside this route's own db session so every
// write commits or none does.
//
//   Case A — not yet settled: reverseTransaction() alone.
//   Case B — already settled (one or more times — see D2 below): reverseTransaction() + one NEW
//            AccountTransfer per outstanding settlement, in the opposite direction (bank -> loan
//            account), same amount as that settlement. The original settlement transfers are
//            left untouched and still visible — a cancelled-but-hidden transfer would be exactly
//            as unreconcilable as a hidden reversal.
//
// D1 FIX — the bug this rewrite exists for: a cancellation's reversing transfer used to be
// created with sourceTransactionId: id, the SAME id the original settlement transfer carries.
// Both this GET probe and the POST handler then looked up
// `AccountTransfer.findOne({ sourceTransactionId: id, isCancelled: { $ne: true } })` — with no
// sort, that could return either the settlement OR the transfer that reversed it, so a second
// cancellation attempt could reverse the reversal and move money back again. Every lookup below
// is scoped by `transferKind: "LOAN_SETTLEMENT"` instead, which only the ORIGINAL settlement
// ever carries — the reversal is tagged LOAN_CANCELLATION and is never returned by this query.

const ALLOWED_ROLES = ["admin", "super-admin"];
const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];

async function findSettlementTransfers(id, session = null) {
  const q = AccountTransfer.find({
    sourceTransactionId: id,
    transferKind: "LOAN_SETTLEMENT",
    isCancelled: { $ne: true },
  });
  if (session) q.session(session);
  return q;
}

// Read-only: which case applies, so the confirmation dialog can say so before the user commits.
// Also doubles as the "how much is already settled" probe LoanSettlementModal uses to pre-fill
// the remaining amount (D6).
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
    }

    const original = await Transactions.findById(id).lean();
    if (!original) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    if (!LOAN_ACCOUNTS.includes(original.furtherMode)) {
      return NextResponse.json({
        success: true,
        isLoanTransaction: false,
        settlementTransfers: [],
        totalSettled: 0,
      });
    }

    const settlementTransfers = await findSettlementTransfers(id).lean();
    const totalSettled = settlementTransfers.reduce((s, t) => s + (t.amount || 0), 0);

    return NextResponse.json({
      success: true,
      isLoanTransaction: true,
      settlementTransfers,
      totalSettled: Math.round(totalSettled * 100) / 100,
      remaining: Math.round(((original.amount || 0) - totalSettled) * 100) / 100,
    });
  } catch (error) {
    console.error("Error reading loan cancellation state:", error);
    return NextResponse.json({ error: "Failed to read loan cancellation state" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const dbSession = await mongoose.startSession();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });
    }

    const body = await request.json();
    const { reason, remarks, date } = body;

    const actor = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
    };

    let result;
    const reversalTransfers = [];
    let loanCase = "A";

    await dbSession.withTransaction(async () => {
      const original = await Transactions.findById(id).session(dbSession);
      if (!original) {
        throw new ReversalError(404, { error: "Transaction not found" });
      }
      if (!LOAN_ACCOUNTS.includes(original.furtherMode)) {
        throw new ReversalError(400, {
          error:
            "This isn't a loan-financing transaction (Bajaj Loan / Fibe Loan). Use the regular Reverse action instead.",
        });
      }

      // The reversal itself — every guard reverseTransaction enforces applies here identically.
      // Full reversal only (amount omitted): a loan cancellation undoes the whole thing, never
      // a partial amount.
      result = await reverseTransaction({
        transactionId: id,
        amount: undefined,
        reason,
        remarks,
        date,
        actor,
        dbSession,
      });

      // Case B: this loan was already settled, possibly more than once (D2) — reverse EVERY
      // outstanding settlement transfer, not just one, same session as the transaction reversal
      // above so all of it commits or none does.
      const settlementTransfers = await findSettlementTransfers(id, dbSession);

      for (const settlementTransfer of settlementTransfers) {
        loanCase = "B";

        // D4 — period lock, checked against the REVERSAL's effective date (result.reversal.date
        // may differ from the request date if the original's own period was closed — see
        // reverseTransaction's comment), on both accounts this transfer touches.
        const fromLock = await checkPeriodLock({
          furtherMode: settlementTransfer.toAccount,
          date: result.reversal.date,
        });
        if (fromLock) {
          throw new ReversalError(423, { error: fromLock, periodLocked: true });
        }
        const toLock = await checkPeriodLock({
          furtherMode: settlementTransfer.fromAccount,
          date: result.reversal.date,
        });
        if (toLock) {
          throw new ReversalError(423, { error: toLock, periodLocked: true });
        }

        const [transfer] = await AccountTransfer.create(
          [
            {
              fromAccount: settlementTransfer.toAccount,
              toAccount: settlementTransfer.fromAccount,
              amount: settlementTransfer.amount,
              date: result.reversal.date,
              branch: settlementTransfer.branch,
              reference: settlementTransfer.reference,
              remarks: `Loan cancellation — reversing settlement ${settlementTransfer._id}`,
              sourceTransactionId: id,
              transferKind: "LOAN_CANCELLATION",
              reversesTransferId: settlementTransfer._id,
              createdBy: { ...actor, date: new Date() },
              log: [
                {
                  action: "Created",
                  newValue: String(settlementTransfer.amount),
                  note: `Reverses settlement transfer ${settlementTransfer._id} (${settlementTransfer.fromAccount} → ${settlementTransfer.toAccount})`,
                  performedBy: { name: actor.name, email: actor.email },
                  performedAt: new Date(),
                },
              ],
            },
          ],
          { session: dbSession },
        );
        reversalTransfers.push(transfer);
      }
    });

    return NextResponse.json(
      {
        success: true,
        case: loanCase,
        message:
          loanCase === "B"
            ? reversalTransfers.length > 1
              ? `Loan cancelled — revenue reversed and ${reversalTransfers.length} settlement transfers undone`
              : "Loan cancelled — revenue reversed and the settlement transfer undone"
            : "Loan cancelled — revenue reversed",
        reversal: result.reversal,
        reversalTransfers,
        original: {
          _id: result.original._id,
          amount: result.original.amount,
          isReversed: result.fullyReversed,
        },
        patientStatus: result.patientStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ReversalError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    console.error("Error cancelling loan:", error);
    return NextResponse.json({ error: error.message || "Failed to cancel loan" }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }
}
