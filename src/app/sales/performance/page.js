"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  BarChart3,
  TrendingUp,
  Filter,
  RefreshCw,
  ShieldCheck,
  Calendar,
  IndianRupee,
  MapPin,
  Layers,
  ArrowRight,
  Sparkles,
  Phone,
} from "lucide-react";
import SalesKpiCard from "@/components/sales/SalesKpiCard";

const BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida", "Gurgaon"];

const PALETTE = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899"];

const fmtRupee = (num) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num || 0);

// Light theme tooltip for Recharts
function LightTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-md text-xs space-y-1">
        <p className="font-semibold text-slate-800">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color || entry.fill }}>
            {entry.name}:{" "}
            <span className="font-bold">
              {typeof entry.value === "number" && entry.value > 1000
                ? fmtRupee(entry.value)
                : entry.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function SalesPerformancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    agentPerformance: [],
    revenueByBranch: [],
    revenueByProcedure: [],
    monthlyRevenue: [],
    conversionFunnel: [],
    patientStatus: [],
  });

  const [selectedBranch, setSelectedBranch] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== "All") params.append("branch", selectedBranch);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/sales/performance?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Error fetching sales performance data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Aggregate metrics
  const totalRevenue = (data.monthlyRevenue || []).reduce((acc, curr) => acc + (curr.revenue || 0), 0);
  const totalLeads = (data.agentPerformance || []).reduce((acc, curr) => acc + (curr.patients || 0), 0);
  // Pick the top performer: API now sorts by conversionRate → converted → revenue → leads.
  // Exclude agents with 0 leads (they cannot have a meaningful conversion rate).
  const topAgent =
    (data.agentPerformance || []).find((a) => a.patients > 0) || null;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
      <SalesSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Sales Performance & Analytics
                </h1>
                <p className="text-xs text-slate-500">
                  Analytics, conversion funnel, and revenue trends strictly for sales agents & telecallers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                View-Only
              </span>
              <button
                onClick={fetchChartData}
                disabled={loading}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-sm"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b === "All" ? "All Branches" : `${b} Branch`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranch("All");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SalesKpiCard
              title="Total Period Revenue"
              value={fmtRupee(totalRevenue)}
              icon={IndianRupee}
              color="green"
              footerLabel="Branch Filter"
              footerValue={selectedBranch === "All" ? "All Branches" : `${selectedBranch} Branch`}
            />
            <SalesKpiCard
              title="Sales Leads Engaged"
              value={totalLeads}
              icon={Phone}
              color="cyan"
              footerLabel="Assignment"
              footerValue="Telecallers"
            />
            <SalesKpiCard
              title="Top Performer"
              value={topAgent ? topAgent.name : "—"}
              icon={TrendingUp}
              color="orange"
              footerLabel="Efficiency"
              footerValue={
                topAgent
                  ? `${topAgent.converted ?? 0} converted · ${topAgent.conversionRate ?? 0}% rate`
                  : "No Data"
              }
            />
          </div>

          {/* Conversion Funnel */}
          {data.conversionFunnel && data.conversionFunnel.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-3 shadow-sm">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Sales Pipeline & Conversion Stages
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.conversionFunnel.map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1"
                  >
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      Stage {idx + 1}
                    </span>
                    <p className="text-sm font-semibold text-slate-800">{step.stage}</p>
                    <p className="text-xl font-bold text-blue-600">{step.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts Row 1: Agent Leaderboard & Monthly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Sales Agent Leaderboard */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Telecaller / Agent Leaderboard</h3>
                  <p className="text-xs text-slate-500">Total inquiries handled by sales agents</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                  Agents Only
                </span>
              </div>
              <div className="h-72">
                {data.agentPerformance?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.agentPerformance.slice(0, 8)}
                      margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        stroke="#64748b"
                        fontSize={11}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                      />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip content={<LightTooltip />} />
                      <Bar dataKey="patients" name="Leads Handled" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No agent performance records available
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Monthly Revenue Trajectory</h3>
                <p className="text-xs text-slate-500">12-month historical settled revenue</p>
              </div>
              <div className="h-72">
                {data.monthlyRevenue?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.monthlyRevenue}
                      margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<LightTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue (INR)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ fill: "#10b981", r: 3 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No monthly trend data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row 2: Branch Contribution & Procedure Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Revenue by Branch */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Branch Revenue Share</h3>
                <p className="text-xs text-slate-500">Distribution across operational clinics</p>
              </div>
              <div className="h-64">
                {data.revenueByBranch?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.revenueByBranch}
                      margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="branch" stroke="#64748b" fontSize={11} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<LightTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No branch data available
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by Procedure */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Procedure & Treatment Types</h3>
                <p className="text-xs text-slate-500">Revenue split by surgical vs medical therapies</p>
              </div>
              <div className="h-64">
                {data.revenueByProcedure?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.revenueByProcedure}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                      />
                      <YAxis
                        type="category"
                        dataKey="procedure"
                        stroke="#64748b"
                        fontSize={11}
                        width={90}
                      />
                      <Tooltip content={<LightTooltip />} />
                      <Bar dataKey="revenue" name="Revenue" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No procedure data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}