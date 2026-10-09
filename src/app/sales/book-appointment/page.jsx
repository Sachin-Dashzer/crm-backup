"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  CalendarDays,
  Search,
  RefreshCw,
  MapPin,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  UserCircle,
} from "lucide-react";

// ── Appointment-specific constants ────────────────────────────────────────────
// Only NEW and NOT_VISITED are valid for the Appointments view.
// "All" here means: NEW + NOT_VISITED — NOT all statuses in the database.
const APPT_STATUSES = ["All", "NEW", "NOT_VISITED"];

const DATE_PRESETS = ["Today", "Yesterday", "Last 7 Days", "This Month", "Custom"];

const STATUS_BADGES = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  NOT_VISITED: "bg-amber-50 text-amber-700 border-amber-200",
};

// ── IST date string helper — matches Sales Dashboard convention ────────────────
function getISTDateString(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ── Visit date formatter ───────────────────────────────────────────────────────
const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

// ── Resolve dateFrom / dateTo from the active preset (IST-safe) ───────────────
function resolveDateParams(preset, customFrom, customTo) {
  const now = new Date();
  if (preset === "Today") {
    const d = getISTDateString(now);
    return { dateFrom: d, dateTo: d };
  }
  if (preset === "Yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = getISTDateString(y);
    return { dateFrom: d, dateTo: d };
  }
  if (preset === "Last 7 Days") {
    const past = new Date(now);
    past.setDate(past.getDate() - 7);
    return { dateFrom: getISTDateString(past), dateTo: getISTDateString(now) };
  }
  if (preset === "This Month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: getISTDateString(start), dateTo: getISTDateString(now) };
  }
  if (preset === "Custom" && customFrom) {
    return { dateFrom: customFrom, dateTo: customTo || customFrom };
  }
  // Default: This Month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: getISTDateString(start), dateTo: getISTDateString(now) };
}

// ── Statuses sent to the API when "All" is selected ───────────────────────────
// This ensures the API query is restricted to NEW + NOT_VISITED even for "All".
const ALL_APPT_STATUS_PARAM = "NEW,NOT_VISITED";

// ── Page component ─────────────────────────────────────────────────────────────
export default function AppointmentsSchedulePage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || "sales";

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [datePreset, setDatePreset] = useState("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const debounceTimer = useRef(null);

  const handleSearch = (val) => {
    setSearchInput(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    setPage(1);
  };

  // ── Fetch appointments — server-side: date + status + search + pagination ──
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = resolveDateParams(datePreset, customFrom, customTo);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortKey: "personal.visitDate",
        sortDir: "desc",
        dateFrom,
        dateTo,
      });

      // Status restriction at API/query level:
      // "All" → NEW,NOT_VISITED (not all statuses)
      // Specific → only that one status
      if (selectedStatus === "All") {
        params.set("status", ALL_APPT_STATUS_PARAM);
      } else {
        params.set("status", selectedStatus);
      }

      if (search) params.set("search", search);

      const res = await fetch(`/api/patients/get-patient?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setAppointments(data.patients || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setAppointments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedStatus, datePreset, customFrom, customTo]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 antialiased">
      <SalesSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">

          {/* ── Page Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
                <CalendarDays className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight leading-none">
                  Appointments Schedule
                </h1>
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  NEW and NOT VISITED patient appointments — read-only view
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                View-Only
              </span>
              <button
                onClick={fetchAppointments}
                disabled={loading}
                className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-500 hover:text-blue-600 hover:border-blue-300 shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── Filter Panel ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs">

            {/* Row 1: Segmented date preset control — identical to Dashboard & Patients */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-inner overflow-x-auto">
                  {DATE_PRESETS.map((r) => {
                    const active = datePreset === r;
                    return (
                      <button
                        key={r}
                        onClick={() => handlePresetChange(r)}
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

                {/* Inline custom date pickers — only when Custom is active */}
                {datePreset === "Custom" && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl p-1 shadow-xs">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                      className="text-slate-700 text-xs font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-slate-400 text-xs font-medium px-0.5">to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                      className="text-slate-700 text-xs font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Status + Search + result count */}
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Status filter — restricted to All/NEW/NOT_VISITED */}
              <div className="relative inline-flex items-center shrink-0">
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200/90 text-slate-700 text-xs font-medium rounded-xl pl-3 pr-7 py-2 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                >
                  {APPT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "All"
                        ? "All (New + Not Visited)"
                        : s === "NOT_VISITED"
                        ? "NOT VISITED"
                        : s}
                    </option>
                  ))}
                </select>
                <span className="absolute right-2.5 pointer-events-none text-slate-400 text-xs">▾</span>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by patient name, phone..."
                  value={searchInput}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              {/* Result count */}
              <div className="text-xs text-slate-500 shrink-0">
                Showing{" "}
                <span className="text-slate-800 font-medium">{appointments.length}</span>
                {" "}of{" "}
                <span className="text-slate-800 font-medium">{total}</span>
                {" "}appointments
              </div>

              {/* Per-page */}
              <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500">
                <span>Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="bg-white border border-slate-200/90 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none shadow-xs"
                >
                  <option value={20}>20</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Appointments Table ───────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    <th className="px-4 py-3.5">Visit Date</th>
                    <th className="px-4 py-3.5">Patient Details</th>
                    <th className="px-4 py-3.5">Branch</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Sales Agent</th>
                    <th className="px-4 py-3.5">Counsellor</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 bg-slate-100 rounded w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : appointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                          <CalendarDays className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">No appointments found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          No NEW or NOT VISITED records match the selected date range and filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    appointments.map((appt) => {
                      const rawPhone = appt.personal?.phone || "";
                      const maskedPhone = maskPhone(rawPhone, userRole);
                      // Sales agent: personal.reference (populated)
                      const agentName = appt.personal?.reference?.name || null;
                      // Counsellor: counselling.counsellor (populated)
                      const counsellorName = appt.counselling?.counsellor?.name || null;

                      return (
                        <tr
                          key={appt._id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          {/* Visit Date */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs font-medium text-slate-700">
                                {fmtDate(appt.personal?.visitDate)}
                              </span>
                            </div>
                          </td>

                          {/* Patient Details */}
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-900 text-sm">
                              {appt.personal?.name || "Unknown"}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {maskedPhone || "—"}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {appt.personal?.branch || "—"}
                            </span>
                          </td>

                          {/* Status — only NEW or NOT_VISITED will appear */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                STATUS_BADGES[appt.ops?.status] ||
                                "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {appt.ops?.status === "NOT_VISITED"
                                ? "NOT VISITED"
                                : appt.ops?.status || "NEW"}
                            </span>
                          </td>

                          {/* Sales Agent (personal.reference, populated) */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {agentName ? (
                                <span className="text-xs text-slate-600">{agentName}</span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">—</span>
                              )}
                            </div>
                          </td>

                          {/* Counsellor (counselling.counsellor, populated) */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {counsellorName ? (
                                <span className="text-xs text-slate-600">{counsellorName}</span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                              )}
                            </div>
                          </td>

                          {/* Action — View Profile only (read-only) */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <Link
                              href={`/sales/patients/${appt._id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 text-xs font-medium transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs">
                <div className="text-slate-500">
                  Page{" "}
                  <span className="text-slate-800 font-medium">{page}</span>
                  {" "}of{" "}
                  <span className="text-slate-800 font-medium">{totalPages}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
