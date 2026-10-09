"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import BillGenerator from "@/components/BillGenerator";
import ContraManager from "@/components/ContraManager";
import SuspenseManager from "@/components/SuspenseManager";
import IncentiveEntryForm from "@/components/IncentiveEntryForm";
import usePatientPicker from "@/lib/usePatientPicker";
import { ALL_BRANCHES } from "@/lib/branches";
import { METHOD_LABELS } from "@/constants/paymentMethods";
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Tag,
  Scissors,
  Heart,
  Pill,
  ArrowUpDown,
  Building2,
  Gift,
  FileDown,
  FileText as Bill,
  Activity,
  Layers,
  Sparkles,
  ArrowLeftRight,
  HelpCircle,
  X,
  CreditCard,
  User,
  Clock,
  Package,
} from "lucide-react";
import { utils, writeFile } from "xlsx";

const DATE_PRESETS = ["Today", "Yesterday", "Last 7 Days", "This Month", "All Time", "Custom"];

const TABS = [
  { id: "ALL",          label: "All",          icon: Layers },
  { id: "TOTAL_SALES",  label: "Total Sales",  icon: IndianRupee },
  { id: "TRANSPLANT",   label: "Transplants",  icon: Scissors },
  { id: "SERVICE",      label: "Services",     icon: Heart },
  { id: "MEDICINE",     label: "Medicine",     icon: Pill },
  { id: "CONTRA",       label: "Contra",       icon: ArrowLeftRight },
  { id: "SUSPENSE",     label: "Suspense",     icon: HelpCircle },
];

const METHOD_COLORS = {
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  upi: "bg-blue-50 text-blue-700 border-blue-200",
  card: "bg-purple-50 text-purple-700 border-purple-200",
  banking: "bg-indigo-50 text-indigo-700 border-indigo-200",
  bajaj_loan: "bg-orange-50 text-orange-700 border-orange-200",
  fibe_loan: "bg-amber-50 text-amber-700 border-amber-200",
  hdfc_skin_bank_transfer: "bg-sky-50 text-sky-700 border-sky-200",
  hdfc_ryan_medihub_bank_transfer: "bg-teal-50 text-teal-700 border-teal-200",
  icici_medihub_bank_transfer: "bg-rose-50 text-rose-700 border-rose-200",
  other: "bg-slate-100 text-slate-600 border-slate-200",
};

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
  });
};

function getISTDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const getPatientName = (row) => row.patient?.personal?.name || row.patientName || "Walk-in Customer";
const getPatientPhone = (row) => row.patient?.personal?.phone || row.patientPhone || "";

const getPatientPackage = (row) => {
  const p = row.patient;
  if (!p) {
    if (row.procedure && (row.transactionCategory === "SERVICE" || row.transactionCategory === "TRANSPLANT")) {
      return row.procedure;
    }
    return "N/A";
  }
  const pkg =
    p.counselling?.techniqueSuggested ||
    p.surgery?.technique ||
    p.personal?.techniqueQuoted ||
    row.procedure ||
    "N/A";
  return pkg;
};

const getPatientPackageAmount = (row) => {
  const p = row.patient;
  if (!p) return null;
  const amt = p.payments?.totalAmount || p.counselling?.finlpackage || null;
  return amt ? parseFloat(amt) : null;
};

function SalesTransactionsContent() {
  const { data: session } = useSession();
  const patientPicker = usePatientPicker();

  const [activeTab, setActiveTab] = useState("ALL");
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    TRANSPLANT: { count: 0, total: 0 },
    SERVICE:    { count: 0, total: 0 },
    MEDICINE:   { count: 0, total: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");
  const [dateRange, setDateRange] = useState("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // Expanded row state (for view-only detail expansion)
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Modals
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [billDataId, setBillDataId] = useState(null);
  const [showBill, setShowBill] = useState(false);

  // Fetch transactions dataset
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/get-all?limit=1000", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.transactions) {
        // Filter out expenses from sales view dataset
        const salesTx = (json.transactions || []).filter(
          (t) => (t.transactionCategory || t.category) !== "EXPENSE"
        );
        setTransactions(salesTx);
        if (json.stats) {
          setStats({
            TRANSPLANT: json.stats.TRANSPLANT || { count: 0, total: 0 },
            SERVICE:    json.stats.SERVICE    || { count: 0, total: 0 },
            MEDICINE:   json.stats.MEDICINE   || { count: 0, total: 0 },
          });
        }
        setLastUpdated(new Date());
      } else {
        throw new Error(json.message || "Failed to load transactions");
      }
    } catch (err) {
      console.error("Sales transactions fetch error:", err);
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Tab & attribute filter logic
  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((t) => {
      const cat = t.transactionCategory || t.category || "TRANSPLANT";
      // Expenses are strictly excluded
      if (cat === "EXPENSE") return false;

      if (activeTab === "ALL") return true;
      if (activeTab === "TOTAL_SALES") {
        return cat === "TRANSPLANT" || cat === "SERVICE" || cat === "MEDICINE";
      }
      if (activeTab === "TRANSPLANT") {
        return cat === "TRANSPLANT" || !cat || cat === "";
      }
      if (activeTab === "SERVICE") return cat === "SERVICE";
      if (activeTab === "MEDICINE") return cat === "MEDICINE";
      return true;
    });

    if (selectedBranch !== "All") {
      list = list.filter((t) => t.branch?.toLowerCase() === selectedBranch.toLowerCase());
    }

    if (selectedMethod !== "All") {
      list = list.filter((t) => t.method?.toLowerCase() === selectedMethod.toLowerCase());
    }

    // Date filtering
    const now = new Date();
    if (dateRange === "Today") {
      const todayStr = getISTDate(now);
      list = list.filter((t) => t.date && getISTDate(new Date(t.date)) === todayStr);
    } else if (dateRange === "Yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = getISTDate(y);
      list = list.filter((t) => t.date && getISTDate(new Date(t.date)) === yStr);
    } else if (dateRange === "Last 7 Days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      list = list.filter((t) => t.date && new Date(t.date) >= past);
    } else if (dateRange === "This Month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      list = list.filter((t) => t.date && new Date(t.date) >= start);
    } else if (dateRange === "Custom" && customFrom) {
      const from = new Date(customFrom);
      const to = customTo ? new Date(customTo) : new Date(customFrom);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d >= from && d <= to;
      });
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => {
        const pName = getPatientName(t);
        const pPhone = getPatientPhone(t);
        const proc = t.procedure || "";
        const id = t.paymentId || "";
        const remarks = t.remarks || "";
        const pkg = getPatientPackage(t);
        return (
          pName.toLowerCase().includes(q) ||
          pPhone.includes(q) ||
          proc.toLowerCase().includes(q) ||
          id.toLowerCase().includes(q) ||
          remarks.toLowerCase().includes(q) ||
          pkg.toLowerCase().includes(q)
        );
      });
    }

    // Sorting
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === "date") {
        aVal = new Date(a.date || 0).getTime();
        bVal = new Date(b.date || 0).getTime();
      } else if (sortField === "amount") {
        aVal = parseFloat(a.amount) || 0;
        bVal = parseFloat(b.amount) || 0;
      } else if (sortField === "patient") {
        aVal = getPatientName(a).toLowerCase();
        bVal = getPatientName(b).toLowerCase();
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    transactions,
    activeTab,
    selectedBranch,
    selectedMethod,
    dateRange,
    customFrom,
    customTo,
    search,
    sortField,
    sortDir,
  ]);

  // Dynamic branch list from existing transactions
  const availableBranches = useMemo(() => {
    const set = new Set();
    transactions.forEach((t) => {
      if (t.branch) set.add(t.branch);
    });
    ALL_BRANCHES.forEach((b) => set.add(b));
    return Array.from(set).filter(Boolean);
  }, [transactions]);

  // KPI Calculations strictly using real database metrics
  const kpiData = useMemo(() => {
    const totalActivityAmount = (stats.TRANSPLANT.total || 0) + (stats.SERVICE.total || 0) + (stats.MEDICINE.total || 0);
    const totalActivityCount = (stats.TRANSPLANT.count || 0) + (stats.SERVICE.count || 0) + (stats.MEDICINE.count || 0);

    return {
      totalActivity: {
        amount: totalActivityAmount,
        count: totalActivityCount,
      },
      transplant: {
        amount: stats.TRANSPLANT.total || 0,
        count: stats.TRANSPLANT.count || 0,
      },
      service: {
        amount: stats.SERVICE.total || 0,
        count: stats.SERVICE.count || 0,
      },
      medicine: {
        amount: stats.MEDICINE.total || 0,
        count: stats.MEDICINE.count || 0,
      },
    };
  }, [stats]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = {
      ALL: transactions.length,
      TOTAL_SALES: 0,
      TRANSPLANT: 0,
      SERVICE: 0,
      MEDICINE: 0,
    };
    transactions.forEach((t) => {
      const cat = t.transactionCategory || t.category || "TRANSPLANT";
      if (cat === "TRANSPLANT") {
        counts.TRANSPLANT += 1;
        counts.TOTAL_SALES += 1;
      } else if (cat === "SERVICE") {
        counts.SERVICE += 1;
        counts.TOTAL_SALES += 1;
      } else if (cat === "MEDICINE") {
        counts.MEDICINE += 1;
        counts.TOTAL_SALES += 1;
      }
    });
    return counts;
  }, [transactions]);

  // Pagination calculations
  const total = filteredTransactions.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredTransactions.slice(start, start + limit);
  }, [filteredTransactions, page, limit]);

  // Export to Excel (Read-only intelligence export)
  const exportToExcel = () => {
    try {
      const exportData = filteredTransactions.map((t) => ({
        Date: fmtDate(t.date),
        Type: t.transactionCategory || t.category || "TRANSPLANT",
        Patient: getPatientName(t),
        Phone: getPatientPhone(t),
        ProcedureOrMedicine: t.procedure || (typeof t.medicineId === "object" ? t.medicineId?.name : null) || "—",
        TotalPackage: getPatientPackage(t),
        Method: METHOD_LABELS[t.method] || t.method || "—",
        Branch: t.branch || "—",
        Amount: parseFloat(t.amount) || 0,
        Remarks: t.remarks || "",
      }));

      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Sales Transactions");
      writeFile(wb, `Sales_Transactions_${activeTab}_${dateRange}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
    }
  };

  const handleOpenBill = (row) => {
    const isRevenue = row.costType === "Revenue";
    const hasCategory = row.transactionCategory && row.transactionCategory !== "undefined" && row.transactionCategory !== "";
    if (isRevenue && (!hasCategory || row.transactionCategory === "TRANSPLANT") && row.patient) {
      const patientId = typeof row.patient === "object" ? row.patient._id : row.patient;
      setBillDataId(patientId || row._id);
    } else {
      setBillDataId(row._id);
    }
    setShowBill(true);
  };

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
                <Receipt className="w-4.5 h-4.5 drop-shadow-xs" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-semibold text-slate-800 tracking-tight leading-none">
                    Financial Transactions
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
                    Enterprise sales collections, settlement audit &amp; patient financial records
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

            {/* Date presets + Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Segmented date pills */}
              <div className="inline-flex items-center p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-inner">
                {DATE_PRESETS.map((r) => {
                  const active = dateRange === r;
                  return (
                    <button
                      key={r}
                      onClick={() => { setDateRange(r); setPage(1); }}
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
              {dateRange === "Custom" && (
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

              {/* Export Excel */}
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 shadow-xs transition-colors cursor-pointer"
                title="Download Excel Report"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Export</span>
              </button>

              {/* Incentive Entry Action */}
              <button
                onClick={() => setShowIncentiveModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-linear-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-semibold rounded-xl shadow-sm shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
                title="Record per-patient employee incentive"
              >
                <Gift className="w-3.5 h-3.5" />
                <span>Incentive Entry</span>
              </button>

              {/* Refresh */}
              <button
                onClick={fetchTransactions}
                disabled={loading}
                className="p-2 bg-white border border-slate-200/90 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-300 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Main Canvas ────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* ── 4 Primary Summary Cards ────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Total Activity */}
            <div className="relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-slate-400 to-blue-500" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Activity</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1">
                    {fmtRupee(kpiData.totalActivity.amount)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {kpiData.totalActivity.count} transactions
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 2. Transplant Revenue */}
            <div className="relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-600" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Transplant Revenue</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1">
                    {fmtRupee(kpiData.transplant.amount)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {kpiData.transplant.count} transactions
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                  <Scissors className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 3. Service Revenue */}
            <div className="relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-purple-500 to-pink-500" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Service Revenue</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1">
                    {fmtRupee(kpiData.service.amount)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {kpiData.service.count} transactions
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100">
                  <Heart className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 4. Medicine Revenue */}
            <div className="relative bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-600" />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Medicine Revenue</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mt-1">
                    {fmtRupee(kpiData.medicine.amount)}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    {kpiData.medicine.count} transactions
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <Pill className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Category / Tab Navigation ─────────────────────────────────────── */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                const count = tabCounts[t.id];
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTab(t.id); setPage(1); }}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                    <span>{t.label}</span>
                    {count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Body: Contra / Suspense / Regular Transactions ───────────────── */}
          {activeTab === "CONTRA" ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <ContraManager />
            </div>
          ) : activeTab === "SUSPENSE" ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <SuspenseManager />
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
              {/* Filter Toolbar */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search patient, phone, procedure, package, notes..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Branch selector */}
                <div className="relative min-w-[150px]">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
                    className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="All">All Branches</option>
                    {availableBranches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
                </div>

                {/* Payment Method selector */}
                <div className="relative min-w-[150px]">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedMethod}
                    onChange={(e) => { setSelectedMethod(e.target.value); setPage(1); }}
                    className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="All">All Methods</option>
                    {Object.keys(METHOD_LABELS).map((m) => (
                      <option key={m} value={m}>{METHOD_LABELS[m] || m}</option>
                    ))}
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
                </div>

                {/* Sort selector */}
                <div className="relative min-w-[160px]">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={`${sortField}-${sortDir}`}
                    onChange={(e) => {
                      const [f, d] = e.target.value.split("-");
                      setSortField(f);
                      setSortDir(d);
                    }}
                    className="w-full pl-8 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-[12px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="date-desc">Newest First</option>
                    <option value="date-asc">Oldest First</option>
                    <option value="amount-desc">Highest Amount</option>
                    <option value="amount-asc">Lowest Amount</option>
                    <option value="patient-asc">Patient Name (A-Z)</option>
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▾</span>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Party</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">Total Package</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[12px]">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                          <span>Loading financial transactions...</span>
                        </td>
                      </tr>
                    ) : paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <Receipt className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                          <p className="font-medium text-slate-600">No transactions found</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting filters or date range</p>
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => {
                        const cat = row.transactionCategory || row.category || "TRANSPLANT";
                        const pkg = getPatientPackage(row);
                        const pkgAmt = getPatientPackageAmount(row);
                        const isExpanded = expandedRowId === row._id;

                        return (
                          <React.Fragment key={row._id}>
                            <tr className="hover:bg-slate-50/80 transition-colors">
                              {/* Date */}
                              <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                                {fmtDate(row.date)}
                              </td>

                              {/* Type */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                                    cat === "TRANSPLANT"
                                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                                      : cat === "SERVICE"
                                      ? "bg-pink-50 text-pink-700 border border-pink-200/80"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                  }`}
                                >
                                  {cat}
                                </span>
                              </td>

                              {/* Party (Patient) */}
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800 leading-snug">
                                  {getPatientName(row)}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {getPatientPhone(row) || "—"}
                                </div>
                              </td>

                              {/* Details */}
                              <td className="py-3 px-4">
                                <div className="font-medium text-slate-700">
                                  {row.procedure || (typeof row.medicineId === "object" ? row.medicineId?.name : null) || "—"}
                                </div>
                                {row.quantity > 1 && (
                                  <div className="text-[11px] text-slate-400">
                                    Qty / Sessions: {row.quantity}
                                  </div>
                                )}
                              </td>

                              {/* Total Package of Patient (Authoritative Database field) */}
                              <td className="py-3 px-4">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px]">
                                  <Package className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span className="font-semibold text-slate-700">{pkg}</span>
                                  {pkgAmt !== null && (
                                    <span className="text-slate-400 text-[10px]">
                                      · {fmtRupee(pkgAmt)}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Method */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                    METHOD_COLORS[row.method?.toLowerCase()] || METHOD_COLORS.other
                                  }`}
                                >
                                  {METHOD_LABELS[row.method] || row.method || "—"}
                                </span>
                              </td>

                              {/* Branch */}
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                                  <Building2 className="w-3 h-3 text-slate-400" />
                                  {row.branch || "—"}
                                </span>
                              </td>

                              {/* Amount */}
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="font-bold text-slate-900 text-[13px]">
                                  {fmtRupee(row.amount)}
                                </div>
                                {parseFloat(row.discount || 0) > 0 && (
                                  <div className="text-[10px] text-amber-600 font-medium">
                                    -{fmtRupee(row.discount)} disc
                                  </div>
                                )}
                              </td>

                              {/* Actions (Strictly Read-Only: Bill & Expand) */}
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  {/* View Bill / Receipt */}
                                  <button
                                    onClick={() => handleOpenBill(row)}
                                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors cursor-pointer"
                                    title="View / Print Invoice"
                                  >
                                    <Bill className="w-4 h-4" />
                                  </button>

                                  {/* Toggle Detail Expander */}
                                  <button
                                    onClick={() => setExpandedRowId(isExpanded ? null : row._id)}
                                    className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors cursor-pointer"
                                    title="View Record Details"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-blue-600" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* ── Expanded Detail Row (Read-Only) ────────────── */}
                            {isExpanded && (
                              <tr className="bg-blue-50/30">
                                <td colSpan={9} className="px-6 py-3 border-t border-b border-blue-100">
                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
                                    <div>
                                      <span className="font-semibold text-slate-500 block">Payment ID:</span>
                                      <span className="font-mono text-slate-700">{row.paymentId || "N/A"}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-500 block">Payment Type:</span>
                                      <span className="text-slate-700">{row.paymentType || "Standard"}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-500 block">Account / Mode:</span>
                                      <span className="text-slate-700">{row.furtherMode || "Standard Account"}</span>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-500 block">Remarks:</span>
                                      <span className="text-slate-600 italic">{row.remarks || "None"}</span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ─────────────────────────────────────────────────── */}
              {!loading && total > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-400">
                    Showing{" "}
                    <span className="text-slate-700 font-semibold">{startItem}–{endItem}</span>{" "}
                    of{" "}
                    <span className="text-slate-700 font-semibold">{total}</span>{" "}
                    transactions
                    {totalPages > 1 && (
                      <span className="text-slate-300 ml-1">· Page {page} of {totalPages}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || loading}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                        page <= 1 || loading
                          ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                          : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || loading}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] font-medium transition-colors cursor-pointer ${
                        page >= totalPages || loading
                          ? "bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed"
                          : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Incentive Entry Modal ────────────────────────────────────────────── */}
      {showIncentiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Record Staff Incentive</h3>
                  <p className="text-[11px] text-slate-400">Tops up the employee&apos;s monthly incentive payable</p>
                </div>
              </div>
              <button
                onClick={() => setShowIncentiveModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <IncentiveEntryForm picker={patientPicker} />
            </div>
          </div>
        </div>
      )}

      {/* ── Bill Generator Modal ─────────────────────────────────────────────── */}
      {showBill && billDataId && (
        <BillGenerator
          transactionId={billDataId}
          onClose={() => {
            setShowBill(false);
            setBillDataId(null);
          }}
        />
      )}
    </div>
  );
}

export default function SalesTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-[12px] text-slate-500 shadow-sm">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>Loading sales transactions workspace...</span>
          </div>
        </div>
      }
    >
      <SalesTransactionsContent />
    </Suspense>
  );
}
