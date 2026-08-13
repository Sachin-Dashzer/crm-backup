import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";
import Stock from "@/models/Stock";
import Leads from "@/models/Leads";
import Interviewer from "@/models/Interviewer";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All", from, to } = await req.json();

    // Client sends IST-bounded ISO strings — trust them directly (Vercel runs UTC)
    const fromDate = new Date(from);
    const toDate   = new Date(to);

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
        // Every branch below excludes UNSETTLED_METHODS — it's a total — EXCEPT byMethod,
        // which stays unfiltered on purpose (see the §2.4 report: totals hide the
        // paid_to_external/paid_by_other bucket, a breakdown BY method shows it).
        $facet: {
          totalAmount: [
            { $match: { method: { $nin: UNSETTLED_METHODS } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          medicineAmount: [
            { $match: { transactionCategory: "MEDICINE", method: { $nin: UNSETTLED_METHODS } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          techniqueWise: [
            { $match: { procedure: { $exists: true, $ne: null }, method: { $nin: UNSETTLED_METHODS } } },
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
            { $match: { method: { $nin: UNSETTLED_METHODS } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } },
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
          prpStats: [
            {
              $match: { procedure: { $in: ["PRP", "GFC"] }, method: { $nin: UNSETTLED_METHODS } },
            },
            {
              $group: {
                _id: "$procedure",
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

    // ── 6. Interview Stats ────────────────────────────────────────
    const interviewStatsPromise = Interviewer.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      {
        $facet: {
          total:     [{ $count: "count" }],
          selected:  [{ $match: { status: "Selected" } },  { $count: "count" }],
          rejected:  [{ $match: { status: "Rejected" } },  { $count: "count" }],
          scheduled: [{ $match: { status: "Interview Scheduled" } }, { $count: "count" }],
        },
      },
    ]);

    // ── Run all in parallel ───────────────────────────────────────
    const [patientAgg, revenueAgg, staffAgg, stockAgg, totalLeads, interviewAgg] =
      await Promise.all([
        patientStatsPromise,
        revenueStatsPromise,
        staffStatsPromise,
        stockStatsPromise,
        totalLeadsPromise,
        interviewStatsPromise,
      ]);

    const p   = patientAgg[0]   || {};
    const rv  = revenueAgg[0]   || {};
    const iv  = interviewAgg[0] || {};

    // Shape staff
    const staffBreakdown = {};
    staffAgg.forEach(({ _id, count }) => {
      if (_id) staffBreakdown[_id] = count;
    });
    const totalStaff = Object.values(staffBreakdown).reduce((a, b) => a + b, 0);

    // Fill per-day graph — include all days in range even if 0 revenue
    // Use IST date keys to match the $dateToString timezone: "Asia/Kolkata" output
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const toISTDateKey = (utcDate) =>
      new Date(utcDate.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

    const dayMs = 86400000;
    const perDayMap = {};
    (rv.perDay || []).forEach(({ _id, total }) => { perDayMap[_id] = total; });
    const perDayFilled = [];
    for (let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime() + dayMs)) {
      const key = toISTDateKey(d);
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
      // Interviews
      totalInterviews:     iv.total?.[0]?.count     ?? 0,
      selectedInterviews:  iv.selected?.[0]?.count  ?? 0,
      rejectedInterviews:  iv.rejected?.[0]?.count  ?? 0,
      scheduledInterviews: iv.scheduled?.[0]?.count ?? 0,
      // PRP & GFC
      prp: (() => {
        const prpStats = rv.prpStats || [];
        const prpRow   = prpStats.find((r) => r._id === "PRP");
        const gfcRow   = prpStats.find((r) => r._id === "GFC");
        return {
          prpSessions:   prpRow?.count || 0,
          prpRevenue:    prpRow?.total || 0,
          gfcSessions:   gfcRow?.count || 0,
          gfcRevenue:    gfcRow?.total || 0,
          totalSessions: (prpRow?.count || 0) + (gfcRow?.count || 0),
          totalRevenue:  (prpRow?.total || 0) + (gfcRow?.total || 0),
        };
      })(),
    });
  } catch (err) {
    console.error("Super-admin dashboard error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
