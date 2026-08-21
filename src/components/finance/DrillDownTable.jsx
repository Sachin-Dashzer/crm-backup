"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  ArrowLeft,
  FileText,
  Banknote,
  HandCoins,
  History,
  Ban,
  X,
  Eye,
} from "lucide-react";
import AccountingTable from "./AccountingTable";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { ALL_BRANCHES } from "@/lib/branches";
import { AGEING_BUCKETS, AGEING_TONE_CLASSES, formatAgeing } from "@/lib/ageing";
import { useToast } from "@/components/Toast";
import LockedBadge from "./LockedBadge";
import ContraRowActions from "./ContraRowActions";
import SuspenseRowActions from "./SuspenseRowActions";
import { ReversalBadge, ReversedBadge } from "./StatusBadges";
import RecordPaymentModal from "./RecordPaymentModal";
import RecordReceiptModal from "./RecordReceiptModal";
import RevisePayableModal from "./RevisePayableModal";
import ReviseReceivableModal from "./ReviseReceivableModal";
import DocumentHistory from "./DocumentHistory";
import TransactionDetailModal from "./TransactionDetailModal";
import DocumentDetailModal from "./DocumentDetailModal";

const DELETE_ENDPOINTS = {
  TRANSPLANT: "/api/transactions/transplant/delete",
  SERVICE: "/api/transactions/service/delete",
  MEDICINE: "/api/transactions/medicine/delete",
  EXPENSE: "/api/transactions/expense/delete",
};

const PAYABLE_STATUS_OPTIONS = ["Pending", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const RECEIVABLE_STATUS_OPTIONS = ["Pending", "Partially Received", "Received", "Overdue", "Cancelled"];

// Drill-down table shared by the Assets and Liabilities pages (and, since Task 6, the Receipts/
// Payments pages). Three shapes, chosen by `sectionConfig.mode`:
//
//   "documents" (payables/receivables) — HEAD -> SUB-TYPE -> DOCUMENTS -> TRANSACTIONS (4 levels,
//     fixed; Task 5). Level 3 is the Payable/Receivable itself with live paid/pending, Record
//     Payment/Revise/Cancel/History actions, and a click-through to level 4 once something has
//     been paid against it.
//   "grouped" (receipts/payments, Task 6) — HEAD -> SUB-TYPE -> TRANSACTIONS (3 levels), the same
//     fetch pattern minus the document tier.
//   default (cash-bank/loans via `key`, or "suspense") — 2-level ledger views, unchanged.
//
// Generic against sectionConfig.columnLabels — "paid"/"raised"/"owed" never appear as literals
// here except where a section is KNOWN to be documents-mode, where the wording genuinely differs
// from a group rollup (Owed/Paid vs Expected/Received) and needs to say so.
export default function DrillDownTable({
  sectionConfig,
  levels = 3,
  renderLeafRowActions,
  extraParams,
  initialDrill,
  onDrillChange,
  scope: controlledScope,
  onScopeChange,
}) {
  const router = useRouter();
  const toast = useToast();
  const { key, apiBase, columnLabels } = sectionConfig;
  const isDocuments = sectionConfig.mode === "documents" || key === "payables" || key === "receivables";
  const isPayableSection = key === "payables";
  // `mode: "grouped"` (or documents mode, which shares the same level 1/2 fetch) is the explicit
  // opt-in for the shared HEAD -> SUB-TYPE fetch pattern (apiBase + "/grouped?level="). Legacy key
  // check kept for backward compatibility.
  const isGrouped = isDocuments || sectionConfig.mode === "grouped" || key === "payables" || key === "receivables";
  const deepestLevel = isDocuments ? 4 : levels;

  // Task A (Round 2) — branch/dateFrom/dateTo become controlled when the caller passes `scope`
  // (Assets/Liabilities lift ONE scope to the page so the header total and every section agree —
  // see those pages' header comment). party/status/ageing (documents mode only) are never lifted
  // — they're a per-section drill-down refinement, not a page-level total filter — so they always
  // live in internal state regardless of controlled/uncontrolled.
  const [internalScope, setInternalScope] = useState({ branch: "", dateFrom: "", dateTo: "", party: "", status: "", ageing: "" });
  const isControlled = !!controlledScope;
  // Memoized on the underlying PRIMITIVES, not on internalScope/controlledScope's object
  // identity — those two combine into a new object literal every render when controlled, and an
  // unmemoized `scope` would give `qs`/`load` below a new reference every render, re-running the
  // fetch effect on every render rather than only when a filter actually changes.
  const scope = useMemo(
    () =>
      isControlled
        ? { ...internalScope, branch: controlledScope.branch ?? "", dateFrom: controlledScope.dateFrom ?? "", dateTo: controlledScope.dateTo ?? "" }
        : internalScope,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isControlled,
      controlledScope?.branch,
      controlledScope?.dateFrom,
      controlledScope?.dateTo,
      internalScope,
    ],
  );
  const CONTROLLED_KEYS = ["branch", "dateFrom", "dateTo"];
  const updateScope = (patch) => {
    const toParent = {};
    const toLocal = {};
    Object.entries(patch).forEach(([k, v]) => {
      if (isControlled && CONTROLLED_KEYS.includes(k)) toParent[k] = v;
      else toLocal[k] = v;
    });
    if (Object.keys(toParent).length) onScopeChange?.({ ...scope, ...toParent });
    if (Object.keys(toLocal).length) setInternalScope((s) => ({ ...s, ...toLocal }));
  };
  // Task 5, Step 5 — `initialDrill` seeds the drill path from a deep link (e.g.
  // /admin/liabilities?section=payables&head=Rent&doc=<id>, the URL Task 1's Entry Type badge
  // points at); read once on mount, same "one-time initial state" pattern the create page's
  // query-string prefill uses. `documentLabel`/`headLabel`/`subLabel` aren't in the URL, so they
  // start equal to their key and self-correct once the user navigates normally.
  const [drill, setDrill] = useState(() => initialDrill || { level: 1 });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Task 5, Step 3 — document-level modal state (payables/receivables only).
  const [payModal, setPayModal] = useState(null); // the document row being paid/received against
  const [reviseModal, setReviseModal] = useState(null);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyTx, setHistoryTx] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewTxId, setViewTxId] = useState(null);
  const [viewDoc, setViewDoc] = useState(null); // the Payable/Receivable row being viewed

  const qs = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams();
      if (scope.branch) p.set("branch", scope.branch);
      if (scope.dateFrom) p.set("from", scope.dateFrom);
      if (scope.dateTo) p.set("to", scope.dateTo);
      // Caller-supplied constants (e.g. Task 6's Receipts page groupBy=mode toggle) that ride
      // along on every fetch this table makes, same as the scope filters above.
      Object.entries(extraParams || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") p.set(k, v);
      });
      Object.entries(extra).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") p.set(k, v);
      });
      return p.toString();
    },
    [scope, extraParams],
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
        } else if (drill.level === 3 && isDocuments) {
          // Documents list — party/status/ageing (Step 5) ride on the same `scope` object the
          // branch/date filters already use, so they share the URL-less in-memory state pattern.
          const json = await fetch(
            `${apiBase}/grouped?level=3&category=${encodeURIComponent(drill.headKey)}&subType=${encodeURIComponent(
              drill.subKey || "",
            )}&page=${page}&${qs({ party: scope.party, status: scope.status, ageing: scope.ageing })}`,
          ).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: json.total || 0, page: json.page || 1, limit: json.limit || 50 });
        } else if (drill.level === 4 && isDocuments) {
          const json = await fetch(
            `${apiBase}/grouped?level=4&documentId=${encodeURIComponent(drill.documentId)}&page=${page}&${qs()}`,
          ).then((r) => r.json());
          setRows(json.rows || []);
          setMeta({ total: json.total || 0, page: json.page || 1, limit: json.limit || 50 });
        } else {
          // Non-documents "grouped" mode (Task 6 receipts/payments) — level 3 is the flat
          // transaction leaf for a HEAD (+SUB-TYPE) bucket.
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
              // These are SuspenseEntry documents, not Transactions — /api/suspense doesn't tag
              // them the way close-book/ledger's union stage does, so it's set here instead of
              // leaving leafActions to guess from field absence.
              sourceKind: "SUSPENSE",
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
  }, [apiBase, isGrouped, isDocuments, key, drill, page, qs, scope.party, scope.status, scope.ageing]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [drill]);
  // A party/status/ageing filter change re-queries level 3 from page 1, same as every other
  // scope filter — without this, changing the filter on page 2 would silently show page 2 of a
  // now-different result set.
  useEffect(() => setPage(1), [scope.party, scope.status, scope.ageing]);

  // Mirrors the drill path back to the caller so it can keep the URL shareable — only meaningful
  // for the one section a page deep-linked into; every other section drills locally, same as
  // before Task 5. Fires on every change, not just deep-link ones, so navigating away from a
  // restored deep link also clears it from the URL instead of leaving a stale one behind.
  useEffect(() => {
    onDrillChange?.(drill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill]);

  const atLeaf = drill.level === deepestLevel;
  const atDocuments = isDocuments && drill.level === 3;

  const goBack = () => {
    if (drill.level === 4) {
      setDrill({ level: 3, headKey: drill.headKey, headLabel: drill.headLabel, subKey: drill.subKey, subLabel: drill.subLabel });
    } else if (drill.level === 3) {
      setDrill({ level: 2, headKey: drill.headKey, headLabel: drill.headLabel });
    } else {
      setDrill({ level: 1 });
    }
  };

  const drillInto = (row) => {
    if (drill.level === 1) {
      setDrill({ level: 2, headKey: row.key, headLabel: row.label });
    } else if (drill.level === 2 && deepestLevel >= 3) {
      setDrill({
        level: 3,
        headKey: drill.headKey,
        headLabel: drill.headLabel,
        subKey: row.key,
        subLabel: row.label,
      });
    } else if (drill.level === 3 && isDocuments) {
      // "Drill to transactions" is only meaningful once something has actually been paid/received
      // against this document — with nothing settled yet, level 4 would just be empty.
      const settled = isPayableSection ? row.paid : row.received;
      if (!(settled > 0)) return;
      setDrill({
        level: 4,
        headKey: drill.headKey,
        headLabel: drill.headLabel,
        subKey: drill.subKey,
        subLabel: drill.subLabel,
        documentId: row._id,
        documentLabel: (isPayableSection ? row.payee?.label : row.payer?.label) || "Document",
      });
    }
  };

  // Task 4 — a Voucher raises an accrual (no cash); a Transaction records cash actually moving.
  // Conflating them is what forced users into the wrong entry point, so the header always offers
  // the two separately rather than one "Add" button that means something different per section.
  //   Payables/Receivables -> both (raise the obligation, or record cash straight against it)
  //   Cash & Bank/Loans/receipts/payments (mode: "grouped" but not payables/receivables) -> only
  //     New Transaction — none of these sections has an accrual concept
  //   Suspense -> neither — it has its own resolve flow, not a create form
  const showVoucherButton = key === "payables" || key === "receivables";
  const showTransactionButton = key !== "suspense";

  const voucherHref = (() => {
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

  // receivables/grouped's Level-1 head is Receivable.revenueCategory prose ("Transplant" /
  // "Services" / "Medicine"); Transactions.transactionCategory is the enum. Map when the head is
  // one of the three known ones — an "Uncategorised" bucket has no single enum to prefill.
  const REVENUE_CATEGORY_TO_ENUM = { Transplant: "TRANSPLANT", Services: "SERVICE", Medicine: "MEDICINE" };

  const transactionHref = (() => {
    const p = new URLSearchParams();
    if (scope.branch) p.set("branch", scope.branch);
    if (key === "payables") {
      p.set("category", "EXPENSE");
      if (drill.headKey) p.set("expense", drill.headKey);
      if (drill.subKey) p.set("expenseType", drill.subKey);
    } else if (key === "receivables" || key === "receipts") {
      const enumCat = REVENUE_CATEGORY_TO_ENUM[drill.headKey];
      if (enumCat) p.set("category", enumCat);
    } else if (key === "payments") {
      p.set("category", "EXPENSE");
      if (drill.headKey) p.set("expense", drill.headKey);
      if (drill.subKey) p.set("expenseType", drill.subKey);
    } else if (key === "cash-bank" || key === "loans") {
      // Here headKey IS the account name (Cash & Bank/Loans have no expense/revenue head), so it
      // carries as furtherMode instead of a category prefill.
      if (drill.headKey) p.set("furtherMode", drill.headKey);
    }
    return `/admin/transactions/create?${p.toString()}`;
  })();

  const handleDelete = async (row) => {
    // Hardened (Task 3): a null/absent transactionCategory used to silently fall back to the
    // EXPENSE endpoint, which is wrong for any row that isn't actually an expense — hitting the
    // wrong DELETE route on a real Transactions _id. Refuse rather than guess.
    if (!row.transactionCategory) {
      window.alert("Can't determine what kind of record this is — refusing to delete it. Open it from Transactions instead.");
      return;
    }
    const endpoint = DELETE_ENDPOINTS[row.transactionCategory];
    if (!endpoint) {
      window.alert(`No delete route for "${row.transactionCategory}" — refusing to guess.`);
      return;
    }
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

  // Task 3 — the single place every leaf row's action cell is decided. Edit/delete are offered
  // ONLY for rows that are genuinely Transactions. A contra transfer lives in AccountTransfer and
  // a suspense entry in SuspenseEntry — both have _ids /admin/transactions/edit/[id] cannot
  // resolve, and both would hit the wrong DELETE endpoint via handleDelete's transactionCategory
  // guard above. They get their own actions instead. `renderLeafRowActions` (the Loans section's
  // Settle/Cancel Loan) is composed in, not replaced — it still wins over the generic Edit/Delete
  // for a plain, unlocked, non-reversed transaction row when the caller supplies it.
  // "View" opens the complete-detail modal (TransactionDetailModal, fetched fresh from
  // /api/transactions/get-by-id — the leaf columns here only ever project a handful of fields).
  // Only real Transactions have that endpoint's row shape; CONTRA transfers (AccountTransfer) and
  // SUSPENSE entries (SuspenseEntry) don't, so they're excluded before this button ever renders.
  // Available on every OTHER leaf row regardless of lock/reversal state — those states restrict
  // what you can DO to a row, never whether you can look at it.
  // Cash & Bank/Loans' level-2 ledger (unlike the documents-mode leaf) mixes real Transactions
  // with contra transfers and suspense entries in one list WITHOUT tagging them via sourceKind —
  // isContra/isSuspense (set in the load() mapping above) are what distinguish them there.
  const isRealTransaction = (row) => !row.isContra && !row.isSuspense;

  const viewButton = (row) =>
    isRealTransaction(row) ? (
      <button
        onClick={() => setViewTxId(row._id)}
        title="View full details"
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
    ) : null;

  const leafActions = (row) => {
    if (row.sourceKind === "CONTRA") return <ContraRowActions />;
    if (row.sourceKind === "SUSPENSE") return <SuspenseRowActions />;
    if (row.lockReason) {
      return (
        <div className="flex items-center justify-end gap-2">
          {viewButton(row)}
          <LockedBadge reason={row.lockReason} />
        </div>
      );
    }
    if (row.reversalOf) {
      return (
        <div className="flex items-center justify-end gap-2">
          {viewButton(row)}
          <ReversalBadge reason={row.reversalReason} />
        </div>
      );
    }
    if (row.isReversed) {
      return (
        <div className="flex items-center justify-end gap-2">
          {viewButton(row)}
          <ReversedBadge />
        </div>
      );
    }
    if (renderLeafRowActions) {
      return (
        <div className="flex items-center justify-end gap-2">
          {viewButton(row)}
          {renderLeafRowActions(row)}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-end gap-2">
        {viewButton(row)}
        <button
          onClick={() => router.push(`/admin/transactions/edit/${row._id}`)}
          className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => handleDelete(row)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  // ── Task 5, Step 3 — Level-3 document row actions ──
  const openHistory = async (row) => {
    setHistoryDoc(row);
    setHistoryLoading(true);
    try {
      const idParam = isPayableSection ? `payableId=${row._id}` : `receivableId=${row._id}`;
      const res = await fetch(`/api/transactions/get-all?${idParam}&limit=50`);
      const data = await res.json();
      setHistoryTx(data.success ? data.transactions || [] : []);
    } finally {
      setHistoryLoading(false);
    }
  };

  const cancelDocument = async (row) => {
    const label = (isPayableSection ? row.payee?.label : row.payer?.label) || "this document";
    const ok = window.confirm(
      `Permanently delete ${label}?\n\n${formatCurrency(row.totalAmount)} · nothing has been ${
        isPayableSection ? "paid" : "received"
      } against it yet.\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    const endpoint = isPayableSection ? `/api/payables/${row._id}` : `/api/receivables/${row._id}`;
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast.success(isPayableSection ? "Payable deleted" : "Receivable deleted");
      load();
    } else {
      toast.error(data.error || "Failed to delete");
    }
  };

  const documentActions = (row) => {
    const settled = isPayableSection ? row.paid : row.received;
    const pendingAmt = row.pending ?? Math.max(row.totalAmount - (settled || 0), 0);
    return (
      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {row.isCancelled ? (
          <StatusBadge status="Cancelled" />
        ) : row.lockReason ? (
          <LockedBadge reason={row.lockReason} />
        ) : (
          <>
            {pendingAmt > 0 && (
              <button
                onClick={() => setPayModal(row)}
                title={isPayableSection ? "Record Payment" : "Record Receipt"}
                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                {isPayableSection ? <Banknote className="w-3.5 h-3.5" /> : <HandCoins className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => setReviseModal(row)}
              title="Revise"
              className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!(settled > 0) && (
              <button
                onClick={() => cancelDocument(row)}
                title="Cancel (delete — nothing paid yet)"
                className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
        <button
          onClick={() => setViewDoc(row)}
          title="View full details"
          className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => openHistory(row)}
          title="View History"
          className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
        >
          <History className="w-3.5 h-3.5" />
        </button>
      </div>
    );
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

  // Level 3, documents mode — one row per Payable/Receivable, live paid/pending (never stored).
  const documentColumns = [
    {
      key: "party",
      label: isPayableSection ? "Payee" : "Payer",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-gray-800">{(isPayableSection ? r.payee?.label : r.payer?.label) || "—"}</span>
          {(r.paid > 0 || r.received > 0) && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
        </div>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (r) => <span className="text-xs text-gray-500">{(r.purpose || "").replace(/_/g, " ")}</span>,
    },
    { key: "totalAmount", label: isPayableSection ? "Owed" : "Expected", numeric: true },
    {
      key: "settled",
      label: isPayableSection ? "Paid" : "Received",
      numeric: true,
      render: (r) => formatCurrency(isPayableSection ? r.paid : r.received),
    },
    { key: "pending", label: "Pending", numeric: true },
    {
      key: "status",
      label: "Status",
      render: (r) => <StatusBadge status={r.isCancelled ? "Cancelled" : r.status} />,
    },
    {
      key: "ageing",
      label: "Due",
      render: (r) => {
        // daysOverdue/ageingBucket are computed from dueDate vs. today regardless of whether
        // anything is still owed — a document paid off long after its due date would otherwise
        // keep showing "140 days overdue" forever. Only meaningful while something is pending.
        const cleared = !(r.pending > 0.5);
        const info = formatAgeing(r.daysOverdue);
        return (
          <div>
            <p className="text-xs text-gray-600">{formatDate(r.dueDate)}</p>
            {!cleared && <p className={`text-[10px] ${AGEING_TONE_CLASSES[info.tone]}`}>{info.text}</p>}
          </div>
        );
      },
    },
  ];

  // cash-bank/loans/suspense leaves are read-only ledger views (no edit/delete — see DrillDownTable
  // header comment). Payables/Receivables leaf rows (level 4, documents mode) are real
  // Transactions with edit/delete; the party they belong to is already shown one level up in the
  // header (drill.documentLabel) and in the documents-level table, so no Party column here.
  const txColumns = [
    { key: "date", label: "Date", render: (r) => formatDate(r.date) },
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
    // The old inline lock-icon column is gone — leafActions() below now replaces the whole
    // action cell with a real, titled LockedBadge for a locked row, which says more than a
    // bare icon and no longer needs its own column.
  ];

  const statusOptions = isPayableSection ? PAYABLE_STATUS_OPTIONS : RECEIVABLE_STATUS_OPTIONS;

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
              {drill.documentLabel && (
                <span className="text-gray-400 font-normal"> / {drill.documentLabel}</span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Task 5, Step 5 — party/status/ageing only matter (and only render) at the documents
              level; branch/date scope the whole section regardless of level, but are hidden here
              entirely when the page above has taken them over (Task A, Round 2) — one filter bar,
              one truth, not a second one repeating what the page already shows. */}
          {atDocuments && (
            <>
              <input
                type="text"
                value={scope.party}
                onChange={(e) => updateScope({ party: e.target.value })}
                placeholder="Search party…"
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs w-32"
              />
              <select
                value={scope.status}
                onChange={(e) => updateScope({ status: e.target.value })}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={scope.ageing}
                onChange={(e) => updateScope({ ageing: e.target.value })}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              >
                <option value="">All ages</option>
                {AGEING_BUCKETS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </>
          )}
          {!isControlled && (
            <>
              <select
                value={scope.branch}
                onChange={(e) => updateScope({ branch: e.target.value })}
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
                onChange={(e) => updateScope({ dateFrom: e.target.value })}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
              />
              <input
                type="date"
                value={scope.dateTo}
                onChange={(e) => updateScope({ dateTo: e.target.value })}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
              />
            </>
          )}
          {showVoucherButton && (
            <button
              onClick={() => router.push(voucherHref)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-300 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-50"
            >
              <FileText className="w-3.5 h-3.5" /> New Voucher
            </button>
          )}
          {showTransactionButton && (
            <button
              onClick={() => router.push(transactionHref)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" /> New Transaction
            </button>
          )}
        </div>
      </div>

      {/* ── The table for the current level ── */}
      {atDocuments ? (
        <AccountingTable
          columns={documentColumns}
          rows={rows}
          loading={loading}
          filterConfig={{ showSearch: false, showBranch: false, showDateRange: false }}
          pagination={meta}
          onPageChange={setPage}
          onRowClick={drillInto}
          urlSync={false}
          getRowKey={(r) => r._id}
          renderRowActions={documentActions}
          emptyMessage="No documents match these filters"
        />
      ) : atLeaf ? (
        <AccountingTable
          columns={txColumns}
          rows={rows}
          loading={loading}
          filterConfig={{ showSearch: false, showBranch: false, showDateRange: false }}
          pagination={meta}
          onPageChange={setPage}
          urlSync={false}
          getRowKey={(r) => r._id}
          renderRowActions={leafActions}
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

      {payModal &&
        (isPayableSection ? (
          <RecordPaymentModal
            payable={payModal}
            toast={toast}
            onClose={() => setPayModal(null)}
            onSuccess={() => {
              setPayModal(null);
              load();
            }}
          />
        ) : (
          <RecordReceiptModal
            receivable={payModal}
            toast={toast}
            onClose={() => setPayModal(null)}
            onSuccess={() => {
              setPayModal(null);
              load();
            }}
          />
        ))}

      {reviseModal &&
        (isPayableSection ? (
          <RevisePayableModal
            payable={reviseModal}
            toast={toast}
            onClose={() => setReviseModal(null)}
            onSuccess={() => {
              setReviseModal(null);
              load();
            }}
          />
        ) : (
          <ReviseReceivableModal
            receivable={reviseModal}
            toast={toast}
            onClose={() => setReviseModal(null)}
            onSuccess={() => {
              setReviseModal(null);
              load();
            }}
          />
        ))}

      {viewTxId && <TransactionDetailModal transactionId={viewTxId} onClose={() => setViewTxId(null)} />}

      {viewDoc && (
        <DocumentDetailModal
          documentId={viewDoc._id}
          kind={isPayableSection ? "payable" : "receivable"}
          onClose={() => setViewDoc(null)}
        />
      )}

      {historyDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                History — {(isPayableSection ? historyDoc.payee?.label : historyDoc.payer?.label) || "Document"}
              </h3>
              <button onClick={() => setHistoryDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <DocumentHistory
                doc={historyDoc}
                kind={isPayableSection ? "payable" : "receivable"}
                transactions={historyTx}
                loading={historyLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
