import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida"];

const handler = async (req) => {
  try {
    const data = await req.json();
    const { branch = "All", from, to } = data;

    // ✅ Validate branch
    if (!VALID_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 }
      );
    }

    // ✅ Parse dates from ISO strings (already include proper time boundaries)
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date provided" },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "From date cannot be after to date" },
        { status: 400 }
      );
    }

    // ✅ Calculate the number of days in the selected range
    const daysDifference =
      Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    // ✅ Calculate comparison period (previous period of same duration)
    const yesterdayEnd = new Date(fromDate);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(yesterdayEnd);
    yesterdayStart.setDate(yesterdayStart.getDate() - (daysDifference - 1));
    yesterdayStart.setHours(0, 0, 0, 0);

    // ✅ Last 7 and 30 days (always relative to actual today)
    const actualToday = new Date();
    actualToday.setHours(23, 59, 59, 999);

    const last7DaysStart = new Date(actualToday);
    last7DaysStart.setDate(actualToday.getDate() - 6);
    last7DaysStart.setHours(0, 0, 0, 0);

    const last30DaysStart = new Date(actualToday);
    last30DaysStart.setDate(actualToday.getDate() - 29);
    last30DaysStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(actualToday.getFullYear(), actualToday.getMonth(), 1, 0, 0, 0, 0);

    // ✅ Centralized filter objects
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };
    const branchFilterTx = branch === "All" ? {} : { branch: branch };

    // ✅ OPTIMIZED: Single aggregation for all patient counts (current period & comparison period)
    const getPatientStats = async () => {
      const result = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
              {
                "personal.visitDate": {
                  $gte: yesterdayStart,
                  $lte: yesterdayEnd,
                },
              },
              { "surgery.surgeryDate": { $gte: fromDate, $lte: toDate } },
              {
                "surgery.surgeryDate": {
                  $gte: yesterdayStart,
                  $lte: yesterdayEnd,
                },
              },
            ],
          },
        },
        {
          $facet: {
            // Current period counts
            currentAppointments: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                },
              },
              { $count: "count" },
            ],
            currentVisits: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.counsellor": {
                    $exists: true,
                    $ne: "",
                    $ne: null,
                  },
                },
              },
              { $count: "count" },
            ],
            currentReadyForSurgery: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.counsellor": {
                    $exists: true,
                    $ne: "",
                    $ne: null,
                  },
                  "payments.transactions": { $exists: true, $ne: [] },
                },
              },
              { $count: "count" },
            ],
            currentSurgeries: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                },
              },
              { $count: "count" },
            ],
            // Comparison period counts (previous period of same duration)
            comparisonAppointments: [
              {
                $match: {
                  "personal.visitDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                },
              },
              { $count: "count" },
            ],
            comparisonVisits: [
              {
                $match: {
                  "personal.visitDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                  "counselling.counsellor": { $exists: true, $ne: "" },
                },
              },
              { $count: "count" },
            ],
            comparisonReadyForSurgery: [
              {
                $match: {
                  "personal.visitDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                  "counselling.readyForSurgery": true,
                },
              },
              { $count: "count" },
            ],
            comparisonSurgeries: [
              {
                $match: {
                  "surgery.surgeryDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]);

      return {
        current: {
          appointments: result[0]?.currentAppointments[0]?.count || 0,
          visits: result[0]?.currentVisits[0]?.count || 0,
          readyForSurgery: result[0]?.currentReadyForSurgery[0]?.count || 0,
          surgeries: result[0]?.currentSurgeries[0]?.count || 0,
        },
        comparison: {
          appointments: result[0]?.comparisonAppointments[0]?.count || 0,
          visits: result[0]?.comparisonVisits[0]?.count || 0,
          readyForSurgery: result[0]?.comparisonReadyForSurgery[0]?.count || 0,
          surgeries: result[0]?.comparisonSurgeries[0]?.count || 0,
        },
      };
    };

    // ✅ OPTIMIZED: Single aggregation for all revenue data
    const getRevenueStats = async () => {
      const result = await Transactions.aggregate([
        {
          $match: {
            costType: "Revenue",
            ...branchFilterTx,
            $or: [
              { date: { $gte: fromDate, $lte: toDate } },
              { date: { $gte: yesterdayStart, $lte: yesterdayEnd } },
              { date: { $gte: last7DaysStart, $lte: actualToday } },
              { date: { $gte: last30DaysStart, $lte: actualToday } },
              { date: { $gte: thisMonthStart, $lte: actualToday } },
            ],
          },
        },
        {
          $facet: {
            // Current period revenue
            currentTotal: [
              { $match: { date: { $gte: fromDate, $lte: toDate } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            currentByTechnique: [
              { $match: { date: { $gte: fromDate, $lte: toDate } } },
              {
                $group: {
                  _id: "$procedure",
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            // Comparison period revenue
            comparisonTotal: [
              {
                $match: { date: { $gte: yesterdayStart, $lte: yesterdayEnd } },
              },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            // Last 7 days
            last7DaysTotal: [
              { $match: { date: { $gte: last7DaysStart, $lte: actualToday } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            last7DaysByMethod: [
              { $match: { date: { $gte: last7DaysStart, $lte: actualToday } } },
              {
                $group: {
                  _id: "$method",
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            last7DaysPerDay: [
              { $match: { date: { $gte: last7DaysStart, $lte: actualToday } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                  total: { $sum: "$amount" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            // Last 30 days
            last30DaysTotal: [
              {
                $match: { date: { $gte: last30DaysStart, $lte: actualToday } },
              },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            last30DaysByMethod: [
              {
                $match: { date: { $gte: last30DaysStart, $lte: actualToday } },
              },
              {
                $group: {
                  _id: "$method",
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            last30DaysPerDay: [
              {
                $match: { date: { $gte: last30DaysStart, $lte: actualToday } },
              },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                  total: { $sum: "$amount" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            // This month
            thisMonthTotal: [
              { $match: { date: { $gte: thisMonthStart, $lte: actualToday } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
            thisMonthByMethod: [
              { $match: { date: { $gte: thisMonthStart, $lte: actualToday } } },
              {
                $group: {
                  _id: "$method",
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
            thisMonthPerDay: [
              { $match: { date: { $gte: thisMonthStart, $lte: actualToday } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                  total: { $sum: "$amount" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            // PRP & GFC stats for the selected period
            prpStats: [
              {
                $match: {
                  date: { $gte: fromDate, $lte: toDate },
                  procedure: { $in: ["PRP", "GFC"] },
                },
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

      return result[0];
    };

    // ✅ Execute both aggregations in parallel
    const [patientStats, revenueStats] = await Promise.all([
      getPatientStats(),
      getRevenueStats(),
    ]);

    // ✅ Calculate growth percentage
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0) return current > 0 ? 100 : 0;
      return Number((((current - comparison) / comparison) * 100).toFixed(2));
    };

    // ✅ Helper formatters
    const formatRevenueData = (data) =>
      data.map((item) => ({
        method: item._id || "Unknown",
        total: item.total || 0,
        count: item.count || 0,
      }));

    const formatDailyRevenue = (data) =>
      data.map((item) => ({
        date: item._id,
        total: item.total || 0,
      }));

    // ✅ Extract revenue values
    const currentRevenue = revenueStats.currentTotal[0]?.total || 0;
    const comparisonRevenue = revenueStats.comparisonTotal[0]?.total || 0;

    // ✅ Prepare final response
    return NextResponse.json({
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        comparisonPeriod: {
          from: yesterdayStart.toISOString(),
          to: yesterdayEnd.toISOString(),
        },
      },
      branch,

      // Patient stats with growth percentage
      appointment: {
        count: patientStats.current.appointments,
        growth: calculateGrowth(
          patientStats.current.appointments,
          patientStats.comparison.appointments
        ),
      },
      visitPatient: {
        count: patientStats.current.visits,
        growth: calculateGrowth(
          patientStats.current.visits,
          patientStats.comparison.visits
        ),
      },
      readyforSurgery: {
        count: patientStats.current.readyForSurgery,
        growth: calculateGrowth(
          patientStats.current.readyForSurgery,
          patientStats.comparison.readyForSurgery
        ),
      },
      surgeryPatient: {
        count: patientStats.current.surgeries,
        growth: calculateGrowth(
          patientStats.current.surgeries,
          patientStats.comparison.surgeries
        ),
      },

      // Revenue with growth percentage
      amountReceived: {
        total: currentRevenue,
        growth: calculateGrowth(currentRevenue, comparisonRevenue),
      },
      amountByTechnique: formatRevenueData(revenueStats.currentByTechnique),

      // Last 7 days
      last7Days: {
        total: revenueStats.last7DaysTotal[0]?.total || 0,
        amountByMethod: formatRevenueData(revenueStats.last7DaysByMethod),
        perDay: formatDailyRevenue(revenueStats.last7DaysPerDay),
      },

      // Last 30 days
      last30Days: {
        total: revenueStats.last30DaysTotal[0]?.total || 0,
        amountByMethod: formatRevenueData(revenueStats.last30DaysByMethod),
        perDay: formatDailyRevenue(revenueStats.last30DaysPerDay),
      },

      // This month
      thisMonth: {
        total: revenueStats.thisMonthTotal[0]?.total || 0,
        amountByMethod: formatRevenueData(revenueStats.thisMonthByMethod),
        perDay: formatDailyRevenue(revenueStats.thisMonthPerDay),
      },

      // PRP & GFC
      prp: (() => {
        const prpRow = revenueStats.prpStats?.find((r) => r._id === "PRP");
        const gfcRow = revenueStats.prpStats?.find((r) => r._id === "GFC");
        return {
          prpSessions:  prpRow?.count   || 0,
          prpRevenue:   prpRow?.total   || 0,
          gfcSessions:  gfcRow?.count   || 0,
          gfcRevenue:   gfcRow?.total   || 0,
          totalSessions: (prpRow?.count || 0) + (gfcRow?.count || 0),
          totalRevenue:  (prpRow?.total || 0) + (gfcRow?.total || 0),
        };
      })(),
    });
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);
