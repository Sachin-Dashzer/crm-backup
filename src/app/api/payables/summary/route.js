import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin", "owner"];

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
    // Only meaningful alongside payeeKind/payeeRefId — narrows a vendor's totals to one sub-type,
    // since a vendor's bills can span several (e.g. Professional Expenses: Turkey Technician vs.
    // Legal Consultant Fee). Every other payeeKind's payeeLabel already IS the sub-type, so this
    // stays unset for those callers.
    const expenseSubType = searchParams.get("expenseSubType") || "";
    const branch = searchParams.get("branch") || "";
    const ageing = searchParams.get("ageing") || "";

    const txCollection = Transactions.collection.name;

    // Ageing-bucketed pending totals, for the dashboard's payables/receivables ageing chart.
    // Reuses buildPayableAggregationStages (which already appends ageingBucket via
    // buildAgeingStages) rather than a separate pipeline just for this chart.
    if (ageing) {
      const byBucket = await Payable.aggregate([
        { $match: { isCancelled: false, ...(branch ? { branch } : {}) } },
        ...buildPayableAggregationStages(txCollection),
        { $match: { pending: { $gt: 0 } } },
        { $group: { _id: "$ageingBucket", count: { $sum: 1 }, totalPending: { $sum: "$pending" } } },
      ]);
      return NextResponse.json({ success: true, byBucket });
    }

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
      if (expenseSubType) payeeMatch.expenseSubType = expenseSubType;
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
