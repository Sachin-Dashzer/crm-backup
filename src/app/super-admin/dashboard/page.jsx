"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  Users, UserCheck, UserX, IndianRupee, Package,
  ClipboardList, Activity, TrendingUp, Stethoscope,
  Crown, ChevronDown, Briefcase, Calendar, MapPin,
  RefreshCw, HeartPulse, Scissors, BarChart2, CreditCard, Droplets,
} from "lucide-react";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";
import { ALL_BRANCHES } from "@/lib/branches";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const BRANCHES    = ["All", ...ALL_BRANCHES];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom"];

const PALETTE = [
  "#6366f1","#8b5cf6","#ec4899","#f59e0b",
  "#10b981","#3b82f6","#f97316","#14b8a6","#ef4444","#a78bfa",
];

const METHOD_ICONS = {
  upi: "📲", cash: "💵", card: "💳", banking: "🏦", bajaj_loan: "📄", fibe_loan: "📄", other: "💰",
};

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const rupee = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const fmt = (n) => new Intl.NumberFormat("en-IN").format(n || 0);

function buildDateRange(range, custom) {
  const now = new Date();
  let from = new Date(), to = new Date();
  to.setHours(23, 59, 59, 999);

  if (range === "Today") {
    from.setHours(0, 0, 0, 0);
  } else if (range === "Yesterday") {
    from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
    to   = new Date(from); to.setHours(23, 59, 59, 999);
  } else if (range === "Last 7 Days") {
    from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
  } else if (range === "Last 30 Days") {
    from = new Date(now); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
  } else if (range === "Custom" && custom.from) {
    from = new Date(custom.from); from.setHours(0, 0, 0, 0);
    to   = custom.to ? new Date(custom.to) : new Date(custom.from);
    to.setHours(23, 59, 59, 999);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

/* ─────────────────────────────────────────────
   KPI Card
───────────────────────────────────────────── */
const COLOR_MAP = {
  indigo: { accent: "bg-indigo-500",  soft: "bg-indigo-50",  text: "text-indigo-600", border: "border-indigo-100" },
  purple: { accent: "bg-purple-500",  soft: "bg-purple-50",  text: "text-purple-600", border: "border-purple-100" },
  green:  { accent: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-600",border: "border-emerald-100"},
  amber:  { accent: "bg-amber-500",   soft: "bg-amber-50",   text: "text-amber-600",  border: "border-amber-100"  },
  red:    { accent: "bg-red-500",     soft: "bg-red-50",     text: "text-red-600",    border: "border-red-100"    },
  blue:   { accent: "bg-blue-500",    soft: "bg-blue-50",    text: "text-blue-600",   border: "border-blue-100"   },
  teal:   { accent: "bg-teal-500",    soft: "bg-teal-50",    text: "text-teal-600",   border: "border-teal-100"   },
  pink:   { accent: "bg-pink-500",    soft: "bg-pink-50",    text: "text-pink-600",   border: "border-pink-100"   },
  rose:   { accent: "bg-rose-500",    soft: "bg-rose-50",    text: "text-rose-600",   border: "border-rose-100"   },
};

function KpiCard({ title, value, subtitle, icon: Icon, color }) {
  const c = COLOR_MAP[color] || COLOR_MAP.indigo;
  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group`}>
      <div className={`h-1 ${c.accent}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl ${c.soft} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${c.text}`} />
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${c.text} opacity-70`}>{subtitle}</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-1.5">{title}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section Header
───────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, color = "text-gray-700", accent = "bg-gray-100" }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-lg ${accent} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Chart Card
───────────────────────────────────────────── */
function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Staff Role Colors
───────────────────────────────────────────── */
const STAFF_COLORS = {
  Agent:      { soft: "bg-blue-50",   text: "text-blue-700",   bar: "#3b82f6" },
  Counsellor: { soft: "bg-purple-50", text: "text-purple-700", bar: "#8b5cf6" },
  Doctor:     { soft: "bg-emerald-50",text: "text-emerald-700",bar: "#10b981" },
  Technician: { soft: "bg-amber-50",  text: "text-amber-700",  bar: "#f59e0b" },
  Implanter:  { soft: "bg-pink-50",   text: "text-pink-700",   bar: "#ec4899" },
  Others:     { soft: "bg-gray-50",   text: "text-gray-600",   bar: "#9ca3af" },
  Hr:         { soft: "bg-rose-50",   text: "text-rose-700",   bar: "#f43f5e" },
};

/* ─────────────────────────────────────────────
   Skeleton Loader
───────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function SuperAdminDashboard() {
  const [branch, setBranch]       = useState("All");
  const [dateRange, setDateRange] = useState("Today");
  const [custom, setCustom]       = useState({ from: "", to: "" });
  const [loading, setLoading]     = useState(true);
  const [data, setData]           = useState(null);
  const [error, setError]         = useState(null);

  const fetchData = useCallback(async () => {
    if (dateRange === "Custom" && !custom.from) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = buildDateRange(dateRange, custom);
      const res  = await fetch("/api/super-admin/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, from, to }),
      });
      const json = await res.json();
      if (json.success) setData(json);
      else setError(json.message || "Failed to load");
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }, [branch, dateRange, custom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const d = data || {};

  return (
    <section className="flex min-h-screen bg-[#f8f9fc]">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">

        {/* ── Header ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-md">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Super Admin Dashboard</h1>
                <p className="text-[11px] text-gray-400 mt-0.5">System-wide overview · All tenants</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Branch */}
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="pl-7 pr-7 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none cursor-pointer shadow-sm"
                >
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Date Range */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="pl-7 pr-7 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 appearance-none cursor-pointer shadow-sm"
                >
                  {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Custom date inputs */}
              {dateRange === "Custom" && (
                <>
                  <input
                    type="date"
                    value={custom.from}
                    onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
                  />
                  <input
                    type="date"
                    value={custom.to}
                    onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
                  />
                </>
              )}

              {/* Refresh */}
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6 space-y-8">

          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                <Activity className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">{error}</p>
                <button onClick={fetchData} className="mt-3 text-xs font-semibold text-amber-600 hover:text-amber-700 underline">
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>

              {/* ── Leads & Patients ── */}
              <div>
                <SectionHeader icon={HeartPulse} title="Leads & Patients" color="text-blue-600" accent="bg-blue-50" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard title="Total Leads"     value={fmt(d.totalLeads)}      icon={ClipboardList} color="blue"   subtitle={dateRange} />
                  <KpiCard title="Appointments"    value={fmt(d.appointments)}    icon={Users}         color="indigo" subtitle="In period" />
                  <KpiCard title="Visited"         value={fmt(d.visited)}         icon={UserCheck}     color="green"  subtitle="Counselled" />
                  <KpiCard title="Converted"       value={fmt(d.converted)}       icon={TrendingUp}    color="teal"   subtitle="Ready" />
                  <KpiCard title="Not Converted"   value={fmt(d.notConverted)}    icon={UserX}         color="red"    subtitle="Dropped" />
                  <KpiCard title="Surgeries"       value={fmt(d.surgeries)}       icon={Scissors}      color="purple" subtitle="Done" />
                </div>
              </div>

              {/* ── HR Recruitment ── */}
              <div>
                <SectionHeader icon={Briefcase} title="HR Recruitment" color="text-rose-600" accent="bg-rose-50" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard title="Total Candidates"   value={fmt(d.totalInterviews)}     icon={ClipboardList} color="purple" subtitle={dateRange} />
                  <KpiCard title="Selected"           value={fmt(d.selectedInterviews)}  icon={UserCheck}     color="green"  subtitle="Hired" />
                  <KpiCard title="Rejected"           value={fmt(d.rejectedInterviews)}  icon={UserX}         color="red"    subtitle="Not selected" />
                  <KpiCard title="Scheduled"          value={fmt(d.scheduledInterviews)} icon={Calendar}      color="amber"  subtitle="Upcoming" />
                </div>

                {/* Mini HR progress bar */}
                {(d.totalInterviews > 0) && (
                  <div className="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Selection Rate</span>
                      <span className="text-xs font-bold text-emerald-600">
                        {d.totalInterviews > 0 ? ((d.selectedInterviews / d.totalInterviews) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 gap-0.5">
                      <div
                        className="bg-emerald-500 transition-all duration-700 rounded-l-full"
                        style={{ width: `${d.totalInterviews > 0 ? (d.selectedInterviews / d.totalInterviews) * 100 : 0}%` }}
                      />
                      <div
                        className="bg-red-400 transition-all duration-700"
                        style={{ width: `${d.totalInterviews > 0 ? (d.rejectedInterviews / d.totalInterviews) * 100 : 0}%` }}
                      />
                      <div
                        className="bg-amber-400 transition-all duration-700"
                        style={{ width: `${d.totalInterviews > 0 ? (d.scheduledInterviews / d.totalInterviews) * 100 : 0}%` }}
                      />
                      <div className="flex-1 bg-gray-200 rounded-r-full" />
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {[
                        { label: "Selected", color: "bg-emerald-500" },
                        { label: "Rejected", color: "bg-red-400" },
                        { label: "Scheduled", color: "bg-amber-400" },
                        { label: "Others", color: "bg-gray-200" },
                      ].map(({ label, color }) => (
                        <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                          <span className={`w-2 h-2 rounded-full ${color}`} /> {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── PRP & GFC ── */}
              <div>
                <SectionHeader icon={Droplets} title="PRP & GFC Sessions" color="text-teal-600" accent="bg-teal-50" />
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <KpiCard title="PRP Sessions"  value={fmt(d.prp?.prpSessions  ?? 0)} subtitle={rupee(d.prp?.prpRevenue  ?? 0)} icon={Droplets}     color="teal"   />
                  <KpiCard title="GFC Sessions"  value={fmt(d.prp?.gfcSessions  ?? 0)} subtitle={rupee(d.prp?.gfcRevenue  ?? 0)} icon={Droplets}     color="purple" />
                  <KpiCard title="Total Sessions" value={fmt(d.prp?.totalSessions ?? 0)} subtitle="Combined"                       icon={Activity}     color="indigo" />
                  <KpiCard title="PRP+GFC Revenue" value={rupee(d.prp?.totalRevenue ?? 0)} subtitle={fmt(d.prp?.totalSessions ?? 0) + " sessions"}  icon={IndianRupee} color="green" />
                </div>

                {((d.prp?.totalSessions ?? 0) > 0) && (
                  <div className="mt-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-3">PRP vs GFC — session split</p>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-teal-600 w-8 text-right">{d.prp?.prpSessions ?? 0}</span>
                      <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                        {(() => {
                          const total  = d.prp?.totalSessions || 1;
                          const prpPct = ((d.prp?.prpSessions ?? 0) / total) * 100;
                          return (
                            <>
                              <div className="h-full bg-teal-500 transition-all duration-700" style={{ width: `${prpPct}%` }} />
                              <div className="h-full bg-purple-500 transition-all duration-700" style={{ width: `${100 - prpPct}%` }} />
                            </>
                          );
                        })()}
                      </div>
                      <span className="text-[11px] font-bold text-purple-600 w-8">{d.prp?.gfcSessions ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-6 mt-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-teal-500" /> PRP · {rupee(d.prp?.prpRevenue ?? 0)}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-purple-500" /> GFC · {rupee(d.prp?.gfcRevenue ?? 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Revenue & Stock ── */}
              <div>
                <SectionHeader icon={IndianRupee} title="Revenue & Inventory" color="text-emerald-600" accent="bg-emerald-50" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard title="Amount Received"  value={rupee(d.totalAmount)}    icon={IndianRupee} color="green"  subtitle="All revenue" />
                  <KpiCard title="Medicine Sales"   value={rupee(d.medicineAmount)} icon={Stethoscope} color="teal"   subtitle="Medicine" />
                  <KpiCard title="Stock Items"      value={fmt(d.totalStockItems)}  icon={Package}     color="indigo" subtitle={`${fmt(d.totalStockQty)} units`} />
                  <KpiCard title="Stock Value"      value={rupee(d.totalStockValue)}icon={BarChart2}   color="amber"  subtitle="MRP × Qty" />
                </div>
              </div>

              {/* ── Daily Revenue Chart ── */}
              <ChartCard
                title="Daily Revenue"
                subtitle={`${dateRange}${branch !== "All" ? ` · ${branch}` : ""}`}
              >
                {d.perDay && d.perDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={d.perDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtDate}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip
                        formatter={(v) => [rupee(v), "Revenue"]}
                        labelFormatter={(l) => new Date(l).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" })}
                        contentStyle={{ borderRadius: "14px", border: "1px solid #e5e7eb", fontSize: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fill="url(#revGrad)"
                        dot={{ r: 3.5, fill: "#f59e0b", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#f59e0b" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-52 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <BarChart2 className="w-10 h-10 opacity-30" />
                    <p className="text-sm">No revenue data for this period</p>
                  </div>
                )}
              </ChartCard>

              {/* ── Technique-wise + Staff ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Technique-wise */}
                <ChartCard title="Services / Technique-wise Sales" subtitle="By revenue contribution">
                  {d.techniqueWise && d.techniqueWise.length > 0 ? (
                    <div className="space-y-3.5">
                      {d.techniqueWise.map((item, i) => {
                        const pct = d.totalAmount > 0 ? ((item.total / d.totalAmount) * 100).toFixed(1) : 0;
                        const color = PALETTE[i % PALETTE.length];
                        return (
                          <div key={item.procedure}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                <span className="text-xs font-medium text-gray-700">{item.procedure}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">{item.count} txn</span>
                                <span className="text-xs font-bold text-gray-800">{rupee(item.total)}</span>
                                <span className="text-[10px] font-semibold w-8 text-right" style={{ color }}>{pct}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-52 flex flex-col items-center justify-center gap-3 text-gray-400">
                      <BarChart2 className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No technique data for this period</p>
                    </div>
                  )}
                </ChartCard>

                {/* Staff Breakdown */}
                <ChartCard title="Staff Breakdown" subtitle="Active employees by role">
                  {d.staffBreakdown && Object.keys(d.staffBreakdown).length > 0 ? (
                    <>
                      {/* Total badge */}
                      <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                          <Users className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900 leading-none">{fmt(d.totalStaff)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Total active employees</p>
                        </div>
                      </div>

                      {/* Role rows */}
                      <div className="space-y-2.5">
                        {Object.entries(d.staffBreakdown)
                          .sort((a, b) => b[1] - a[1])
                          .map(([role, count]) => {
                            const c = STAFF_COLORS[role] || { soft: "bg-gray-50", text: "text-gray-600", bar: "#9ca3af" };
                            const pct = d.totalStaff > 0 ? ((count / d.totalStaff) * 100).toFixed(0) : 0;
                            return (
                              <div key={role} className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold ${c.text} ${c.soft} px-2 py-0.5 rounded-lg w-20 text-center shrink-0`}>
                                  {role}
                                </span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="h-2 rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: c.bar }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-700 w-6 text-right shrink-0">{count}</span>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  ) : (
                    <div className="h-52 flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Users className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No staff data available</p>
                    </div>
                  )}
                </ChartCard>
              </div>

              {/* ── Payment Method Breakdown ── */}
              {d.byMethod && d.byMethod.length > 0 && (
                <div>
                  <SectionHeader icon={CreditCard} title="Revenue by Payment Method" color="text-indigo-600" accent="bg-indigo-50" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {d.byMethod
                      .sort((a, b) => b.total - a.total)
                      .map((item) => (
                        <div
                          key={item.method}
                          className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4 text-center"
                        >
                          <p className="text-2xl mb-2">{METHOD_ICONS[item.method] || "💰"}</p>
                          <p className="text-sm font-bold text-gray-900">{rupee(item.total)}</p>
                          <p className="text-[11px] font-semibold text-gray-500 mt-0.5 capitalize">{item.method?.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.count} transactions</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </main>
    </section>
  );
}
