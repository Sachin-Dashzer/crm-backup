"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, UserCheck, UserX, IndianRupee, Package,
  ClipboardList, Activity, TrendingUp, Stethoscope,
  Crown, ChevronDown,
} from "lucide-react";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const BRANCHES    = ["All", "Delhi", "Mumbai", "Hyderabad"];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "Custom"];

const TECHNIQUE_COLORS = [
  "#6366f1","#8b5cf6","#a78bfa","#ec4899","#f59e0b",
  "#10b981","#3b82f6","#f97316","#14b8a6","#ef4444",
];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
const rupee = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

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
   Sub-components
───────────────────────────────────────────── */
function KpiCard({ title, value, subtitle, icon: Icon, color, growth }) {
  const colors = {
    indigo: { bg: "bg-indigo-50",  icon: "text-indigo-600",  border: "border-indigo-100" },
    purple: { bg: "bg-purple-50",  icon: "text-purple-600",  border: "border-purple-100" },
    green:  { bg: "bg-green-50",   icon: "text-green-600",   border: "border-green-100"  },
    amber:  { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-100"  },
    red:    { bg: "bg-red-50",     icon: "text-red-600",     border: "border-red-100"    },
    blue:   { bg: "bg-blue-50",    icon: "text-blue-600",    border: "border-blue-100"   },
    teal:   { bg: "bg-teal-50",    icon: "text-teal-600",    border: "border-teal-100"   },
    pink:   { bg: "bg-pink-50",    icon: "text-pink-600",    border: "border-pink-100"   },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {growth !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            growth >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          }`}>
            {growth >= 0 ? "+" : ""}{growth}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SectionCard({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const STAFF_COLORS = {
  Agent:      { bg: "bg-blue-100",   text: "text-blue-700"   },
  Counsellor: { bg: "bg-purple-100", text: "text-purple-700" },
  Doctor:     { bg: "bg-green-100",  text: "text-green-700"  },
  Technician: { bg: "bg-amber-100",  text: "text-amber-700"  },
  Implanter:  { bg: "bg-pink-100",   text: "text-pink-700"   },
  Others:     { bg: "bg-gray-100",   text: "text-gray-700"   },
};

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
      if (json.success) {
        setData(json);
      } else {
        setError(json.message || "Failed to load");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [branch, dateRange, custom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const d = data || {};

  return (
    <section className="flex min-h-screen bg-gray-50">
      <SuperAdminSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">

        {/* ── Top Header ── */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Super Admin Dashboard</h1>
              <p className="text-xs text-gray-400">System-wide overview</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Branch */}
            <div className="relative">
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none cursor-pointer"
              >
                {BRANCHES.map((b) => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Date Range */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none cursor-pointer"
              >
                {DATE_RANGES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Custom date inputs */}
            {dateRange === "Custom" && (
              <>
                <input
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value }))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <input
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value }))}
                  className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6 space-y-6">

          {loading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto" />
                <p className="mt-4 text-sm text-gray-500">Loading dashboard…</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-32">
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* ── Row 1: Lead + Patient KPIs ── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Leads & Patients</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <KpiCard title="Total Leads"       value={d.totalLeads ?? 0}    icon={ClipboardList} color="blue"   subtitle={dateRange}    />
                  <KpiCard title="Appointments"      value={d.appointments ?? 0}  icon={Users}         color="indigo" subtitle="In period"    />
                  <KpiCard title="Patient Visited"   value={d.visited ?? 0}       icon={UserCheck}     color="green"  subtitle="Counselled"   />
                  <KpiCard title="Converted"         value={d.converted ?? 0}     icon={TrendingUp}    color="teal"   subtitle="Ready for surgery" />
                  <KpiCard title="Not Converted"     value={d.notConverted ?? 0}  icon={UserX}         color="red"    subtitle="In period"    />
                  <KpiCard title="Surgeries"         value={d.surgeries ?? 0}     icon={Activity}      color="purple" subtitle="In period"    />
                </div>
              </div>

              {/* ── Row 2: Revenue KPIs ── */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Revenue</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard title="Amount Received"   value={rupee(d.totalAmount)}   icon={IndianRupee} color="green"  subtitle="All revenue"  />
                  <KpiCard title="Medicine Amount"   value={rupee(d.medicineAmount)} icon={Stethoscope} color="amber"  subtitle="Medicine sales" />
                  <KpiCard title="Total Stocks"      value={d.totalStockItems ?? 0} icon={Package}     color="indigo" subtitle={`${d.totalStockQty ?? 0} units`} />
                  <KpiCard title="Stock Value"       value={rupee(d.totalStockValue)} icon={IndianRupee} color="pink"  subtitle="MRP × Qty"   />
                </div>
              </div>

              {/* ── Row 3: Per-day Sale Graph ── */}
              <SectionCard title={`Daily Revenue — ${dateRange}${branch !== "All" ? ` · ${branch}` : ""}`}>
                {d.perDay && d.perDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={d.perDay} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={55} />
                      <Tooltip
                        formatter={(v) => [rupee(v), "Revenue"]}
                        labelFormatter={(l) => new Date(l).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" })}
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" dot={{ r: 3, fill: "#6366f1" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No revenue data for this period</div>
                )}
              </SectionCard>

              {/* ── Row 4: Technique-wise + Staff ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Technique-wise Sales */}
                <SectionCard title="Services / Technique-wise Sales">
                  {d.techniqueWise && d.techniqueWise.length > 0 ? (
                    <div className="space-y-3">
                      {d.techniqueWise.map((item, i) => {
                        const pct = d.totalAmount > 0 ? ((item.total / d.totalAmount) * 100).toFixed(1) : 0;
                        return (
                          <div key={item.procedure}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{item.procedure}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400">{item.count} txn</span>
                                <span className="text-sm font-semibold text-gray-900">{rupee(item.total)}</span>
                                <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: TECHNIQUE_COLORS[i % TECHNIQUE_COLORS.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 text-sm py-8">No technique data for this period</p>
                  )}
                </SectionCard>

                {/* Staff Breakdown */}
                <SectionCard title="Total Staff by Role">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl font-bold text-gray-900">{d.totalStaff ?? 0}</span>
                    <span className="text-sm text-gray-400">Active employees</span>
                  </div>
                  {d.staffBreakdown && Object.keys(d.staffBreakdown).length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(d.staffBreakdown).map(([role, count]) => {
                          const c = STAFF_COLORS[role] || { bg: "bg-gray-100", text: "text-gray-700" };
                          return (
                            <div key={role} className={`${c.bg} rounded-xl px-3 py-3 text-center`}>
                              <p className={`text-2xl font-bold ${c.text}`}>{count}</p>
                              <p className={`text-xs font-medium mt-0.5 ${c.text}`}>{role}</p>
                            </div>
                          );
                        })}
                      </div>
                      {/* Bar chart */}
                      <div className="mt-5">
                        <ResponsiveContainer width="100%" height={130}>
                          <BarChart
                            data={Object.entries(d.staffBreakdown).map(([role, count]) => ({ role, count }))}
                            margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="role" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip contentStyle={{ borderRadius: "10px", fontSize: "12px" }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {Object.keys(d.staffBreakdown).map((role, i) => (
                                <Cell key={role} fill={TECHNIQUE_COLORS[i % TECHNIQUE_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-gray-400 text-sm py-8">No staff data available</p>
                  )}
                </SectionCard>
              </div>

              {/* ── Row 5: Payment method breakdown ── */}
              {d.byMethod && d.byMethod.length > 0 && (
                <SectionCard title="Revenue by Payment Method">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {d.byMethod.map((item, i) => (
                      <div key={item.method} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                        <p className="text-lg font-bold text-gray-900">{rupee(item.total)}</p>
                        <p className="text-xs font-medium text-gray-500 mt-1 capitalize">{item.method}</p>
                        <p className="text-xs text-gray-400">{item.count} txn</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

            </>
          )}
        </div>
      </main>
    </section>
  );
}
