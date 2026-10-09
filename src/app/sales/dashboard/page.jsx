"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  CheckCircle2,
  XCircle,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Calendar,
  RefreshCw,
  PieChart as PieChartIcon,
  GitBranch,
  Layers,
  AlertCircle,
  Building2,
  Trophy,
  ArrowRight,
  Sparkles,
  Search,
  ArrowUpRight,
  Plus,
  Clock,
  Zap,
  Receipt,
  FileBarChart,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import SalesKpiCard from "@/components/sales/SalesKpiCard";

const BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida", "Gurgaon"];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "This Month", "Custom"];

function getISTDateString(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const CHART_COLORS = [
  "#2563eb", // blue-600
  "#0d9488", // teal-600
  "#8b5cf6", // purple-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
  "#64748b", // slate-500
];

function ConversionPieCard({
  title,
  subtitle,
  icon: CardIcon,
  accentColor = "from-blue-500 to-indigo-600",
  data,
  loading,
  error,
  onRetry,
}) {
  const total = data?.reduce((acc, item) => acc + (item.value || 0), 0) || 0;
  const hasData = !loading && !error && data && data.length > 0 && total > 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xs shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 flex flex-col flex-1 min-h-[280px]">
      {/* Top gradient accent line */}
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accentColor}`} />

      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100/90 flex items-center justify-between bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-2xs group-hover:scale-105 transition-transform duration-300">
            {CardIcon ? <CardIcon className="w-4 h-4 text-slate-700" /> : <PieChartIcon className="w-4 h-4 text-blue-600" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 leading-tight tracking-tight">{title}</h2>
            <p className="text-[11px] font-normal text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {hasData && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            {total} Converted
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="flex items-center gap-5 animate-pulse">
            <div className="w-28 h-28 rounded-full bg-slate-100 shrink-0 mx-auto" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3.5 bg-slate-100 rounded-md w-3/4" />
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
              <div className="h-3 bg-slate-100 rounded-md w-2/3" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-2">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-xs font-medium text-slate-800">Unable to load conversion analytics</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Please check your network and try again</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200/60 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2 text-slate-400">
              <PieChartIcon className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-xs font-medium text-slate-600">
              No conversion data available
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              No converted records for the selected period
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Donut Chart with Centered Metric */}
            <div className="w-32 h-32 shrink-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={32}
                    outerRadius={54}
                    paddingAngle={2.5}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, props) => [
                      `${val} (${props.payload?.percentage || 0}%)`,
                      props.payload?.name || name,
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.94)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "0.85rem",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "8px 12px",
                      boxShadow: "0 12px 30px -5px rgba(0, 0, 0, 0.35)",
                    }}
                    itemStyle={{ color: "#fff", fontWeight: 500 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Centered Donut Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-semibold text-slate-800 tracking-tight leading-none tabular-nums">
                  {total}
                </span>
                <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                  Total
                </span>
              </div>
            </div>

            {/* Rich Legend List */}
            <div className="flex-1 min-w-0 space-y-2 max-h-36 overflow-y-auto pr-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-200">
              {data.map((item, idx) => {
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate text-slate-600 font-normal text-[11px]" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-1.5">
                        <span className="font-medium text-slate-800 text-xs tabular-nums">{item.value}</span>
                        <span className="text-[11px] font-normal text-slate-400">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Micro Progress Bar */}
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(item.percentage || 0, 100)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalesDashboard() {
  const router = useRouter();

  const [branch, setBranch] = useState("All");
  const [dateRange, setDateRange] = useState("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [agentSearch, setAgentSearch] = useState("");

  const [data, setData] = useState({
    totalLeads: 0,
    bookingDone: 0,
    surgeryBooked: 0,
    converted: 0,
    notConverted: 0,
    revenue: 0,
    activeAgents: 0,
    conversionRate: 0,
    agentPerformance: [],
    packageConversion: [],
    branchConversion: [],
    trends: {
      totalLeads: 0,
      bookingDone: 0,
      surgeryBooked: 0,
      converted: 0,
      notConverted: 0,
      revenue: 0,
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let from = "";
      let to = "";

      const now = new Date();
      if (dateRange === "Today") {
        from = getISTDateString(now);
        to = getISTDateString(now);
      } else if (dateRange === "Yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        from = getISTDateString(y);
        to = getISTDateString(y);
      } else if (dateRange === "Last 7 Days") {
        const past = new Date(now);
        past.setDate(past.getDate() - 7);
        from = getISTDateString(past);
        to = getISTDateString(now);
      } else if (dateRange === "This Month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        from = getISTDateString(start);
        to = getISTDateString(now);
      } else if (dateRange === "Custom" && customFrom) {
        from = customFrom;
        to = customTo || customFrom;
      }

      const res = await fetch("/api/sales/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, from, to, dateFrom: from, dateTo: to }),
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(json.message || "Failed to load dashboard data");
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [branch, dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n || 0);

  const activePeriodLabel =
    dateRange === "Custom"
      ? `${customFrom || "—"} to ${customTo || "—"}`
      : dateRange;

  // Filtered leaderboard agents based on search query
  const filteredAgents = useMemo(() => {
    if (!data.agentPerformance || !data.agentPerformance.length) return [];
    if (!agentSearch.trim()) return data.agentPerformance;
    const q = agentSearch.toLowerCase();
    return data.agentPerformance.filter(
      (a) =>
        (a.name && a.name.toLowerCase().includes(q)) ||
        (a.branch && a.branch.toLowerCase().includes(q))
    );
  }, [data.agentPerformance, agentSearch]);

  // 6 standard KPI cards (excludes the combined Revenue+Conversion card)
  const metrics = [
    {
      label: "Total Appointments",
      value: data.totalLeads,
      icon: Users,
      color: "blue",
      trend: data.trends?.totalLeads,
      onClick: () => router.push("/sales/patients"),
    },
    {
      label: "Converted",
      value: data.converted,
      icon: CheckCircle2,
      color: "green",
      trend: data.trends?.converted,
      onClick: () => router.push("/sales/patients?status=CONSULTED"),
    },
    {
      label: "Not Converted",
      value: data.notConverted,
      icon: XCircle,
      color: "red",
      trend: data.trends?.notConverted,
      onClick: () => router.push("/sales/patients?status=NOT_CONVERTED"),
    },
    {
      label: "Booking Done",
      value: data.bookingDone,
      icon: CheckCircle2,
      color: "teal",
      trend: data.trends?.bookingDone,
      onClick: () => router.push("/sales/patients?status=BOOKING_DONE"),
    },
    {
      label: "Surgery Booked",
      value: data.surgeryBooked,
      icon: CalendarDays,
      color: "purple",
      trend: data.trends?.surgeryBooked,
      onClick: () => router.push("/sales/patients?status=SURGERY_BOOKED"),
    },
    {
      label: "Active Agents",
      value: data.activeAgents,
      icon: TrendingUp,
      color: "orange",
      trend: null,
      onClick: () => router.push("/sales/agents"),
    },
  ];

  const trendColor = (t) =>
    t > 0
      ? "text-emerald-700 bg-emerald-50 border-emerald-200/70"
      : t < 0
      ? "text-rose-700 bg-rose-50 border-rose-200/70"
      : "text-slate-600 bg-slate-50 border-slate-200";
  const trendArrow = (t) => (t > 0 ? "↑" : t < 0 ? "↓" : "—");

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <SalesSidebar />

      <main className="flex-1 min-h-screen overflow-auto bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(59,130,246,0.06),rgba(255,255,255,0))]">
        {/* Sticky Executive Glass Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 py-5 sm:py-6 shadow-2xs">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            {/* Header Title Section */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                <TrendingUp className="w-5 h-5 drop-shadow-xs" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight leading-none">
                    Sales Dashboard
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-2xs">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Live
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[11px] font-normal text-slate-500">
                    Enterprise Conversion & Revenue Analytics
                  </p>
                  {lastUpdated && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 font-normal before:content-['•'] before:mr-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Segmented Date Range Pills */}
              <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-inner">
                {DATE_RANGES.map((r) => {
                  const active = dateRange === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setDateRange(r)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-white text-blue-600 shadow-xs border border-slate-200/60"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Pickers */}
              {dateRange === "Custom" && (
                <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl p-1 shadow-2xs">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="text-slate-700 text-xs font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-xs font-medium px-0.5">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="text-slate-700 text-xs font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Branch Filter Dropdown */}
              <div className="relative inline-flex items-center">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="bg-white border border-slate-200/90 text-slate-700 text-xs font-medium rounded-xl pl-8 pr-7 py-2 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b === "All" ? "All Branches" : `${b} Branch`}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 pointer-events-none text-slate-400 text-xs font-medium">▾</span>
              </div>

              {/* Quick Action: Book Appointment */}
              <button
                onClick={() => router.push("/sales/book-appointment")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-medium rounded-xl shadow-xs shadow-blue-600/25 hover:shadow-md hover:shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Book Appointment</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-600 hover:text-blue-600 hover:border-blue-300 shadow-2xs hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer group"
                title="Refresh dashboard"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content Canvas */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* KPI Cards Section */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs animate-pulse ${
                    i === 0 ? "sm:col-span-2 lg:col-span-2" : ""
                  }`}
                >
                  <div className="h-12 w-12 bg-slate-100 rounded-xl mb-4" />
                  <div className="h-7 bg-slate-100 rounded-md w-1/2 mb-2" />
                  <div className="h-3.5 bg-slate-100 rounded-md w-2/3" />
                  <div className="h-3 bg-slate-100 rounded-md w-full border-t border-slate-100 mt-5 pt-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Flagship Combined Total Settled Revenue + Conversion Rate — Double Width */}
              <div
                className="sm:col-span-2 lg:col-span-2 group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xs shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => router.push("/sales/transactions")}
              >
                {/* 3px Top Multi-tone Gradient Accent Line */}
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />

                {/* Soft Dual-Tone Ambient Gradient Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/40 via-transparent to-indigo-50/30 pointer-events-none" />

                <div className="relative flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100 h-full">
                  {/* Left Section — Settled Revenue */}
                  <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-300 shrink-0">
                          <IndianRupee className="w-5 h-5 drop-shadow-xs" />
                        </div>
                        {data.trends?.revenue !== null && data.trends?.revenue !== undefined && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border shadow-2xs ${trendColor(
                              data.trends.revenue
                            )}`}
                          >
                            {trendArrow(data.trends.revenue)}{" "}
                            {Math.abs(data.trends.revenue)}% vs prior
                          </span>
                        )}
                      </div>

                      <div className="mt-4">
                        <p className="text-3xl sm:text-4xl font-semibold text-slate-800 tracking-tight leading-none group-hover:text-emerald-700 transition-colors tabular-nums">
                          {fmt(data.revenue)}
                        </p>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-2 flex items-center gap-1.5">
                          Settled Revenue
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-normal">Active Period</span>
                      <span className="font-medium text-emerald-700 bg-emerald-50/90 px-2.5 py-0.5 rounded-md border border-emerald-200/60 shadow-2xs">
                        {activePeriodLabel}
                      </span>
                    </div>
                  </div>

                  {/* Right Section — Conversion Efficiency */}
                  <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300 shrink-0">
                          <TrendingUp className="w-5 h-5 drop-shadow-xs" />
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                          <Sparkles className="w-3 h-3" />
                          {data.conversionRate >= 45 ? "Optimal" : data.conversionRate >= 25 ? "Steady" : "Attention"}
                        </span>
                      </div>

                      <div className="mt-4">
                        <p className="text-3xl sm:text-4xl font-semibold text-slate-800 tracking-tight leading-none group-hover:text-indigo-700 transition-colors tabular-nums">
                          {data.conversionRate || 0}%
                        </p>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-2 flex items-center gap-1.5">
                          Conversion Rate
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </p>
                      </div>
                    </div>

                    {/* Multi-tone Progress Bar */}
                    <div className="mt-5 pt-3.5 border-t border-slate-100">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-full transition-all duration-700 shadow-xs"
                          style={{ width: `${Math.min(data.conversionRate || 0, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[11px]">
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {data.converted || 0} converted
                        </span>
                        <span className="font-medium text-slate-500">
                          {data.totalLeads || 0} total leads
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards 2-7: 6 Standard Metric Cards */}
              {metrics.map((m) => (
                <SalesKpiCard
                  key={m.label}
                  title={m.label}
                  value={m.value}
                  icon={m.icon}
                  color={m.color}
                  trend={m.trend}
                  footerLabel="Active Period"
                  footerValue={activePeriodLabel}
                  onClick={m.onClick}
                />
              ))}
            </div>
          )}

          {/* Bottom Grid: Agent Leaderboard (Left 2 cols) + Conversion Analytics (Right 1 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* Left: Agent Leaderboard Card */}
            <div className="lg:col-span-2 bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] flex flex-col h-full hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.06)] transition-all duration-300">
              {/* Header with Search and Stats */}
              <div className="px-5 py-4 border-b border-slate-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs">
                    <Trophy className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">
                        Agent Leaderboard
                      </h2>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                        {data.agentPerformance?.length || 0} Agents
                      </span>
                    </div>
                    <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                      Top sales performers ranked by conversion volume
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Instant Agent Filter Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter agent..."
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      className="bg-white border border-slate-200/90 text-slate-700 text-xs rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-32 sm:w-40 font-normal"
                    />
                  </div>

                  <button
                    onClick={() => router.push("/sales/agents")}
                    className="group inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors px-2.5 py-1.5 rounded-lg hover:bg-blue-50 shrink-0 cursor-pointer"
                  >
                    <span>All Agents</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Table Body */}
              {loading ? (
                <div className="p-6 space-y-3.5 flex-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredAgents.length > 0 ? (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Rank</th>
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Agent Name</th>
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Branch</th>
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Leads</th>
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Converted</th>
                        <th className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-400 font-medium">Conv. Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {filteredAgents.slice(0, 6).map((agent, i) => {
                        const isTop1 = i === 0 && !agentSearch;
                        const isTop2 = i === 1 && !agentSearch;
                        const isTop3 = i === 2 && !agentSearch;

                        return (
                          <tr
                            key={i}
                            className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                            onClick={() => router.push("/sales/agents")}
                          >
                            {/* Rank Medal / Badge */}
                            <td className="px-5 py-3.5">
                              {isTop1 ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-amber-500/30">
                                  1
                                </div>
                              ) : isTop2 ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                  2
                                </div>
                              ) : isTop3 ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-700 to-orange-800 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                                  3
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-medium text-xs flex items-center justify-center">
                                  {i + 1}
                                </div>
                              )}
                            </td>

                            {/* Agent Identity */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-xs ring-2 ring-white">
                                  {agent.name?.charAt(0)?.toUpperCase() || "A"}
                                </div>
                                <span className="text-sm text-slate-800 font-medium group-hover:text-blue-600 transition-colors">
                                  {agent.name}
                                </span>
                              </div>
                            </td>

                            {/* Branch Tag */}
                            <td className="px-5 py-3.5">
                              <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80">
                                {agent.branch || "—"}
                              </span>
                            </td>

                            {/* Leads */}
                            <td className="px-5 py-3.5 text-sm text-slate-600 font-normal tabular-nums">
                              {agent.totalLeads}
                            </td>

                            {/* Converted */}
                            <td className="px-5 py-3.5 text-sm text-emerald-700 font-semibold tabular-nums">
                              {agent.converted}
                            </td>

                            {/* Conversion Rate Micro Progress */}
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      agent.conversionRate >= 50
                                        ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                                        : agent.conversionRate >= 30
                                        ? "bg-gradient-to-r from-blue-500 to-indigo-600"
                                        : "bg-gradient-to-r from-amber-500 to-orange-600"
                                    }`}
                                    style={{ width: `${Math.min(agent.conversionRate || 0, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-700 font-medium w-10 tabular-nums">
                                  {agent.conversionRate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 flex-1">
                  <Users className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-medium text-slate-500">
                    {agentSearch ? "No agents matching your search" : "No agent data for this period"}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Conversion Analytics (2 Donut Cards) */}
            <div className="flex flex-col gap-5 h-full">
              <ConversionPieCard
                title="Package-wise Conversion"
                subtitle="Distribution across treatment packages"
                icon={Layers}
                accentColor="from-blue-500 to-indigo-600"
                data={data.packageConversion}
                loading={loading}
                error={error}
                onRetry={fetchData}
              />
              <ConversionPieCard
                title="Branch-wise Conversion"
                subtitle="Distribution across clinic locations"
                icon={GitBranch}
                accentColor="from-teal-500 to-emerald-600"
                data={data.branchConversion}
                loading={loading}
                error={error}
                onRetry={fetchData}
              />
            </div>
          </div>

          {/* Quick Operations & Shortcuts Hub */}
          <div className="bg-white/95 backdrop-blur-xs border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shadow-2xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">
                    Quick Operations & Shortcuts
                  </h3>
                  <p className="text-[11px] font-normal text-slate-400 mt-0.5">
                    Fast-access shortcuts to frequently used sales and patient workflows
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-500 bg-slate-50 rounded-full border border-slate-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                4 Core Workflows
              </span>
            </div>

            {/* 4 Interactive Operations Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Tile 1: Book Consultation */}
              <div
                onClick={() => router.push("/sales/book-appointment")}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-4 transition-all duration-300 hover:border-blue-300 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.12)] hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                      <CalendarDays className="w-5 h-5 drop-shadow-xs" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100/80 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors flex items-center justify-center shadow-2xs">
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                      Schedule Consultation
                    </h4>
                    <p className="text-xs font-normal text-slate-400 mt-1 leading-relaxed">
                      Register new patient inquiry and schedule clinic visit
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-medium text-blue-600 gap-1 group-hover:gap-1.5 transition-all">
                  <span>Book Appointment</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Tile 2: Patient Directory */}
              <div
                onClick={() => router.push("/sales/patients")}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-4 transition-all duration-300 hover:border-teal-300 hover:shadow-[0_8px_20px_-6px_rgba(13,148,136,0.12)] hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-teal-500 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                      <Users className="w-5 h-5 drop-shadow-xs" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100/80 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors flex items-center justify-center shadow-2xs">
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-teal-600 transition-colors">
                      Patient Directory
                    </h4>
                    <p className="text-xs font-normal text-slate-400 mt-1 leading-relaxed">
                      Browse full roster, consult stages, and patient history
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-medium text-teal-600 gap-1 group-hover:gap-1.5 transition-all">
                  <span>Browse Patients</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Tile 3: Transactions & Receipts */}
              <div
                onClick={() => router.push("/sales/transactions")}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-4 transition-all duration-300 hover:border-indigo-300 hover:shadow-[0_8px_20px_-6px_rgba(79,70,229,0.12)] hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                      <Receipt className="w-5 h-5 drop-shadow-xs" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100/80 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors flex items-center justify-center shadow-2xs">
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      Transactions & Receipts
                    </h4>
                    <p className="text-xs font-normal text-slate-400 mt-1 leading-relaxed">
                      Reconcile settled payments, advances, and bank receipts
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-medium text-indigo-600 gap-1 group-hover:gap-1.5 transition-all">
                  <span>View Transactions</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>

              {/* Tile 4: Sales Reports & Analytics */}
              <div
                onClick={() => router.push("/sales/reports")}
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-4 transition-all duration-300 hover:border-purple-300 hover:shadow-[0_8px_20px_-6px_rgba(168,85,247,0.12)] hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
                      <FileBarChart className="w-5 h-5 drop-shadow-xs" />
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-slate-100/80 text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors flex items-center justify-center shadow-2xs">
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <h4 className="text-sm font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                      Sales Reports
                    </h4>
                    <p className="text-xs font-normal text-slate-400 mt-1 leading-relaxed">
                      Export branch conversions, agent performance, and metrics
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-medium text-purple-600 gap-1 group-hover:gap-1.5 transition-all">
                  <span>Export Reports</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}