import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";
import Stock from "@/models/Stock";
import Leads from "@/models/Leads";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All", from, to } = await req.json();

    const fromDate = new Date(from);
    const toDate   = new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Branch filters
    const patientBranchFilter = branch === "All" ? {} : { "personal.branch": branch };
    const txBranchFilter      = branch === "All" ? {} : { branch };

    // ── 1. Patient Stats ──────────────────────────────────────────
    const patientStatsPromise = Patient.aggregate([
      { $facet: {
        appointments: [
          { $match: { ...patientBranchFilter, "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
          { $count: "count" },
        ],
        visited: [
          {
            $match: {
              ...patientBranchFilter,
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "counselling.counsellor": { $exists: true, $ne: null, $ne: "" },
            },
          },
          { $count: "count" },
        ],
        converted: [
          {
            $match: {
              ...patientBranchFilter,
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "counselling.readyForSurgery": true,
            },
          },
          { $count: "count" },
        ],
        notConverted: [
          {
            $match: {
              ...patientBranchFilter,
              "ops.status": "NOT_CONVERTED",
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
            },
          },
          { $count: "count" },
        ],
        surgeries: [
          {
            $match: {
              ...patientBranchFilter,
              "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
            },
          },
          { $count: "count" },
        ],
      }},
    ]);

    // ── 2. Revenue Stats ──────────────────────────────────────────
    const revenueStatsPromise = Transactions.aggregate([
      {
        $match: {
          ...txBranchFilter,
          costType: "Revenue",
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $facet: {
          totalAmount: [
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          medicineAmount: [
            { $match: { transactionCategory: "MEDICINE" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          techniqueWise: [
            { $match: { procedure: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: "$procedure",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            { $sort: { total: -1 } },
          ],
          perDay: [
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byMethod: [
            {
              $group: {
                _id: "$method",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // ── 3. Staff Stats ────────────────────────────────────────────
    const staffStatsPromise = Employee.aggregate([
      { $match: { isactive: true } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // ── 4. Stock Stats ────────────────────────────────────────────
    const stockQuery = branch === "All" ? {} : { location: branch };
    const stockStatsPromise = Stock.aggregate([
      { $match: stockQuery },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalQty:   { $sum: "$totalQuantity" },
          stockValue: { $sum: { $multiply: ["$totalQuantity", "$mrp"] } },
        },
      },
    ]);

    // ── 5. Total Leads (filtered by date range) ──────────────────
    const totalLeadsPromise = Leads.countDocuments({
      createdAt: { $gte: fromDate, $lte: toDate },
    });

    // ── Run all in parallel ───────────────────────────────────────
    const [patientAgg, revenueAgg, staffAgg, stockAgg, totalLeads] =
      await Promise.all([
        patientStatsPromise,
        revenueStatsPromise,
        staffStatsPromise,
        stockStatsPromise,
        totalLeadsPromise,
      ]);

    const p  = patientAgg[0] || {};
    const rv = revenueAgg[0]  || {};

    // Shape staff
    const staffBreakdown = {};
    staffAgg.forEach(({ _id, count }) => {
      if (_id) staffBreakdown[_id] = count;
    });
    const totalStaff = Object.values(staffBreakdown).reduce((a, b) => a + b, 0);

    // Fill per-day graph — include all days in range even if 0 revenue
    const dayMs = 86400000;
    const perDayMap = {};
    (rv.perDay || []).forEach(({ _id, total }) => { perDayMap[_id] = total; });
    const perDayFilled = [];
    for (let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime() + dayMs)) {
      const key = d.toISOString().slice(0, 10);
      perDayFilled.push({ date: key, total: perDayMap[key] || 0 });
    }

    return NextResponse.json({
      success: true,
      // Leads & Patients
      totalLeads,
      appointments:  p.appointments?.[0]?.count  ?? 0,
      visited:       p.visited?.[0]?.count        ?? 0,
      converted:     p.converted?.[0]?.count      ?? 0,
      notConverted:  p.notConverted?.[0]?.count   ?? 0,
      surgeries:     p.surgeries?.[0]?.count      ?? 0,
      // Revenue
      totalAmount:   rv.totalAmount?.[0]?.total    ?? 0,
      medicineAmount: rv.medicineAmount?.[0]?.total ?? 0,
      techniqueWise: (rv.techniqueWise || []).map(({ _id, total, count }) => ({
        procedure: _id || "Other",
        total,
        count,
      })),
      byMethod: (rv.byMethod || []).map(({ _id, total, count }) => ({
        method: _id || "other",
        total,
        count,
      })),
      perDay: perDayFilled,
      // Stock
      totalStockItems: stockAgg[0]?.totalItems ?? 0,
      totalStockValue: stockAgg[0]?.stockValue  ?? 0,
      totalStockQty:   stockAgg[0]?.totalQty    ?? 0,
      // Staff
      totalStaff,
      staffBreakdown,
    });
  } catch (err) {
    console.error("Super-admin dashboard error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
