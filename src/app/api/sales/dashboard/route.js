import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";

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

    // ✅ Date range setup - FIXED to match admin dashboard
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

    // ✅ Calculate the number of days in the selected range
    const daysDifference =
      Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

    // ✅ Calculate yesterday's date range (same duration as selected range, but shifted back)
    const yesterdayEnd = new Date(fromDate);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(yesterdayEnd);
    yesterdayStart.setDate(yesterdayStart.getDate() - (daysDifference - 1));
    yesterdayStart.setHours(0, 0, 0, 0);

    // ✅ Centralized filter objects
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };
    const branchFilterEmployee = branch === "All" ? {} : { branch };

    // ✅ FIXED: Single aggregation for all patient counts using visitDate like admin dashboard
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
            ],
          },
        },
        {
          $facet: {
            // Current period counts
            currentTotalLeads: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                },
              },
              { $count: "count" },
            ],
            currentNewPatients: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  $or: [
                    { "counselling.counsellor": { $exists: false } },
                    { "counselling.counsellor": "" },
                  ],
                },
              },
              { $count: "count" },
            ],
            currentContacted: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.counsellor": { $exists: true, $ne: "" },
                },
              },
              { $count: "count" },
            ],
            currentConverted: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "surgery.surgeryDate": { $exists: true, $ne: "" },
                },
              },
              { $count: "count" },
            ],
            currentNotConverted: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.counsellor": { $exists: true, $ne: "" },
                  $or: [
                    { "surgery.surgeryDate": { $exists: false } },
                    { "surgery.surgeryDate": "" },
                  ],
                },
              },
              { $count: "count" },
            ],
            // Comparison period counts
            comparisonTotalLeads: [
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
            comparisonNewPatients: [
              {
                $match: {
                  "personal.visitDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                  $or: [
                    { "ops.status": "NEW" },
                    { "ops.status": "APPOINTMENT_BOOKED" },
                  ],
                },
              },
              { $count: "count" },
            ],
            comparisonContacted: [
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
            comparisonConverted: [
              {
                $match: {
                  "personal.visitDate": {
                    $gte: yesterdayStart,
                    $lte: yesterdayEnd,
                  },
                  "counselling.converted": true,
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]);

      // FIXED: Revenue calculation using Transactions model like admin dashboard
      const revenueResult = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
              { createdAt: { $gte: fromDate, $lte: toDate } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $ifNull: ["$payments.amountReceived", 0],
              },
            },
          },
        },
      ]);

      const comparisonRevenueResult = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
              { createdAt: { $gte: fromDate, $lte: toDate } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $ifNull: ["$payments.amountReceived", 0],
              },
            },
          },
        },
      ]);

      return {
        current: {
          totalLeads: result[0]?.currentTotalLeads[0]?.count || 0,
          newPatients: result[0]?.currentNewPatients[0]?.count || 0,
          contacted: result[0]?.currentContacted[0]?.count || 0,
          converted: result[0]?.currentConverted[0]?.count || 0,
          notConverted: result[0]?.currentNotConverted[0]?.count || 0,
          revenue: revenueResult[0]?.totalRevenue || 0,
        },
        comparison: {
          totalLeads: result[0]?.comparisonTotalLeads[0]?.count || 0,
          newPatients: result[0]?.comparisonNewPatients[0]?.count || 0,
          contacted: result[0]?.comparisonContacted[0]?.count || 0,
          converted: result[0]?.comparisonConverted[0]?.count || 0,
          revenue: comparisonRevenueResult[0]?.totalRevenue || 0,
        },
      };
    };

    // ✅ OPTIMIZED: Agent performance aggregation (unchanged - it's working)
    const getAgentPerformance = async () => {
      const result = await Employee.aggregate([
        {
          $match: {
            ...branchFilterEmployee,
            role: { $regex: "agent", $options: "i" },
          },
        },
        {
          $lookup: {
            from: "patients",
            localField: "_id",
            foreignField: "personal.reference",
            as: "patients",
          },
        },
        {
          $project: {
            name: 1,
            phone: 1,
            branch: 1,
            totalLeads: {
              $size: {
                $filter: {
                  input: "$patients",
                  as: "patient",
                  cond: {
                    $and: [
                      { $gte: ["$$patient.personal.visitDate", fromDate] },
                      { $lte: ["$$patient.personal.visitDate", toDate] },
                    ],
                  },
                },
              },
            },
            converted: {
              $size: {
                $filter: {
                  input: "$patients",
                  as: "patient",
                  cond: {
                    $and: [
                      { $gte: ["$$patient.personal.visitDate", fromDate] },
                      { $lte: ["$$patient.personal.visitDate", toDate] },
                      { $eq: ["$$patient.counselling.readyForSurgery", true] },
                    ],
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            conversionRate: {
              $cond: {
                if: { $gt: ["$totalLeads", 0] },
                then: {
                  $multiply: [{ $divide: ["$converted", "$totalLeads"] }, 100],
                },
                else: 0,
              },
            },
          },
        },
        {
          $match: {
            totalLeads: { $gt: 0 },
          },
        },
        {
          $sort: { conversionRate: -1 },
        },
        {
          $limit: 10,
        },
      ]);

      return result.map((agent) => ({
        name: agent.name,
        phone: agent.phone,
        branch: "Delhi",
        totalLeads: agent.totalLeads,
        converted: agent.converted,
        conversionRate: Math.round(agent.conversionRate * 100) / 100,
      }));
    };

    // ✅ Get active agents count
    const getActiveAgents = async () => {
      const result = await Employee.countDocuments({
        ...branchFilterEmployee,
        role: { $regex: "agent", $options: "i" },
      });
      return result;
    };

    // ✅ Execute all aggregations in parallel
    const [patientStats, agentPerformance, activeAgents] = await Promise.all([
      getPatientStats(),
      getAgentPerformance(),
      getActiveAgents(),
    ]);

    // ✅ FIXED: Calculate growth percentage to match admin dashboard format
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0) return current > 0 ? 100 : 0;
      return Number((((current - comparison) / comparison) * 100).toFixed(2));
    };

    // ✅ Prepare final response
    return NextResponse.json({
      success: true,
      data: {
        totalLeads: patientStats.current.totalLeads,
        newPatients: patientStats.current.newPatients,
        contacted: patientStats.current.contacted,
        converted: patientStats.current.converted,
        notConverted: patientStats.current.notConverted,
        revenue: patientStats.current.revenue,
        activeAgents: activeAgents,
        agentPerformance: agentPerformance,
        trends: {
          totalLeads: calculateGrowth(
            patientStats.current.totalLeads,
            patientStats.comparison.totalLeads
          ),
          newPatients: calculateGrowth(
            patientStats.current.newPatients,
            patientStats.comparison.newPatients
          ),
          contacted: calculateGrowth(
            patientStats.current.contacted,
            patientStats.comparison.contacted
          ),
          converted: calculateGrowth(
            patientStats.current.converted,
            patientStats.comparison.converted
          ),
          revenue: calculateGrowth(
            patientStats.current.revenue,
            patientStats.comparison.revenue
          ),
        },
        dateRange: {
          from: fromDate.toISOString().split("T")[0],
          to: toDate.toISOString().split("T")[0],
          comparisonPeriod: {
            from: yesterdayStart.toISOString().split("T")[0],
            to: yesterdayEnd.toISOString().split("T")[0],
          },
        },
        branch,
      },
    });
  } catch (error) {
    console.error("Sales dashboard error:", error);
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
