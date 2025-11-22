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

    // Debug logging for production
    if (process.env.NODE_ENV === 'production') {
      logDateInfo('From Date', fromDate);
      logDateInfo('To Date', toDate);
    }

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

    // Patient statistics aggregation
    const getPatientStats = async () => {
      const result = await Patient.aggregate([
        {
          $match: {
            ...branchFilter,
            $or: [
              { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
              { "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } },
              { "surgery.surgeryDate": { $gte: fromDate, $lte: toDate } },
              { "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd } },
            ],
          },
        },
        {
          $facet: {
            // Current period counts
            currentAppointments: [
              { $match: { "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
              { $count: "count" },
            ],
            currentVisits: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "counselling.counsellor": { $exists: true, $ne: "", $ne: null },
                },
              },
              { $count: "count" },
            ],
            currentReadyForSurgery: [
              {
                $match: {
                  "personal.visitDate": { $gte: fromDate, $lte: toDate },
                  "surgery.surgeryDate": { $exists: true, $ne: "", $ne: null },
                },
              },
              { $count: "count" },
            ],
            currentSurgeries: [
              { $match: { "surgery.surgeryDate": { $gte: fromDate, $lte: toDate } } },
              { $count: "count" },
            ],
            // Comparison period counts
            comparisonAppointments: [
              { $match: { "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } } },
              { $count: "count" },
            ],
            comparisonVisits: [
              {
                $match: {
                  "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "counselling.counsellor": { $exists: true, $ne: "" },
                },
              },
              { $count: "count" },
            ],
            comparisonReadyForSurgery: [
              {
                $match: {
                  "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd },
                  "counselling.readyForSurgery": true,
                },
              },
              { $count: "count" },
            ],
            comparisonSurgeries: [
              { $match: { "surgery.surgeryDate": { $gte: yesterdayStart, $lte: yesterdayEnd } } },
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

    // Revenue statistics aggregation
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

    // Execute all queries in parallel
    const [patientStats, revenueStats] = await Promise.all([
      getPatientStats(),
      getRevenueStats(),
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
      amountReceived: {
        total: revenueStats.current,
        growth: calculateGrowth(revenueStats.current, revenueStats.comparison),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);