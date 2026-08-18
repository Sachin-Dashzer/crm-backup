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
  SIGNED_AMOUNT,
  TRANSACTION_TO_MOVEMENT,
} from "@/lib/accountBalances";

const ALLOWED_ROLES = ["admin", "super-admin"];
const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];

// Level-1 rollup for the Assets/Liabilities drill-down (DrillDownTable, levels=2): one row per
// account, reusing the exact opening/in/out/closing math /api/close-book/balance-sheet uses,
// reshaped into the { key, label, opening, movement, settled, closing } contract every
// DrillDownTable section shares.
//
// ?filter=cash  -> every account except the two loan financiers (Assets' Cash & Bank section)
// ?filter=loans -> only the loan financiers (Liabilities' Loans section)
// no filter     -> all of ACCOUNTS
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || new Date().toISOString();
    const branch = searchParams.get("branch") || "";
    const seriesDays = searchParams.get("series") || "";

    // Combined cash-account balance over the trailing N days, for the dashboard's line chart.
    // Contra transfers are deliberately excluded: summed across the FULL combined set they net to
    // exactly zero (money moving between two of our own accounts), so leaving them out changes
    // nothing here. Open suspense entries are also excluded from this rough trend line — a
    // resolved entry's money is later re-counted via its real transaction on a possibly different
    // date, and re-including the original suspense day risks double counting; the accounts list
    // above (and the balance sheet) remain the audited figures, this is a visual trend only.
    if (seriesDays) {
      const days = Math.min(90, Math.max(1, parseInt(seriesDays)));
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);

      const cashAccounts = ACCOUNTS.filter((a) => !LOAN_ACCOUNTS.includes(a));
      const openings = await getOpeningBalances(cashAccounts, start, branch || null);
      const startingBalance = cashAccounts.reduce(
        (s, a) => s + (openings[a]?.openingBalance || 0),
        0,
      );

      const dailyRows = await Transactions.aggregate([
        { $match: buildBalanceMatch({ accounts: cashAccounts, from: start, to: end, branch }) },
        {
          $project: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } },
            net: SIGNED_AMOUNT,
          },
        },
        { $group: { _id: "$day", net: { $sum: "$net" } } },
      ]);

      const byDay = new Map(dailyRows.map((r) => [r._id, r.net]));
      const series = [];
      let running = startingBalance;
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        running = round2(running + (byDay.get(key) || 0));
        series.push({ date: key, balance: running });
      }

      return NextResponse.json({ success: true, series });
    }

    const accounts =
      filter === "loans"
        ? LOAN_ACCOUNTS
        : filter === "cash"
          ? ACCOUNTS.filter((a) => !LOAN_ACCOUNTS.includes(a))
          : ACCOUNTS;

    const openingFrom = from || "1970-01-01";
    const contraStage = buildContraUnionStage({ from: openingFrom, to, branch });
    const suspenseStage = buildSuspenseUnionStage({ from: openingFrom, to, branch });

    const [openings, movementRows] = await Promise.all([
      getOpeningBalances(accounts, openingFrom, branch || null),
      Transactions.aggregate([
        { $match: buildBalanceMatch({ accounts, from: openingFrom, to, branch }) },
        TRANSACTION_TO_MOVEMENT,
        ...(contraStage ? [contraStage] : []),
        ...(suspenseStage ? [suspenseStage] : []),
        // Contra/suspense rows carry their own `account`, unrestricted by buildBalanceMatch
        // above — re-scope to the requested subset (loans-only / cash-only) here.
        { $match: { account: { $in: accounts } } },
        {
          $group: {
            _id: "$account",
            totalIn: { $sum: "$in" },
            totalOut: { $sum: "$out" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byAccount = new Map(movementRows.map((r) => [r._id, r]));
    const rows = accounts.map((account) => {
      const m = byAccount.get(account);
      const opening = round2(openings[account].openingBalance);
      const movement = round2(m?.totalIn || 0);
      const settled = round2(m?.totalOut || 0);
      return {
        key: account,
        label: account,
        opening,
        movement,
        settled,
        closing: round2(opening + movement - settled),
        count: m?.count || 0,
      };
    });

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error("Error building account rollup:", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}
