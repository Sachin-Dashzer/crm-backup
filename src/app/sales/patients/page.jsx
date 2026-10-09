"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  Search,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  MapPin,
  ShieldCheck,
  UserCircle,
  X,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DATE_PRESETS = ["Today", "Yesterday", "Last 7 Days", "This Month", "All Time", "Custom"];

const STATUSES = [
  "All",
  "NEW",
  "NOT_VISITED",
  "CONSULTED",
  "NOT_CONVERTED",
  "BOOKING_DONE",
  "SURGERY_BOOKED",
  "CLOSED",
];

const STATUS_BADGES = {
  NEW: "bg-blue-50 text-blue-700 border-blue-200",
  NOT_VISITED: "bg-slate-100 text-slate-600 border-slate-200",
  CONSULTED: "bg-amber-50 text-amber-700 border-amber-200",
  NOT_CONVERTED: "bg-rose-50 text-rose-700 border-rose-200",
  BOOKING_DONE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SURGERY_BOOKED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-slate-100 text-slate-500 border-slate-200",
};

// ── IST date string helper — matches Sales Dashboard convention ────────────────
function getISTDateString(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// ── Formatting helpers ────────────────────────────────────────────────────────
const fmtRupee = (num) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num || 0);

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

// ── Resolve dateFrom / dateTo params from the active preset (IST) ─────────────
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
  if (preset === "All Time") {
    return { all: "1" };
  }
  if (preset === "Custom" && customFrom) {
    return { dateFrom: customFrom, dateTo: customTo || customFrom };
  }
  // Fallback: This Month (matches API default via resolveDateRange)
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: getISTDateString(start), dateTo: getISTDateString(now) };
}

// ── Page component ────────────────────────────────────────────────────────────
function SalesPatientsContent() {
  const searchParams = useSearchParams();
  const urlReference = searchParams.get("reference") || "";
  const urlPreset = searchParams.get("datePreset") || (searchParams.get("all") === "1" ? "All Time" : "This Month");

  const { data: session } = useSession();
  const userRole = session?.user?.role || "sales";

  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [datePreset, setDatePreset] = useState(urlPreset);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [agentReference, setAgentReference] = useState(urlReference);

  useEffect(() => {
    if (urlReference) {
      setAgentReference(urlReference);
    }
  }, [urlReference]);

  const debounceTimer = useRef(null);

  const handleSearchChange = (val) => {
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

  // ── Fetch patients (server-side filter + pagination) ──────────────────────
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = resolveDateParams(datePreset, customFrom, customTo);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortKey: "personal.visitDate",
        sortDir: "desc",
        ...dateParams,
      });

      if (search) params.set("search", search);
      if (selectedStatus && selectedStatus !== "All") params.set("status", selectedStatus);
      if (agentReference) params.set("reference", agentReference);

      const res = await fetch(`/api/patients/get-patient?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Error fetching patients for sales:", err);
      setPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedStatus, datePreset, customFrom, customTo, agentReference]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

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
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight leading-none">
                  Patients Directory
                </h1>
                <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Read-only record of leads, consultations, and financial summaries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                View-Only
              </span>
              <button
                onClick={fetchPatients}
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

            {/* Row 1: Segmented date presets — identical styling to Sales Dashboard */}
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

                {/* Inline custom date pickers — only shown when Custom is active */}
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

            {/* Row 2: Status + Search + summary */}
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Status filter */}
              <div className="relative inline-flex items-center shrink-0">
                <select
                  value={selectedStatus}
                  onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                  className="bg-white border border-slate-200/90 text-slate-700 text-xs font-medium rounded-xl pl-3 pr-7 py-2 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "All" ? "All Statuses" : s.replace(/_/g, " ")}
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
                  placeholder="Search by name, phone..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors shadow-xs"
                />
              </div>

              {/* Result count */}
              <div className="text-xs text-slate-500 shrink-0">
                Showing{" "}
                <span className="text-slate-800 font-medium">{patients.length}</span>
                {" "}of{" "}
                <span className="text-slate-800 font-medium">{total}</span>
                {" "}patients
              </div>

              {/* Per-page selector */}
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

            {/* Active Agent Filter Pill */}
            {agentReference && (
              <div className="px-4 py-2 bg-blue-50/80 border-t border-blue-100 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Active filter: Showing only patients referred by Agent (<code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-700 text-[11px]">{agentReference}</code>)
                  </span>
                </div>
                <button
                  onClick={() => {
                    setAgentReference("");
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-rose-600 bg-white border border-blue-200 hover:border-rose-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Clear Agent filter"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Agent Filter</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Patient Table ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    <th className="px-4 py-3.5">Patient Details</th>
                    <th className="px-4 py-3.5">Branch</th>
                    <th className="px-4 py-3.5">Visit Date</th>
                    <th className="px-4 py-3.5">Payment Summary</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Counsellor</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
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
                  ) : patients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Users className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">No patients found</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try adjusting your date range, status filter, or search query.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    patients.map((p) => {
                      const totalAmt = p.payments?.totalAmount || 0;
                      const received = p.payments?.amountReceived || 0;
                      const pending =
                        p.payments?.pendingAmount !== undefined
                          ? p.payments.pendingAmount
                          : Math.max(0, totalAmt - received);
                      const rawPhone = p.personal?.phone || "";
                      const maskedPhone = maskPhone(rawPhone, userRole);

                      // Real counsellor from DB: counselling.counsellor (populated by API)
                      const counsellorName = p.counselling?.counsellor?.name || null;

                      return (
                        <tr
                          key={p._id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          {/* Patient Details */}
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-900 text-sm">
                              {p.personal?.name || "Unknown"}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {maskedPhone || "—"}
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {p.personal?.branch || "—"}
                            </span>
                          </td>

                          {/* Visit Date */}
                          <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              {fmtDate(p.personal?.visitDate)}
                            </div>
                          </td>

                          {/* Payment Summary */}
                          <td className="px-4 py-3.5">
                            <div className="text-xs font-medium text-emerald-700">
                              Rec: {fmtRupee(received)}
                            </div>
                            {pending > 0 && (
                              <div className="text-xs text-amber-700 mt-0.5">
                                Due: {fmtRupee(pending)}
                              </div>
                            )}
                            {pending === 0 && received === 0 && (
                              <div className="text-xs text-slate-400">—</div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                STATUS_BADGES[p.ops?.status] ||
                                "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {p.ops?.status?.replace(/_/g, " ") || "NEW"}
                            </span>
                          </td>

                          {/* Counsellor — real DB relationship: counselling.counsellor (populated) */}
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

                          {/* Actions — View Profile only (read-only panel) */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <Link
                              href={`/sales/patients/${p._id}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 text-xs font-medium transition-all"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Profile
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

export default function SalesPatientsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 shadow-sm">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
          <span>Loading patients workspace...</span>
        </div>
      </div>
    }>
      <SalesPatientsContent />
    </Suspense>
  );
}
