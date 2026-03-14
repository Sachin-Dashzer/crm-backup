"use client";

import { useState, useEffect, useCallback } from "react";
import HRSidebar from "@/components/Sidebars/HRSidebar";
import {
  Users,
  UserCheck,
  UserX,
  CalendarClock,
  PauseCircle,
  ClipboardList,
  TrendingUp,
  Briefcase,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayRange() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function buildRange(preset) {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  let start = new Date(now); start.setHours(0, 0, 0, 0);

  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
  } else if (preset === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "last30") {
    start.setDate(start.getDate() - 29);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

function fmt(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const STATUS_COLORS = {
  Selected:             "#10b981",
  Rejected:             "#ef4444",
  "Interview Scheduled":"#6366f1",
  "On Hold":            "#f59e0b",
  Applied:              "#3b82f6",
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HRDashboard() {
  const [preset, setPreset]     = useState("today");
  const [custom, setCustom]     = useState({ from: "", to: "" });
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);

  const getRange = useCallback(() => {
    if (preset === "custom") {
      if (!custom.from || !custom.to) return todayRange();
      const f = new Date(custom.from); f.setHours(0, 0, 0, 0);
      const t = new Date(custom.to);   t.setHours(23, 59, 59, 999);
      return { from: f.toISOString(), to: t.toISOString() };
    }
    if (preset === "today") return todayRange();
    return buildRange(preset);
  }, [preset, custom]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const range = getRange();
      const res = await fetch("/api/hr/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(range),
      });
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [getRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const presets = ["today", "yesterday", "last7", "last30", "custom"];
  const presetLabels = { today: "Today", yesterday: "Yesterday", last7: "Last 7 Days", last30: "Last 30 Days", custom: "Custom" };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HRSidebar />

      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">HR Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Recruitment overview & analytics</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  preset === p
                    ? "bg-violet-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-violet-300"
                }`}
              >
                {presetLabels[p]}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={custom.from}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <input
                  type="date"
                  value={custom.to}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <KpiCard icon={Users}        label="Total Interviews" value={data?.total     ?? 0} color="bg-violet-500" />
              <KpiCard icon={ClipboardList} label="Applied"          value={data?.applied   ?? 0} color="bg-blue-500" />
              <KpiCard icon={CalendarClock} label="Scheduled"        value={data?.scheduled ?? 0} color="bg-indigo-500" />
              <KpiCard icon={UserCheck}    label="Selected"          value={data?.selected  ?? 0} color="bg-emerald-500" />
              <KpiCard icon={UserX}        label="Rejected"          value={data?.rejected  ?? 0} color="bg-red-500" />
              <KpiCard icon={PauseCircle}  label="On Hold"           value={data?.onHold    ?? 0} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Per-day chart */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  Candidates Per Day
                </h2>
                {data?.perDay?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.perDay} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                      <Tooltip
                        formatter={(v) => [v, "Candidates"]}
                        labelFormatter={fmt}
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} fill="url(#hrGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-16">No data for selected range</p>
                )}
              </div>

              {/* Status breakdown */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h2>
                <div className="space-y-3">
                  {(data?.byStatus || []).map(({ _id, count }) => {
                    const pct = data?.total ? Math.round((count / data.total) * 100) : 0;
                    return (
                      <div key={_id}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{_id || "Unknown"}</span>
                          <span className="font-semibold">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: STATUS_COLORS[_id] || "#6b7280",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {!data?.byStatus?.length && (
                    <p className="text-sm text-gray-400 text-center py-8">No data</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Positions applied for */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-violet-500" />
                  Positions Applied For
                </h2>
                {data?.positions?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.positions} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                      <YAxis dataKey="_id" type="category" tick={{ fontSize: 11, fill: "#374151" }} width={100} />
                      <Tooltip
                        formatter={(v) => [v, "Applicants"]}
                        contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: 12 }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-16">No data for selected range</p>
                )}
              </div>

              {/* Recent candidates */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Candidates</h2>
                {data?.recentCandidates?.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentCandidates.map((c) => (
                      <div key={c._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.position}</p>
                        </div>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${STATUS_COLORS[c.status] || "#6b7280"}20`,
                            color: STATUS_COLORS[c.status] || "#6b7280",
                          }}
                        >
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-16">No candidates yet</p>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
