"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import {
  Calendar,
  UserPlus,
  Users,
  IndianRupee,
  Clock,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  UserCheck,
  AlertCircle,
  ClipboardList,
  Activity,
  ChevronRight,
  TrendingUp,
  BadgeCheck,
} from "lucide-react";
import CollabSidebar from "@/components/Sidebars/CollabSidebar";
import Topbar from "@/components/Topbar";
import { useToast } from "@/components/Toast";

// ── Currency formatter ──────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

// ── Status badge config ────────────────────────────────────────────────────
const STATUS_META = {
  NEW: { label: "New", color: "bg-blue-100 text-blue-700 border-blue-200" },
  NOT_VISITED: { label: "Not Visited", color: "bg-amber-100 text-amber-700 border-amber-200" },
  NOT_CONVERTED: { label: "Not Converted", color: "bg-orange-100 text-orange-700 border-orange-200" },
  CONSULTED: { label: "Consulted", color: "bg-green-100 text-green-700 border-green-200" },
  SURGERY_BOOKED: { label: "Surgery Booked", color: "bg-purple-100 text-purple-700 border-purple-200" },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-600 border-gray-200" },
};

// ── StatCard ────────────────────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, gradient, trend, onClick, subtitle }) {
  const trendZero = trend === 0 || trend === undefined || trend === null;
  const trendPositive = trend > 0;

  return (
    <div
      onClick={onClick}
      className={`bg-linear-to-br ${gradient} rounded-2xl shadow-lg text-white relative overflow-hidden p-5 sm:p-6 ${
        onClick ? "cursor-pointer hover:scale-[1.02] transition-transform duration-200" : ""
      }`}
    >
      <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -mr-10 -mt-10" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full -ml-6 -mb-6" />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <Icon className="w-5 h-5 text-white" />
          </div>
          {!trendZero && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-white/20 text-white">
              {trendPositive
                ? <ArrowUpRight className="w-3 h-3" />
                : <ArrowDownRight className="w-3 h-3" />}
              {trendPositive ? "+" : ""}{trend}%
            </div>
          )}
        </div>
        <p className="text-white/80 text-xs font-medium mb-1">{title}</p>
        <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
        {subtitle && <p className="text-white/70 text-xs mt-2">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── FunnelBar ───────────────────────────────────────────────────────────────
function FunnelBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-600 font-medium">{label}</span>
        <span className="text-xs font-bold text-gray-900">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function CollabDashboard() {
  const router = useRouter();
  const toast = useToast();
  const { data: session } = useSession();
  const userRole = session?.user?.role || "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [timeRange, setTimeRange] = useState("Today");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [data, setData] = useState({
    todayAppointments: 0,
    todayVisits: 0,
    pendingAppointments: 0,
    todayRevenue: 0,
    recentPatients: [],
    trends: { appointments: 0, visits: 0, revenue: 0 },
  });

  // Build date-range payload (no branch — server aggregates across all 8 collab cities)
  const buildPayload = useCallback(() => {
    let from = new Date();
    let to = new Date();

    if (timeRange === "Today") {
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);
    } else if (timeRange === "Yesterday") {
      from.setDate(from.getDate() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
    } else if (timeRange === "Last 7 Days") {
      to.setHours(23, 59, 59, 999);
      from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else if (timeRange === "Custom" && customDates.from) {
      from = new Date(customDates.from);
      from.setHours(0, 0, 0, 0);
      to = customDates.to ? new Date(customDates.to) : new Date(customDates.from);
      to.setHours(23, 59, 59, 999);
    }

    return { from: from.toISOString(), to: to.toISOString() };
  }, [timeRange, customDates]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = buildPayload();
      const res = await fetch("/api/collab/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch dashboard data");

      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (err) {
      console.error("Collab dashboard error:", err);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildPayload, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navigate to sub-pages with current date range
  const navTo = useCallback((path) => {
    const { from, to } = buildPayload();
    const params = new URLSearchParams({ dateFrom: from, dateTo: to });
    router.push(`${path}?${params.toString()}`);
  }, [buildPayload, router]);

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <CollabSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            <p className="text-gray-500 text-sm mt-4 font-medium">Loading dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  const { todayAppointments, todayVisits, pendingAppointments, convertedPatients, todayRevenue, trends, recentPatients } = data;
  const conversionRate = todayAppointments > 0 ? Math.round((todayVisits / todayAppointments) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <CollabSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex-1 flex flex-col lg:p-5 min-w-0">
        {/* Topbar — no branch props; collab dashboard aggregates across all 8 collab cities */}
        <Topbar
          title="Collab Dashboard"
          setSidebarOpen={setSidebarOpen}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

        <div className="flex-1 space-y-6">

          {/* ── KPI cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <StatCard
              title="Total Appointments"
              value={todayAppointments}
              icon={Calendar}
              gradient="from-blue-500 to-indigo-600"
              trend={trends?.appointments}
              subtitle="vs previous period"
              onClick={() => navTo("/collab/patients")}
            />
            <StatCard
              title="Patients Visited"
              value={todayVisits}
              icon={UserCheck}
              gradient="from-emerald-500 to-green-600"
              trend={trends?.visits}
              subtitle={`${conversionRate}% conversion rate`}
              onClick={() => navTo("/collab/patients")}
            />
            <StatCard
              title="Pending / Not Visited"
              value={pendingAppointments}
              icon={Clock}
              gradient="from-amber-500 to-orange-500"
              subtitle="Awaiting consultation"
              onClick={() => navTo("/collab/not-visited")}
            />
            <StatCard
              title="Converted"
              value={convertedPatients ?? 0}
              icon={BadgeCheck}
              gradient="from-teal-500 to-cyan-600"
              trend={trends?.converted}
              subtitle="Paid at least once"
              onClick={() => router.push("/collab/transactions")}
            />
            <StatCard
              title="Revenue Collected"
              value={fmt(todayRevenue)}
              icon={IndianRupee}
              gradient="from-purple-500 to-violet-600"
              trend={trends?.revenue}
              subtitle="vs previous period"
              onClick={() => router.push("/collab/transactions")}
            />
          </div>

          {/* ── Patient flow + Quick actions ───────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

            {/* Patient flow funnel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Patient Flow</h3>
                  <p className="text-xs text-gray-500">{timeRange}</p>
                </div>
              </div>
              <div className="space-y-4">
                <FunnelBar label="Appointments" value={todayAppointments} max={todayAppointments} color="bg-blue-500" />
                <FunnelBar label="Visited" value={todayVisits} max={todayAppointments} color="bg-emerald-500" />
                <FunnelBar label="Converted" value={convertedPatients ?? 0} max={todayAppointments} color="bg-teal-500" />
                <FunnelBar label="Pending" value={pendingAppointments} max={todayAppointments} color="bg-amber-500" />
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Conversion rate</span>
                <span className="font-bold text-indigo-600">{conversionRate}%</span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Quick Actions</h3>
                  <p className="text-xs text-gray-500">Frequently used tasks</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    label: "Add Patient",
                    icon: UserPlus,
                    cls: "border-indigo-100 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-200",
                    iconCls: "bg-indigo-100 text-indigo-600",
                    textCls: "text-indigo-700",
                    path: "/collab/add-patient",
                  },
                  {
                    label: "All Patients",
                    icon: Users,
                    cls: "border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200",
                    iconCls: "bg-blue-100 text-blue-600",
                    textCls: "text-blue-700",
                    path: "/collab/patients",
                  },
                  {
                    label: "Not Visited",
                    icon: AlertCircle,
                    cls: "border-amber-100 bg-amber-50 hover:bg-amber-100 hover:border-amber-200",
                    iconCls: "bg-amber-100 text-amber-600",
                    textCls: "text-amber-700",
                    path: "/collab/not-visited",
                  },
                  {
                    label: "Transactions",
                    icon: IndianRupee,
                    cls: "border-emerald-100 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-200",
                    iconCls: "bg-emerald-100 text-emerald-600",
                    textCls: "text-emerald-700",
                    path: "/collab/transactions",
                  },
                  {
                    label: "Reports",
                    icon: ClipboardList,
                    cls: "border-purple-100 bg-purple-50 hover:bg-purple-100 hover:border-purple-200",
                    iconCls: "bg-purple-100 text-purple-600",
                    textCls: "text-purple-700",
                    path: "/collab/reports",
                  },
                ].map(({ label, icon: Icon, cls, iconCls, textCls, path }) => (
                  <button
                    key={label}
                    onClick={() => router.push(path)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${cls}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconCls}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className={`text-xs font-semibold ${textCls}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Recent Patients (full width) ───────────────────────────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Recent Patients</h3>
                  <p className="text-xs text-gray-500">Last visited this period</p>
                </div>
              </div>
              <button
                onClick={() => navTo("/collab/patients")}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1"
              >
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {recentPatients.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {recentPatients.map((patient, i) => {
                  const meta = STATUS_META[patient.ops?.status] || STATUS_META.NEW;
                  const initials = (patient.personal?.name || "?").slice(0, 2).toUpperCase();
                  const borderClass = i > 0 ? "border-t sm:border-t-0 sm:border-l border-gray-50" : "";
                  return (
                    <div
                      key={patient._id}
                      onClick={() => router.push(`/collab/patients/${patient._id}`)}
                      className={`flex items-center gap-3 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${borderClass}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{patient.personal?.name}</p>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          {maskPhone(patient.personal?.phone, userRole) || "—"}
                        </span>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold border ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <Users className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">No recent patients</p>
                <p className="text-xs mt-1">Patients visited will appear here</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
