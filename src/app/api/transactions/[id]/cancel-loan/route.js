import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import AccountTransfer from "@/models/AccountTransfer";
import { reverseTransaction, ReversalError } from "@/lib/reverseTransaction";

// Loan cancellation — the purpose-built front end onto the existing, proven reversal mechanism
// (src/lib/reverseTransaction.js, the same guards api/transactions/[id]/reverse enforces),
// plus — only when the loan was already settled — a second write reversing the settlement's
// AccountTransfer. NOT a second reversal implementation: reverseTransaction() is called exactly
// as the reverse route calls it, just inside this route's own db session so both writes commit
// or neither does.
//
//   Case A — not yet settled: reverseTransaction() alone.
//   Case B — already settled (found via AccountTransfer.sourceTransactionId, set by
//            LoanSettlementModal): reverseTransaction() + a NEW AccountTransfer in the opposite
//            direction (bank -> loan account), same amount as the settlement. The original
//            settlement transfer is left untouched and still visible — a cancelled-but-hidden
//            transfer would be exactly as unreconcilable as a hidden reversal.

const ALLOWED_ROLES = ["admin", "super-admin"];
const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];

// Read-only: which case applies, so the confirmation dialog can say so before the user commits.
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
        settlementTransfer: null,
      });
    }

    const settlementTransfer = await AccountTransfer.findOne({
      sourceTransactionId: id,
      isCancelled: { $ne: true },
    }).lean();

    return NextResponse.json({
      success: true,
      isLoanTransaction: true,
      settlementTransfer,
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
    let reversalTransfer = null;
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

      // Case B: this loan was already settled — reverse that transfer too, same session, same
      // atomic unit as the transaction reversal above.
      const settlementTransfer = await AccountTransfer.findOne({
        sourceTransactionId: id,
        isCancelled: { $ne: true },
      }).session(dbSession);

      if (settlementTransfer) {
        loanCase = "B";
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
        reversalTransfer = transfer;
      }
    });

    return NextResponse.json(
      {
        success: true,
        case: loanCase,
        message:
          loanCase === "B"
            ? "Loan cancelled — revenue reversed and the settlement transfer undone"
            : "Loan cancelled — revenue reversed",
        reversal: result.reversal,
        reversalTransfer,
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
