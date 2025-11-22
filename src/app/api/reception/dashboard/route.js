import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { 
  getISTStartOfDay, 
  getISTEndOfDay, 
  formatISTDate, 
  logDateInfo 
} from "@/lib/dateHelpers.js";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad"];

const handler = async (req) => {
  try {
    console.log('Reception Dashboard API called');
    
    const data = await req.json();
    const { branch = "All", from, to } = data;

    console.log('Request data:', { branch, from, to });

    // Validate branch
    if (!VALID_BRANCHES.includes(branch)) {
      console.error('Invalid branch:', branch);
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 }
      );
    }

    // Use IST timezone for date calculations
    const fromDate = from ? getISTStartOfDay(from) : getISTStartOfDay();
    const toDate = to ? getISTEndOfDay(to) : getISTEndOfDay();

    // Debug logging
    console.log('Date range:', {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromIST: formatISTDate(fromDate),
      toIST: formatISTDate(toDate)
    });

    // Validate dates
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      console.error('Invalid dates:', { fromDate, toDate });
      return NextResponse.json(
        { error: "Invalid date provided" },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      console.error('From date after to date:', { fromDate, toDate });
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

    console.log('Comparison period:', {
      comparisonStart: comparisonStart.toISOString(),
      comparisonEnd: comparisonEnd.toISOString()
    });

    // Branch filter
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    // Get patient statistics - FIXED: Handle empty string counsellor values
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
              // Current period
              currentAppointments: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  },
                },
                { $count: "count" },
              ],
              currentVisited: [
                {
                  $match: {
                    "personal.visitDate": { $gte: fromDate, $lte: toDate },
                    "counselling.counsellor": { 
                      $exists: true, 
                      $ne: null, 
                      $ne: "" 
                    },
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
              // Comparison period
              comparisonAppointments: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                  },
                },
                { $count: "count" },
              ],
              comparisonVisited: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "counselling.counsellor": { 
                      $exists: true, 
                      $ne: null, 
                      $ne: "" 
                    },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        console.log('Patient stats result:', JSON.stringify(result, null, 2));
        return result[0] || {};
      } catch (error) {
        console.error('Error in getPatientStats:', error);
        throw error;
      }
    };

    // Get revenue statistics
    const getRevenueStats = async () => {
      try {
        const result = await Transactions.aggregate([
          {
            $match: {
              costType: "Revenue",
              ...(branch === "All" ? {} : { branch }),
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

        console.log('Revenue stats result:', JSON.stringify(result, null, 2));
        return result[0] || {};
      } catch (error) {
        console.error('Error in getRevenueStats:', error);
        throw error;
      }
    };

    // Get recent patients - FIXED: Handle ObjectId casting issues
    const getRecentPatients = async () => {
      try {
        // First, let's check what counsellor values actually exist
        const counsellorStats = await Patient.aggregate([
          {
            $match: {
              ...branchFilter,
              "personal.visitDate": { $gte: fromDate, $lte: toDate }
            }
          },
          {
            $project: {
              counsellorType: { $type: "$counselling.counsellor" },
              counsellorValue: "$counselling.counsellor",
              hasCounsellor: {
                $and: [
                  { $ne: ["$counselling.counsellor", null] },
                  { $ne: ["$counselling.counsellor", ""] },
                  { $ne: ["$counselling.counsellor", undefined] }
                ]
              }
            }
          },
          {
            $group: {
              _id: "$counsellorType",
              count: { $sum: 1 },
              sampleValues: { $push: "$counsellorValue" }
            }
          }
        ]);

        console.log('Counsellor field analysis:', JSON.stringify(counsellorStats, null, 2));

        // Use a safer query that avoids ObjectId casting issues
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
            $addFields: {
              counsellorString: { $toString: "$counselling.counsellor" }
            }
          },
          {
            $match: {
              counsellorString: { $ne: "" }
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

        console.log('Recent patients count:', patients.length);
        return patients;
      } catch (error) {
        console.error('Error in getRecentPatients:', error);
        // Return empty array instead of failing completely
        return [];
      }
    };

    // Get upcoming appointments - FIXED: Handle status field properly
    const getUpcomingAppointments = async () => {
      try {
        const now = new Date();
        const endOfDay = getISTEndOfDay();
        
        // Use aggregation to handle potential missing status fields
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

        console.log('Upcoming appointments count:', appointments.length);
        return appointments;
      } catch (error) {
        console.error('Error in getUpcomingAppointments:', error);
        // Return empty array instead of failing completely
        return [];
      }
    };

    // Execute all queries in parallel with error handling
    const [patientStats, revenueStats, recentPatients, upcomingAppointments] = await Promise.allSettled([
      getPatientStats(),
      getRevenueStats(),
      getRecentPatients(),
      getUpcomingAppointments()
    ]);

    // Handle promise results
    const patientStatsResult = patientStats.status === 'fulfilled' ? patientStats.value : {};
    const revenueStatsResult = revenueStats.status === 'fulfilled' ? revenueStats.value : {};
    const recentPatientsResult = recentPatients.status === 'fulfilled' ? recentPatients.value : [];
    const upcomingAppointmentsResult = upcomingAppointments.status === 'fulfilled' ? upcomingAppointments.value : [];

    // Process patient stats with safe defaults
    const currentAppointments = patientStatsResult.currentAppointments?.[0]?.count || 0;
    const currentVisited = patientStatsResult.currentVisited?.[0]?.count || 0;
    const currentPending = patientStatsResult.currentPending?.[0]?.count || 0;
    const comparisonAppointments = patientStatsResult.comparisonAppointments?.[0]?.count || 0;
    const comparisonVisited = patientStatsResult.comparisonVisited?.[0]?.count || 0;
    const currentRevenue = revenueStatsResult.current?.[0]?.total || 0;
    const comparisonRevenue = revenueStatsResult.comparison?.[0]?.total || 0;

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    const appointmentsGrowth = calculateGrowth(currentAppointments, comparisonAppointments);
    const visitsGrowth = calculateGrowth(currentVisited, comparisonVisited);
    const revenueGrowth = calculateGrowth(currentRevenue, comparisonRevenue);

    // Prepare response matching the frontend expected structure
    const response = {
      success: true,
      data: {
        todayAppointments: currentAppointments,
        todayVisits: currentVisited,
        pendingAppointments: currentPending,
        totalPatients: currentAppointments, // Using appointments as total patients for now
        todayRevenue: currentRevenue,
        recentPatients: recentPatientsResult,
        upcomingAppointments: upcomingAppointmentsResult,
        trends: {
          appointments: appointmentsGrowth,
          visits: visitsGrowth,
          revenue: revenueGrowth,
        },
      },
    };

    console.log('API response prepared successfully');
    return NextResponse.json(response);

  } catch (error) {
    console.error("Reception Dashboard API error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error", 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);