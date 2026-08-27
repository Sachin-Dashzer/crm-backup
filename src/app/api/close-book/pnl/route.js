import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import { UNSETTLED_METHODS, ACCOUNTS } from "@/constants/bankRouting";

const ALLOWED_ROLES = ["admin", "super-admin", "owner"];

// Accrual Income/Expense for the dashboard's Row 2 strip.
//
//   Income  = direct revenue Transactions (no receivableId, no receivableAllocations) raised
//             within the period  +  every Receivable's totalAmount CREATED within the period.
//   Expense = direct expense Transactions (no payableId) within the period  +  every Payable's
//             totalAmount CREATED within the period.
//
// This is exactly "all revenue/expense transactions + all receivables/payables raised - the
// transactions registered against those receivables/payables": every sale or cost counts exactly
// once, either as a direct transaction (nothing was ever raised for it) or as the
// receivable/payable's own raised amount (whether or not it has since been collected/paid),
// never both. A transaction linked to a receivable/payable is excluded from the "direct" sum
// specifically so it isn't counted a second time on top of the raised amount.
//
// The Further Mode account filter only narrows the TRANSACTION portions — a raised-but-unsettled
// receivable/payable has no bank account yet, so it can't be scoped to one.
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
      : [];

    const dateRange = {};
    if (from) dateRange.$gte = new Date(from);
    if (to) dateRange.$lte = new Date(to);

    const txBase = {
      approvalStatus: { $nin: ["PENDING", "REJECTED"] },
      method: { $nin: UNSETTLED_METHODS },
    };
    if (Object.keys(dateRange).length) txBase.date = dateRange;
    if (branch) txBase.branch = branch;
    if (selectedAccounts.length > 0) txBase.furtherMode = { $in: selectedAccounts };

    // excludeFromPnl filters out FINANCING obligations — a borrowing's Payable (money received
    // that must be repaid) and an advance's Receivable (money lent that will be recovered). Both
    // are genuine balance-sheet items, but neither is a cost or a sale: borrowing money is not
    // income, lending it is not expense, and settling either way is just cash moving back.
    // Without this the sums below counted the full borrowed/lent amount as expense/income the
    // moment the document was raised. See the field's comment on both models.
    const obligationBase = { isCancelled: { $ne: true }, excludeFromPnl: { $ne: true } };
    if (Object.keys(dateRange).length) obligationBase.createdAt = dateRange;
    if (branch) obligationBase.branch = branch;

    const [directRevenueAgg, directExpenseAgg, receivablesRaisedAgg, payablesRaisedAgg] = await Promise.all([
      Transactions.aggregate([
        {
          $match: {
            ...txBase,
            costType: "Revenue",
            receivableId: null,
            $or: [
              { receivableAllocations: { $exists: false } },
              { receivableAllocations: { $size: 0 } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transactions.aggregate([
        { $match: { ...txBase, costType: "Expenses", payableId: null } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Receivable.aggregate([
        { $match: obligationBase },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      Payable.aggregate([
        { $match: obligationBase },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

    const round2 = (n) => Math.round((n || 0) * 100) / 100;
    const income = round2((directRevenueAgg[0]?.total || 0) + (receivablesRaisedAgg[0]?.total || 0));
    const expense = round2((directExpenseAgg[0]?.total || 0) + (payablesRaisedAgg[0]?.total || 0));

    return NextResponse.json({ success: true, income, expense, profit: round2(income - expense) });
  } catch (error) {
    console.error("Error computing P&L:", error);
    return NextResponse.json({ error: "Failed to compute P&L" }, { status: 500 });
  }
}
