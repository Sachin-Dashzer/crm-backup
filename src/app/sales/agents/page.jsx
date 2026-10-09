"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  TrendingUp,
  IndianRupee,
  MapPin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Phone,
  Sparkles,
  BarChart3,
  Building2,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import SalesKpiCard from "@/components/sales/SalesKpiCard";

const DATE_PRESETS = ["Today", "Yesterday", "Last 7 Days", "This Month", "All Time", "Custom"];

function getISTDateString(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const fmtRupee = (num) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num || 0);

const fmtDate = (dateVal) => {
  if (!dateVal) return "Not available";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Not available";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return "Not available";
  }
};

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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: getISTDateString(start), dateTo: getISTDateString(now) };
}

function SalesAgentsContent() {
  const router = useRouter();

  const [agents, setAgents] = useState([]);
  const [kpis, setKpis] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalLeads: 0,
    totalConverted: 0,
    avgConversion: 0,
    totalRevenue: 0,
  });
  const [availableBranches, setAvailableBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filters
  const [datePreset, setDatePreset] = useState("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [sortBy, setSortBy] = useState("revenue");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedAgentId, setExpandedAgentId] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const debounceTimer = useRef(null);
  const abortControllerRef = useRef(null);

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

  const handleBranchChange = (br) => {
    setSelectedBranch(br);
    setPage(1);
  };

  const handleSortChange = (sort) => {
    setSortBy(sort);
    setPage(1);
  };

  const toggleExpand = (id) => {
    setExpandedAgentId((prev) => (prev === id ? null : id));
  };

  const fetchAgents = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const dateParams = resolveDateParams(datePreset, customFrom, customTo);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        ...dateParams,
      });

      if (selectedBranch && selectedBranch !== "All") {
        params.set("branch", selectedBranch);
      }
      if (search) {
        params.set("search", search);
      }

      const res = await fetch(`/api/sales/agents?${params.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (json.success) {
        setAgents(json.agents || []);
        if (json.kpis) setKpis(json.kpis);
        if (json.availableBranches && json.availableBranches.length > 0) {
          setAvailableBranches(json.availableBranches);
        }
        setTotal(json.pagination?.total || 0);
        setTotalPages(json.pagination?.totalPages || 1);
        setLastUpdated(new Date());
      } else {
        throw new Error(json.error || "Failed to load sales agents");
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error fetching agents:", err);
      setError(err.message || "Failed to load sales agents");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, datePreset, customFrom, customTo, selectedBranch, sortBy, search]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const activePeriodLabel =
    datePreset === "Custom"
      ? `${customFrom || "—"} to ${customTo || "—"}`
      : datePreset;

  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  // ── Skeleton row for loading state ──────────────────────────────────────────
  const SkeletonRow = () => (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-200 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-slate-200 rounded" />
            <div className="h-2.5 w-20 bg-slate-100 rounded" />
          </div>
        </div>
      </td>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 w-14 bg-slate-100 rounded" />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      <SalesSidebar />

      <main className="flex-1 min-h-screen overflow-auto bg-[radial-gradient(ellipse_80%_80%_at_50%_-15%,rgba(59,130,246,0.06),rgba(255,255,255,0))]">

        {/* ── Sticky Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                <Users className="w-4.5 h-4.5 drop-shadow-xs" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-800 tracking-tight leading-none">
                    Sales Agents &amp; Telecallers
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Live
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[11px] text-slate-400 font-normal">
                    Performance, conversion analytics &amp; patient management
                  </p>
                  {lastUpdated && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 before:content-['·'] before:mr-0.5">
                      <Clock className="w-3 h-3" />
                      {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Date presets + Refresh — NO branch filter here */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Segmented date pills */}
              <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-inner">
                {DATE_PRESETS.map((r) => {
                  const active = datePreset === r;
                  return (
                    <button
                      key={r}
                      onClick={() => handlePresetChange(r)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-[10px] transition-all cursor-pointer whitespace-nowrap ${
                        active
                          ? "bg-white text-blue-600 shadow-xs border border-slate-200/60"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>

              {/* Custom date pickers */}
              {datePreset === "Custom" && (
                <div className="flex items-center gap-1 bg-white border border-slate-200/90 rounded-xl p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => { setCustomFrom(e.target.value); setPage(1); }}
                    className="text-slate-700 text-[11px] font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-[11px] px-0.5">to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => { setCustomTo(e.target.value); setPage(1); }}
                    className="text-slate-700 text-[11px] font-normal px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Refresh */}
              <button
                onClick={fetchAgents}
                disabled={loading}
                className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-sm transition-all disabled:opacity-50 cursor-pointer group"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Workspace Canvas ───────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {/* KPI Cards — 5 equal cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <SalesKpiCard
              title="Total Agents"
              value={kpis.totalAgents}
              icon={Users}
              color="blue"
              footerLabel="Staff Role"
              footerValue="Telecallers"
              className="h-full"
            />
            <SalesKpiCard
              title="Active Agents"
              value={kpis.activeAgents}
              icon={CheckCircle2}
              color="teal"
              footerLabel="Staff Status"
              footerValue="On Duty"
              className="h-full"
            />
            <SalesKpiCard
              title="Total Leads"
              value={kpis.totalLeads}
              icon={Phone}
              color="cyan"
              footerLabel="Period Volume"
              footerValue={activePeriodLabel}
              className="h-full"
            />
            <SalesKpiCard
              title="Converted"
              value={kpis.totalConverted}
              icon={TrendingUp}
              color="green"
              footerLabel="Conversion Rate"
              footerValue={`${kpis.avgConversion}% Conv.`}
              className="h-full"
            />
            <SalesKpiCard
              title="Total Revenue"
              value={fmtRupee(kpis.totalRevenue)}
              icon={IndianRupee}
              color="green"
              footerLabel="Collections"
              footerValue="Settled"
              className="h-full"
            />
          </div>

          {/* ── Unified Filter Bar ───────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search sales agent..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Branch filter — the ONLY branch filter on this page */}
              <div className="relative min-w-[160px]">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="All">All Branches</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
              </div>

              {/* Sort */}
              <div className="relative min-w-[188px]">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="revenue">Highest Revenue</option>
                  <option value="leads">Most Leads</option>
                  <option value="rate">Highest Conversion Rate</option>
                  <option value="name">Agent Name (A–Z)</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
              </div>
            </div>

            {/* Count row */}
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
              <span>
                Showing{" "}
                <span className="text-slate-700 font-semibold">{startItem}–{endItem}</span>{" "}
                of{" "}
                <span className="text-slate-700 font-semibold">{total}</span>{" "}
                sales agents
              </span>
              <span>Strictly Agent / Telecaller roles</span>
            </div>
          </div>

          {/* ── Agent Table ──────────────────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                {/* Table header */}
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-[260px]">Agent</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Branch</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Patients</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Period Leads</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Converted</th>
                    <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-[130px]">Conv. Rate</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Revenue</th>
                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-[130px]">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {/* ── Loading skeleton ── */}
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                  {/* ── Error state ── */}
                  {!loading && error && (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center">
                        <p className="text-sm font-semibold text-rose-600 mb-3">{error}</p>
                        <button
                          onClick={fetchAgents}
                          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* ── Empty state ── */}
                  {!loading && !error && agents.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <Users className="w-9 h-9 mx-auto mb-2 text-slate-200" />
                        <p className="text-sm font-semibold text-slate-600">No sales agents found</p>
                        <p className="text-[12px] text-slate-400 mt-1">
                          Adjust your search query, branch filter, or date range.
                        </p>
                      </td>
                    </tr>
                  )}

                  {/* ── Agent rows ── */}
                  {!loading && !error && agents.map((agent, index) => {
                    const isExpanded = expandedAgentId === agent._id;
                    const globalRank = (page - 1) * limit + index;

                    return (
                      <React.Fragment key={agent._id}>
                        {/* ── Main data row ── */}
                        <tr
                          className={`border-b border-slate-100 transition-colors ${
                            isExpanded ? "bg-blue-50/40" : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* Agent identity */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold text-[13px] shrink-0 shadow-sm shadow-blue-500/20">
                                {agent.name?.charAt(0)?.toUpperCase() || "A"}
                              </div>
                              <div className="min-w-0">
                                {/* Name + rank badge */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[14px] font-semibold text-slate-900 leading-tight truncate">
                                    {agent.name}
                                  </span>
                                  {globalRank >= 0 && globalRank < 3 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0">
                                      #{globalRank + 1}
                                    </span>
                                  )}
                                </div>
                                {/* Metadata — subordinate to name */}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-400">
                                  <span className="font-mono text-slate-500">{agent.employeeId || "Not available"}</span>
                                  <span className="text-slate-200">·</span>
                                  <span>Joined {fmtDate(agent.dateOfJoining)}</span>
                                  <span className="text-slate-200">·</span>
                                  <span>TL: {agent.tlName || "Not available"}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Branch */}
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200/70 whitespace-nowrap">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              {agent.branch || "Not available"}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${
                                agent.isactive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {agent.isactive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* Total Patients */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-semibold text-slate-700">
                              {agent.totalPatients ?? 0}
                            </span>
                          </td>

                          {/* Period Leads */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-semibold text-slate-700">
                              {agent.totalLeads ?? 0}
                            </span>
                          </td>

                          {/* Converted */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-semibold text-emerald-700">
                              {agent.converted ?? 0}
                            </span>
                          </td>

                          {/* Conversion rate + bar */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[13px] font-bold text-indigo-700 leading-none">
                                {agent.conversionRate ?? 0}%
                              </span>
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(agent.conversionRate ?? 0, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Revenue */}
                          <td className="px-4 py-3 text-right">
                            <span className="text-[14px] font-bold text-slate-900">
                              {fmtRupee(agent.totalRevenue)}
                            </span>
                          </td>

                          {/* Action — View Breakdown only */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => toggleExpand(agent._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 text-[12px] font-medium transition-colors border border-slate-200/80 cursor-pointer whitespace-nowrap"
                            >
                              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                              {isExpanded ? "Hide" : "View Breakdown"}
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3 h-3 shrink-0" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* ── Expanded breakdown row ── */}
                        {isExpanded && (
                          <tr key={`${agent._id}-breakdown`} className="bg-slate-50/60">
                            <td colSpan={9} className="px-4 py-4 border-b border-slate-100">
                              {/* Header */}
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                                  Performance Breakdown — {agent.name}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {activePeriodLabel}
                                </span>
                              </div>

                              {/* Two panels side by side */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                {/* Package-wise */}
                                <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Package-Wise Conversion</span>
                                    </div>
                                    <span className="text-slate-400 font-normal">
                                      {agent.packageBreakdown?.length ?? 0} procedures
                                    </span>
                                  </div>

                                  {agent.packageBreakdown && agent.packageBreakdown.length > 0 ? (
                                    <div className="space-y-2.5">
                                      {agent.packageBreakdown.map((pkg) => (
                                        <div key={pkg.name} className="space-y-1">
                                          <div className="flex items-center justify-between text-[12px]">
                                            <span className="font-medium text-slate-700">{pkg.name}</span>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                              <span>{pkg.totalLeads} leads</span>
                                              <span className="text-slate-200">·</span>
                                              <span className="text-emerald-700 font-medium">{pkg.converted} conv.</span>
                                              <span className="text-slate-200">·</span>
                                              <span className="font-bold text-indigo-700">{pkg.conversionRate}%</span>
                                            </div>
                                          </div>
                                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                              style={{ width: `${Math.min(pkg.conversionRate, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[12px] text-slate-400 py-3 text-center">
                                      No package data for the selected period.
                                    </p>
                                  )}
                                </div>

                                {/* Branch-wise */}
                                <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
                                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Branch-Wise Conversion</span>
                                    </div>
                                    <span className="text-slate-400 font-normal">
                                      {agent.branchBreakdown?.length ?? 0} branches
                                    </span>
                                  </div>

                                  {agent.branchBreakdown && agent.branchBreakdown.length > 0 ? (
                                    <div className="space-y-2.5">
                                      {agent.branchBreakdown.map((br) => (
                                        <div key={br.branch} className="space-y-1">
                                          <div className="flex items-center justify-between text-[12px]">
                                            <span className="font-medium text-slate-700">{br.branch}</span>
                                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                              <span>{br.totalLeads} leads</span>
                                              <span className="text-slate-200">·</span>
                                              <span className="text-emerald-700 font-medium">{br.converted} conv.</span>
                                              <span className="text-slate-200">·</span>
                                              <span className="font-bold text-emerald-700">{br.conversionRate}%</span>
                                            </div>
                                          </div>
                                          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
                                              style={{ width: `${Math.min(br.conversionRate, 100)}%` }}
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-[12px] text-slate-400 py-3 text-center">
                                      No branch data for the selected period.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination — inside the table container ─────────────────── */}
            {!loading && !error && total > 0 && (
              <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  Showing{" "}
                  <span className="text-slate-700 font-semibold">{startItem}–{endItem}</span>{" "}
                  of{" "}
                  <span className="text-slate-700 font-semibold">{total}</span>{" "}
                  agents
                  {totalPages > 1 && (
                    <span className="text-slate-300 ml-1">· Page {page} of {totalPages}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {/* Previous */}
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                      page <= 1 || loading
                        ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200"
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Previous
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                      if (p === "...") {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            className="w-8 h-8 flex items-center justify-center text-[11px] text-slate-400 select-none"
                          >
                            ...
                          </span>
                        );
                      }
                      const isCurrent = p === page;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          disabled={loading}
                          className={`w-8 h-8 rounded-xl text-[11px] font-semibold transition-colors flex items-center justify-center cursor-pointer ${
                            isCurrent
                              ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next */}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                      page >= totalPages || loading
                        ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-slate-200"
                    }`}
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
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

export default function SalesAgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-[12px] text-slate-500 shadow-sm">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Loading sales agents workspace...</span>
          </div>
        </div>
      }
    >
      <SalesAgentsContent />
    </Suspense>
  );
}