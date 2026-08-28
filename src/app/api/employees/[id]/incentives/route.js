import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Payable from "@/models/Payable";
import Transactions from "@/models/Transactions";
import { buildPayableAggregationStages } from "@/lib/payableAggregation";

const ALLOWED_ROLES = ["admin", "super-admin"];

// The employee-side mirror of Patient.incentives — a live aggregation over every patient, never a
// second stored copy (see src/models/Patient.js's header comment on the incentives array, and
// src/lib/incentiveDerivation.js). Returns every non-cancelled row this employee earned, who it
// was for, totals grouped by month and by purpose, and the outstanding balance across every
// Incentive payable this employee has (paid/pending computed live, same as everywhere else).
export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid employee ID" }, { status: 400 });
    }
    const employeeId = new mongoose.Types.ObjectId(id);

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")) : null;
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")) : null;
    const purpose = searchParams.get("purpose") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    // Index-friendly first match (patientSchema's incentives.employee+isCancelled index — a query
    // on just the employee half of a compound index still uses it) before $unwind explodes every
    // patient's array. Deliberately does NOT exclude cancelled rows — §3.4 shows them struck
    // through rather than hiding them, so the row listing below keeps them; only the totals
    // aggregations (byMonth/byPurpose, further down) exclude cancelled amounts.
    const preMatch = { "incentives.employee": employeeId };

    const rowMatch = { "incentives.employee": employeeId };
    if (purpose) rowMatch["incentives.purpose"] = purpose;
    if (month && year) {
      rowMatch["incentives.date"] = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    } else if (year) {
      rowMatch["incentives.date"] = { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
    }

    const basePipeline = [
      { $match: preMatch },
      { $unwind: "$incentives" },
      { $match: rowMatch },
      {
        $project: {
          _id: "$incentives._id",
          patientId: "$_id",
          patientName: "$personal.name",
          patientPhone: "$personal.phone",
          purpose: "$incentives.purpose",
          amount: "$incentives.amount",
          date: "$incentives.date",
          branch: "$incentives.branch",
          remarks: "$incentives.remarks",
          isCancelled: "$incentives.isCancelled",
          payableId: "$incentives.payableId",
        },
      },
      { $sort: { date: -1 } },
    ];

    const [rows, totalAgg, byMonth, byPurpose, outstandingPayables] = await Promise.all([
      Patient.aggregate([...basePipeline, { $skip: (page - 1) * limit }, { $limit: limit }]),
      Patient.aggregate([...basePipeline, { $count: "total" }]),
      // Grouped totals ignore the purpose/month/year filters above — they're the whole-history
      // breakdown the filters let you drill into, not a mirror of the current filtered view.
      Patient.aggregate([
        { $match: preMatch },
        { $unwind: "$incentives" },
        { $match: { "incentives.employee": employeeId, "incentives.isCancelled": { $ne: true } } },
        {
          $group: {
            _id: { month: { $month: "$incentives.date" }, year: { $year: "$incentives.date" } },
            total: { $sum: "$incentives.amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": -1, "_id.month": -1 } },
      ]),
      Patient.aggregate([
        { $match: preMatch },
        { $unwind: "$incentives" },
        { $match: { "incentives.employee": employeeId, "incentives.isCancelled": { $ne: true } } },
        { $group: { _id: "$incentives.purpose", total: { $sum: "$incentives.amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Payable.aggregate([
        {
          $match: {
            "payee.kind": "EMPLOYEE",
            "payee.refId": employeeId,
            purpose: "INCENTIVE",
            expenseSubType: "Incentive",
          },
        },
        ...buildPayableAggregationStages(Transactions.collection.name),
      ]),
    ]);

    const outstanding = outstandingPayables.reduce((sum, p) => sum + (p.pending || 0), 0);

    return NextResponse.json({
      success: true,
      rows,
      total: totalAgg[0]?.total || 0,
      page,
      limit,
      byMonth: byMonth.map((m) => ({ month: m._id.month, year: m._id.year, total: m.total, count: m.count })),
      byPurpose: byPurpose.map((p) => ({ purpose: p._id, total: p.total, count: p.count })),
      outstanding,
      payables: outstandingPayables,
    });
  } catch (error) {
    console.error("Error fetching employee incentives:", error);
    return NextResponse.json({ error: "Failed to fetch incentives" }, { status: 500 });
  }
}
