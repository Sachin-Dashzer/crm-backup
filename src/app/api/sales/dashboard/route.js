import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "@/constants/bankRouting";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getISTStartOfDay, getISTEndOfDay } from "@/lib/dateHelpers";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida", "Gurgaon"];
const CONVERTED_STATUSES = ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];
const CONTACTED_STATUSES = [
  "CONSULTED",
  "NOT_CONVERTED",
  "BOOKING_DONE",
  "SURGERY_BOOKED",
  "CLOSED",
];

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const data = await req.json();
    const branch = data.branch || "All";
    const from = data.from || data.dateFrom;
    const to = data.to || data.dateTo;

    if (!VALID_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 },
      );
    }

    const fromDate = from ? getISTStartOfDay(from) : getISTStartOfDay();
    const toDate = to ? getISTEndOfDay(to) : getISTEndOfDay();

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date provided" },
        { status: 400 },
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "From date cannot be after to date" },
        { status: 400 },
      );
    }

    const daysDifference =
      Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const comparisonEnd = new Date(fromDate.getTime() - 1);
    const comparisonStart = new Date(
      fromDate.getTime() - daysDifference * 24 * 60 * 60 * 1000,
    );

    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    const getPatientStats = async () => {
      try {
        const result = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              $or: [
                { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
                { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } },
              ],
            },
          },
          {
            $facet: {
              currentTotalLeads: [
                { $match: { "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
                { $count: "count" },
              ],
              currentBookingDone: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": "BOOKING_DONE",
                  },
                },
                { $count: "count" },
              ],
              currentSurgeryBooked: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": "SURGERY_BOOKED",
                  },
                },
                { $count: "count" },
              ],
              currentNewPatients: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": { $in: ["NEW", "NOT_VISITED"] },
                  },
                },
                { $count: "count" },
              ],
              currentContacted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": { $in: CONTACTED_STATUSES },
                  },
                },
                { $count: "count" },
              ],
              currentConverted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": { $in: CONVERTED_STATUSES },
                  },
                },
                { $count: "count" },
              ],
              currentNotConverted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "ops.status": "NOT_CONVERTED",
                  },
                },
                { $count: "count" },
              ],
              comparisonTotalLeads: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                  },
                },
                { $count: "count" },
              ],
              comparisonBookingDone: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": "BOOKING_DONE",
                  },
                },
                { $count: "count" },
              ],
              comparisonSurgeryBooked: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": "SURGERY_BOOKED",
                  },
                },
                { $count: "count" },
              ],
              comparisonNewPatients: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": { $in: ["NEW", "NOT_VISITED"] },
                  },
                },
                { $count: "count" },
              ],
              comparisonContacted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": { $in: CONTACTED_STATUSES },
                  },
                },
                { $count: "count" },
              ],
              comparisonConverted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": { $in: CONVERTED_STATUSES },
                  },
                },
                { $count: "count" },
              ],
              comparisonNotConverted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "ops.status": "NOT_CONVERTED",
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        return result[0] || {};
      } catch (error) {
        console.error("Error in getPatientStats:", error);
        return {};
      }
    };

    const getRevenueStats = async () => {
      try {
        const result = await Transactions.aggregate([
          {
            $match: {
              costType: "Revenue",
              ...(branch === "All" ? {} : { branch }),
              method: { $nin: UNSETTLED_METHODS },
              ...SETTLEMENT_EXCLUSION,
              $or: [
                { date: { $gte: fromDate, $lte: toDate } },
                { date: { $gte: comparisonStart, $lte: comparisonEnd } },
              ],
            },
          },
          {
            $facet: {
              current: [
                { $match: { date: { $gte: fromDate, $lte: toDate } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
              comparison: [
                {
                  $match: {
                    date: { $gte: comparisonStart, $lte: comparisonEnd },
                  },
                },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
            },
          },
        ]);

        return result[0] || {};
      } catch (error) {
        console.error("Error in getRevenueStats:", error);
        return {};
      }
    };

    const getAgentPerformance = async () => {
      try {
        const agentFilter = {
          role: "Agent",
          isactive: true,
          ...(branch === "All" ? {} : { branch }),
        };

        const activeAgents = await Employee.find(agentFilter)
          .select("name branch")
          .lean();

        if (!activeAgents.length) return [];

        const agentIds = activeAgents.map((a) => a._id);

        const agentStats = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              $or: [
                { "personal.reference": { $in: agentIds } },
                { "counselling.counsellor": { $in: agentIds } },
              ],
            },
          },
          {
            $project: {
              opsStatus: "$ops.status",
              matchedAgent: {
                $cond: [
                  { $in: ["$personal.reference", agentIds] },
                  "$personal.reference",
                  "$counselling.counsellor",
                ],
              },
            },
          },
          {
            $group: {
              _id: "$matchedAgent",
              totalLeads: { $sum: 1 },
              converted: {
                $sum: {
                  $cond: [{ $in: ["$opsStatus", CONVERTED_STATUSES] }, 1, 0],
                },
              },
            },
          },
        ]);

        const statsMap = new Map(
          agentStats.map((s) => [s._id.toString(), s]),
        );

        const leaderboard = activeAgents.map((agent) => {
          const stats = statsMap.get(agent._id.toString()) || {
            totalLeads: 0,
            converted: 0,
          };
          const rate =
            stats.totalLeads > 0
              ? Math.round((stats.converted / stats.totalLeads) * 100)
              : 0;
          return {
            name: agent.name,
            branch: agent.branch,
            totalLeads: stats.totalLeads,
            converted: stats.converted,
            conversionRate: rate,
          };
        });

        return leaderboard.sort(
          (a, b) =>
            b.converted - a.converted ||
            b.totalLeads - a.totalLeads ||
            b.conversionRate - a.conversionRate,
        );
      } catch (error) {
        console.error("Error in getAgentPerformance:", error);
        return [];
      }
    };

    const getActiveAgentsCount = async () => {
      try {
        return await Employee.countDocuments({
          role: "Agent",
          isactive: true,
          ...(branch === "All" ? {} : { branch }),
        });
      } catch (error) {
        console.error("Error in getActiveAgentsCount:", error);
        return 0;
      }
    };

    const getConversionCharts = async () => {
      try {
        const matchBase = {
          ...branchFilter,
          "personal.visitDate": { $gte: fromDate, $lte: toDate },
          "ops.status": { $in: CONVERTED_STATUSES },
        };

        const [pkgRaw, brRaw] = await Promise.all([
          // Package-wise: group by counselling.techniqueSuggested
          Patient.aggregate([
            { $match: matchBase },
            {
              $group: {
                _id: {
                  $cond: [
                    { $and: [{ $ne: ["$counselling.techniqueSuggested", null] }, { $ne: ["$counselling.techniqueSuggested", ""] }] },
                    "$counselling.techniqueSuggested",
                    "Unknown",
                  ],
                },
                value: { $sum: 1 },
              },
            },
            { $sort: { value: -1 } },
          ]),
          // Branch-wise: group by personal.branch
          Patient.aggregate([
            { $match: matchBase },
            {
              $group: {
                _id: {
                  $cond: [
                    { $and: [{ $ne: ["$personal.branch", null] }, { $ne: ["$personal.branch", ""] }] },
                    "$personal.branch",
                    "Unknown",
                  ],
                },
                value: { $sum: 1 },
              },
            },
            { $sort: { value: -1 } },
          ]),
        ]);

        const totalPkg = pkgRaw.reduce((s, r) => s + r.value, 0);
        const totalBr  = brRaw.reduce((s, r) => s + r.value, 0);

        const packageConversion = pkgRaw.map((r) => ({
          name: r._id,
          value: r.value,
          percentage: totalPkg > 0 ? Math.round((r.value / totalPkg) * 100) : 0,
        }));

        const branchConversion = brRaw.map((r) => ({
          name: r._id,
          value: r.value,
          percentage: totalBr > 0 ? Math.round((r.value / totalBr) * 100) : 0,
        }));

        return { packageConversion, branchConversion };
      } catch (error) {
        console.error("Error in getConversionCharts:", error);
        return { packageConversion: [], branchConversion: [] };
      }
    };

    const [patientStats, revenueStats, agentPerformance, conversionCharts, activeAgentsCount] =
      await Promise.allSettled([
        getPatientStats(),
        getRevenueStats(),
        getAgentPerformance(),
        getConversionCharts(),
        getActiveAgentsCount(),
      ]);

    const patientStatsResult =
      patientStats.status === "fulfilled" ? patientStats.value : {};
    const revenueStatsResult =
      revenueStats.status === "fulfilled" ? revenueStats.value : {};
    const agentPerformanceResult =
      agentPerformance.status === "fulfilled" ? agentPerformance.value : [];
    const conversionChartsResult =
      conversionCharts.status === "fulfilled"
        ? conversionCharts.value
        : { packageConversion: [], branchConversion: [] };
    const totalActiveAgents =
      activeAgentsCount.status === "fulfilled" ? activeAgentsCount.value : 0;

    const currentTotalLeads =
      patientStatsResult.currentTotalLeads?.[0]?.count || 0;
    const currentBookingDone =
      patientStatsResult.currentBookingDone?.[0]?.count || 0;
    const currentSurgeryBooked =
      patientStatsResult.currentSurgeryBooked?.[0]?.count || 0;
    const currentNewPatients =
      patientStatsResult.currentNewPatients?.[0]?.count || 0;
    const currentContacted =
      patientStatsResult.currentContacted?.[0]?.count || 0;
    const currentConverted =
      patientStatsResult.currentConverted?.[0]?.count || 0;
    const currentNotConverted =
      patientStatsResult.currentNotConverted?.[0]?.count || 0;
    const currentRevenue = revenueStatsResult.current?.[0]?.total || 0;

    const comparisonTotalLeads =
      patientStatsResult.comparisonTotalLeads?.[0]?.count || 0;
    const comparisonBookingDone =
      patientStatsResult.comparisonBookingDone?.[0]?.count || 0;
    const comparisonSurgeryBooked =
      patientStatsResult.comparisonSurgeryBooked?.[0]?.count || 0;
    const comparisonNewPatients =
      patientStatsResult.comparisonNewPatients?.[0]?.count || 0;
    const comparisonContacted =
      patientStatsResult.comparisonContacted?.[0]?.count || 0;
    const comparisonConverted =
      patientStatsResult.comparisonConverted?.[0]?.count || 0;
    const comparisonNotConverted =
      patientStatsResult.comparisonNotConverted?.[0]?.count || 0;
    const comparisonRevenue = revenueStatsResult.comparison?.[0]?.total || 0;

    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    const totalLeadsGrowth = calculateGrowth(
      currentTotalLeads,
      comparisonTotalLeads,
    );
    const bookingDoneGrowth = calculateGrowth(
      currentBookingDone,
      comparisonBookingDone,
    );
    const surgeryBookedGrowth = calculateGrowth(
      currentSurgeryBooked,
      comparisonSurgeryBooked,
    );
    const newPatientsGrowth = calculateGrowth(
      currentNewPatients,
      comparisonNewPatients,
    );
    const contactedGrowth = calculateGrowth(
      currentContacted,
      comparisonContacted,
    );
    const convertedGrowth = calculateGrowth(
      currentConverted,
      comparisonConverted,
    );
    const notConvertedGrowth = calculateGrowth(
      currentNotConverted,
      comparisonNotConverted,
    );
    const revenueGrowth = calculateGrowth(currentRevenue, comparisonRevenue);

    const conversionRate =
      currentTotalLeads > 0
        ? Math.round((currentConverted / currentTotalLeads) * 100)
        : 0;

    const response = {
      success: true,
      data: {
        totalAppointments: currentTotalLeads,
        totalLeads: currentTotalLeads,
        bookingDone: currentBookingDone,
        surgeryBooked: currentSurgeryBooked,
        converted: currentConverted,
        notConverted: currentNotConverted,
        newPatients: currentNewPatients,
        contacted: currentContacted,
        revenue: currentRevenue,
        totalRevenue: currentRevenue,
        activeAgents: totalActiveAgents,
        conversionRate: conversionRate,

        trends: {
          totalAppointments: totalLeadsGrowth,
          totalLeads: totalLeadsGrowth,
          bookingDone: bookingDoneGrowth,
          surgeryBooked: surgeryBookedGrowth,
          newPatients: newPatientsGrowth,
          contacted: contactedGrowth,
          converted: convertedGrowth,
          notConverted: notConvertedGrowth,
          revenue: revenueGrowth,
        },

        agentPerformance: agentPerformanceResult,
        packageConversion: conversionChartsResult.packageConversion,
        branchConversion: conversionChartsResult.branchConversion,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Admin Dashboard API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    );
  }
};

export const POST = withDB(handler);
