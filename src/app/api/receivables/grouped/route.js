import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableGroupedStages } from "@/lib/receivableAggregation";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Grouped receivables for the Assets drill-down (DrillDownTable):
//   level=1  -> one row per revenueCategory (HEAD)
//   level=2  -> one row per purpose within ?category= (SUB-TYPE)
//   level=3  -> the actual receipt Transactions for a HEAD (+ optional SUB-TYPE) bucket, with a
//               running "received so far" balance. Mirrors /api/payables/grouped.
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
      const rows = await Receivable.aggregate(
        buildReceivableGroupedStages(Transactions.collection.name, {
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

    const receivableMatch = { isCancelled: { $ne: true }, revenueCategory: category };
    if (subType) receivableMatch.purpose = subType;
    if (branch) receivableMatch.branch = branch;
    // Fetched in full (not just distinct ids) so each Transaction row below can carry WHO the
    // receivable is for — the drill-down previously showed a bare narration with no way to tell
    // whose receivable was being received.
    const receivables = await Receivable.find(receivableMatch, { payer: 1, purpose: 1, dueDate: 1 }).lean();
    const receivableIds = receivables.map((r) => r._id);
    const receivableMap = new Map(receivables.map((r) => [String(r._id), r]));

    const txMatch = {
      costType: "Revenue",
      approvalStatus: "APPROVED",
      method: { $nin: UNSETTLED_METHODS },
      $or: [
        { receivableId: { $in: receivableIds } },
        { "receivableAllocations.receivableId": { $in: receivableIds } },
      ],
    };
    if (from || to) {
      txMatch.date = {};
      if (from) txMatch.date.$gte = new Date(from);
      if (to) txMatch.date.$lte = new Date(to);
    }

    const idSet = receivableIds.map((id) => String(id));

    const [rows, total] = await Promise.all([
      Transactions.aggregate([
        { $match: txMatch },
        {
          // A split payment's receivableAllocations may reference receivables OUTSIDE this
          // bucket too — only count the slice that belongs here, exactly like
          // buildReceivableGroupedStages does for the rollup above.
          $addFields: {
            contribution: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$receivableAllocations", []] } }, 0] },
                {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: "$receivableAllocations",
                          cond: { $in: [{ $toString: "$$this.receivableId" }, idSet] },
                        },
                      },
                      as: "a",
                      in: "$$a.amount",
                    },
                  },
                },
                "$amount",
              ],
            },
          },
        },
        { $sort: { date: 1, _id: 1 } },
        {
          $setWindowFields: {
            sortBy: { date: 1, _id: 1 },
            output: {
              runningBalance: {
                $sum: "$contribution",
                window: { documents: ["unbounded", "current"] },
              },
            },
          },
        },
        { $sort: { date: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            date: 1,
            narration: { $ifNull: ["$remarks", "$procedure"] },
            amount: "$contribution",
            method: 1,
            account: "$furtherMode",
            runningBalance: 1,
            branch: 1,
            transactionCategory: 1,
            receivableId: 1,
            receivableAllocations: 1,
          },
        },
      ]),
      Transactions.countDocuments(txMatch),
    ]);

    // Which receivable in THIS bucket a row belongs to: the flat receivableId when set, else the
    // single allocation that falls in this bucket's id set, else — for a genuine multi-receivable
    // split payment — "Split payment" rather than guessing one party.
    const resolveParty = (r) => {
      if (r.receivableId) return receivableMap.get(String(r.receivableId)) || null;
      const inBucket = (r.receivableAllocations || []).filter((a) => idSet.includes(String(a.receivableId)));
      if (inBucket.length === 1) return receivableMap.get(String(inBucket[0].receivableId)) || null;
      if (inBucket.length > 1) return "SPLIT";
      return null;
    };

    // See the identical comment in /api/payables/grouped — bounded by `limit`, cheap per page.
    const rowsWithLock = await Promise.all(
      rows.map(async (r) => {
        const matched = resolveParty(r);
        const { receivableAllocations, ...rest } = r;
        return {
          ...rest,
          party: matched === "SPLIT" ? "Split payment" : matched?.payer?.label || "—",
          purpose: matched && matched !== "SPLIT" ? matched.purpose || "" : "",
          dueDate: matched && matched !== "SPLIT" ? matched.dueDate || null : null,
          lockReason: await checkPeriodLock({ furtherMode: r.account, date: r.date }),
        };
      }),
    );

    return NextResponse.json({ success: true, rows: rowsWithLock, total, page, limit });
  } catch (error) {
    console.error("Error building grouped receivables:", error);
    return NextResponse.json({ error: "Failed to load grouped receivables" }, { status: 500 });
  }
}
