import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableGroupedStages } from "@/lib/payableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Grouped payables for the Liabilities drill-down (DrillDownTable):
//   level=1  -> one row per expenseCategory (HEAD)
//   level=2  -> one row per expenseSubType within ?category= (SUB-TYPE)
//   level=3  -> the actual settling Transactions for a HEAD (+ optional SUB-TYPE) bucket, with a
//               running "paid so far" balance — same paid/settled rule
//               buildPayableAggregationStages uses for the flat list, just re-scoped to a bucket.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const level = Math.min(3, Math.max(1, parseInt(searchParams.get("level") || "1")));
    const category = searchParams.get("category") || "";
    const subType = searchParams.get("subType") || "";
    const branch = searchParams.get("branch") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    if (level < 3) {
      const rows = await Payable.aggregate(
        buildPayableGroupedStages(Transactions.collection.name, {
          level,
          category,
          subType,
          branch,
          from,
          to,
        }),
      );
      return NextResponse.json({ success: true, rows });
    }

    if (!category) {
      return NextResponse.json({ error: "category is required at level 3" }, { status: 400 });
    }

    const payableMatch = { isCancelled: { $ne: true }, expenseCategory: category };
    if (subType) payableMatch.expenseSubType = subType;
    if (branch) payableMatch.branch = branch;
    // Fetched in full (not just distinct ids) so each Transaction row below can carry WHO the
    // payable is for — the drill-down previously showed a bare narration with no way to tell
    // whose obligation was being paid.
    const payables = await Payable.find(payableMatch, { payee: 1, purpose: 1, dueDate: 1 }).lean();
    const payableIds = payables.map((p) => p._id);
    const payableMap = new Map(payables.map((p) => [String(p._id), p]));

    const txMatch = {
      payableId: { $in: payableIds },
      approvalStatus: "APPROVED",
      method: { $nin: UNSETTLED_METHODS },
    };
    if (from || to) {
      txMatch.date = {};
      if (from) txMatch.date.$gte = new Date(from);
      if (to) txMatch.date.$lte = new Date(to);
    }

    const [rows, total] = await Promise.all([
      Transactions.aggregate([
        { $match: txMatch },
        { $sort: { date: 1, _id: 1 } },
        {
          $setWindowFields: {
            sortBy: { date: 1, _id: 1 },
            output: {
              runningBalance: { $sum: "$amount", window: { documents: ["unbounded", "current"] } },
            },
          },
        },
        { $sort: { date: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            date: 1,
            narration: { $ifNull: [{ $ifNull: ["$remarks", "$expenseType"] }, "$expense"] },
            amount: 1,
            method: 1,
            account: "$furtherMode",
            runningBalance: 1,
            branch: 1,
            transactionCategory: 1,
            payableId: 1,
          },
        },
      ]),
      Transactions.countDocuments(txMatch),
    ]);

    // A row inside a closed AccountPeriod is shown with a lock icon + reason rather than a
    // silently-disabled edit/delete button. Bounded by `limit` (<=200), so one lock check per
    // row per page is cheap.
    const rowsWithLock = await Promise.all(
      rows.map(async (r) => {
        const payable = payableMap.get(String(r.payableId));
        return {
          ...r,
          party: payable?.payee?.label || "—",
          purpose: payable?.purpose || "",
          dueDate: payable?.dueDate || null,
          lockReason: await checkPeriodLock({ furtherMode: r.account, date: r.date }),
        };
      }),
    );

    return NextResponse.json({ success: true, rows: rowsWithLock, total, page, limit });
  } catch (error) {
    console.error("Error building grouped payables:", error);
    return NextResponse.json({ error: "Failed to load grouped payables" }, { status: 500 });
  }
}
