import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { ACCOUNTS } from "@/constants/bankRouting";
import { buildBalanceMatch } from "@/lib/accountBalances";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Cash-basis Receipts / Payments for the dashboard's Row 3 strip, for the selected period.
//
// Built on buildBalanceMatch — the exact same account-ledger filter the balance sheet, the
// per-account ledger, and the Assets/Liabilities pages all use — rather than a bespoke match, so
// this always agrees with the rest of Close Book:
//   - furtherMode must be one of the (optionally Further-Mode-filtered) accounts — "registered in
//     my bank and other further mode accounts".
//   - NON_CASH_METHODS (offset_settlement, including-package) are excluded — no cash moved.
//   - approvalStatus excludes only PENDING/REJECTED (not a strict "APPROVED" equality), because a
//     large share of historical rows predate the approvalStatus field and carry null.
//   - Contra transfers (AccountTransfer) are a SEPARATE collection, never queried here, so they
//     never enter this figure at all — "minus contra entries" is true by construction, not a
//     filter that has to remember to exclude them.
//
//   receipts = "receivable received amount" + "direct revenue payments" (no receivableId)
//   payments = "payable paid amount"        + "direct expense payments" (no payableId)
// Those two parts always sum to "every account-attributed, cash-moving Revenue/Expense
// transaction" (a transaction is always exactly one or the other), so one aggregation per side is
// enough — there's no need to compute the linked and direct portions separately.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const branch = searchParams.get("branch") || "";
    const accountsParam = searchParams.get("accounts") || "";
    const selectedAccounts = accountsParam
      ? accountsParam.split(",").filter((a) => ACCOUNTS.includes(a))
      : ACCOUNTS;

    const match = buildBalanceMatch({ accounts: selectedAccounts, from, to, branch });

    const [receiptsAgg, paymentsAgg] = await Promise.all([
      Transactions.aggregate([
        { $match: { ...match, costType: "Revenue" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transactions.aggregate([
        { $match: { ...match, costType: "Expenses" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const round2 = (n) => Math.round((n || 0) * 100) / 100;
    const receipts = round2(receiptsAgg[0]?.total || 0);
    const payments = round2(paymentsAgg[0]?.total || 0);

    return NextResponse.json({
      success: true,
      receipts,
      payments,
      balanceLeft: round2(receipts - payments),
    });
  } catch (error) {
    console.error("Error computing cash flow:", error);
    return NextResponse.json({ error: "Failed to compute cash flow" }, { status: 500 });
  }
}
