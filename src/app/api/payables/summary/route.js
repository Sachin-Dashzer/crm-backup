import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Grouped pending totals — feeds the inline "Paid / Pending" chips on the
// Agent, Rent+Electricity, Collab, and Taxes sections of the expense form.
//
//   ?purpose=SALARY                                 -> org-wide Salary totals
//   ?purpose=SALARY&payeeKind=EMPLOYEE&payeeRefId=X  -> + that employee's Salary totals
//   ?purpose=RENT&payeeKind=RENT_UNIT&payeeLabel=Y   -> that rent unit's totals
//   ?branch=Delhi                                    -> totals grouped by purpose
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
    const purpose = searchParams.get("purpose") || "";
    const payeeKind = searchParams.get("payeeKind") || "";
    const payeeRefId = searchParams.get("payeeRefId") || "";
    const payeeLabel = searchParams.get("payeeLabel") || "";
    const branch = searchParams.get("branch") || "";

    const txCollection = Transactions.collection.name;

    const sumMatch = async (match) => {
      const [agg] = await Payable.aggregate([
        { $match: match },
        ...buildPayableAggregationStages(txCollection),
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalOwed: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$paid" },
            totalPending: { $sum: "$pending" },
          },
        },
      ]);
      return agg
        ? {
            count: agg.count,
            totalOwed: agg.totalOwed,
            totalPaid: agg.totalPaid,
            totalPending: agg.totalPending,
          }
        : { count: 0, totalOwed: 0, totalPaid: 0, totalPending: 0 };
    };

    const baseMatch = { isCancelled: false };
    if (purpose) baseMatch.purpose = purpose;
    if (branch) baseMatch.branch = branch;

    const overall = await sumMatch(baseMatch);

    let byPayee = null;
    if (payeeKind && (payeeRefId || payeeLabel)) {
      const payeeMatch = { ...baseMatch, "payee.kind": payeeKind };
      if (payeeRefId) payeeMatch["payee.refId"] = new mongoose.Types.ObjectId(payeeRefId);
      if (payeeLabel) payeeMatch["payee.label"] = payeeLabel;
      byPayee = await sumMatch(payeeMatch);
    }

    let byPurpose = null;
    if (!purpose) {
      byPurpose = await Payable.aggregate([
        { $match: { isCancelled: false, ...(branch ? { branch } : {}) } },
        ...buildPayableAggregationStages(txCollection),
        {
          $group: {
            _id: "$purpose",
            count: { $sum: 1 },
            totalOwed: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$paid" },
            totalPending: { $sum: "$pending" },
          },
        },
        { $sort: { totalPending: -1 } },
      ]);
    }

    return NextResponse.json({ success: true, overall, byPayee, byPurpose });
  } catch (error) {
    console.error("Error building payable summary:", error);
    return NextResponse.json({ error: "Failed to fetch payable summary" }, { status: 500 });
  }
}
