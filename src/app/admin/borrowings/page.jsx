"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins, Pencil, History, RefreshCw, Plus, AlertTriangle, X } from "lucide-react";
import AccountingTable from "@/components/finance/AccountingTable";
import RecordBorrowingModal from "@/components/finance/RecordBorrowingModal";
import RevisePayableModal from "@/components/finance/RevisePayableModal";
import EditBorrowingModal from "@/components/finance/EditBorrowingModal";
import DocumentHistory from "@/components/finance/DocumentHistory";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { ALL_BRANCHES } from "@/lib/branches";
import { useToast } from "@/components/Toast";

// Dedicated CRUD page for Borrowing money (deposits/loans/advances that must be repaid — see
// src/models/Borrowing.js) and the Payable ("loan") documents they create. The Liabilities
// page's own "Borrowings" section (a DrillDownTable) is the summarised drill-down view; this
// page is the flat, direct one — every loan and every individual row, editable/cancellable/
// deletable in place, for whoever is reconciling the books rather than browsing a rollup.
export default function BorrowingsPage() {
  const toast = useToast();

  const [branch, setBranch] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // ── Loans (Payable documents, expenseCategory "Borrowings") ──────────────────────────────
  const [loans, setLoans] = useState([]);
  const [loansMeta, setLoansMeta] = useState({ total: 0, page: 1, limit: 20 });
  const [loansLoading, setLoansLoading] = useState(false);
  const [loansError, setLoansError] = useState("");
  const [loansSearch, setLoansSearch] = useState("");

  const loadLoans = useCallback(
    async (page = 1) => {
      setLoansLoading(true);
      setLoansError("");
      try {
        const p = new URLSearchParams({
          expenseCategory: "Borrowings",
          page: String(page),
          limit: "20",
          includeCancelled: String(includeCancelled),
        });
        if (branch) p.set("branch", branch);
        if (loansSearch) p.set("search", loansSearch);
        const res = await fetch(`/api/payables/list?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load loans");
        setLoans(data.payables || []);
        setLoansMeta({ total: data.total || 0, page: data.page || 1, limit: data.limit || 20 });
      } catch (err) {
        setLoansError(err.message || "Failed to load loans");
      } finally {
        setLoansLoading(false);
      }
    },
    [branch, includeCancelled, loansSearch],
  );

  useEffect(() => {
    loadLoans(1);
  }, [loadLoans]);

  // ── Borrowing transactions (flat Borrowing rows, IN + OUT) ───────────────────────────────
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
        const res = await fetch(`/api/borrowings/list?${p}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load borrowing transactions");
        setRows(data.borrowings || []);
        setRowsMeta({ total: data.total || 0, page: data.page || 1, limit: data.limit || 20 });
      } catch (err) {
        setRowsError(err.message || "Failed to load borrowing transactions");
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
    loadLoans(loansMeta.page);
    loadRows(rowsMeta.page);
  };

  // ── Modal state ───────────────────────────────────────────────────────────────────────────
  const [borrowModal, setBorrowModal] = useState(null); // { mode, payable } | null
  const [reviseLoan, setReviseLoan] = useState(null); // the Payable row being revised
  const [editRow, setEditRow] = useState(null); // the Borrowing row being edited
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (loan) => {
    setHistoryDoc(loan);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/borrowings/list?payableId=${loan._id}&includeCancelled=true&limit=200`);
      const data = await res.json();
      setHistoryRows(
        (data.borrowings || []).map((r) => ({
          _id: r._id,
          amount: r.amount,
          date: r.date,
          method: `${r.direction === "OUT" ? "Repayment" : "Received"} · ${r.account}${r.isCancelled ? " (cancelled)" : ""}`,
          paymentId: r.reference,
          createdBy: r.createdBy,
        })),
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleBorrowSuccess = () => {
    setBorrowModal(null);
    refreshAll();
  };

  const loanColumns = [
    { key: "payee", label: "Party", render: (r) => r.payee?.label || "—" },
    { key: "expenseSubType", label: "Type" },
    { key: "totalAmount", label: "Total Received", numeric: true, render: (r) => formatCurrency(r.totalAmount) },
    { key: "paid", label: "Repaid", numeric: true, render: (r) => formatCurrency(r.paid) },
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
            r.direction === "OUT"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {r.direction === "OUT" ? "Repayment" : "Received"}
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
              <h1 className="text-xl font-bold text-gray-900">Borrowings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Deposits, loans and advances received that must be repaid — create, revise, and
                cancel loans and their individual transactions here. Never a sale or an expense;
                see the summarised view under Liabilities → Borrowings.
              </p>
            </div>
            <button
              onClick={() => setBorrowModal({ mode: "IN", payable: null })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-violet-700"
            >
              <HandCoins className="w-3.5 h-3.5" />
              Record Borrowing
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

          {/* ── Loans ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Loans</h2>
            {loansError ? (
              <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {loansError}
                </span>
                <button onClick={() => loadLoans(loansMeta.page)} className="font-semibold underline shrink-0">
                  Retry
                </button>
              </div>
            ) : (
              <AccountingTable
                columns={loanColumns}
                rows={loans}
                loading={loansLoading}
                urlSync={false}
                filterConfig={{ showSearch: true, searchPlaceholder: "Search party…", showBranch: false, showDateRange: false }}
                filters={{ search: loansSearch }}
                onFilterChange={(f) => setLoansSearch(f.search)}
                pagination={loansMeta}
                onPageChange={(p) => loadLoans(p)}
                getRowKey={(r) => r._id}
                emptyMessage="No loans recorded"
                renderRowActions={(row) => (
                  <div className="flex items-center justify-end gap-1.5">
                    {!row.isCancelled && row.pending > 0 && (
                      <button
                        onClick={() => setBorrowModal({ mode: "OUT", payable: row })}
                        title="Record Repayment"
                        className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      >
                        <HandCoins className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!row.isCancelled && (
                      <button
                        onClick={() => setBorrowModal({ mode: "IN", payable: row })}
                        title="Add Tranche"
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => setReviseLoan(row)}
                      title="Revise / Cancel loan"
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

          {/* ── Borrowing transactions ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Borrowing Transactions</h2>
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
                <option value="">All directions</option>
                <option value="IN">Received</option>
                <option value="OUT">Repayment</option>
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
                emptyMessage="No borrowing transactions recorded"
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

      {borrowModal && (
        <RecordBorrowingModal
          open
          mode={borrowModal.mode}
          payable={borrowModal.payable}
          toast={toast}
          onClose={() => setBorrowModal(null)}
          onSuccess={handleBorrowSuccess}
        />
      )}

      {reviseLoan && (
        <RevisePayableModal
          payable={reviseLoan}
          toast={toast}
          onClose={() => setReviseLoan(null)}
          onSuccess={() => {
            setReviseLoan(null);
            refreshAll();
          }}
        />
      )}

      {editRow && (
        <EditBorrowingModal
          borrowing={editRow}
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
                History — {historyDoc.payee?.label || "Loan"}
              </h3>
              <button onClick={() => setHistoryDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <DocumentHistory
                doc={historyDoc}
                kind="payable"
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
