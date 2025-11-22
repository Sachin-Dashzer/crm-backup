import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";
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

    // Get sales statistics
    const getSalesStats = async () => {
      const result = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
              { "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } }
            ],
          },
        },
        {
          $facet: {
            // Current period
            currentLeads: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                },
              },
              { $count: "count" },
            ],
            currentConverted: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.readyForSurgery": true,
                },
              },
              { $count: "count" },
            ],
            currentBooked: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "surgery.surgeryDate": { $exists: true, $ne: null },
                },
              },
              { $count: "count" },
            ],
            // Comparison period
            comparisonLeads: [
              {
                $match: {
                  "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                },
              },
              { $count: "count" },
            ],
            comparisonConverted: [
              {
                $match: {
                  "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "counselling.readyForSurgery": true,
                },
              },
              { $count: "count" },
            ],
            comparisonBooked: [
              {
                $match: {
                  "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "surgery.surgeryDate": { $exists: true, $ne: null },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]);

      return {
        current: {
          leads: result[0]?.currentLeads[0]?.count || 0,
          converted: result[0]?.currentConverted[0]?.count || 0,
          booked: result[0]?.currentBooked[0]?.count || 0,
        },
        comparison: {
          leads: result[0]?.comparisonLeads[0]?.count || 0,
          converted: result[0]?.comparisonConverted[0]?.count || 0,
          booked: result[0]?.comparisonBooked[0]?.count || 0,
        },
      };
    };

    // Get revenue statistics
    const getRevenueStats = async () => {
      const result = await Transactions.aggregate([
        {
          $match: {
            costType: "Revenue",
            ...(branch === "All" ? {} : { branch }),
            $or: [
              { date: { $gte: fromDate, $lte: toDate } },
              { date: { $gte: yesterdayStart, $lte: yesterdayEnd } },
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
              { $match: { date: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
              { $group: { _id: null, total: { $sum: "$amount" } } },
            ],
          },
        },
      ]);

      return {
        current: result[0]?.current[0]?.total || 0,
        comparison: result[0]?.comparison[0]?.total || 0,
      };
    };

    // Get agent performance
    const getAgentPerformance = async () => {
      const agents = await Employee.find({
        role: "Agent",
        isactive: true
      })
        .populate({
          path: 'patient',
          match: {
            ...branchFilter,
            "personal.visitDate": { $gte: fromDate, $lte: toDate }
          },
          select: 'personal.name personal.visitDate counselling.readyForSurgery'
        })
        .select('name email patient')
        .lean();

      return agents.map(agent => ({
        name: agent.name,
        email: agent.email,
        leadsGenerated: agent.patient?.length || 0,
        conversions: agent.patient?.filter(p => p.counselling?.readyForSurgery).length || 0
      }));
    };

    // Get upcoming appointments
    const getUpcomingAppointments = async () => {
      const now = getISTDate();
      const endOfDay = getISTEndOfDay();
      
      const appointments = await Patient.find({
        ...branchFilter,
        "personal.visitDate": { $gt: now, $lte: endOfDay },
      })
        .select("personal.name personal.visitDate personal.phone personal.branch")
        .sort({ "personal.visitDate": 1 })
        .limit(10)
        .lean();

      return appointments;
    };

    // Execute all queries in parallel
    const [salesStats, revenueStats, agentPerformance, upcomingAppointments] = await Promise.all([
      getSalesStats(),
      getRevenueStats(),
      getAgentPerformance(),
      getUpcomingAppointments()
    ]);

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    // Calculate conversion rate
    const conversionRate = salesStats.current.leads > 0
      ? Math.round((salesStats.current.converted / salesStats.current.leads) * 100)
      : 0;

    // Prepare response
    const response = {
      dateRange: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        fromIST: formatISTDate(fromDate),
        toIST: formatISTDate(toDate),
      },
      branch,
      newLeads: {
        count: salesStats.current.leads,
        growth: calculateGrowth(
          salesStats.current.leads,
          salesStats.comparison.leads
        ),
      },
      conversions: {
        count: salesStats.current.converted,
        growth: calculateGrowth(
          salesStats.current.converted,
          salesStats.comparison.converted
        ),
        rate: conversionRate
      },
      bookings: {
        count: salesStats.current.booked,
        growth: calculateGrowth(
          salesStats.current.booked,
          salesStats.comparison.booked
        ),
      },
      revenue: {
        total: revenueStats.current,
        growth: calculateGrowth(revenueStats.current, revenueStats.comparison),
      },
      agentPerformance,
      upcomingAppointments,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sales Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);