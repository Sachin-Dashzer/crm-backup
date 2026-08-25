import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";
import { COLLAB_BRANCHES } from "@/lib/branches";

const ALLOWED_ROLES = ["collab", "admin", "super-admin"];

// One row per collab clinic.
//
// SOURCE OF TRUTH: Payable/Receivable documents, with paid/received computed live from
// the Transactions linked to them — the same aggregation the payables and receivables
// pages use, so the three screens can never disagree.
//
// This deliberately no longer derives the balance from CollabCase.clinicCollections.
// Doing both would report the same debt twice (once here, once on /admin/liabilities and
// /admin/assets' Payables/Receivables drill-downs) and the two would drift apart permanently: settling a
// CollabSettlement moved this number but never closed the payable, and paying the
// payable never moved this number. CollabCase now carries case metadata only.
//
//   netPosition = outstanding receivables - outstanding payables
//   > 0  clinics owe us    < 0  we owe clinics
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const clinicParam = searchParams.get("clinic") || "";
    if (clinicParam && !COLLAB_BRANCHES.includes(clinicParam)) {
      return NextResponse.json({ error: "Invalid clinic" }, { status: 400 });
    }

    // Every branch of this query is pinned to collab clinics only. A main branch
    // (Delhi/Mumbai/Hyderabad/Noida) can never be matched here.
    const clinicMatch = clinicParam ? clinicParam : { $in: COLLAB_BRANCHES };
    const txCollection = Transactions.collection.name;

    const [receivableRows, payableRows, caseRows] = await Promise.all([
      Receivable.aggregate([
        {
          $match: {
            "payer.kind": "COLLAB_CLINIC",
            "payer.label": clinicMatch,
            branch: { $in: COLLAB_BRANCHES },
            isCancelled: { $ne: true },
          },
        },
        ...buildReceivableAggregationStages(txCollection),
        {
          $group: {
            _id: "$payer.label",
            totalReceivable: { $sum: "$totalAmount" },
            outstandingReceivable: { $sum: "$pending" },
            receivableCount: { $sum: 1 },
          },
        },
      ]),
      Payable.aggregate([
        {
          $match: {
            "payee.kind": "COLLAB_CLINIC",
            "payee.label": clinicMatch,
            branch: { $in: COLLAB_BRANCHES },
            isCancelled: { $ne: true },
          },
        },
        ...buildPayableAggregationStages(txCollection),
        {
          $group: {
            _id: "$payee.label",
            totalPayable: { $sum: "$totalAmount" },
            outstandingPayable: { $sum: "$pending" },
            payableCount: { $sum: 1 },
          },
        },
      ]),
      CollabCase.aggregate([
        { $match: { clinic: clinicMatch, status: { $ne: "CANCELLED" } } },
        {
          $group: {
            _id: "$clinic",
            openCaseCount: { $sum: { $cond: [{ $eq: ["$status", "OPEN"] }, 1, 0] } },
            caseCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Empirical guard — fail loudly if a non-collab branch ever slipped through.
    const leaked = [...receivableRows, ...payableRows, ...caseRows].filter(
      (r) => !COLLAB_BRANCHES.includes(r._id),
    );
    if (leaked.length > 0) {
      console.error("Collab balance query returned non-collab-branch rows:", leaked);
    }

    const receivableBy = new Map(receivableRows.map((r) => [r._id, r]));
    const payableBy = new Map(payableRows.map((r) => [r._id, r]));
    const caseBy = new Map(caseRows.map((r) => [r._id, r]));

    const clinicsInvolved = new Set([
      ...receivableRows.map((r) => r._id),
      ...payableRows.map((r) => r._id),
      ...caseRows.map((r) => r._id),
    ]);

    const balances = [...clinicsInvolved]
      .filter((clinic) => COLLAB_BRANCHES.includes(clinic))
      .map((clinic) => {
        const r = receivableBy.get(clinic);
        const p = payableBy.get(clinic);
        const c = caseBy.get(clinic);
        const outstandingReceivable = r?.outstandingReceivable || 0;
        const outstandingPayable = p?.outstandingPayable || 0;
        return {
          clinic,
          outstandingReceivable,
          outstandingPayable,
          totalReceivable: r?.totalReceivable || 0,
          totalPayable: p?.totalPayable || 0,
          receivableCount: r?.receivableCount || 0,
          payableCount: p?.payableCount || 0,
          netPosition: outstandingReceivable - outstandingPayable,
          openCaseCount: c?.openCaseCount || 0,
          caseCount: c?.caseCount || 0,
        };
      });

    balances.sort((a, b) => a.clinic.localeCompare(b.clinic));

    const totals = balances.reduce(
      (acc, b) => {
        acc.totalReceivable += b.outstandingReceivable;
        acc.totalPayable += b.outstandingPayable;
        return acc;
      },
      { totalReceivable: 0, totalPayable: 0 },
    );

    return NextResponse.json({ success: true, balances, ...totals });
  } catch (error) {
    console.error("Error building collab balances:", error);
    return NextResponse.json({ error: "Failed to fetch collab balances" }, { status: 500 });
  }
}
