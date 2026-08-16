import { NextResponse } from "next/server";
import dbConnect from "@/lib/db.js";
import Employee from "@/models/Employee";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions.js";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "@/constants/bankRouting";

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    // Build filter query
    const dateFilter = {};
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    const branch = searchParams.get("branch");

    // 1. Agent Performance Data
    const agents = await Employee.find({ role: "Agent" })
      .populate({
        path: "patient",
        select: "personal payments",
      })
      .lean();

    const agentPerformance = await Promise.all(
      agents.map(async (agent) => {
        let patients = agent.patient || [];

        // Filter by branch if specified
        if (branch) {
          patients = patients.filter((p) => p.personal?.branch === branch);
        }

        // Filter by date if specified
        if (startDate || endDate) {
          patients = patients.filter((p) => {
            const visitDate = p.personal?.visitDate;
            if (!visitDate) return false;
            const date = new Date(visitDate);
            if (startDate && date < new Date(startDate)) return false;
            if (endDate && date > new Date(endDate)) return false;
            return true;
          });
        }

        const visitedCount = patients.filter(
          (p) => p.personal?.visitDate
        ).length;

        const transactions = await Transactions.find({
          patient: { $in: patients.map((p) => p._id) },
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
          ...dateFilter,
        }).lean();

        const revenue = transactions.reduce(
          (sum, t) => sum + (t.amount || 0),
          0
        );

        return {
          name: agent.name,
          patients: patients.length,
          visited: visitedCount,
          revenue: revenue,
        };
      })
    );

    // 2. Revenue by Branch
    const branchFilter = { costType: "Revenue", method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION, ...dateFilter };
    const branches = ["Delhi", "Mumbai", "Hyderabad", "Noida"];

    const revenueByBranch = await Promise.all(
      branches.map(async (branchName) => {
        if (branch && branch !== branchName) {
          return null;
        }

        const transactions = await Transactions.find({
          ...branchFilter,
          branch: branchName,
        }).lean();

        const revenue = transactions.reduce(
          (sum, t) => sum + (t.amount || 0),
          0
        );

        return {
          name: branchName,
          revenue: revenue,
        };
      })
    );

    const filteredRevenueByBranch = revenueByBranch.filter(
      (b) => b !== null && b.revenue > 0
    );

    // 3. Revenue by Procedure
    const procedures = [
      "hair transplant",
      "prp",
      "beard transplant",
      "medicine",
      "gfc",
    ];
    const revenueByProcedure = await Promise.all(
      procedures.map(async (procedure) => {
        const filter = {
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
          procedure: procedure,
          ...dateFilter,
        };

        if (branch) {
          filter.branch = branch;
        }

        const transactions = await Transactions.find(filter).lean();
        const revenue = transactions.reduce(
          (sum, t) => sum + (t.amount || 0),
          0
        );

        return {
          procedure: procedure,
          revenue: revenue,
        };
      })
    );

    // 4. Monthly Revenue Trend (last 12 months or filtered range)
    const monthlyRevenue = [];
    const now = new Date();
    const monthsToShow = 12;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      // Skip if outside filter range
      if (startDate && monthEnd < new Date(startDate)) continue;
      if (endDate && monthStart > new Date(endDate)) continue;

      const filter = {
        costType: "Revenue",
        method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
        date: {
          $gte: monthStart,
          $lte: monthEnd,
        },
      };

      if (branch) {
        filter.branch = branch;
      }

      const transactions = await Transactions.find(filter).lean();
      const revenue = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

      const patientFilter = {
        "personal.visitDate": {
          $gte: monthStart,
          $lte: monthEnd,
        },
      };

      if (branch) {
        patientFilter["personal.branch"] = branch;
      }

      const patientCount = await Patient.countDocuments(patientFilter);

      monthlyRevenue.push({
        month: monthStart.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        revenue: revenue,
        patients: patientCount,
      });
    }

    // 5. Patient Status Distribution
    const statusFilter = {};
    if (branch) {
      statusFilter["personal.branch"] = branch;
    }
    if (startDate || endDate) {
      statusFilter["personal.visitDate"] = {};
      if (startDate)
        statusFilter["personal.visitDate"].$gte = new Date(startDate);
      if (endDate) statusFilter["personal.visitDate"].$lte = new Date(endDate);
    }

    const statuses = ["NEW", "CONSULTED", "SURGERY_BOOKED", "CLOSED"];
    const patientStatus = await Promise.all(
      statuses.map(async (status) => {
        const count = await Patient.countDocuments({
          ...statusFilter,
          "ops.status": status,
        });

        return {
          name: status.replace("_", " "),
          count: count,
        };
      })
    );

    // 6. Conversion Funnel
    const totalPatientsForFunnel = await Patient.countDocuments(statusFilter);
    const consultedPatients = await Patient.countDocuments({
      ...statusFilter,
      "ops.status": { $in: ["CONSULTED", "SURGERY_BOOKED", "CLOSED"] },
    });
    const surgeryBookedPatients = await Patient.countDocuments({
      ...statusFilter,
      "ops.status": { $in: ["SURGERY_BOOKED", "CLOSED"] },
    });
    const closedPatients = await Patient.countDocuments({
      ...statusFilter,
      "ops.status": "CLOSED",
    });

    const conversionFunnel = [
      { stage: "Total Leads", count: totalPatientsForFunnel },
      { stage: "Consulted", count: consultedPatients },
      { stage: "Surgery Booked", count: surgeryBookedPatients },
      { stage: "Closed", count: closedPatients },
    ];
    // 7. Summary Statistics
    const allTransactions = await Transactions.find({
      costType: "Revenue",
      method: { $nin: UNSETTLED_METHODS }, ...SETTLEMENT_EXCLUSION,
      ...dateFilter,
      ...(branch ? { branch } : {}),
    }).lean();

    const totalRevenue = allTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );
    let totalPatients = await Patient.countDocuments(statusFilter);
    const conversionRate =
      totalPatients > 0
        ? ((closedPatients / totalPatients) * 100).toFixed(2)
        : 0;
    const avgTransaction =
      allTransactions.length > 0
        ? Math.round(totalRevenue / allTransactions.length)
        : 0;

    return NextResponse.json({
      success: true,
      agentPerformance: agentPerformance.filter(
        (a) => a.patients > 0 || a.revenue > 0
      ),
      revenueByBranch: filteredRevenueByBranch,
      revenueByProcedure: revenueByProcedure.filter((p) => p.revenue > 0),
      monthlyRevenue,
      patientStatus: patientStatus.filter((s) => s.count > 0),
      conversionFunnel,
      totalRevenue,
      totalPatients,
      conversionRate,
      avgTransaction,
    });
  } catch (error) {
    console.error("Error fetching performance data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch performance data" },
      { status: 500 }
    );
  }
}
