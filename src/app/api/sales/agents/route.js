import Employee from "@/models/Employee";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "@/constants/bankRouting";
import { resolveDateRange } from "@/lib/dateHelpers";
import { MAIN_BRANCHES } from "@/lib/branches";

const CONVERTED_STATUSES = ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];
const ALLOWED_ROLES = ["sales", "owner", "admin", "super-admin", "manager", "telecaller"];

function normalizePackageName(raw) {
  if (!raw) return "Standard";
  const str = String(raw).trim();
  if (!str || str === "0") return "Standard";
  const upper = str.toUpperCase().replace(/\s+/g, " ");
  if (upper === "FUE") return "FUE";
  if (upper === "INDIAN DHI" || upper === "DHI INDIAN") return "INDIAN DHI";
  if (upper === "TURKISH DHI" || upper === "DHI TURKEY" || upper === "DHI TURKISH") return "TURKISH DHI";
  if (upper === "GFC") return "GFC";
  if (upper === "PRP") return "PRP";
  if (upper === "HYBRID" || upper === "DHI HYBRID") return "HYBRID";
  if (upper === "ALOPECIA") return "Alopecia";
  if (upper === "OTHER") return "Other";
  return str;
}

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const userRole = session.user.role?.toLowerCase();
    if (userRole && !ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ success: false, error: "Forbidden: Sales access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);

    const parsedPage = parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = parseInt(searchParams.get("limit") || "10", 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
    const skip = (page - 1) * limit;

    const branch = searchParams.get("branch") || "All";
    const search = (searchParams.get("search") || "").trim();
    const sortBy = searchParams.get("sortBy") || "revenue"; // revenue | leads | rate | name

    // Resolve date window (IST-compliant)
    const dateRange = resolveDateRange(searchParams);
    const isAllTime = dateRange.isAll;
    const fromDate = dateRange.start;
    const toDate = dateRange.end;

    // Scope strictly to Agent employees only — no Doctors, Receptionists, HR, Counsellors, etc.
    const agentFilter = { role: "Agent" };
    if (search) {
      agentFilter.name = { $regex: search, $options: "i" };
    }

    // Load agents
    const agents = await Employee.find(agentFilter)
      .select("_id name branch isactive employeeId tlName dateOfJoining createdAt")
      .lean();

    const agentIds = agents.map((a) => a._id);

    // Patient branch filter (performance-based branch scope matching Sales Dashboard)
    const patientBranchMatch = branch && branch !== "All" ? { "personal.branch": branch } : {};

    // Period visitDate filter
    const visitDateMatch = !isAllTime && fromDate && toDate
      ? { "personal.visitDate": { $gte: fromDate, $lte: toDate } }
      : {};

    // Period transaction date filter
    const txDateMatch = !isAllTime && fromDate && toDate
      ? { date: { $gte: fromDate, $lte: toDate } }
      : {};

    // Batched parallel queries to prevent N+1 queries
    const [lifetimeCounts, periodPatientStats, periodTransactions, dynamicBranches] = await Promise.all([
      // 1. Lifetime total patients per agent
      Patient.aggregate([
        {
          $match: {
            "personal.reference": { $in: agentIds },
            ...patientBranchMatch,
          },
        },
        {
          $group: {
            _id: "$personal.reference",
            totalPatients: { $sum: 1 },
          },
        },
      ]),

      // 2. Period leads, conversions, package breakdown, branch breakdown per agent
      Patient.aggregate([
        {
          $match: {
            "personal.reference": { $in: agentIds },
            ...visitDateMatch,
            ...patientBranchMatch,
          },
        },
        {
          $project: {
            agentId: "$personal.reference",
            status: "$ops.status",
            patientBranch: { $ifNull: ["$personal.branch", "Unknown"] },
            package: {
              $let: {
                vars: {
                  ts: { $trim: { input: { $ifNull: ["$counselling.techniqueSuggested", ""] } } },
                  st: { $trim: { input: { $ifNull: ["$surgery.technique", ""] } } },
                  tq: { $trim: { input: { $ifNull: ["$personal.techniqueQuoted", ""] } } },
                  pq: { $trim: { input: { $ifNull: [{ $toString: "$personal.packageQuoted" }, ""] } } },
                },
                in: {
                  $cond: [
                    { $ne: ["$$ts", ""] },
                    "$$ts",
                    {
                      $cond: [
                        { $ne: ["$$st", ""] },
                        "$$st",
                        {
                          $cond: [
                            { $ne: ["$$tq", ""] },
                            "$$tq",
                            {
                              $cond: [
                                { $and: [{ $ne: ["$$pq", ""] }, { $ne: ["$$pq", "0"] }] },
                                "$$pq",
                                "Standard",
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            converted: {
              $cond: [{ $in: ["$ops.status", CONVERTED_STATUSES] }, 1, 0],
            },
          },
        },
        {
          $group: {
            _id: "$agentId",
            leads: { $sum: 1 },
            converted: { $sum: "$converted" },
            packages: {
              $push: { package: "$package", converted: "$converted" },
            },
            branches: {
              $push: { branch: "$patientBranch", converted: "$converted" },
            },
          },
        },
      ]),

      // 3. Settled revenue transactions in period (reconciled with Sales Dashboard bank routing)
      Transactions.aggregate([
        {
          $match: {
            costType: "Revenue",
            ...(branch && branch !== "All" ? { branch } : {}),
            method: { $nin: UNSETTLED_METHODS },
            ...SETTLEMENT_EXCLUSION,
            ...txDateMatch,
            patient: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: "$patient",
            amount: { $sum: "$amount" },
          },
        },
      ]),

      // 4. Dynamic branches from Patient records
      Patient.distinct("personal.branch"),
    ]);

    // Map lifetime counts
    const lifetimeMap = new Map(lifetimeCounts.map((l) => [String(l._id), l.totalPatients]));

    // Map period stats
    const periodMap = new Map(periodPatientStats.map((p) => [String(p._id), p]));

    // Link transaction revenue to agent via patient reference
    const txPatientIds = periodTransactions.map((t) => t._id);
    const patientAgentMap = new Map();
    if (txPatientIds.length > 0) {
      const pRefs = await Patient.find(
        { _id: { $in: txPatientIds }, "personal.reference": { $in: agentIds } },
        { "personal.reference": 1 }
      ).lean();
      pRefs.forEach((p) => {
        if (p.personal?.reference) {
          patientAgentMap.set(String(p._id), String(p.personal.reference));
        }
      });
    }

    // Sum revenue per agent
    const agentRevenueMap = new Map();
    let totalFilterSettledRevenue = 0;
    periodTransactions.forEach((t) => {
      const agentIdStr = patientAgentMap.get(String(t._id));
      if (agentIdStr) {
        agentRevenueMap.set(agentIdStr, (agentRevenueMap.get(agentIdStr) || 0) + (t.amount || 0));
        totalFilterSettledRevenue += (t.amount || 0);
      }
    });

    // Compile each agent's metrics
    const compiledAgents = agents.map((agent) => {
      const aId = String(agent._id);
      const pStats = periodMap.get(aId) || { leads: 0, converted: 0, packages: [], branches: [] };
      const totalPatients = lifetimeMap.get(aId) || 0;
      const totalLeads = pStats.leads || 0;
      const converted = pStats.converted || 0;
      const conversionRate = totalLeads > 0 ? parseFloat(((converted / totalLeads) * 100).toFixed(1)) : 0;
      const totalRevenue = Math.round(agentRevenueMap.get(aId) || 0);

      // Package-wise conversion breakdown
      const pkgCounts = {};
      (pStats.packages || []).forEach((item) => {
        const name = normalizePackageName(item.package);
        if (!pkgCounts[name]) pkgCounts[name] = { totalLeads: 0, converted: 0 };
        pkgCounts[name].totalLeads += 1;
        if (item.converted) pkgCounts[name].converted += 1;
      });
      const packageBreakdown = Object.entries(pkgCounts)
        .map(([name, stat]) => ({
          name,
          totalLeads: stat.totalLeads,
          converted: stat.converted,
          conversionRate: stat.totalLeads > 0 ? Math.round((stat.converted / stat.totalLeads) * 100) : 0,
        }))
        .sort((a, b) => b.totalLeads - a.totalLeads);

      // Branch-wise conversion breakdown
      const brCounts = {};
      (pStats.branches || []).forEach((item) => {
        const rawBr = item.branch != null ? String(item.branch).trim() : "";
        const bName = rawBr && rawBr !== "null" && rawBr !== "undefined" ? rawBr : "Unknown";
        if (!brCounts[bName]) brCounts[bName] = { totalLeads: 0, converted: 0 };
        brCounts[bName].totalLeads += 1;
        if (item.converted) brCounts[bName].converted += 1;
      });
      const branchBreakdown = Object.entries(brCounts)
        .map(([bName, stat]) => ({
          branch: bName,
          totalLeads: stat.totalLeads,
          converted: stat.converted,
          conversionRate: stat.totalLeads > 0 ? Math.round((stat.converted / stat.totalLeads) * 100) : 0,
        }))
        .sort((a, b) => b.totalLeads - a.totalLeads);

      return {
        _id: agent._id,
        name: agent.name,
        branch: agent.branch || "Delhi",
        isactive: agent.isactive !== false,
        employeeId: agent.employeeId || "Not available",
        dateOfJoining: agent.dateOfJoining || agent.createdAt || null,
        tlName: agent.tlName || "Not available",
        totalPatients,
        totalLeads,
        converted,
        conversionRate,
        totalRevenue,
        packageBreakdown,
        branchBreakdown,
      };
    });

    // Compute Overall Filter KPIs across all matched agents
    const totalAgents = compiledAgents.length;
    const activeAgents = compiledAgents.filter((a) => a.isactive).length;
    const filterTotalLeads = compiledAgents.reduce((s, a) => s + a.totalLeads, 0);
    const filterTotalConverted = compiledAgents.reduce((s, a) => s + a.converted, 0);
    const avgConversion = filterTotalLeads > 0
      ? parseFloat(((filterTotalConverted / filterTotalLeads) * 100).toFixed(1))
      : 0;

    // Sort agents based on sortBy query param
    compiledAgents.sort((a, b) => {
      if (sortBy === "leads") return b.totalLeads - a.totalLeads || b.totalRevenue - a.totalRevenue;
      if (sortBy === "rate") return b.conversionRate - a.conversionRate || b.totalLeads - a.totalLeads;
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      // Default: revenue descending
      return b.totalRevenue - a.totalRevenue || b.totalLeads - a.totalLeads;
    });

    // Paginate
    const paginatedAgents = compiledAgents.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalAgents / limit) || 1;

    // Dynamic branches list: authoritative MAIN_BRANCHES + distinct branches from patients (excluding null/All)
    const availableBranches = Array.from(
      new Set([...MAIN_BRANCHES, ...(dynamicBranches || []).filter((b) => Boolean(b) && b !== "All")])
    );

    return NextResponse.json({
      success: true,
      agents: paginatedAgents,
      kpis: {
        totalAgents,
        activeAgents,
        totalLeads: filterTotalLeads,
        totalConverted: filterTotalConverted,
        avgConversion,
        totalRevenue: Math.round(totalFilterSettledRevenue),
      },
      availableBranches,
      pagination: {
        page,
        limit,
        total: totalAgents,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      dateWindow: {
        isAll: isAllTime,
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Error in /api/sales/agents:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch sales agents" }, { status: 500 });
  }
};

export const GET = withDB(handler);