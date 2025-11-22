import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import { 
  getISTStartOfDay, 
  getISTEndOfDay, 
  formatISTDate,
  getISTDate 
} from "@/lib/dateHelpers.js";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad"];

const handler = async (req) => {
  try {
    const data = await req.json();
    const { branch = "All", from, to } = data;

    // Validate branch
    if (!VALID_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 }
      );
    }

    // Use IST timezone for date calculations
    const fromDate = from ? getISTStartOfDay(from) : getISTStartOfDay();
    const toDate = to ? getISTEndOfDay(to) : getISTEndOfDay();

    console.log('Surgery Dashboard Date Range:', {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromIST: formatISTDate(fromDate),
      toIST: formatISTDate(toDate)
    });

    // Calculate comparison period
    const daysDifference = Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    
    const yesterdayEnd = new Date(fromDate);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(yesterdayEnd);
    yesterdayStart.setDate(yesterdayStart.getDate() - (daysDifference - 1));
    yesterdayStart.setHours(0, 0, 0, 0);

    // Branch filter
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    // Get surgery statistics
    const getSurgeryStats = async () => {
      const result = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "surgery.surgeryDate": { $gte: fromDate, $lte: toDate } },
              { "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd } },
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } }
            ],
          },
        },
        {
          $facet: {
            // Current period
            currentScheduled: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                  "surgery.doctor": { $exists: false }
                },
              },
              { $count: "count" },
            ],
            currentCompleted: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                  "surgery.doctor": { $exists: true, $ne: null }
                },
              },
              { $count: "count" },
            ],
            currentPending: [
              {
                $match: {
                  "counselling.readyForSurgery": true,
                  "surgery.surgeryDate": { $exists: false },
                  "personal.visitDate": { $lte: toDate }
                },
              },
              { $count: "count" },
            ],
            // Total grafts for current period
            currentGrafts: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                  "surgery.graftsImplanted": { $exists: true }
                },
              },
              {
                $group: {
                  _id: null,
                  totalGrafts: { $sum: "$surgery.graftsImplanted" },
                  avgGrafts: { $avg: "$surgery.graftsImplanted" }
                }
              }
            ],
            // Comparison period
            comparisonScheduled: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "surgery.doctor": { $exists: false }
                },
              },
              { $count: "count" },
            ],
            comparisonCompleted: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "surgery.doctor": { $exists: true, $ne: null }
                },
              },
              { $count: "count" },
            ],
            comparisonGrafts: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "surgery.graftsImplanted": { $exists: true }
                },
              },
              {
                $group: {
                  _id: null,
                  totalGrafts: { $sum: "$surgery.graftsImplanted" }
                }
              }
            ],
          },
        },
      ]);

      return {
        current: {
          scheduled: result[0]?.currentScheduled[0]?.count || 0,
          completed: result[0]?.currentCompleted[0]?.count || 0,
          pending: result[0]?.currentPending[0]?.count || 0,
          totalGrafts: result[0]?.currentGrafts[0]?.totalGrafts || 0,
          avgGrafts: Math.round(result[0]?.currentGrafts[0]?.avgGrafts || 0),
        },
        comparison: {
          scheduled: result[0]?.comparisonScheduled[0]?.count || 0,
          completed: result[0]?.comparisonCompleted[0]?.count || 0,
          totalGrafts: result[0]?.comparisonGrafts[0]?.totalGrafts || 0,
        },
      };
    };

    // Get today's surgeries
    const getTodaySurgeries = async () => {
      const todayStart = getISTStartOfDay();
      const todayEnd = getISTEndOfDay();
      
      const surgeries = await Patient.find({
        ...branchFilter,
        "surgery.surgeryDate": { $gte: todayStart, $lte: todayEnd }
      })
        .select("personal.name personal.phone surgery.surgeryDate surgery.technique surgery.graftsneed surgery.OT surgery.location ops.status")
        .populate("surgery.doctor", "name")
        .sort({ "surgery.surgeryDate": 1 })
        .lean();

      return surgeries;
    };

    // Get upcoming surgeries (next 7 days)
    const getUpcomingSurgeries = async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcomingStart = getISTStartOfDay(tomorrow);
      const upcomingEnd = getISTEndOfDay(nextWeek);
      
      const surgeries = await Patient.find({
        ...branchFilter,
        "surgery.surgeryDate": { $gte: upcomingStart, $lte: upcomingEnd }
      })
        .select("personal.name personal.phone surgery.surgeryDate surgery.technique surgery.location")
        .sort({ "surgery.surgeryDate": 1 })
        .limit(10)
        .lean();

      return surgeries;
    };

    // Get surgery techniques distribution
    const getTechniqueDistribution = async () => {
      const distribution = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
            "surgery.technique": { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: "$surgery.technique",
            count: { $sum: 1 },
            avgGrafts: { $avg: "$surgery.graftsImplanted" }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      return distribution.map(item => ({
        technique: item._id || "Not Specified",
        count: item.count,
        avgGrafts: Math.round(item.avgGrafts || 0)
      }));
    };

    // Get post-surgery patients (for follow-up)
    const getPostSurgeryPatients = async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const patients = await Patient.find({
        ...branchFilter,
        "surgery.surgeryDate": { 
          $gte: getISTStartOfDay(thirtyDaysAgo), 
          $lte: getISTEndOfDay() 
        },
        "surgery.doctor": { $exists: true, $ne: null }
      })
        .select("personal.name personal.phone surgery.surgeryDate surgery.technique")
        .sort({ "surgery.surgeryDate": -1 })
        .limit(20)
        .lean();

      return patients;
    };

    // Execute all queries in parallel
    const [
      surgeryStats, 
      todaySurgeries, 
      upcomingSurgeries, 
      techniqueDistribution,
      postSurgeryPatients
    ] = await Promise.all([
      getSurgeryStats(),
      getTodaySurgeries(),
      getUpcomingSurgeries(),
      getTechniqueDistribution(),
      getPostSurgeryPatients()
    ]);

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    // Prepare response
    const response = {
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        fromIST: formatISTDate(fromDate),
        toIST: formatISTDate(toDate),
      },
      branch,
      scheduledSurgeries: {
        count: surgeryStats.current.scheduled,
        growth: calculateGrowth(
          surgeryStats.current.scheduled,
          surgeryStats.comparison.scheduled
        ),
      },
      completedSurgeries: {
        count: surgeryStats.current.completed,
        growth: calculateGrowth(
          surgeryStats.current.completed,
          surgeryStats.comparison.completed
        ),
      },
      pendingSurgeries: {
        count: surgeryStats.current.pending,
      },
      graftsData: {
        total: surgeryStats.current.totalGrafts,
        average: surgeryStats.current.avgGrafts,
        growth: calculateGrowth(
          surgeryStats.current.totalGrafts,
          surgeryStats.comparison.totalGrafts
        ),
      },
      todaySurgeries,
      upcomingSurgeries,
      techniqueDistribution,
      postSurgeryPatients,
      surgeryRate: surgeryStats.current.scheduled > 0
        ? Math.round((surgeryStats.current.completed / (surgeryStats.current.scheduled + surgeryStats.current.completed)) * 100)
        : 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Surgery Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);