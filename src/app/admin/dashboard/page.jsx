"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Calendar, Activity, CheckCircle2, Stethoscope, IndianRupee,
  Users, TrendingUp, RefreshCw, ChevronDown,
  MapPin, ArrowUpRight, ArrowDownRight, Minus,
  BarChart2, Target,
} from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";

/* ─── Constants ─────────────────────────────────────────────────────────── */
const BRANCHES    = ["All", "Delhi", "Mumbai", "Hyderabad"];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom"];

const PALETTE = [
  "#6366f1","#8b5cf6","#a78bfa","#ec4899",
  "#3b82f6","#10b981","#f59e0b","#14b8a6",
];

const METHOD_META = {
  upi:     { label: "UPI",     color: "#6366f1", icon: "📲" },
  cash:    { label: "Cash",    color: "#10b981", icon: "💵" },
  card:    { label: "Card",    color: "#3b82f6", icon: "💳" },
  banking: { label: "Banking", color: "#8b5cf6", icon: "🏦" },
  Loan:    { label: "Loan",    color: "#f97316", icon: "📄" },
  other:   { label: "Other",   color: "#9ca3af", icon: "💰" },
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const fmt   = (n) => new Intl.NumberFormat("en-IN").format(n || 0);
const fmtK  = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` : `₹${n || 0}`;
const fmtDate = (s) => {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

function buildPayload(dateRange, customDates, branch) {
  let from = new Date(), to = new Date();
  to.setHours(23, 59, 59, 999);

  if (dateRange === "Today") {
    from.setHours(0, 0, 0, 0);
  } else if (dateRange === "Yesterday") {
    from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
    to = new Date(from); to.setHours(23, 59, 59, 999);
  } else if (dateRange === "Last 7 Days") {
    from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
  } else if (dateRange === "Last 30 Days") {
    from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
  } else if (dateRange === "Custom" && customDates.from) {
    from = new Date(customDates.from); from.setHours(0, 0, 0, 0);
    to   = customDates.to ? new Date(customDates.to) : new Date(customDates.from);
    to.setHours(23, 59, 59, 999);
  }
  return { branch, from: from.toISOString(), to: to.toISOString() };
}

/* ─── Reusable UI ────────────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />;
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1.5">{fmtDate(label) || label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {formatter ? formatter(p.value, p.name) : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ title, value, growth, icon: Icon, accent, soft, text, onClick }) {
  const isPositive = growth > 0;
  const isZero     = growth === 0;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden text-left group w-full"
    >
      <div className={`h-1 ${accent}`} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl ${soft} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${text}`} />
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
            isZero
              ? "bg-gray-100 text-gray-500"
              : isPositive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-500"
          }`}>
            {isZero
              ? <Minus className="w-3 h-3" />
              : isPositive
              ? <ArrowUpRight className="w-3 h-3" />
              : <ArrowDownRight className="w-3 h-3" />
            }
            {Math.abs(growth)}%
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs font-medium text-gray-500 mt-1.5 group-hover:text-indigo-600 transition-colors">{title}</p>
      </div>
    </button>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function AdminDashboard() {
  const router = useRouter();
  const [branch,    setBranch]    = useState("All");
  const [dateRange, setDateRange] = useState("Today");
  const [custom,    setCustom]    = useState({ from: "", to: "" });
  const [loading,   setLoading]   = useState(true);
  const [data,      setData]      = useState(null);

  const fetchData = useCallback(async () => {
    if (dateRange === "Custom" && !custom.from) return;
    setLoading(true);
    try {
      const payload = buildPayload(dateRange, custom, branch);
      const res = await fetch("/api/admin/dashboard", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body:    JSON.stringify(payload),
      });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [branch, dateRange, custom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const d = data || {};

  /* ── KPI Metrics ── */
  const metrics = [
    {
      title: "Appointments",
      value: fmt(d.appointment?.count ?? 0),
      growth: d.appointment?.growth ?? 0,
      icon: Calendar,
      accent: "bg-indigo-500", soft: "bg-indigo-50", text: "text-indigo-600",
      href: "/admin/patients",
    },
    {
      title: "Patients Visited",
      value: fmt(d.visitPatient?.count ?? 0),
      growth: d.visitPatient?.growth ?? 0,
      icon: Activity,
      accent: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-600",
      href: "/admin/patients?visited=true",
    },
    {
      title: "Ready for Surgery",
      value: fmt(d.readyforSurgery?.count ?? 0),
      growth: d.readyforSurgery?.growth ?? 0,
      icon: CheckCircle2,
      accent: "bg-purple-500", soft: "bg-purple-50", text: "text-purple-600",
      href: "/admin/patients?status=CONSULTED",
    },
    {
      title: "Surgeries Done",
      value: fmt(d.surgeryPatient?.count ?? 0),
      growth: d.surgeryPatient?.growth ?? 0,
      icon: Stethoscope,
      accent: "bg-blue-500", soft: "bg-blue-50", text: "text-blue-600",
      href: "/admin/patients?status=CLOSED",
    },
    {
      title: "Revenue",
      value: fmtK(d.amountReceived?.total ?? 0),
      growth: d.amountReceived?.growth ?? 0,
      icon: IndianRupee,
      accent: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-600",
      href: "/admin/transactions",
    },
  ];

  /* ── Chart data ── */
  const perDay7    = (d.last7Days?.perDay  || []).map((x) => ({ date: x.date, amount: x.total }));
  const perDay30      = (d.last30Days?.perDay   || []).map((x) => ({ date: x.date, amount: x.total }));
  const perDayMonth   = (d.thisMonth?.perDay    || []).map((x) => ({ date: x.date, amount: x.total }));
  const byMethod7     = d.last7Days?.amountByMethod  || [];
  const byMethod30    = d.last30Days?.amountByMethod || [];
  const byMethodMonth = d.thisMonth?.amountByMethod  || [];
  const byTechnique = d.amountByTechnique || [];

  const patientFunnel = [
    { stage: "Appointments",    count: d.appointment?.count     ?? 0 },
    { stage: "Visited",         count: d.visitPatient?.count    ?? 0 },
    { stage: "Ready for Surg.", count: d.readyforSurgery?.count ?? 0 },
    { stage: "Surgeries Done",  count: d.surgeryPatient?.count  ?? 0 },
  ];

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <AdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">

        {/* ── Sticky Header ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                <BarChart2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Admin Dashboard</h1>
                <p className="text-[11px] text-gray-400 mt-0.5">Overview across all patient and financial metrics</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Branch */}
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <select value={branch} onChange={(e) => setBranch(e.target.value)}
                  className="pl-7 pr-7 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none cursor-pointer shadow-sm">
                  {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Date Range */}
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}
                  className="pl-7 pr-7 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none cursor-pointer shadow-sm">
                  {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>

              {dateRange === "Custom" && (
                <>
                  <input type="date" value={custom.from}
                    onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm" />
                  <input type="date" value={custom.to} min={custom.from}
                    onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm" />
                </>
              )}

              <button onClick={fetchData} disabled={loading}
                className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl bg-white hover:bg-indigo-50 shadow-sm transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 text-indigo-500 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
                <Skeleton className="h-64" />
              </div>
            </div>
          ) : (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {metrics.map((m) => (
                  <KpiCard
                    key={m.title}
                    title={m.title}
                    value={m.value}
                    growth={m.growth}
                    icon={m.icon}
                    accent={m.accent}
                    soft={m.soft}
                    text={m.text}
                    onClick={() => router.push(m.href)}
                  />
                ))}
              </div>

              {/* ── Revenue + Patient Funnel ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ChartCard title="Revenue — Last 7 Days" subtitle="Daily collection trend">
                  {perDay7.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={perDay7}>
                        <defs>
                          <linearGradient id="revGrad7" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip formatter={(v) => fmtK(v)} />} />
                        <Area type="monotone" dataKey="amount" name="Revenue" stroke="#6366f1" fill="url(#revGrad7)" strokeWidth={2.5} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-gray-400 text-sm">No revenue data for this period</div>
                  )}
                </ChartCard>

                <ChartCard title="Patient Journey Funnel" subtitle={`${dateRange} — stage-wise breakdown`}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={patientFunnel} layout="vertical" margin={{ left: 10, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} width={105} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="count" name="Patients" radius={[0, 6, 6, 0]}
                        label={{ position: "right", fontSize: 11, fontWeight: 700, fill: "#374151" }}>
                        {patientFunnel.map((_, i) => (
                          <Cell key={i} fill={["#6366f1", "#8b5cf6", "#a78bfa", "#3b82f6"][i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              {/* ── 30-day Revenue + Payment Methods + Summary ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ChartCard title="Revenue — This Month" subtitle="Daily collection this month" className="lg:col-span-2">
                  {perDayMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={perDayMonth}>
                        <defs>
                          <linearGradient id="revGradMonth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tickFormatter={fmtK} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip formatter={(v) => fmtK(v)} />} />
                        <Area type="monotone" dataKey="amount" name="Revenue" stroke="#8b5cf6" fill="url(#revGradMonth)" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data</div>
                  )}
                </ChartCard>

                {/* Payment Methods */}
                <ChartCard title="Payment Methods" subtitle="Last 7 days">
                  {byMethod7.length > 0 ? (
                    <div className="space-y-2.5">
                      {byMethod7.slice(0, 5).map((m) => {
                        const meta = METHOD_META[m.method] || { label: m.method, color: "#9ca3af", icon: "💰" };
                        const total7 = byMethod7.reduce((s, x) => s + x.total, 0);
                        const pct = total7 > 0 ? ((m.total / total7) * 100).toFixed(0) : 0;
                        return (
                          <div key={m.method}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{meta.icon}</span>
                                <span className="text-xs font-semibold text-gray-700">{meta.label}</span>
                              </div>
                              <span className="text-xs font-bold text-gray-900">{fmtK(m.total)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
                  )}
                </ChartCard>
              </div>

              {/* ── Technique Revenue + Summary + Quick Links ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <ChartCard title="Revenue by Technique" subtitle={`${dateRange}`} className="lg:col-span-2">
                  {byTechnique.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={byTechnique} layout="vertical" margin={{ left: 8, right: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                        <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="method" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip content={<CustomTooltip formatter={(v) => fmtK(v)} />} />
                        <Bar dataKey="total" name="Revenue" radius={[0, 6, 6, 0]}
                          label={{ position: "right", fontSize: 10, fontWeight: 700, fill: "#374151", formatter: fmtK }}>
                          {byTechnique.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No technique data for this period</div>
                  )}
                </ChartCard>

                <div className="space-y-3">
                  {/* 7-day total */}
                  <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">7-Day Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmtK(d.last7Days?.total ?? 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Total collected in last 7 days</p>
                  </div>

                  {/* This month total */}
                  <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">This Month Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{fmtK(d.thisMonth?.total ?? 0)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Total collected this month</p>
                  </div>

                  {/* Quick nav */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <p className="text-xs font-bold text-gray-700 mb-2.5 uppercase tracking-wide">Quick Links</p>
                    <div className="space-y-1">
                      {[
                        { label: "All Patients",    href: "/admin/patients" },
                        { label: "Transactions",    href: "/admin/transactions" },
                        { label: "Reports",         href: "/admin/reports" },
                        { label: "Employees",       href: "/admin/employees" },
                      ].map((link) => (
                        <button key={link.label}
                          onClick={() => router.push(link.href)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                          {link.label}
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 7d vs 30d Payment Method Comparison ── */}
              {(byMethod7.length > 0 || byMethod30.length > 0) && (
                <ChartCard title="Payment Method Comparison" subtitle="7-day vs 30-day collection by channel">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(() => {
                      const map = {};
                      byMethod7.forEach((m) => {
                        const meta = METHOD_META[m.method] || { label: m.method };
                        map[meta.label] = { method: meta.label, "7 Days": m.total, "30 Days": 0 };
                      });
                      byMethod30.forEach((m) => {
                        const meta = METHOD_META[m.method] || { label: m.method };
                        if (!map[meta.label]) map[meta.label] = { method: meta.label, "7 Days": 0, "30 Days": 0 };
                        map[meta.label]["30 Days"] = m.total;
                      });
                      return Object.values(map);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="method" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip formatter={(v) => fmtK(v)} />} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="7 Days"  fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="30 Days" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
