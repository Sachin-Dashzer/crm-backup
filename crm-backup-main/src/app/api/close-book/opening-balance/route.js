import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import AccountPeriod from "@/models/AccountPeriod";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Manual opening balances — the seed the whole ledger counts forward from.
//
// No historical transaction carries furtherMode, so per-account history before this
// feature cannot be derived. Rather than invent it by inferring from method, the opening
// position is entered by hand once per account as of a chosen start date, and every figure
// is computed forward from there.
//
// A seed is stored as an AccountPeriod with zero movement (openingBalance ===
// closingBalance, isClosed true) so the ordinary "previous closed period" lookup finds it
// with no special-casing.
//
// This is NOT the close action — it neither closes a real period nor blocks edits. Period
// closing and edit-locking belong to the next step.

// GET                -> company-level seeds, one row per account (unchanged shape)
// GET ?branch=Delhi  -> that branch's seeds, one row per account
//
// Also returns `branchTotals`: every branch seed that exists, per account, so the UI can show
// the company figure against the sum of its branches. They are NOT required to agree — contra
// entries carry no branch, so an internal transfer moves the company position without moving
// any branch's. The difference is reported, never auto-corrected.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const branchParam = searchParams.get("branch") || "";
    if (branchParam && !ALL_BRANCHES.includes(branchParam)) {
      return NextResponse.json(
        { error: `branch must be one of: ${ALL_BRANCHES.join(", ")}` },
        { status: 400 },
      );
    }
    const branch = branchParam || null;

    // A seed is a zero-movement closed row. Fetch company and branch rows in one pass so the
    // reconciliation figures come from the same read as the list.
    const seeds = await AccountPeriod.find({
      account: { $in: ACCOUNTS },
      isClosed: true,
      totalIn: 0,
      totalOut: 0,
      transactionCount: 0,
    })
      .sort({ periodEnd: 1 })
      .lean();

    // Earliest seed wins per (account, branch) — that is the position everything counts from.
    const pick = new Map();
    for (const s of seeds) {
      const key = `${s.account}|${s.branch ?? ""}`;
      if (!pick.has(key)) pick.set(key, s);
    }

    const branchesOf = (account) =>
      [...pick.values()]
        .filter((s) => s.account === account && s.branch)
        .map((s) => ({ branch: s.branch, openingBalance: s.openingBalance, asOf: s.periodEnd }));

    const openingBalances = ACCOUNTS.map((account) => {
      const branchRows = branchesOf(account);

      // "All branches" is DERIVED — the total of the branch figures, matching what
      // getOpeningBalance() hands the unfiltered ledger and balance sheet. It is not editable:
      // opening balances are entered per branch, and a separately-typed company figure would
      // just be a second number free to disagree with the sum of its own parts.
      if (!branch) {
        const companySeed = pick.get(`${account}|`);
        if (branchRows.length > 0) {
          const total = branchRows.reduce((t, b) => t + (b.openingBalance || 0), 0);
          return {
            account,
            branch: null,
            openingBalance: Math.round(total * 100) / 100,
            asOf: branchRows.reduce((l, b) => (!l || b.asOf > l ? b.asOf : l), null),
            notes: "",
            set: true,
            derivedFromBranches: true,
            branches: branchRows,
          };
        }
        // No branch figures at all — fall back to a company-wide seed if one was ever entered.
        return {
          account,
          branch: null,
          openingBalance: companySeed?.openingBalance ?? null,
          asOf: companySeed?.periodEnd ?? null,
          notes: companySeed?.notes || "",
          set: !!companySeed,
          derivedFromBranches: false,
          branches: [],
        };
      }

      const s = pick.get(`${account}|${branch}`);
      return {
        account,
        branch,
        openingBalance: s?.openingBalance ?? null,
        asOf: s?.periodEnd ?? null,
        notes: s?.notes || "",
        set: !!s,
        derivedFromBranches: false,
        branches: branchRows,
      };
    });

    return NextResponse.json({ success: true, branch, openingBalances });
  } catch (error) {
    console.error("Error reading opening balances:", error);
    return NextResponse.json({ error: "Failed to read opening balances" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { account, openingBalance, asOf, notes, branch: branchInput } = await req.json();

    if (!ACCOUNTS.includes(account)) {
      return NextResponse.json(
        { error: `account must be one of: ${ACCOUNTS.join(", ")}` },
        { status: 400 },
      );
    }
    // Omitted / empty branch means the company-level seed — the existing behaviour, unchanged.
    if (branchInput && !ALL_BRANCHES.includes(branchInput)) {
      return NextResponse.json(
        { error: `branch must be one of: ${ALL_BRANCHES.join(", ")}` },
        { status: 400 },
      );
    }
    const branch = branchInput || null;
    const amount = Number(openingBalance);
    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "openingBalance must be a number" }, { status: 400 });
    }
    if (!asOf) {
      return NextResponse.json({ error: "asOf date is required" }, { status: 400 });
    }
    const asOfDate = new Date(asOf);
    if (Number.isNaN(asOfDate.getTime())) {
      return NextResponse.json({ error: "asOf is not a valid date" }, { status: 400 });
    }

    // A seed is a zero-length period ending at asOf: everything from asOf onward is counted
    // from transactions, everything before it is represented by this single figure.
    const seed = await AccountPeriod.findOneAndUpdate(
      { account, branch, periodStart: asOfDate, periodEnd: asOfDate },
      {
        $set: {
          account,
          branch,
          periodStart: asOfDate,
          periodEnd: asOfDate,
          openingBalance: amount,
          totalIn: 0,
          totalOut: 0,
          closingBalance: amount,
          transactionCount: 0,
          isClosed: true,
          closedBy: { name: session.user.name, email: session.user.email },
          closedAt: new Date(),
          notes:
            notes ||
            (branch
              ? `Manually entered opening balance — ${branch}`
              : "Manually entered opening balance"),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json({ success: true, openingBalance: seed }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "An opening balance already exists for this account and date." },
        { status: 409 },
      );
    }
    console.error("Error saving opening balance:", error);
    return NextResponse.json({ error: "Failed to save opening balance" }, { status: 500 });
  }
}
