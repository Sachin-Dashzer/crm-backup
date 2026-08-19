import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { getOpeningBalances, computeContraMovements, computeSuspenseMovements, round2 } from "@/lib/accountBalances";

const ALLOWED_ROLES = ["admin", "super-admin"];
const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];
// Same "cash" account set the Assets page's Cash & Bank section uses (close-book/accounts
// ?filter=cash) — loan-financing accounts are excluded there and here for the same reason.
const CASH_ACCOUNTS = ACCOUNTS.filter((a) => !LOAN_ACCOUNTS.includes(a));

// Feeds the Opening/+Receipts/-Payments/[+Contra][+Suspense]/=Closing reconciliation strip on
// /admin/receipts and /admin/payments. Every figure here comes from src/lib/accountBalances.js —
// never re-derived — so this route can only ever agree with /api/close-book/accounts?filter=cash
// for the same window, by construction. See src/lib/cashFlowAggregation.js's header for why
// Receipts/Payments themselves are computed separately (they come from the two /grouped routes,
// summed client-side) and why Contra/Suspense are surfaced as their own terms instead of folded
// silently into "Receipts" or "Payments" — neither is a Transaction, so neither belongs in a
// cash-basis P&L-adjacent figure, but both DO move the cash balance and must be accounted for or
// the strip would show a false mismatch on every internal transfer / unresolved bank entry.
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
    const to = searchParams.get("to") || new Date().toISOString();
    const branchParam = searchParams.get("branch") || "";
    // Deliberately a raw branch string, not resolveBranchFilter's collab-expanded filter object —
    // accountBalances.js's branch param is "one branch, or company-wide (null)"; a real
    // Transactions.branch value is always a single city, never the "Collab" role sentinel, so
    // this is safe and stays consistent with how the /grouped routes are queried for the same
    // window (see the two pages, which pass this same single value through to both).
    const branch = branchParam && ALL_BRANCHES.includes(branchParam) ? branchParam : null;

    if (!from) {
      return NextResponse.json({ error: "from is required" }, { status: 400 });
    }

    const toPlusInstant = new Date(new Date(to).getTime() + 1);

    const [openings, closings, contraRows, suspenseRows] = await Promise.all([
      getOpeningBalances(CASH_ACCOUNTS, from, branch),
      getOpeningBalances(CASH_ACCOUNTS, toPlusInstant, branch),
      Promise.all(CASH_ACCOUNTS.map((a) => computeContraMovements(a, from, to, null, branch))),
      Promise.all(CASH_ACCOUNTS.map((a) => computeSuspenseMovements(a, from, to, null, branch))),
    ]);

    const opening = round2(
      CASH_ACCOUNTS.reduce((s, a) => s + (openings[a]?.openingBalance || 0), 0),
    );
    const closing = round2(
      CASH_ACCOUNTS.reduce((s, a) => s + (closings[a]?.openingBalance || 0), 0),
    );
    const contraNet = round2(contraRows.reduce((s, c) => s + (c.totalIn - c.totalOut), 0));
    const suspenseNet = round2(suspenseRows.reduce((s, c) => s + (c.totalIn - c.totalOut), 0));

    return NextResponse.json({ success: true, opening, closing, contraNet, suspenseNet });
  } catch (error) {
    console.error("Error building receipts/payments reconciliation:", error);
    return NextResponse.json({ error: "Failed to build reconciliation" }, { status: 500 });
  }
}
