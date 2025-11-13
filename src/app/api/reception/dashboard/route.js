import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad"];

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

    // ✅ Date range setup - matching sales dashboard
    const today = new Date();
    const fromDate = from ? new Date(from) : new Date(today);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(to) : new Date(today);
    toDate.setHours(23, 59, 59, 999);

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

    // ✅ Calculate comparison period (same duration as selected range, but previous period)
    const daysDifference =
      Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    const comparisonEnd = new Date(fromDate);
    comparisonEnd.setDate(comparisonEnd.getDate() - 1);
    comparisonEnd.setHours(23, 59, 59, 999);

    const comparisonStart = new Date(comparisonEnd);
    comparisonStart.setDate(comparisonStart.getDate() - (daysDifference - 1));
    comparisonStart.setHours(0, 0, 0, 0);

    // ✅ Centralized filter objects
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    // ✅ Get current period stats
    const getCurrentStats = async () => {
      const [
        todayAppointments,
        todayVisits,
        pendingAppointments,
        totalPatients,
        revenueData,
        recentPatients,
        upcomingAppointments,
      ] = await Promise.all([
        // Today's appointments
        Patient.countDocuments({
          ...branchFilter,
          "personal.visitDate": {
            $gte: fromDate,
            $lte: toDate,
          },
        }),

        // Today's visits (patients who have been counselled)
        Patient.countDocuments({
          ...branchFilter,
          "personal.visitDate": {
            $gte: fromDate,
            $lte: toDate,
          },
          "counselling.counsellor": { $exists: true, $ne: null },
        }),

        Patient.countDocuments({
          ...branchFilter,
          "personal.visitDate": { $gte: fromDate, $lte: toDate },
          "counselling.counsellor": { $in: [null, undefined] },
        }),
        // Total patients (within date range)
        Patient.countDocuments({
          ...branchFilter,
          "personal.visitDate": {
            $gte: fromDate,
            $lte: toDate,
          },
        }),

        // Today's revenue
        Transactions.aggregate([
          {
            $match: {
              costType: "Revenue",
              date: {
                $gte: fromDate,
                $lte: toDate,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]),

        // Recent patients (last 5 within date range)
        Patient.find({
          ...branchFilter,
          "personal.visitDate": {
            $gte: fromDate,
            $lte: toDate,
          },
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("personal ops"),

        // Upcoming appointments (next 5 days from selected range)
        Patient.find({
          ...branchFilter,
          "personal.visitDate": {
            $gte: fromDate,
            $lte: new Date(toDate.getTime() + 5 * 24 * 60 * 60 * 1000), // +5 days
          },
          "ops.status": "NEW",
        })
          .sort({ "personal.visitDate": 1 })
          .limit(5)
          .select("personal"),
      ]);

      return {
        todayAppointments,
        todayVisits,
        pendingAppointments,
        totalPatients,
        todayRevenue: revenueData[0]?.total || 0,
        recentPatients,
        upcomingAppointments,
      };
    };

    // ✅ Get comparison period stats
    const getComparisonStats = async () => {
      const [comparisonAppointments, comparisonVisits, comparisonRevenueData] =
        await Promise.all([
          Patient.countDocuments({
            ...branchFilter,
            "personal.visitDate": {
              $gte: comparisonStart,
              $lte: comparisonEnd,
            },
          }),

          Patient.countDocuments({
            ...branchFilter,
            "personal.visitDate": {
              $gte: comparisonStart,
              $lte: comparisonEnd,
            },
            "counselling.counsellor": { $exists: true, $ne: null },
          }),

          Transactions.aggregate([
            {
              $match: {
                costType: "Revenue",
                date: {
                  $gte: comparisonStart,
                  $lte: comparisonEnd,
                },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$amount" },
              },
            },
          ]),
        ]);

      return {
        appointments: comparisonAppointments,
        visits: comparisonVisits,
        revenue: comparisonRevenueData[0]?.total || 0,
      };
    };

    // ✅ Calculate growth percentage
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0) return current > 0 ? 100 : 0;
      return Number((((current - comparison) / comparison) * 100).toFixed(2));
    };

    // ✅ Execute all queries in parallel
    const [currentStats, comparisonStats] = await Promise.all([
      getCurrentStats(),
      getComparisonStats(),
    ]);

    // ✅ Prepare final response
    return NextResponse.json({
      success: true,
      data: {
        ...currentStats,
        trends: {
          appointments: calculateGrowth(
            currentStats.todayAppointments,
            comparisonStats.appointments
          ),
          visits: calculateGrowth(
            currentStats.todayVisits,
            comparisonStats.visits
          ),
          revenue: calculateGrowth(
            currentStats.todayRevenue,
            comparisonStats.revenue
          ),
        },
        dateRange: {
          from: fromDate.toISOString().split("T")[0],
          to: toDate.toISOString().split("T")[0],
          comparisonPeriod: {
            from: comparisonStart.toISOString().split("T")[0],
            to: comparisonEnd.toISOString().split("T")[0],
          },
        },
        branch,
      },
    });
  } catch (error) {
    console.error("Reception dashboard error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);
