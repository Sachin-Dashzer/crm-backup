import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { ACCOUNTS } from "@/constants/bankRouting";
import {
  buildBalanceMatch,
  buildContraUnionStage,
  buildSuspenseUnionStage,
  getOpeningBalances,
  round2,
  TRANSACTION_TO_MOVEMENT,
} from "@/lib/accountBalances";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Balance sheet: every account side by side for one period — opening, in, out, closing
// per account, plus a grand total row.
//
// ONE aggregation covering all accounts (grouped by furtherMode), not one query per account.
// Accounts with no movement still appear, at their opening balance, so a zero row is
// visibly zero rather than missing.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const branch = searchParams.get("branch") || "";
    if (!from || !to) {
      return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
    }

    const started = Date.now();

    // Transactions and contra entries are summed in ONE pipeline: the transaction rows are
    // projected into a neutral { account, in, out } shape, contra rows are unioned in already
    // in that shape (one transfer contributing an out row and an in row), then a single $group
    // totals both. Contra entries therefore net to zero across all accounts by
    // construction rather than by a separate reconciliation step.
    const contraStage = buildContraUnionStage({ from, to, branch });
    // Unexplained bank movement, so the closing balance matches the statement. Open entries
    // only — a resolved one is represented by its real transaction, already counted above.
    const suspenseStage = buildSuspenseUnionStage({ from, to, branch });
    const [openings, movementRows] = await Promise.all([
      // Branch-filtered views open from that branch's own seeds, not the company figures.
      getOpeningBalances(ACCOUNTS, from, branch || null),
      Transactions.aggregate([
        { $match: buildBalanceMatch({ accounts: ACCOUNTS, from, to, branch }) },
        TRANSACTION_TO_MOVEMENT,
        ...(contraStage ? [contraStage] : []),
        ...(suspenseStage ? [suspenseStage] : []),
        {
          $group: {
            _id: "$account",
            totalIn: { $sum: "$in" },
            totalOut: { $sum: "$out" },
            transactionCount: { $sum: { $cond: ["$isContra", 0, 1] } },
            contraCount: { $sum: { $cond: ["$isContra", 1, 0] } },
            suspenseCount: { $sum: { $cond: ["$isSuspense", 1, 0] } },
          },
        },
      ]),
    ]);

    const elapsedMs = Date.now() - started;
    const byAccount = new Map(movementRows.map((r) => [r._id, r]));

    const accounts = ACCOUNTS.map((account) => {
      const m = byAccount.get(account);
      const openingBalance = round2(openings[account].openingBalance);
      const totalIn = round2(m?.totalIn || 0);
      const totalOut = round2(m?.totalOut || 0);
      return {
        account,
        openingBalance,
        openingBalanceSeeded: openings[account].seeded,
        totalIn,
        totalOut,
        closingBalance: round2(openingBalance + totalIn - totalOut),
        transactionCount: m?.transactionCount || 0,
        contraCount: m?.contraCount || 0,
        suspenseCount: m?.suspenseCount || 0,
      };
    });

    const grandTotal = accounts.reduce(
      (acc, a) => ({
        openingBalance: round2(acc.openingBalance + a.openingBalance),
        totalIn: round2(acc.totalIn + a.totalIn),
        totalOut: round2(acc.totalOut + a.totalOut),
        closingBalance: round2(acc.closingBalance + a.closingBalance),
        transactionCount: acc.transactionCount + a.transactionCount,
      }),
      { openingBalance: 0, totalIn: 0, totalOut: 0, closingBalance: 0, transactionCount: 0 },
    );

    // Rows that move real cash but carry no account attribution would otherwise be
    // invisible. Surfaced as a known gap rather than silently dropped — every historical
    // row is in this bucket, since none of them carry furtherMode.
    const [unattributed] = await Transactions.aggregate([
      {
        $match: {
          ...buildBalanceMatch({ accounts: ACCOUNTS, from, to, branch }),
          furtherMode: { $in: [null, ""] },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]);

    return NextResponse.json({
      success: true,
      period: { from, to },
      accounts,
      grandTotal,
      unattributed: {
        count: unattributed?.count || 0,
        amount: round2(unattributed?.amount || 0),
      },
      elapsedMs,
    });
  } catch (error) {
    console.error("Error building balance sheet:", error);
    return NextResponse.json({ error: "Failed to build balance sheet" }, { status: 500 });
  }
}
