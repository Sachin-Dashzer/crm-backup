"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Lock, Pencil, Trash2, Plus, ArrowLeft } from "lucide-react";
import AccountingTable from "./AccountingTable";
import { formatCurrency, formatDate } from "@/lib/financeUI";
import { ALL_BRANCHES } from "@/lib/branches";

const DELETE_ENDPOINTS = {
  TRANSPLANT: "/api/transactions/transplant/delete",
  SERVICE: "/api/transactions/service/delete",
  MEDICINE: "/api/transactions/medicine/delete",
  EXPENSE: "/api/transactions/expense/delete",
};

// Three-level (HEAD -> SUB-TYPE -> TRANSACTIONS) drill-down table shared by the Assets and
// Liabilities pages. `levels={2}` collapses to HEAD -> TRANSACTIONS for sections that have no
// natural middle tier (Cash & Bank accounts, Loan accounts, Suspense).
//
// Generic against sectionConfig.columnLabels — "paid"/"raised"/"owed" never appear as literals
// here, only as whatever the caller's columnLabels say. What DOES vary by sectionConfig.key is
// WHICH ENDPOINT each level calls (payables/receivables use their own /grouped aggregation;
// cash-bank/loans/suspense are plain per-account ledgers) — that's routing, not vocabulary.
export default function DrillDownTable({ sectionConfig, levels = 3, renderLeafRowActions }) {
  const router = useRouter();
  const { key, apiBase, columnLabels } = sectionConfig;
  const isGrouped = key === "payables" || key === "receivables";

  const [scope, setScope] = useState({ branch: "", dateFrom: "", dateTo: "" });
  const [drill, setDrill] = useState({ level: 1 });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const qs = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams();
      if (scope.branch) p.set("branch", scope.branch);
      if (scope.dateFrom) p.set("from", scope.dateFrom);
      if (scope.dateTo) p.set("to", scope.dateTo);
      Object.entries(extra).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") p.set(k, v);
      });
      return p.toString();
    },
    [scope],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isGrouped) {
        if (drill.level === 1) {
          const json = await fetch(`${apiBase}/grouped?level=1&${qs()}`).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: (json.rows || []).length, page: 1, limit: 9999 });
        } else if (drill.level === 2) {
          const json = await fetch(
            `${apiBase}/grouped?level=2&category=${encodeURIComponent(drill.headKey)}&${qs()}`,
          ).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: (json.rows || []).length, page: 1, limit: 9999 });
        } else {
          const json = await fetch(
            `${apiBase}/grouped?level=3&category=${encodeURIComponent(drill.headKey)}&subType=${encodeURIComponent(
              drill.subKey || "",
            )}&page=${page}&${qs()}`,
          ).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: json.total || 0, page: json.page || 1, limit: json.limit || 50 });
        }
      } else if (key === "suspense") {
        if (drill.level === 1) {
          const json = await fetch(`/api/suspense?groupBy=account&${qs()}`).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: (json.rows || []).length, page: 1, limit: 9999 });
        } else {
          const json = await fetch(
            `/api/suspense?account=${encodeURIComponent(drill.headKey)}&status=all&page=${page}&limit=50&${qs()}`,
          ).then((r) => r.json());
          setRows(
            (json.entries || []).map((e) => ({
              ...e,
              date: e.date,
              narration: e.remarks || e.reference || "—",
              amount: e.amount,
              method: e.direction,
              account: e.account,
              runningBalance: null,
            })),
          );
          setMeta({ total: json.total || 0, page: json.page || 1, limit: json.limit || 50 });
        }
      } else {
        // cash-bank / loans — level 1 is the account rollup, level 2 is that account's FULL
        // ledger (transactions + contra transfers + open suspense), via /api/close-book/ledger —
        // the same aggregation the balance sheet's per-account figures come from. Using
        // transactions/get-all here (as an earlier version did) silently dropped every contra
        // transfer from the drill-down even though the level-1 "Money out" total already
        // included them, so the two disagreed. Never repeat that split.
        if (drill.level === 1) {
          const filterParam = key === "loans" ? "loans" : "cash";
          const json = await fetch(`${apiBase}?filter=${filterParam}&${qs()}`).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: (json.rows || []).length, page: 1, limit: 9999 });
        } else {
          const from = scope.dateFrom || "2000-01-01";
          const to = scope.dateTo || new Date().toISOString().slice(0, 10);
          const json = await fetch(
            `/api/close-book/ledger?account=${encodeURIComponent(drill.headKey)}&from=${from}&to=${to}&page=${page}&limit=50${
              scope.branch ? `&branch=${encodeURIComponent(scope.branch)}` : ""
            }`,
          ).then((r) => r.json());
          setRows(
            (json.rows || []).map((r) => ({
              ...r,
              narration: r.isContra
                ? `Transfer: ${r.fromAccount} → ${r.toAccount}${r.reference ? ` · ${r.reference}` : ""}`
                : r.isSuspense
                  ? `Suspense${r.direction ? ` (${r.direction})` : ""}${r.remarks ? ` · ${r.remarks}` : r.reference ? ` · ${r.reference}` : ""}`
                  : r.remarks || r.procedure || r.expenseType || "—",
              amount: r.amount ?? Math.abs(r.signedAmount || 0),
              method: r.isContra ? "Contra Transfer" : r.isSuspense ? "Suspense" : r.method,
              account: drill.headKey,
              transactionCategory: r.isContra || r.isSuspense ? null : r.transactionCategory,
            })),
          );
          setMeta({
            total: json.pagination?.total || 0,
            page: json.pagination?.page || 1,
            limit: json.pagination?.limit || 50,
          });
        }
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, isGrouped, key, drill, page, qs]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [drill]);

  const deepestLevel = levels;
  const atLeaf = drill.level === deepestLevel;

  const goBack = () => {
    if (drill.level === 3) setDrill({ level: 2, headKey: drill.headKey, headLabel: drill.headLabel });
    else setDrill({ level: 1 });
  };

  const drillInto = (row) => {
    if (drill.level === 1) {
      if (deepestLevel === 2) {
        setDrill({ level: 2, headKey: row.key, headLabel: row.label });
      } else {
        setDrill({ level: 2, headKey: row.key, headLabel: row.label });
      }
    } else if (drill.level === 2 && deepestLevel === 3) {
      setDrill({
        level: 3,
        headKey: drill.headKey,
        headLabel: drill.headLabel,
        subKey: row.key,
        subLabel: row.label,
      });
    }
  };

  const addHref = (() => {
    if (key === "payables") {
      const p = new URLSearchParams({ type: "Payable" });
      if (drill.headKey) p.set("category", drill.headKey);
      if (drill.subKey) p.set("subType", drill.subKey);
      return `/admin/vouchers?${p.toString()}`;
    }
    if (key === "receivables") {
      const p = new URLSearchParams({ type: "Receivable" });
      if (drill.headKey) p.set("category", drill.headKey);
      if (drill.subKey) p.set("subType", drill.subKey);
      return `/admin/vouchers?${p.toString()}`;
    }
    return "/admin/vouchers";
  })();

  const handleDelete = async (row) => {
    const category = row.transactionCategory || "EXPENSE";
    const endpoint = DELETE_ENDPOINTS[category] || DELETE_ENDPOINTS.EXPENSE;
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ transactionId: row._id }),
    });
    if (res.ok) load();
    else {
      const json = await res.json().catch(() => ({}));
      window.alert(json.error || "Failed to delete transaction");
    }
  };

  // ── Column sets per level ──
  const groupColumns = [
    { key: "label", label: "Category" },
    { key: "opening", label: columnLabels.opening, numeric: true },
    { key: "movement", label: columnLabels.movement, numeric: true },
    { key: "settled", label: columnLabels.settled, numeric: true },
    { key: "closing", label: columnLabels.closing, numeric: true },
    { key: "count", label: "Count", numeric: true, render: (r) => r.count ?? "—" },
    { key: "go", label: "", render: () => <ChevronRight className="w-4 h-4 text-gray-300 inline" /> },
  ];

  // cash-bank/loans/suspense leaves are read-only ledger views (no edit/delete — see DrillDownTable
  // header comment); only payables/receivables leaf rows are real Transactions with edit/delete.
  const txColumns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
    ...(isGrouped
      ? [
          {
            key: "party",
            label: "Party",
            render: (r) => (
              <div>
                <p className="font-medium text-gray-800">{r.party || "—"}</p>
                {r.purpose && <p className="text-[10px] text-gray-400">{r.purpose.replace(/_/g, " ")}</p>}
              </div>
            ),
          },
        ]
      : []),
    { key: "narration", label: "Narration" },
    {
      key: "type",
      label: "Type",
      render: (r) => {
        const isSale = ["TRANSPLANT", "SERVICE", "MEDICINE"].includes(r.transactionCategory);
        const isExpense = r.transactionCategory === "EXPENSE";
        if (!isSale && !isExpense) return "—";
        return (
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
              isSale
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {isSale ? "Sales" : "Expense"}
          </span>
        );
      },
    },
    { key: "amount", label: "Amount", numeric: true },
    { key: "method", label: "Method" },
    { key: "account", label: "Account" },
    { key: "runningBalance", label: "Running Balance", numeric: true, render: (r) => (r.runningBalance == null ? "—" : formatCurrency(r.runningBalance)) },
    ...(isGrouped
      ? [
          {
            key: "lock",
            label: "",
            render: (r) =>
              r.lockReason ? (
                <span title={r.lockReason} className="inline-flex items-center text-amber-600">
                  <Lock className="w-3.5 h-3.5" />
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
      {/* ── Section header + scope filters ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {drill.level > 1 && (
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 shrink-0">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              {sectionConfig.title || key}
              {drill.headLabel && (
                <span className="text-gray-400 font-normal"> / {drill.headLabel}</span>
              )}
              {drill.subLabel && (
                <span className="text-gray-400 font-normal"> / {drill.subLabel}</span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={scope.branch}
            onChange={(e) => setScope((s) => ({ ...s, branch: e.target.value }))}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
          >
            <option value="">All branches</option>
            {ALL_BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <input
            type="date"
            value={scope.dateFrom}
            onChange={(e) => setScope((s) => ({ ...s, dateFrom: e.target.value }))}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
          />
          <input
            type="date"
            value={scope.dateTo}
            onChange={(e) => setScope((s) => ({ ...s, dateTo: e.target.value }))}
            className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
          />
          <button
            onClick={() => router.push(addHref)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add Transaction
          </button>
        </div>
      </div>

      {/* ── The table for the current level ── */}
      {atLeaf ? (
        <AccountingTable
          columns={txColumns}
          rows={rows}
          loading={loading}
          filterConfig={{ showSearch: false, showBranch: false, showDateRange: false }}
          pagination={meta}
          onPageChange={setPage}
          urlSync={false}
          getRowKey={(r) => r._id}
          renderRowActions={
            isGrouped
              ? (row) =>
                  row.lockReason ? null : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => router.push(`/admin/transactions/edit/${row._id}`)}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
              : renderLeafRowActions
                // A contra transfer or suspense row IS itself a settlement/reconciliation entry —
                // it never gets its own settle action.
                ? (row) => (row.isContra || row.isSuspense ? null : renderLeafRowActions(row))
                : undefined
          }
        />
      ) : (
        <AccountingTable
          columns={groupColumns}
          rows={rows}
          loading={loading}
          filterConfig={{ showSearch: false, showBranch: false, showDateRange: false }}
          onRowClick={drillInto}
          urlSync={false}
          getRowKey={(r) => r.key}
          emptyMessage="No records match these filters"
        />
      )}
    </div>
  );
}
