"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, Pencil, History, RefreshCw, Plus, AlertTriangle, X } from "lucide-react";
import AccountingTable from "@/components/finance/AccountingTable";
import RecordAdvanceModal from "@/components/finance/RecordAdvanceModal";
import ReviseReceivableModal from "@/components/finance/ReviseReceivableModal";
import EditAdvanceModal from "@/components/finance/EditAdvanceModal";
import DocumentHistory from "@/components/finance/DocumentHistory";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { ALL_BRANCHES } from "@/lib/branches";
import { useToast } from "@/components/Toast";

// Dedicated CRUD page for Advance money (money WE lent out — advance salary, advance rent, a
// personal advance — that must come back; see src/models/Advance.js) and the Receivable
// ("advance") documents they create. Exact mirror of /admin/borrowings, with the directions and
// the linked document flipped. The Assets page's own "Advances" section (a DrillDownTable) is
// the summarised drill-down view; this page is the flat, direct one.
export default function AdvancesPage() {
  const toast = useToast();

  const [branch, setBranch] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // ── Advances (Receivable documents, revenueCategory "Advances") ─────────────────────────
  const [advances, setAdvances] = useState([]);
  const [advancesMeta, setAdvancesMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [advancesError, setAdvancesError] = useState("");
  const [advancesSearch, setAdvancesSearch] = useState("");

  const loadAdvances = useCallback(
    async (page = 1) => {
      setAdvancesLoading(true);
      setAdvancesError("");
      try {
        const p = new URLSearchParams({
          revenueCategory: "Advances",
          page: String(page),
          limit: "20",
          includeCancelled: String(includeCancelled),
        });
        if (branch) p.set("branch", branch);
        if (advancesSearch) p.set("search", advancesSearch);
        const res = await fetch(`/api/receivables/list?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load advances");
        setAdvances(data.receivables || []);
        setAdvancesMeta({ total: data.total || 0, page: data.page || 1, limit: data.limit || 20 });
      } catch (err) {
        setAdvancesError(err.message || "Failed to load advances");
      } finally {
        setAdvancesLoading(false);
      }
    },
    [branch, includeCancelled, advancesSearch],
  );

  useEffect(() => {
    loadAdvances(1);
  }, [loadAdvances]);

  // ── Advance transactions (flat Advance rows, OUT + IN) ──────────────────────────────────
  const [rows, setRows] = useState([]);
  const [rowsMeta, setRowsMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [rowsSearch, setRowsSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");

  const loadRows = useCallback(
    async (page = 1) => {
      setRowsLoading(true);
      setRowsError("");
      try {
        const p = new URLSearchParams({
          page: String(page),
          limit: "20",
          includeCancelled: String(includeCancelled),
        });
        if (branch) p.set("branch", branch);
        if (rowsSearch) p.set("party", rowsSearch);
        if (directionFilter) p.set("direction", directionFilter);
        const res = await fetch(`/api/advances/list?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load advance transactions");
        setRows(data.advances || []);
        setRowsMeta({ total: data.total || 0, page: data.page || 1, limit: data.limit || 20 });
      } catch (err) {
        setRowsError(err.message || "Failed to load advance transactions");
      } finally {
        setRowsLoading(false);
      }
    },
    [branch, includeCancelled, rowsSearch, directionFilter],
  );

  useEffect(() => {
    loadRows(1);
  }, [loadRows]);

  const refreshAll = () => {
    loadAdvances(advancesMeta.page);
    loadRows(rowsMeta.page);
  };

  // ── Modal state ───────────────────────────────────────────────────────────────────────────
  const [advanceModal, setAdvanceModal] = useState(null); // { mode, receivable } | null
  const [reviseAdvance, setReviseAdvance] = useState(null); // the Receivable row being revised
  const [editRow, setEditRow] = useState(null); // the Advance row being edited
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (advance) => {
    setHistoryDoc(advance);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/advances/list?receivableId=${advance._id}&includeCancelled=true&limit=200`);
      const data = await res.json();
      setHistoryRows(
        (data.advances || []).map((r) => ({
          _id: r._id,
          amount: r.amount,
          date: r.date,
          method: `${r.direction === "IN" ? "Recovered" : "Paid out"} · ${r.account}${r.isCancelled ? " (cancelled)" : ""}`,
          paymentId: r.reference,
          createdBy: r.createdBy,
        })),
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAdvanceSuccess = () => {
    setAdvanceModal(null);
    refreshAll();
  };

  const advanceColumns = [
    { key: "payer", label: "Party", render: (r) => r.payer?.label || "—" },
    { key: "revenueSubType", label: "Type" },
    { key: "totalAmount", label: "Total Advanced", numeric: true, render: (r) => formatCurrency(r.totalAmount) },
    { key: "received", label: "Recovered", numeric: true, render: (r) => formatCurrency(r.received) },
    { key: "pending", label: "Outstanding", numeric: true, render: (r) => formatCurrency(r.pending) },
    { key: "branch", label: "Branch", render: (r) => r.branch || "—" },
    { key: "createdAt", label: "Date", render: (r) => formatDate(r.createdAt) },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.isCancelled ? "Cancelled" : r.status} />,
    },
  ];

  const rowColumns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    {
      key: "direction",
      label: "Direction",
      render: (r) => (
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
            r.direction === "IN"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}
        >
          {r.direction === "IN" ? "Recovery" : "Paid Out"}
        </span>
      ),
    },
    { key: "party", label: "Party", render: (r) => r.party?.label || "—" },
    { key: "amount", label: "Amount", numeric: true, render: (r) => formatCurrency(r.amount) },
    { key: "account", label: "Account" },
    { key: "branch", label: "Branch", render: (r) => r.branch || "—" },
    { key: "reference", label: "Reference", render: (r) => r.reference || "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.isCancelled ? "Cancelled" : "Active"} />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Advances</h1>
              <p className="text-sm text-gray-500 mt-1">
                Advance salary, advance rent and personal advances paid out that must come back —
                create, revise, and cancel advances and their individual transactions here. Never
                a sale or revenue; see the summarised view under Assets → Advances.
              </p>
            </div>
            <button
              onClick={() => setAdvanceModal({ mode: "OUT", receivable: null })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-teal-700"
            >
              <HandCoins className="w-3.5 h-3.5" />
              Record Advance
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
            >
              <option value="">All branches</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={(e) => setIncludeCancelled(e.target.checked)}
              />
              Include cancelled
            </label>
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>

          {/* ── Advances ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Advances</h2>
            {advancesError ? (
              <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {advancesError}
                </span>
                <button onClick={() => loadAdvances(advancesMeta.page)} className="font-semibold underline shrink-0">
                  Retry
                </button>
              </div>
            ) : (
              <AccountingTable
                columns={advanceColumns}
                rows={advances}
                loading={advancesLoading}
                urlSync={false}
                filterConfig={{ showSearch: true, searchPlaceholder: "Search party…", showBranch: false, showDateRange: false }}
                filters={{ search: advancesSearch }}
                onFilterChange={(f) => setAdvancesSearch(f.search)}
                pagination={advancesMeta}
                onPageChange={(p) => loadAdvances(p)}
                getRowKey={(r) => r._id}
                emptyMessage="No advances recorded"
                renderRowActions={(row) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {!row.isCancelled && row.pending > 0 && (
                      <button
                        onClick={() => setAdvanceModal({ mode: "IN", receivable: row })}
                        title="Record Recovery"
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!row.isCancelled && (
                      <button
                        onClick={() => setAdvanceModal({ mode: "OUT", receivable: row })}
                        title="Further Advance"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setReviseAdvance(row)}
                      title="Revise / Cancel advance"
                      className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openHistory(row)}
                      title="View History"
                      className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              />
            )}
          </section>

          {/* ── Advance transactions ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Advance Transactions</h2>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
                <option value="">All directions</option>
                <option value="OUT">Paid Out</option>
                <option value="IN">Recovery</option>
              </select>
            </div>
            {rowsError ? (
              <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {rowsError}
                </span>
                <button onClick={() => loadRows(rowsMeta.page)} className="font-semibold underline shrink-0">
                  Retry
                </button>
              </div>
            ) : (
              <AccountingTable
                columns={rowColumns}
                rows={rows}
                loading={rowsLoading}
                urlSync={false}
                filterConfig={{ showSearch: true, searchPlaceholder: "Search party…", showBranch: false, showDateRange: false }}
                filters={{ search: rowsSearch }}
                onFilterChange={(f) => setRowsSearch(f.search)}
                pagination={rowsMeta}
                onPageChange={(p) => loadRows(p)}
                getRowKey={(r) => r._id}
                emptyMessage="No advance transactions recorded"
                renderRowActions={(row) => (
                  <button
                    onClick={() => setEditRow(row)}
                    title="Edit"
                    className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              />
            )}
          </section>
        </div>
      </main>

      {advanceModal && (
        <RecordAdvanceModal
          open
          mode={advanceModal.mode}
          receivable={advanceModal.receivable}
          toast={toast}
          onClose={() => setAdvanceModal(null)}
          onSuccess={handleAdvanceSuccess}
        />
      )}

      {reviseAdvance && (
        <ReviseReceivableModal
          receivable={reviseAdvance}
          toast={toast}
          onClose={() => setReviseAdvance(null)}
          onSuccess={() => {
            setReviseAdvance(null);
            refreshAll();
          }}
        />
      )}

      {editRow && (
        <EditAdvanceModal
          advance={editRow}
          toast={toast}
          onClose={() => setEditRow(null)}
          onSuccess={() => {
            setEditRow(null);
            refreshAll();
          }}
        />
      )}

      {historyDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                History — {historyDoc.payer?.label || "Advance"}
              </h3>
              <button onClick={() => setHistoryDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <DocumentHistory
                doc={historyDoc}
                kind="receivable"
                transactions={historyRows}
                loading={historyLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
