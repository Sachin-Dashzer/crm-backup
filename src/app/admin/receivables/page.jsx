"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import MetricCard from "@/components/MetricCard";
import SearchableSelect from "@/components/SearchableSelect";
import ReceiptUpload from "@/components/ReceiptUpload";
import TransactionFieldSet, { validateTransactionFields } from "@/components/TransactionFieldSet";
import { useToast } from "@/components/Toast";
import { REVENUE_METHODS } from "@/constants/paymentMethods";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { AGEING_BUCKETS, AGEING_TONE_CLASSES, formatAgeing } from "@/lib/ageing";
import {
  HandCoins,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Pencil,
  Ban,
  Trash2,
} from "lucide-react";

const PURPOSES = ["PATIENT_DUE", "COLLAB_SETTLEMENT", "REFUND_DUE", "ADVANCE_RECOVERY", "OTHER"];

const PURPOSE_LABELS = {
  PATIENT_DUE: "Patient Due",
  COLLAB_SETTLEMENT: "Collab Settlement",
  REFUND_DUE: "Refund Due",
  ADVANCE_RECOVERY: "Advance Recovery",
  OTHER: "Other",
};

// purpose -> the payer.kind it always maps to. REFUND_DUE and ADVANCE_RECOVERY are the two
// purposes without a single fixed kind — the New Receivable modal shows a kind picker for those.
const PURPOSE_TO_FIXED_KIND = {
  PATIENT_DUE: "PATIENT",
  COLLAB_SETTLEMENT: "COLLAB_CLINIC",
  OTHER: "OTHER",
};

const REVENUE_CATEGORIES = ["Transplant", "Services", "Medicine"];

const DEFAULT_FILTERS = {
  search: "",
  status: "",
  ageingBucket: "",
  purpose: "",
  branch: "",
  dateFrom: "",
  dateTo: "",
};

export default function AdminReceivablesPage() {
  return (
    <Suspense fallback={null}>
      <AdminReceivablesPageInner />
    </Suspense>
  );
}

function AdminReceivablesPageInner() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [summary, setSummary] = useState({ overall: null, byPurpose: [] });
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [receivables, setReceivables] = useState([]);
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
  const [reviseModal, setReviseModal] = useState(null);
  const [receiptModal, setReceiptModal] = useState(null);

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
      const res = await fetch(`/api/receivables/summary?${params}`);
      const data = await res.json();
      if (res.ok) {
        setSummary({ overall: data.overall, byPurpose: data.byPurpose || [] });
      }
    } catch (error) {
      console.error("Error fetching receivable summary:", error);
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

      const res = await fetch(`/api/receivables/list?${params}`);
      const data = await res.json();
      if (res.ok) {
        setReceivables(data.receivables || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "Failed to load receivables");
      }
    } catch (error) {
      console.error("Error fetching receivables:", error);
      toast.error("Failed to load receivables");
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

  // Row-level delete. The API refuses outright when receipts already point at this receivable
  // (409), so the guard lives there rather than being duplicated as a disabled button here —
  // the row can't know the live receipt count without another fetch.
  const deleteReceivable = async (r) => {
    const ok = window.confirm(
      `Permanently delete this receivable?\n\n` +
        `  ${r.payer?.label || "Receivable"} · ${formatCurrency(r.totalAmount)}\n` +
        `  ${r.purpose || ""}${r.branch ? ` · ${r.branch}` : ""}\n\n` +
        `Cancelling instead keeps the record and the audit trail. Delete cannot be undone.`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/receivables/${r._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to delete receivable");
      toast.success("Receivable deleted");
      refreshAll();
    } catch (error) {
      console.error("Error deleting receivable:", error);
      toast.error("Failed to delete receivable");
    }
  };

  const toggleExpand = async (receivable) => {
    if (expandedId === receivable._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(receivable._id);
    setExpandedTxLoading(true);
    try {
      const params = new URLSearchParams({ receivableId: receivable._id, limit: "50" });
      const res = await fetch(`/api/transactions/get-all?${params}`);
      const data = await res.json();
      if (res.ok) setExpandedTx(data.transactions || []);
    } catch (error) {
      console.error("Error fetching receivable transactions:", error);
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
              <h1 className="text-2xl font-bold text-gray-900">Receivables</h1>
              <p className="text-sm text-gray-500 mt-1">
                Money owed to us — patient dues, collab settlements, refunds, and advance
                recoveries — in one place
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Receivable
            </button>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
              title="Total Receivable"
              value={formatCurrency(summary.overall?.totalReceivable)}
              icon={HandCoins}
              color="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Received To Date"
              value={formatCurrency(summary.overall?.totalReceived)}
              icon={CheckCircle2}
              color="from-indigo-500 to-indigo-600"
            />
            <MetricCard
              title="Open (Pending)"
              value={formatCurrency(summary.overall?.totalPending)}
              icon={Clock}
              color="from-amber-500 to-amber-600"
            />
            <MetricCard
              title="Active Receivables"
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
                        ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <p className="text-xs font-medium text-gray-500 mb-1">
                      {PURPOSE_LABELS[p._id] || p._id} · {p.count}
                    </p>
                    <p className="text-sm font-bold text-amber-600">{formatCurrency(p.totalPending)} pending</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(p.totalReceivable)} expected · {formatCurrency(p.totalReceived)} received
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
                  placeholder="Search payer, category…"
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
                <option value="Partially Received">Partially Received</option>
                <option value="Received">Received</option>
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
                className="mt-3 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {listLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            ) : receivables.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">No receivables match these filters.</div>
            ) : (
              <>
                {/* Mobile: stacked cards below sm breakpoint */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {receivables.map((r) => (
                    <div key={r._id} className={`p-4 ${r.isCancelled ? "opacity-50" : ""}`}>
                      <button
                        onClick={() => toggleExpand(r)}
                        className="flex items-center justify-between w-full text-left mb-2"
                      >
                        <span className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                          {expandedId === r._id ? (
                            <ChevronUp className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          )}
                          {r.payer?.label}
                        </span>
                        {r.isCancelled ? <StatusBadge status="Cancelled" /> : <StatusBadge status={r.status} />}
                      </button>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                        <span>{PURPOSE_LABELS[r.purpose] || r.purpose}</span>
                        <span className="text-right">{r.revenueCategory || "—"}</span>
                        <span>
                          Due {formatDate(r.dueDate)}
                          <span className={`ml-1.5 ${AGEING_TONE_CLASSES[formatAgeing(r.daysOverdue).tone]}`}>
                            · {formatAgeing(r.daysOverdue).text}
                          </span>
                        </span>
                        <span className="text-right">
                          {r.period?.month ? `${r.period.month}/${r.period.year}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-500">Expected </span>
                          <span className="font-medium text-gray-900">{formatCurrency(r.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Received </span>
                          <span className="text-emerald-700">{formatCurrency(r.received)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Pending </span>
                          <span className="font-bold text-amber-600">{formatCurrency(r.pending)}</span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        {!r.isCancelled && r.status !== "Received" && (
                          <button
                            onClick={() => setReceiptModal(r)}
                            className="flex items-center gap-1 text-xs font-medium text-emerald-700 px-2 py-1 rounded-lg bg-emerald-50"
                          >
                            <HandCoins className="w-3.5 h-3.5" /> Record Receipt
                          </button>
                        )}
                        <button
                          onClick={() => setReviseModal(r)}
                          className="flex items-center gap-1 text-xs font-medium text-gray-600 px-2 py-1 rounded-lg bg-gray-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Revise
                        </button>
                        <button
                          onClick={() => deleteReceivable(r)}
                          className="flex items-center gap-1 text-xs font-medium text-red-600 px-2 py-1 rounded-lg bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                      {expandedId === r._id && (
                        <div className="mt-3">
                          <ReceivableHistory receivable={r} transactions={expandedTx} loading={expandedTxLoading} />
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
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Payer</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Purpose</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Period</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Expected</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Received</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Pending</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Due</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Ageing</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receivables.map((r) => (
                      <Fragment key={r._id}>
                        <tr className={`hover:bg-gray-50/60 ${r.isCancelled ? "opacity-50" : ""}`}>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleExpand(r)}
                              className="flex items-center gap-1.5 text-left font-medium text-gray-900 hover:text-emerald-600"
                            >
                              {expandedId === r._id ? (
                                <ChevronUp className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 shrink-0" />
                              )}
                              <span className="truncate max-w-40">{r.payer?.label}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{PURPOSE_LABELS[r.purpose] || r.purpose}</td>
                          <td className="px-4 py-3 text-gray-700">{r.revenueCategory || "—"}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {r.period?.month ? `${r.period.month}/${r.period.year}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCurrency(r.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(r.received)}</td>
                          <td className="px-4 py-3 text-right font-bold text-amber-600">{formatCurrency(r.pending)}</td>
                          <td className="px-4 py-3">
                            {r.isCancelled ? <StatusBadge status="Cancelled" /> : <StatusBadge status={r.status} />}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(r.dueDate)}</td>
                          <td className={`px-4 py-3 whitespace-nowrap ${AGEING_TONE_CLASSES[formatAgeing(r.daysOverdue).tone]}`}>
                            {formatAgeing(r.daysOverdue).text}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Hidden once fully received or cancelled — there is nothing
                                  left to receive, and the endpoint would reject it anyway. */}
                              {!r.isCancelled && r.status !== "Received" && (
                                <button
                                  onClick={() => setReceiptModal(r)}
                                  title="Record Receipt"
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                >
                                  <HandCoins className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setReviseModal(r)}
                                title="Revise"
                                className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteReceivable(r)}
                                title="Delete permanently"
                                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedId === r._id && (
                          <tr>
                            <td colSpan={11} className="px-4 pb-4 bg-gray-50/60">
                              <ReceivableHistory receivable={r} transactions={expandedTx} loading={expandedTxLoading} />
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

            {!listLoading && receivables.length > 0 && (
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

      {receiptModal && (
        <RecordReceiptModal
          receivable={receiptModal}
          onClose={() => setReceiptModal(null)}
          onSuccess={() => {
            setReceiptModal(null);
            refreshAll();
          }}
          toast={toast}
        />
      )}

      {reviseModal && (
        <ReviseModal
          receivable={reviseModal}
          onClose={() => setReviseModal(null)}
          onSuccess={() => {
            setReviseModal(null);
            refreshAll();
          }}
          toast={toast}
        />
      )}

      {showCreateModal && (
        <NewReceivableModal
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

// ========== HISTORY (log[] + linked revenue transactions) ==========
function ReceivableHistory({ receivable, transactions, loading }) {
  const log = receivable.log || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Revenue Received ({transactions.length})
        </h4>
        <p className="text-xs text-gray-400 mb-3">
          Recorded by tagging a normal Transplant/Services/Medicine transaction with this
          receivable — there is no separate "receive" action.
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-400">No revenue logged against this yet.</p>
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
                {entry.note && <p className="text-xs text-gray-500 italic">{entry.note}</p>}
                <p className="text-xs text-gray-400">{entry.performedBy?.name}</p>
              </li>
            ))}
          </ul>
        )}
        {receivable.remarks && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
            <p className="text-sm text-gray-600">{receivable.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== REVISE / CANCEL MODAL ==========
// ========== RECORD RECEIPT MODAL ==========
//
// The replacement for the "Apply to Receivable" picker that used to live on the revenue forms.
// Creates the same document — a Revenue transaction carrying receivableId — but from the side
// where the outstanding balance is known, so the amount can be validated against it. Mirrors
// RecordPaymentModal on the payables page, including the allowOverpayment escape hatch.
function RecordReceiptModal({ receivable, onClose, onSuccess, toast }) {
  // One flat object owned here and handed to TransactionFieldSet, rather than a state variable
  // per field — the field set is what decides which of these are shown and required.
  const [fields, setFields] = useState({
    amount: String(receivable.pending || ""),
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    paymentId: "",
    branch: receivable.branch || "",
    receiptMode: "",
    furtherMode: "",
    remarks: "",
    receipts: [],
    externalParty: {},
  });
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const overBalance = parseFloat(fields.amount || 0) > receivable.pending;

  const handleSubmit = async () => {
    // Same rules the field set renders — validateTransactionFields is the single definition, so
    // the form can't enforce something different from what it showed.
    const invalid = validateTransactionFields(fields, "receivable-receipt");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (overBalance && !allowOverpayment) {
      toast.error("Amount exceeds outstanding balance — check 'Allow overpayment' to proceed anyway");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          allowOverpayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receipt recorded");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to record receipt");
      }
    } catch (error) {
      console.error("Error recording receipt:", error);
      toast.error("Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Record Receipt</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{receivable.payer?.label}</p>
            <p className="text-gray-500 mt-1">
              {PURPOSE_LABELS[receivable.purpose] || receivable.purpose} · Pending:{" "}
              <span className="font-bold text-amber-600">{formatCurrency(receivable.pending)}</span>
            </p>
          </div>

          <div>
            {/* Full field parity with a directly-entered transaction (§1.2) — most importantly
                receiptMode/furtherMode, whose absence here is what produced thousands of rows
                invisible to Close Book. */}
            <TransactionFieldSet
              context="receivable-receipt"
              value={fields}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
              transactionCategory={receivable.revenueCategory || undefined}
              patientId={receivable.relatedPatient || undefined}
            />
            {overBalance && (
              <label className="flex items-center gap-2 mt-3 text-xs text-amber-700">
                <input
                  type="checkbox"
                  checked={allowOverpayment}
                  onChange={(e) => setAllowOverpayment(e.target.checked)}
                />
                Amount exceeds outstanding balance — allow overpayment
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Recording…" : "Record Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviseModal({ receivable, onClose, onSuccess, toast }) {
  const [totalAmount, setTotalAmount] = useState(String(receivable.totalAmount));
  const [dueDate, setDueDate] = useState(receivable.dueDate ? receivable.dueDate.split("T")[0] : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const save = async (extra = {}) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: totalAmount !== String(receivable.totalAmount) ? totalAmount : undefined,
          dueDate: dueDate || null,
          note,
          ...extra,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receivable updated");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to update receivable");
      }
    } catch (error) {
      console.error("Error updating receivable:", error);
      toast.error("Failed to update receivable");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Permanently delete this receivable?\n\n` +
        `  ${receivable.payer?.label || "Receivable"} · ${formatCurrency(receivable.totalAmount)}\n\n` +
        `Cancelling instead keeps the record and the audit trail. Delete cannot be undone.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to delete receivable");
      toast.success("Receivable deleted");
      onSuccess();
    } catch (error) {
      console.error("Error deleting receivable:", error);
      toast.error("Failed to delete receivable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Revise Receivable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{receivable.payer?.label}</p>
            <p className="text-gray-500 mt-1">
              Already received:{" "}
              <span className="font-semibold text-emerald-700">{formatCurrency(receivable.received)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount Expected (₹)</label>
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
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
          <button
            onClick={() => save({ isCancelled: !receivable.isCancelled })}
            disabled={submitting}
            className={`w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
              receivable.isCancelled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            <Ban className="w-4 h-4" />
            {receivable.isCancelled ? "Reinstate Receivable" : "Cancel Receivable"}
          </button>
          {/* Offered under Cancel, not beside it: cancelling keeps the record and is reversible,
              so it should stay the obvious choice. The API refuses outright if any receipt has
              already been logged against this receivable. */}
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

// ========== NEW RECEIVABLE MODAL ==========
function NewReceivableModal({ onClose, onSuccess, toast }) {
  const [purpose, setPurpose] = useState("");
  const [kind, setKind] = useState(""); // only shown/used for REFUND_DUE / ADVANCE_RECOVERY
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [revenueCategory, setRevenueCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [collabBranch, setCollabBranch] = useState("");
  const [manualLabel, setManualLabel] = useState("");

  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientDebounce = useRef(null);
  const [relatedPatient, setRelatedPatient] = useState("");

  const [employees, setEmployees] = useState([]);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const employeeDebounce = useRef(null);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");

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

  // The vendor list is small and has no search endpoint, so it is fetched once and filtered
  // inside SearchableSelect rather than per keystroke like patients and employees.
  const fetchVendors = async () => {
    try {
      const res = await fetch("/api/vendors/get");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || data.vendors || []);
      }
    } catch {
      // A vendor list that fails to load leaves the picker empty; the toast on submit is
      // enough signal, and blocking the whole modal over it would be worse.
    }
  };
  const formatVendorOption = (v) => (v.DealsIn ? `${v.name} — ${v.DealsIn}` : v.name);

  useEffect(() => {
    fetchPatients("");
    fetchEmployees("");
    fetchVendors();
  }, []);

  const needsKindPicker = ["REFUND_DUE", "ADVANCE_RECOVERY"].includes(purpose);
  const effectiveKind = PURPOSE_TO_FIXED_KIND[purpose] || kind;
  const needsPeriod = purpose === "COLLAB_SETTLEMENT";
  const needsPatient = purpose === "PATIENT_DUE" || (needsKindPicker && effectiveKind === "PATIENT");

  const buildPayer = () => {
    if (effectiveKind === "PATIENT") {
      const pat = patients.find((p) => p._id === relatedPatient);
      return { kind: "PATIENT", refId: relatedPatient, label: pat?.personal?.name || "Patient" };
    }
    if (effectiveKind === "EMPLOYEE") {
      return { kind: "EMPLOYEE", refId: employeeId, label: employeeName };
    }
    if (effectiveKind === "COLLAB_CLINIC") {
      return { kind: "COLLAB_CLINIC", refId: null, label: collabBranch };
    }
    // refId links the receivable to the actual Vendor record. It used to be a free-text name
    // with refId null, which left vendor receivables unjoinable to the vendor they belong to.
    if (effectiveKind === "VENDOR") {
      return { kind: "VENDOR", refId: vendorId || null, label: vendorName };
    }
    if (effectiveKind === "OTHER") {
      return { kind: "OTHER", refId: null, label: manualLabel };
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!purpose || !totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error("Purpose and a valid amount are required");
      return;
    }
    const payer = buildPayer();
    if (!payer?.label) {
      toast.error("Complete the payer details for this purpose");
      return;
    }
    if (needsPeriod && (!month || !year)) {
      toast.error("Select the month and year this settlement is for");
      return;
    }
    if (purpose === "PATIENT_DUE" && !relatedPatient) {
      toast.error("Select the related patient first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/receivables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer,
          purpose,
          revenueCategory: revenueCategory || undefined,
          period: needsPeriod ? { month: parseInt(month), year: parseInt(year) } : undefined,
          relatedPatient: relatedPatient || undefined,
          totalAmount,
          dueDate: dueDate || undefined,
          branch: branch || undefined,
          remarks,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receivable created");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to create receivable");
      }
    } catch (error) {
      console.error("Error creating receivable:", error);
      toast.error("Failed to create receivable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">New Receivable</h3>
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
                setKind("");
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

          {needsKindPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Who owes this? *</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select…</option>
                <option value="PATIENT">Patient</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="VENDOR">Vendor</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}

          {needsPatient && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient *</label>
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
          )}

          {effectiveKind === "EMPLOYEE" && (
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

          {effectiveKind === "VENDOR" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor *</label>
              <SearchableSelect
                options={vendors}
                value={vendorId}
                onChange={(v, obj) => {
                  setVendorId(v);
                  setVendorName(obj?.name || "");
                }}
                placeholder="Search and select a vendor..."
                valueKey="_id"
                formatOption={formatVendorOption}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Not listed?{" "}
                <a href="/admin/vendors/create" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  Add a vendor
                </a>
                , then reopen this form.
              </p>
            </div>
          )}

          {effectiveKind === "OTHER" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payer Label *</label>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Enter a name"
              />
            </div>
          )}

          {purpose === "COLLAB_SETTLEMENT" && (
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Revenue Category</label>
            <select
              value={revenueCategory}
              onChange={(e) => setRevenueCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Not specific to one category</option>
              {REVENUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

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
              <option value="">Default (your branch)</option>
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
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Receivable"}
          </button>
        </div>
      </div>
    </div>
  );
}
