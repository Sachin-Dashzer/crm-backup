import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin", "owner"];

// Grouped pending totals, mirroring /api/payables/summary.
//   ?purpose=PATIENT_DUE                               -> org-wide totals for that purpose
//   ?purpose=PATIENT_DUE&payerKind=PATIENT&payerRefId=X -> + that patient's totals
//   ?branch=Delhi                                       -> totals grouped by purpose
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
    const payerKind = searchParams.get("payerKind") || "";
    const payerRefId = searchParams.get("payerRefId") || "";
    const payerLabel = searchParams.get("payerLabel") || "";
    const branch = searchParams.get("branch") || "";
    const ageing = searchParams.get("ageing") || "";

    const txCollection = Transactions.collection.name;

    // Ageing-bucketed pending totals, mirroring /api/payables/summary?ageing=1 — reused by the
    // dashboard's receivables/payables ageing chart instead of a separate pipeline.
    if (ageing) {
      const byBucket = await Receivable.aggregate([
        { $match: { isCancelled: false, ...(branch ? { branch } : {}) } },
        ...buildReceivableAggregationStages(txCollection),
        { $match: { pending: { $gt: 0 } } },
        { $group: { _id: "$ageingBucket", count: { $sum: 1 }, totalPending: { $sum: "$pending" } } },
      ]);
      return NextResponse.json({ success: true, byBucket });
    }

    const sumMatch = async (match) => {
      const [agg] = await Receivable.aggregate([
        { $match: match },
        ...buildReceivableAggregationStages(txCollection),
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalReceivable: { $sum: "$totalAmount" },
            totalReceived: { $sum: "$received" },
            totalPending: { $sum: "$pending" },
          },
        },
      ]);
      return agg
        ? {
            count: agg.count,
            totalReceivable: agg.totalReceivable,
            totalReceived: agg.totalReceived,
            totalPending: agg.totalPending,
          }
        : { count: 0, totalReceivable: 0, totalReceived: 0, totalPending: 0 };
    };

    const baseMatch = { isCancelled: false };
    if (purpose) baseMatch.purpose = purpose;
    if (branch) baseMatch.branch = branch;

    const overall = await sumMatch(baseMatch);

    let byPayer = null;
    if (payerKind && (payerRefId || payerLabel)) {
      const payerMatch = { ...baseMatch, "payer.kind": payerKind };
      if (payerRefId) payerMatch["payer.refId"] = new mongoose.Types.ObjectId(payerRefId);
      if (payerLabel) payerMatch["payer.label"] = payerLabel;
      byPayer = await sumMatch(payerMatch);
    }

    let byPurpose = null;
    if (!purpose) {
      byPurpose = await Receivable.aggregate([
        { $match: { isCancelled: false, ...(branch ? { branch } : {}) } },
        ...buildReceivableAggregationStages(txCollection),
        {
          $group: {
            _id: "$purpose",
            count: { $sum: 1 },
            totalReceivable: { $sum: "$totalAmount" },
            totalReceived: { $sum: "$received" },
            totalPending: { $sum: "$pending" },
          },
        },
        { $sort: { totalPending: -1 } },
      ]);
    }

    return NextResponse.json({ success: true, overall, byPayer, byPurpose });
  } catch (error) {
    console.error("Error building receivable summary:", error);
    return NextResponse.json({ error: "Failed to fetch receivable summary" }, { status: 500 });
  }
}
