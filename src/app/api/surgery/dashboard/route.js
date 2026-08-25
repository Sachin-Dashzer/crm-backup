import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import { 
  getISTStartOfDay, 
  getISTEndOfDay, 
  formatISTDate,
  getDateRangeFromFilter 
} from "@/lib/dateHelpers.js";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida"];

const handler = async (req) => {
  try {
    // Get parameters from URL search params for GET request
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";
    const dateRange = searchParams.get("dateRange") || "Today";

    // Validate branch
    if (!VALID_BRANCHES.includes(branch)) {
      return NextResponse.json(
        { error: "Invalid branch specified" },
        { status: 400 }
      );
    }

    // Get date range based on filter
    const { start: fromDate, end: toDate } = getDateRangeFromFilter(dateRange);

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
              { "counselling.readyForSurgery": true }
            ],
          },
        },
        {
          $facet: {
            // Current period - Scheduled (surgeries with date but without doctor assigned)
            currentScheduled: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                  $or: [
                    { "surgery.doctor": { $exists: false } },
                    { "surgery.doctor": null }
                  ]
                },
              },
              { $count: "count" },
            ],
            // Current period - Completed (surgeries with doctor assigned)
            currentCompleted: [
              {
                $match: {
                  "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
                  "surgery.doctor": { $exists: true, $ne: null }
                },
              },
              { $count: "count" },
            ],
            // Pending surgeries (ready but no date scheduled)
            currentPending: [
              {
                $match: {
                  "counselling.readyForSurgery": true,
                  $or: [
                    { "surgery.surgeryDate": { $exists: false } },
                    { "surgery.surgeryDate": null }
                  ]
                },
              },
              { $count: "count" },
            ],
            // Ready for surgery (ready and scheduled)
            readyForSurgery: [
              {
                $match: {
                  "counselling.readyForSurgery": true,
                  "surgery.surgeryDate": { $exists: true, $ne: null },
                  $or: [
                    { "surgery.doctor": { $exists: false } },
                    { "surgery.doctor": null }
                  ]
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
                  $or: [
                    { "surgery.doctor": { $exists: false } },
                    { "surgery.doctor": null }
                  ]
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
          ready: result[0]?.readyForSurgery[0]?.count || 0,
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

    // Get today's upcoming surgeries (scheduled but not completed)
    const getUpcomingSurgeries = async () => {
      const todayStart = getISTStartOfDay();
      const todayEnd = getISTEndOfDay();
      
      const surgeries = await Patient.find({
        ...branchFilter,
        "surgery.surgeryDate": { $gte: todayStart, $lte: todayEnd },
        $or: [
          { "surgery.doctor": { $exists: false } },
          { "surgery.doctor": null }
        ]
      })
        .select("personal.name personal.phone personal.branch surgery.surgeryDate surgery.technique surgery.graftsneed surgery.location counselling.techniqueSuggested counselling.graftsSuggested")
        .sort({ "surgery.surgeryDate": 1 })
        .lean();

      return surgeries;
    };

    // Get today's performed surgeries (completed)
    const getPerformedSurgeries = async () => {
      const todayStart = getISTStartOfDay();
      const todayEnd = getISTEndOfDay();
      
      const surgeries = await Patient.find({
        ...branchFilter,
        "surgery.surgeryDate": { $gte: todayStart, $lte: todayEnd },
        "surgery.doctor": { $exists: true, $ne: null }
      })
        .select("personal.name personal.phone personal.branch surgery.surgeryDate surgery.technique surgery.graftsImplanted surgery.graftsneed surgery.location")
        .populate("surgery.doctor", "name")
        .sort({ "surgery.surgeryDate": 1 })
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
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Convert to object format
      const techniqueBreakdown = {};
      distribution.forEach(item => {
        techniqueBreakdown[item._id] = item.count;
      });

      return techniqueBreakdown;
    };

    // Get location breakdown
    const getLocationDistribution = async () => {
      const distribution = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            "surgery.surgeryDate": { $gte: fromDate, $lte: toDate },
            "surgery.location": { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: "$surgery.location",
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      // Convert to object format
      const locationBreakdown = {};
      distribution.forEach(item => {
        locationBreakdown[item._id] = item.count;
      });

      return locationBreakdown;
    };

    // Execute all queries in parallel
    const [
      surgeryStats, 
      upcomingSurgeries, 
      performedSurgeries,
      techniqueBreakdown,
      locationBreakdown
    ] = await Promise.all([
      getSurgeryStats(),
      getUpcomingSurgeries(),
      getPerformedSurgeries(),
      getTechniqueDistribution(),
      getLocationDistribution()
    ]);

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    // Prepare response in the format expected by frontend
    const response = {
      metrics: {
        scheduledSurgeries: surgeryStats.current.scheduled,
        completedSurgeries: surgeryStats.current.completed,
        pendingSurgeries: surgeryStats.current.pending,
        readyForSurgery: surgeryStats.current.ready,
        techniqueBreakdown,
        locationBreakdown,
        totalGrafts: surgeryStats.current.totalGrafts,
        avgGrafts: surgeryStats.current.avgGrafts,
      },
      upcomingSurgeries,
      performedSurgeries,
      growth: {
        scheduled: calculateGrowth(
          surgeryStats.current.scheduled,
          surgeryStats.comparison.scheduled
        ),
        completed: calculateGrowth(
          surgeryStats.current.completed,
          surgeryStats.comparison.completed
        ),
        grafts: calculateGrowth(
          surgeryStats.current.totalGrafts,
          surgeryStats.comparison.totalGrafts
        ),
      },
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        fromIST: formatISTDate(fromDate),
        toIST: formatISTDate(toDate),
      },
      branch,
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

// Export GET handler instead of POST
export const GET = withDB(handler);