import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Employee from "@/models/Employee";

const VALID_BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad"];

// Improved date helpers that work consistently across timezones
const getISTStartOfDay = (date = null) => {
  const d = date ? new Date(date) : new Date();
  
  // Create date in IST timezone (UTC+5:30)
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

const formatISTDate = (date) => {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

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

   
    // Branch filter
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    // Get sales statistics
    const getSalesStats = async () => {
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
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                  },
                },
                { $count: "count" },
              ],
              comparisonConverted: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "counselling.readyForSurgery": true,
                  },
                },
                { $count: "count" },
              ],
              comparisonBooked: [
                {
                  $match: {
                    "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
                    "surgery.surgeryDate": { $exists: true, $ne: null },
                  },
                },
                { $count: "count" },
              ],
            },
          },
        ]);

        return result[0] || {};
      } catch (error) {
        console.error('Error in getSalesStats:', error);
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

        return result[0] || {};
      } catch (error) {
        console.error('Error in getRevenueStats:', error);
        return {};
      }
    };

    // Get agent performance - Fixed for Vercel
    const getAgentPerformance = async () => {
      try {
        // First get all active agents
        const agents = await Employee.find({
          role: "Agent",
          isactive: true
        }).select('name email phone branch').lean();

        // Then get their patient counts using aggregation
        const agentPerformance = await Promise.all(
          agents.map(async (agent) => {
            const patientStats = await Patient.aggregate([
              {
                $match: {
                  ...branchFilter,
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  // Assuming agent relationship is stored somewhere
                  // Adjust this match based on your actual schema
                  $or: [
                    { "counselling.counsellor": agent._id?.toString() },
                    { "assignedAgent": agent._id?.toString() }
                  ]
                }
              },
              {
                $facet: {
                  totalLeads: [{ $count: "count" }],
                  converted: [
                    { 
                      $match: { 
                        "counselling.readyForSurgery": true 
                      } 
                    },
                    { $count: "count" }
                  ]
                }
              }
            ]);

            const totalLeads = patientStats[0]?.totalLeads[0]?.count || 0;
            const converted = patientStats[0]?.converted[0]?.count || 0;
            const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;

            return {
              name: agent.name,
              email: agent.email,
              phone: agent.phone,
              branch: agent.branch,
              totalLeads,
              converted,
              conversionRate
            };
          })
        );

        return agentPerformance;
      } catch (error) {
        console.error('Error in getAgentPerformance:', error);
        return [];
      }
    };

    // Get upcoming appointments - Fixed for Vercel
    const getUpcomingAppointments = async () => {
      try {
        const now = new Date(); // Current server time (UTC)
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
      } catch (error) {
        console.error('Error in getUpcomingAppointments:', error);
        return [];
      }
    };

    // Execute all queries in parallel with error handling
    const [salesStats, revenueStats, agentPerformance, upcomingAppointments] = await Promise.allSettled([
      getSalesStats(),
      getRevenueStats(),
      getAgentPerformance(),
      getUpcomingAppointments()
    ]);

    // Handle promise results with safe defaults
    const salesStatsResult = salesStats.status === 'fulfilled' ? salesStats.value : {};
    const revenueStatsResult = revenueStats.status === 'fulfilled' ? revenueStats.value : {};
    const agentPerformanceResult = agentPerformance.status === 'fulfilled' ? agentPerformance.value : [];
    const upcomingAppointmentsResult = upcomingAppointments.status === 'fulfilled' ? upcomingAppointments.value : [];

    // Process stats with safe defaults
    const currentLeads = salesStatsResult.currentLeads?.[0]?.count || 0;
    const currentConverted = salesStatsResult.currentConverted?.[0]?.count || 0;
    const currentBooked = salesStatsResult.currentBooked?.[0]?.count || 0;
    const comparisonLeads = salesStatsResult.comparisonLeads?.[0]?.count || 0;
    const comparisonConverted = salesStatsResult.comparisonConverted?.[0]?.count || 0;
    const comparisonBooked = salesStatsResult.comparisonBooked?.[0]?.count || 0;
    const currentRevenue = revenueStatsResult.current?.[0]?.total || 0;
    const comparisonRevenue = revenueStatsResult.comparison?.[0]?.total || 0;

    // Calculate growth percentages
    const calculateGrowth = (current, comparison) => {
      if (comparison === 0 && current > 0) return 100;
      if (comparison === 0 && current === 0) return 0;
      return Math.round(((current - comparison) / comparison) * 100);
    };

    const leadsGrowth = calculateGrowth(currentLeads, comparisonLeads);
    const convertedGrowth = calculateGrowth(currentConverted, comparisonConverted);
    const bookedGrowth = calculateGrowth(currentBooked, comparisonBooked);
    const revenueGrowth = calculateGrowth(currentRevenue, comparisonRevenue);

    // Calculate conversion rate
    const conversionRate = currentLeads > 0
      ? Math.round((currentConverted / currentLeads) * 100)
      : 0;

    // Prepare response matching frontend structure
    const response = {
      success: true,
      data: {
        // Main metrics matching frontend expectations
        totalLeads: currentLeads,
        newPatients: currentLeads, // Using leads as new patients
        contacted: currentConverted, // Using converted as contacted
        converted: currentConverted,
        notConverted: currentLeads - currentConverted,
        revenue: currentRevenue,
        activeAgents: agentPerformanceResult.length,
        
        // Trends data
        trends: {
          totalLeads: leadsGrowth,
          newPatients: leadsGrowth,
          contacted: convertedGrowth,
          converted: convertedGrowth,
          revenue: revenueGrowth
        },
        
        // Additional data
        agentPerformance: agentPerformanceResult,
        upcomingAppointments: upcomingAppointmentsResult,
        
        // Original sales data for reference
        salesData: {
          leads: currentLeads,
          converted: currentConverted,
          booked: currentBooked,
          conversionRate: conversionRate
        },
        
        // Debug info
        _debug: process.env.NODE_ENV === 'development' ? {
          dateRanges: {
            current: { from: fromDate.toISOString(), to: toDate.toISOString() },
            comparison: { from: comparisonStart.toISOString(), to: comparisonEnd.toISOString() }
          },
          counts: {
            currentLeads,
            currentConverted,
            currentBooked,
            currentRevenue
          }
        } : undefined
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Admin Dashboard API error on Vercel:", error);
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