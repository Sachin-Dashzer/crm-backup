import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { COLLAB_BRANCHES } from "@/lib/branches";


const VALID_BRANCHES = ["All", ...COLLAB_BRANCHES];

// Improved date helpers that work consistently across timezones
const getISTStartOfDay = (date = null) => {
  const d = date ? new Date(date) : new Date();
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();

  // Return as UTC date that represents IST start of day
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
};

const getISTEndOfDay = (date = null) => {
  const d = date ? new Date(date) : new Date();

  // Create date in IST timezone (UTC+5:30)
  const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const year = istDate.getFullYear();
  const month = istDate.getMonth();
  const day = istDate.getDate();

  // Return as UTC date that represents IST end of day
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
};

const handler = async (req) => {
  try {

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. Please login.",
        },
        { status: 401 }
      );
    }

    const data = await req.json();
    const { branch: requestedBranch = "All" } = data;
    const { from, to } = data;

    // Collab users always see the 8 collab-city set (shared panel), optionally
    // narrowed to one specific city via the branch selector.
    const branch = requestedBranch !== "All" && COLLAB_BRANCHES.includes(requestedBranch)
      ? requestedBranch
      : "All";

    if (!VALID_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 }
      );
    }

    // Use consistent IST timezone for date calculations
    const fromDate = from ? getISTStartOfDay(from) : getISTStartOfDay();
    const toDate = to ? getISTEndOfDay(to) : getISTEndOfDay();


    // Validate dates
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

    // Calculate comparison period (previous period for trends)
    const daysDifference = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    const comparisonEnd = new Date(fromDate);
    comparisonEnd.setDate(comparisonEnd.getDate() - 1);
    comparisonEnd.setHours(23, 59, 59, 999);

    const comparisonStart = new Date(comparisonEnd);
    comparisonStart.setDate(comparisonStart.getDate() - (daysDifference - 1));
    comparisonStart.setHours(0, 0, 0, 0);


    // Branch filter — "All" here means "all 8 collab cities"
    const branchFilter = branch === "All"
      ? { "personal.branch": { $in: COLLAB_BRANCHES } }
      : { "personal.branch": branch };
    const txBranchFilter = branch === "All"
      ? { branch: { $in: COLLAB_BRANCHES } }
      : { branch };

    // Get patient statistics
    const getPatientStats = async () => {
      try {

        const result = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              $or: [
                { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
                { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } }
              ],
            },
          },
          {
            $facet: {
              currentAppointments: [
                { $match: { "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
                { $count: "count" },
              ],
              currentVisited: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "counselling.counsellor": { $exists: true, $ne: null, $ne: "" },
                  },
                },
                { $count: "count" },
              ],
              currentPending: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    $or: [
                      { "counselling.counsellor": { $exists: false } },
                      { "counselling.counsellor": null },
                      { "counselling.counsellor": "" }
                    ]
                  },
                },
                { $count: "count" },
              ],
              comparisonAppointments: [
                { $match: { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } } },
                { $count: "count" },
              ],
              comparisonVisited: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "counselling.counsellor": { $exists: true, $ne: null, $ne: "" },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        return result[0] || {};
      } catch (error) {
        console.error('Error in getPatientStats:', error);
        return {};
      }
    };

    // Get revenue statistics
    const getRevenueStats = async () => {
      try {

        const result = await Transactions.aggregate([
          {
            $match: {
              costType: "Revenue",
              ...txBranchFilter,
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
                { $match: { date: { $gte: comparisonStart, $lte: comparisonEnd } } },
                { $group: { _id: null, total: { $sum: "$amount" } } },
              ],
            },
          },
        ]);

        return result[0] || {};
      } catch (error) {
        console.error('Error in getRevenueStats:', error);
        return {};
      }
    };

    // Get recent patients - Safe approach for Vercel
    const getRecentPatients = async () => {
      try {
        const patients = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              $expr: {
                $and: [
                  { $ne: ["$counselling.counsellor", null] },
                  { $ne: ["$counselling.counsellor", ""] },
                  { $ne: ["$counselling.counsellor", undefined] }
                ]
              }
            }
          },
          {
            $project: {
              "personal.name": 1,
              "personal.phone": 1,
              "personal.branch": 1,
              "ops.status": 1,
              "counselling.counsellor": 1,
              "personal.visitDate": 1
            }
          },
          {
            $sort: { "personal.visitDate": -1 }
          },
          {
            $limit: 5
          }
        ]);

        return patients;
      } catch (error) {
        console.error('Error in getRecentPatients:', error);
        return [];
      }
    };

    // Get upcoming appointments
    const getUpcomingAppointments = async () => {
      try {
        const now = new Date(); // Current server time (UTC)
        const endOfDay = getISTEndOfDay();


        const appointments = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              "personal.visitDate": { $gt: now, $lte: endOfDay }
            }
          },
          {
            $addFields: {
              status: {
                $ifNull: ["$ops.status", "NEW"]
              }
            }
          },
          {
            $match: {
              status: { $in: ["NEW", "NOT_VISITED"] }
            }
          },
          {
            $project: {
              "personal.name": 1,
              "personal.visitDate": 1,
              "personal.branch": 1,
              "ops.status": 1
            }
          },
          {
            $sort: { "personal.visitDate": 1 }
          },
          {
            $limit: 5
          }
        ]);

        return appointments;
      } catch (error) {
        return [];
      }
    };

    // Get converted patients — visited in the period AND have at least one transaction
    const getConvertedStats = async () => {
      try {
        const result = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              $or: [
                { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
                { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } },
              ],
              $expr: { $gt: [{ $size: { $ifNull: ["$payments.transactions", []] } }, 0] },
            },
          },
          {
            $facet: {
              current: [
                { $match: { "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
                { $count: "count" },
              ],
              comparison: [
                { $match: { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } } },
                { $count: "count" },
              ],
            },
          },
        ]);
        return result[0] || {};
      } catch (error) {
        console.error('Error in getConvertedStats:', error);
        return {};
      }
    };

    // Execute all queries in parallel with error handling
    const [patientStats, revenueStats, recentPatients, upcomingAppointments, convertedStats] = await Promise.allSettled([
      getPatientStats(),
      getRevenueStats(),
      getRecentPatients(),
      getUpcomingAppointments(),
      getConvertedStats(),
    ]);

    // Handle promise results with safe defaults
    const patientStatsResult = patientStats.status === 'fulfilled' ? patientStats.value : {};
    const revenueStatsResult = revenueStats.status === 'fulfilled' ? revenueStats.value : {};
    const recentPatientsResult = recentPatients.status === 'fulfilled' ? recentPatients.value : [];
    const upcomingAppointmentsResult = upcomingAppointments.status === 'fulfilled' ? upcomingAppointments.value : [];
    const convertedStatsResult = convertedStats.status === 'fulfilled' ? convertedStats.value : {};

    // Process stats with safe defaults
    const currentAppointments = patientStatsResult.currentAppointments?.[0]?.count || 0;
    const currentVisited = patientStatsResult.currentVisited?.[0]?.count || 0;
    const currentPending = patientStatsResult.currentPending?.[0]?.count || 0;
    const comparisonAppointments = patientStatsResult.comparisonAppointments?.[0]?.count || 0;
    const comparisonVisited = patientStatsResult.comparisonVisited?.[0]?.count || 0;
    const currentRevenue = revenueStatsResult.current?.[0]?.total || 0;
    const comparisonRevenue = revenueStatsResult.comparison?.[0]?.total || 0;
    const currentConverted = convertedStatsResult.current?.[0]?.count || 0;
    const comparisonConverted = convertedStatsResult.comparison?.[0]?.count || 0;

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    const appointmentsGrowth = calculateGrowth(currentAppointments, comparisonAppointments);
    const visitsGrowth = calculateGrowth(currentVisited, comparisonVisited);
    const revenueGrowth = calculateGrowth(currentRevenue, comparisonRevenue);
    const convertedGrowth = calculateGrowth(currentConverted, comparisonConverted);

    // Prepare final response
    const response = {
      success: true,
      data: {
        todayAppointments: currentAppointments,
        todayVisits: currentVisited,
        pendingAppointments: currentPending,
        convertedPatients: currentConverted,
        totalPatients: currentAppointments,
        todayRevenue: currentRevenue,
        recentPatients: recentPatientsResult,
        upcomingAppointments: upcomingAppointmentsResult,
        trends: {
          appointments: appointmentsGrowth,
          visits: visitsGrowth,
          revenue: revenueGrowth,
          converted: convertedGrowth,
        },
        activeBranch: branch,
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Collab Dashboard API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message
      },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);
