"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import MetricCard from "@/components/MetricCard";
import SearchableSelect from "@/components/SearchableSelect";
import { useToast } from "@/components/Toast";
import TransactionFieldSet, { validateTransactionFields } from "@/components/TransactionFieldSet";
import { getExpenseTypes } from "@/constants/expenseCategories";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { EXPENSE_METHODS, withLegacyMethod } from "@/constants/paymentMethods";
import { AGEING_BUCKETS, AGEING_TONE_CLASSES, formatAgeing } from "@/lib/ageing";
import {
  Wallet,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Banknote,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";

const PURPOSES = [
  "SALARY",
  "INCENTIVE",
  "RENT",
  "ELECTRICITY",
  "COLLAB_CLINIC",
  "PATIENT_COMMISSION",
  "TAX",
  "MEDICAL_CONSUMABLES",
  "MEDICINE_PROCUREMENT",
  "PROFESSIONAL_EXPENSES",
  "LAB_EXPENSES",
  "INTEREST_EXPENSES",
  "SOFTWARE_RENTAL",
  "HARDWARE_RENTAL",
];
// Purposes whose picker is just "pick a sub-type under this category" — no dedicated
// payee (mirrors how RENT/ELECTRICITY/TAX already work, just without a special unit label).
const GENERIC_SUBTYPE_PURPOSES = [
  "MEDICAL_CONSUMABLES",
  "MEDICINE_PROCUREMENT",
  "PROFESSIONAL_EXPENSES",
  "LAB_EXPENSES",
  "INTEREST_EXPENSES",
  "SOFTWARE_RENTAL",
  "HARDWARE_RENTAL",
];

const PURPOSE_LABELS = {
  SALARY: "Salary",
  INCENTIVE: "Incentive",
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  COLLAB_CLINIC: "Collab Clinic",
  PATIENT_COMMISSION: "Patient Commission",
  TAX: "Taxes",
  MEDICAL_CONSUMABLES: "Medical Consumables",
  MEDICINE_PROCUREMENT: "Medicine Procurement",
  PROFESSIONAL_EXPENSES: "Professional Expenses",
  LAB_EXPENSES: "Lab Expenses",
  INTEREST_EXPENSES: "Interest Expenses",
  SOFTWARE_RENTAL: "Software Rental",
  HARDWARE_RENTAL: "Hardware Rental",
};

// purpose -> the expenseCategory it always maps to (mirrors the expense form's own mapping).
const PURPOSE_TO_CATEGORY = {
  SALARY: "Salary",
  INCENTIVE: "Incentive",
  RENT: "Rent",
  ELECTRICITY: "Electricity Bill",
  COLLAB_CLINIC: "Collab Clinic Payment",
  PATIENT_COMMISSION: "Commision",
  TAX: "Taxes",
  MEDICAL_CONSUMABLES: "Medical Consumables",
  MEDICINE_PROCUREMENT: "Medicine Procurement",
  PROFESSIONAL_EXPENSES: "Professional Expenses",
  LAB_EXPENSES: "Lab Expenses",
  INTEREST_EXPENSES: "Interest Expenses",
  SOFTWARE_RENTAL: "Software Rental Expenses",
  HARDWARE_RENTAL: "Hardware Rental Expenses",
};


const DEFAULT_FILTERS = {
  search: "",
  status: "",
  ageingBucket: "",
  purpose: "",
  branch: "",
  dateFrom: "",
  dateTo: "",
};

export default function AdminPayablesPage() {
  return (
    <Suspense fallback={null}>
      <AdminPayablesPageInner />
    </Suspense>
  );
}

function AdminPayablesPageInner() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState({ overall: null, byPurpose: [] });
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [payables, setPayables] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => parseInt(searchParams.get("page") || "1", 10));
  const [listLoading, setListLoading] = useState(true);
  const limit = 20;

  const [filters, setFilters] = useState(() => ({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    ageingBucket: searchParams.get("ageingBucket") || "",
    purpose: searchParams.get("purpose") || "",
    branch: searchParams.get("branch") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
  }));

  const [expandedId, setExpandedId] = useState(null);
  const [expandedTx, setExpandedTx] = useState([]);
  const [expandedTxLoading, setExpandedTxLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [payModal, setPayModal] = useState(null);
  const [reviseModal, setReviseModal] = useState(null);

  // Keep the URL in sync so a filtered view can be shared and survives a refresh.
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.branch) params.set("branch", filters.branch);
      const res = await fetch(`/api/payables/summary?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSummary({ overall: data.overall, byPurpose: data.byPurpose || [] });
      }
    } catch (error) {
      console.error("Error fetching payable summary:", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchList = async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.purpose) params.set("purpose", filters.purpose);
      if (filters.status) params.set("status", filters.status);
      if (filters.ageingBucket) params.set("ageingBucket", filters.ageingBucket);
      if (filters.branch) params.set("branch", filters.branch);
      if (filters.search) params.set("search", filters.search);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);

      const res = await fetch(`/api/payables/list?${params}`);
      const data = await res.json();
      if (res.ok) {
        setPayables(data.payables || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "Failed to load payables");
      }
    } catch (error) {
      console.error("Error fetching payables:", error);
      toast.error("Failed to load payables");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [filters.branch]);

  useEffect(() => {
    fetchList();
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  };

  const refreshAll = () => {
    fetchSummary();
    fetchList();
  };

  // Row-level delete. The API refuses outright when payments already point at this payable
  // (409), so the guard lives there rather than being duplicated as a disabled button here —
  // the row can't know the live payment count without another fetch.
  const deletePayable = async (p) => {
    const ok = window.confirm(
      `Permanently delete this payable?\n\n` +
        `  ${p.payee?.label || "Payable"} · ${formatCurrency(p.totalAmount)}\n` +
        `  ${p.expenseCategory || p.purpose || ""}${p.branch ? ` · ${p.branch}` : ""}\n\n` +
        `Cancelling instead keeps the record and the audit trail. Delete cannot be undone.`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/payables/${p._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to delete payable");
      toast.success("Payable deleted");
      refreshAll();
    } catch (error) {
      console.error("Error deleting payable:", error);
      toast.error("Failed to delete payable");
    }
  };

  const toggleExpand = async (payable) => {
    if (expandedId === payable._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(payable._id);
    setExpandedTxLoading(true);
    try {
      const params = new URLSearchParams({ payableId: payable._id, limit: "50" });
      const res = await fetch(`/api/transactions/get-all?${params}`);
      const data = await res.json();
      if (res.ok) setExpandedTx(data.transactions || []);
    } catch (error) {
      console.error("Error fetching payable transactions:", error);
    } finally {
      setExpandedTxLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payables</h1>
              <p className="text-sm text-gray-500 mt-1">
                Everything owed — salary, incentives, rent, electricity, collab clinics, patient
                commissions, and taxes — in one place
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Payable
            </button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Total Owed"
              value={formatCurrency(summary.overall?.totalOwed)}
              icon={Wallet}
              color="from-indigo-500 to-indigo-600"
            />
            <MetricCard
              title="Total Paid"
              value={formatCurrency(summary.overall?.totalPaid)}
              icon={CheckCircle2}
              color="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Total Pending"
              value={formatCurrency(summary.overall?.totalPending)}
              icon={Clock}
              color="from-amber-500 to-amber-600"
            />
            <MetricCard
              title="Active Payables"
              value={summary.overall?.count ?? 0}
              icon={AlertTriangle}
              color="from-rose-500 to-rose-600"
            />
          </div>

          {/* Purpose breakdown */}
          {summary.byPurpose.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Breakdown by Purpose</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {summary.byPurpose.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => handleFilterChange("purpose", filters.purpose === p._id ? "" : p._id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      filters.purpose === p._id
                        ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      {PURPOSE_LABELS[p._id] || p._id} · {p.count}
                    </p>
                    <p className="text-sm font-bold text-rose-600">{formatCurrency(p.totalPending)} pending</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(p.totalOwed)} owed · {formatCurrency(p.totalPaid)} paid
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters — order: search -> status -> purpose -> branch -> date range */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-3">
              <div className="relative lg:col-span-2">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search payee, category…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
              <select
                value={filters.ageingBucket}
                onChange={(e) => handleFilterChange("ageingBucket", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Ages</option>
                {AGEING_BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.purpose}
                onChange={(e) => handleFilterChange("purpose", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Purposes</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {PURPOSE_LABELS[p]}
                  </option>
                ))}
              </select>
              <select
                value={filters.branch}
                onChange={(e) => handleFilterChange("branch", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Branches</option>
                {ALL_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 lg:col-span-2">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            {Object.values(filters).some(Boolean) && (
              <button
                onClick={clearFilters}
                className="mt-3 text-xs font-medium text-indigo-700 hover:text-indigo-800"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {listLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : payables.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">No payables match these filters.</div>
            ) : (
              <>
                {/* Mobile: stacked cards below sm breakpoint */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {payables.map((p) => (
                    <div key={p._id} className={`p-4 ${p.isCancelled ? "opacity-50" : ""}`}>
                      <button
                        onClick={() => toggleExpand(p)}
                        className="flex items-center justify-between w-full text-left mb-2"
                      >
                        <span className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                          {expandedId === p._id ? (
                            <ChevronUp className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          )}
                          {p.payee?.label}
                          {p.tdsLink?.role && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {p.tdsLink.role === "PARENT" ? "TDS linked" : "TDS split"}
                            </span>
                          )}
                        </span>
                        {p.isCancelled ? <StatusBadge status="Cancelled" /> : <StatusBadge status={p.status} />}
                      </button>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                        <span>{PURPOSE_LABELS[p.purpose] || p.purpose}</span>
                        <span className="text-right">
                          {p.expenseCategory}
                          {p.expenseSubType ? ` / ${p.expenseSubType}` : ""}
                        </span>
                        <span>
                          Due {formatDate(p.dueDate)}
                          <span className={`ml-1.5 ${AGEING_TONE_CLASSES[formatAgeing(p.daysOverdue).tone]}`}>
                            · {formatAgeing(p.daysOverdue).text}
                          </span>
                        </span>
                        <span className="text-right">
                          {p.period?.month ? `${p.period.month}/${p.period.year}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-500">Owed </span>
                          <span className="font-medium text-gray-900">{formatCurrency(p.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Paid </span>
                          <span className="text-emerald-700">{formatCurrency(p.paid)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Pending </span>
                          <span className="font-bold text-rose-600">{formatCurrency(p.pending)}</span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-1.5 mt-2">
                        {!p.isCancelled && p.status !== "Paid" && (
                          <button
                            onClick={() => setPayModal(p)}
                            className="flex items-center gap-1 text-xs font-medium text-indigo-700 px-2 py-1 rounded-lg bg-indigo-50"
                          >
                            <Banknote className="w-3.5 h-3.5" /> Pay
                          </button>
                        )}
                        <button
                          onClick={() => setReviseModal(p)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-600 px-2 py-1 rounded-lg bg-gray-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Revise
                        </button>
                        <button
                          onClick={() => deletePayable(p)}
                          className="flex items-center gap-1 text-xs font-medium text-red-600 px-2 py-1 rounded-lg bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                      {expandedId === p._id && (
                        <div className="mt-3">
                          <PayableHistory payable={p} transactions={expandedTx} loading={expandedTxLoading} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop/tablet: table */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Payee</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Purpose</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Category / Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Period</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Owed</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Paid</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Pending</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Due</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Ageing</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payables.map((p) => (
                      <Fragment key={p._id}>
                        <tr className={`hover:bg-gray-50/60 ${p.isCancelled ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(p)}
                              className="flex items-center gap-1.5 text-left font-medium text-gray-900 hover:text-indigo-600"
                            >
                              {expandedId === p._id ? (
                                <ChevronUp className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 shrink-0" />
                              )}
                              <span className="truncate max-w-40">{p.payee?.label}</span>
                              {p.tdsLink?.role && (
                                <span
                                  title={
                                    p.tdsLink.role === "PARENT"
                                      ? "Has a linked TDS payable"
                                      : "TDS split from another payable"
                                  }
                                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200"
                                >
                                  {p.tdsLink.role === "PARENT" ? "TDS linked" : "TDS split"}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{PURPOSE_LABELS[p.purpose] || p.purpose}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {p.expenseCategory}
                            {p.expenseSubType ? <span className="text-gray-400"> / {p.expenseSubType}</span> : null}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {p.period?.month ? `${p.period.month}/${p.period.year}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(p.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(p.paid)}</td>
                          <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(p.pending)}</td>
                          <td className="px-4 py-3">
                            {p.isCancelled ? <StatusBadge status="Cancelled" /> : <StatusBadge status={p.status} />}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(p.dueDate)}</td>
                          <td className={`px-4 py-3 whitespace-nowrap ${AGEING_TONE_CLASSES[formatAgeing(p.daysOverdue).tone]}`}>
                            {formatAgeing(p.daysOverdue).text}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {!p.isCancelled && p.status !== "Paid" && (
                                <button
                                  onClick={() => setPayModal(p)}
                                  title="Record Payment"
                                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                >
                                  <Banknote className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setReviseModal(p)}
                                title="Revise"
                                className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deletePayable(p)}
                                title="Delete permanently"
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedId === p._id && (
                          <tr>
                            <td colSpan={11} className="px-4 pb-4 bg-gray-50/60">
                              <PayableHistory payable={p} transactions={expandedTx} loading={expandedTxLoading} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}

            {!listLoading && payables.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} · {total} total
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {payModal && (
        <RecordPaymentModal
          payable={payModal}
          onClose={() => setPayModal(null)}
          onSuccess={() => {
            setPayModal(null);
            refreshAll();
          }}
          toast={toast}
        />
      )}

      {reviseModal && (
        <ReviseModal
          payable={reviseModal}
          onClose={() => setReviseModal(null)}
          onSuccess={() => {
            setReviseModal(null);
            refreshAll();
          }}
          toast={toast}
        />
      )}

      {showCreateModal && (
        <NewPayableModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refreshAll();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

// ========== HISTORY (log[] + linked transactions) ==========
function PayableHistory({ payable, transactions, loading }) {
  const log = payable.log || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Payments ({transactions.length})
        </h4>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {transactions.map((tx) => (
              <li key={tx._id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{formatCurrency(tx.amount)}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(tx.date)} · {(tx.method || "—").replace(/_/g, " ").toUpperCase()}
                    {tx.paymentId ? ` · ${tx.paymentId}` : ""}
                  </p>
                </div>
                <p className="text-xs text-gray-500 text-right shrink-0 ml-3">{tx.createdBy?.name || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Activity Log ({log.length})
        </h4>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...log].reverse().map((entry, i) => (
              <li key={i} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{entry.action}</span>
                  <span className="text-xs text-gray-500">{formatDate(entry.performedAt)}</span>
                </div>
                {entry.previousValue && (
                  <p className="text-xs text-gray-500">
                    {entry.previousValue} → {entry.newValue}
                  </p>
                )}
                {entry.note && <p className="text-xs text-gray-400 italic mt-0.5">{entry.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">by {entry.performedBy?.name || "—"}</p>
              </li>
            ))}
          </ul>
        )}
        {payable.remarks && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Remarks</p>
            <p className="text-sm text-gray-700">{payable.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function buildGiverForPayable(payable) {
  const { kind, refId, label } = payable.payee || {};
  if (kind === "EMPLOYEE") return { type: "EMPLOYEE", refId, name: label };
  if (kind === "PATIENT") return { type: "PATIENT", refId, name: label };
  if (kind === "VENDOR") return { type: "VENDOR", vendorId: refId, name: label };
  return { type: "MANUAL", name: label }; // RENT_UNIT, UTILITY_UNIT, COLLAB_CLINIC, OTHER
}

// ========== RECORD PAYMENT MODAL ==========
function RecordPaymentModal({ payable, onClose, onSuccess, toast }) {
  // Flat object handed to TransactionFieldSet — see the receipt modal for the same shape. The
  // routing fields here are what was missing: a payment with no furtherMode never reaches an
  // account in Close Book.
  const [fields, setFields] = useState({
    amount: String(payable.pending || ""),
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    paymentId: "",
    branch: payable.branch || "",
    receiptMode: "",
    furtherMode: "",
    remarks: "",
    receipts: [],
    externalParty: {},
  });
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const overBalance = parseFloat(fields.amount || 0) > payable.pending;

  const handleSubmit = async () => {
    const invalid = validateTransactionFields(fields, "payable-payment");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (overBalance && !allowOverpayment) {
      toast.error("Amount exceeds pending balance — check 'Allow overpayment' to proceed anyway");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/expense/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseCategory: payable.expenseCategory,
          expenseType: payable.expenseSubType,
          amount: fields.amount,
          method: fields.method,
          paymentId: fields.paymentId,
          branch: fields.branch,
          date: fields.date,
          receiptMode: fields.receiptMode,
          furtherMode: fields.furtherMode,
          receipts: fields.receipts,
          externalParty: fields.externalParty?.name ? fields.externalParty : undefined,
          remarks: fields.remarks || `Payment against payable — ${payable.payee?.label}`,
          patientId: payable.relatedPatient || undefined,
          expenseGiver: buildGiverForPayable(payable),
          payableId: payable._id,
          allowOverpayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payment recorded");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{payable.payee?.label}</p>
            <p className="text-gray-500 mt-1">
              {PURPOSE_LABELS[payable.purpose]} · Pending:{" "}
              <span className="font-bold text-rose-600">{formatCurrency(payable.pending)}</span>
            </p>
          </div>

          <div>
            {/* Full parity with a directly-entered expense (§1.2) — the routing fields are the
                point: a payment with no furtherMode never lands in a Close Book account. */}
            <TransactionFieldSet
              context="payable-payment"
              value={fields}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
              transactionCategory="EXPENSE"
              patientId={payable.relatedPatient || undefined}
            />
            {overBalance && (
              <label className="flex items-center gap-2 mt-3 text-xs text-amber-700">
                <input type="checkbox" checked={allowOverpayment} onChange={(e) => setAllowOverpayment(e.target.checked)} />
                Amount exceeds pending balance — allow overpayment
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== REVISE / CANCEL MODAL ==========
function ReviseModal({ payable, onClose, onSuccess, toast }) {
  const [totalAmount, setTotalAmount] = useState(String(payable.totalAmount));
  const [dueDate, setDueDate] = useState(payable.dueDate ? payable.dueDate.split("T")[0] : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const save = async (extra = {}) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payables/${payable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: totalAmount !== String(payable.totalAmount) ? totalAmount : undefined,
          dueDate: dueDate || null,
          note,
          ...extra,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payable updated");
        onSuccess();
      } else if (data.requiresCascadeConfirmation) {
        // Never silently orphan the linked TDS payable — the server refuses until we say
        // explicitly what should happen to it, so surface that choice rather than the error.
        const alsoCancelTds = window.confirm(
          "This payable has a linked TDS payable.\n\n" +
            "OK — cancel BOTH this payable and its linked TDS payable.\n" +
            "Cancel — leave both as they are (you can then handle the TDS payable separately).",
        );
        if (alsoCancelTds) {
          await save({ ...extra, cascadeTds: true });
          return;
        }
        toast.info("No changes made — the linked TDS payable was left untouched.");
      } else {
        toast.error(data.error || "Failed to update payable");
      }
    } catch (error) {
      console.error("Error updating payable:", error);
      toast.error("Failed to update payable");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Permanently delete this payable?\n\n` +
        `  ${payable.payee?.label || "Payable"} · ${formatCurrency(payable.totalAmount)}\n\n` +
        `Cancelling instead keeps the record and the audit trail. Delete cannot be undone.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payables/${payable._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to delete payable");
      toast.success("Payable deleted");
      onSuccess();
    } catch (error) {
      console.error("Error deleting payable:", error);
      toast.error("Failed to delete payable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Revise Payable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{payable.payee?.label}</p>
            <p className="text-gray-500 mt-1">
              Already paid: <span className="font-semibold text-emerald-700">{formatCurrency(payable.paid)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount Owed (₹)</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              placeholder="Reason for the change (optional)"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-5 border-t border-gray-100">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
              Close
            </button>
            <button
              onClick={() => save()}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
          <button
            onClick={() => save({ isCancelled: !payable.isCancelled })}
            disabled={submitting}
            className={`w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
              payable.isCancelled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            <Ban className="w-4 h-4" />
            {payable.isCancelled ? "Reinstate Payable" : "Cancel Payable"}
          </button>
          {/* Offered under Cancel, not beside it: cancelling keeps the record and is reversible,
              so it should stay the obvious choice. The API refuses outright if any payment has
              already been logged against this payable. */}
          <button
            onClick={remove}
            disabled={submitting}
            className="w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== NEW PAYABLE MODAL ==========
function NewPayableModal({ onClose, onSuccess, toast }) {
  const [purpose, setPurpose] = useState("");
  const [subType, setSubType] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Payee fields
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [collabBranch, setCollabBranch] = useState("");
  const [taxType, setTaxType] = useState("");

  // Related patient (Incentive / Patient Commission)
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientDebounce = useRef(null);
  const [relatedPatient, setRelatedPatient] = useState("");

  const [employees, setEmployees] = useState([]);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const employeeDebounce = useRef(null);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchPatients = async (term = "") => {
    setPatientSearching(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (term) params.set("search", term);
      const res = await fetch(`/api/patients/get-patient?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } finally {
      setPatientSearching(false);
    }
  };
  const handlePatientSearch = (term) => {
    clearTimeout(patientDebounce.current);
    patientDebounce.current = setTimeout(() => fetchPatients(term), 350);
  };
  const formatPatientOption = (p) => `${p.personal?.name || "N/A"} — ${p.personal?.phone || "N/A"}`;

  const fetchEmployees = async (term = "") => {
    setEmployeeSearching(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (term) params.set("search", term);
      const res = await fetch(`/api/employees/get?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } finally {
      setEmployeeSearching(false);
    }
  };
  const handleEmployeeSearch = (term) => {
    clearTimeout(employeeDebounce.current);
    employeeDebounce.current = setTimeout(() => fetchEmployees(term), 350);
  };
  const formatEmployeeOption = (e) => `${e.name} — ${e.role}`;

  useEffect(() => {
    fetchPatients("");
    fetchEmployees("");
  }, []);

  const needsPeriod = ["SALARY", "RENT", "ELECTRICITY", "COLLAB_CLINIC", "TAX"].includes(purpose);
  const needsPatient = ["INCENTIVE", "PATIENT_COMMISSION"].includes(purpose);

  const buildPayee = () => {
    if (purpose === "SALARY" || purpose === "INCENTIVE") {
      return { kind: "EMPLOYEE", refId: employeeId, label: employeeName };
    }
    if (purpose === "RENT") return { kind: "RENT_UNIT", refId: null, label: unitLabel };
    if (purpose === "ELECTRICITY") return { kind: "UTILITY_UNIT", refId: null, label: unitLabel };
    if (purpose === "COLLAB_CLINIC") return { kind: "COLLAB_CLINIC", refId: null, label: collabBranch };
    if (purpose === "PATIENT_COMMISSION") {
      const pat = patients.find((p) => p._id === relatedPatient);
      return { kind: "PATIENT", refId: relatedPatient, label: pat?.personal?.name || "Patient" };
    }
    if (purpose === "TAX") return { kind: "OTHER", refId: null, label: taxType };
    if (GENERIC_SUBTYPE_PURPOSES.includes(purpose)) return { kind: "OTHER", refId: null, label: subType };
    return null;
  };

  const handleSubmit = async () => {
    if (!purpose || !totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error("Purpose and a valid amount are required");
      return;
    }
    const payee = buildPayee();
    if (!payee?.label) {
      toast.error("Complete the payee details for this purpose");
      return;
    }
    if (needsPeriod && (!month || !year)) {
      toast.error("Select the month and year this payable is for");
      return;
    }
    if (needsPatient && !relatedPatient) {
      toast.error("Related patient is required for this purpose");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payee,
          purpose,
          expenseCategory: PURPOSE_TO_CATEGORY[purpose],
          expenseSubType: subType || (purpose === "SALARY" ? "Salary" : purpose === "COLLAB_CLINIC" ? "Collab Clinic Payment" : subType),
          period: needsPeriod ? { month: parseInt(month), year: parseInt(year) } : undefined,
          relatedPatient: needsPatient ? relatedPatient : undefined,
          totalAmount,
          dueDate: dueDate || undefined,
          branch: branch || undefined,
          remarks,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payable created");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to create payable");
      }
    } catch (error) {
      console.error("Error creating payable:", error);
      toast.error("Failed to create payable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">New Payable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose *</label>
            <select
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setSubType("");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select purpose…</option>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {PURPOSE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {(purpose === "SALARY" || purpose === "INCENTIVE") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee *</label>
              <SearchableSelect
                options={employees}
                value={employeeId}
                onChange={(v, obj) => {
                  setEmployeeId(v);
                  setEmployeeName(obj?.name || "");
                }}
                placeholder="Search and select an employee..."
                valueKey="_id"
                formatOption={formatEmployeeOption}
                onSearch={handleEmployeeSearch}
                searching={employeeSearching}
              />
            </div>
          )}

          {purpose === "INCENTIVE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Incentive Type</label>
              <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select type…</option>
                {getExpenseTypes("Incentive").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "RENT" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rent Unit *</label>
              <select
                value={unitLabel}
                onChange={(e) => {
                  setUnitLabel(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select unit…</option>
                {getExpenseTypes("Rent").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "ELECTRICITY" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Utility Unit *</label>
              <select
                value={unitLabel}
                onChange={(e) => {
                  setUnitLabel(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select unit…</option>
                {getExpenseTypes("Electricity Bill").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "COLLAB_CLINIC" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic *</label>
              <select
                value={collabBranch}
                onChange={(e) => setCollabBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select clinic…</option>
                {COLLAB_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "PATIENT_COMMISSION" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Related Patient *</label>
                <SearchableSelect
                  options={patients}
                  value={relatedPatient}
                  onChange={(v) => setRelatedPatient(v)}
                  placeholder="Search and select a patient..."
                  valueKey="_id"
                  formatOption={formatPatientOption}
                  onSearch={handlePatientSearch}
                  searching={patientSearching}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Commission Type</label>
                <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select type…</option>
                  {getExpenseTypes("Commision").map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {purpose === "TAX" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Type *</label>
              <select
                value={taxType}
                onChange={(e) => {
                  setTaxType(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select type…</option>
                {getExpenseTypes("Taxes").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {GENERIC_SUBTYPE_PURPOSES.includes(purpose) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {PURPOSE_LABELS[purpose]} Sub-type *
              </label>
              <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select…</option>
                {getExpenseTypes(PURPOSE_TO_CATEGORY[purpose]).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsPeriod && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount (₹) *</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Select branch…</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Payable"}
          </button>
        </div>
      </div>
    </div>
  );
}
