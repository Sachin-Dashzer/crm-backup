"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Landmark, Banknote, HandCoins, AlertTriangle, CheckCircle2, Clock, Download, Loader2, X, ArrowUpRight } from "lucide-react";
import DrillDownTable from "@/components/finance/DrillDownTable";
import LoanSettlementModal from "@/components/finance/LoanSettlementModal";
import CancelLoanModal from "@/components/finance/CancelLoanModal";
import LoanRowActions from "@/components/finance/LoanRowActions";
import RecordAdvanceModal from "@/components/finance/RecordAdvanceModal";
import AdvanceDocumentActions from "@/components/finance/AdvanceDocumentActions";
import DocumentHistory from "@/components/finance/DocumentHistory";
import MetricCard from "@/components/MetricCard";
import { formatCurrency, formatDate } from "@/lib/financeUI";
import { AGEING_BUCKETS } from "@/lib/ageing";
import { ALL_BRANCHES } from "@/lib/branches";
import { ENTRY_TYPES } from "@/constants/entryTypes";
import { exportWorkbook, fetchAllPages, filterProvenanceRows } from "@/lib/exportToExcel";
import { useToast } from "@/components/Toast";
import DebouncedDateInput from "@/components/finance/DebouncedDateInput";

// Assets = Cash & Bank + Loan-financing accounts + Receivables. Page total is the sum of the same
// three closing figures the sections below compute — never a separate calculation, so the header
// can never disagree with what's under it.
//
// "Bajaj Loan"/"Fibe Loan" live here, not on Liabilities: they're patient-financing SETTLEMENT
// accounts — money the financier pays the clinic when a patient pays via that loan product — not
// money the clinic owes. Functionally the same as any other account in ACCOUNTS, just kept as
// its own section since it's a distinct kind of account.
//
// DrillDownTable's AccountingTable leaf uses useSearchParams for its own filter URL-sync, which
// Next.js requires a Suspense boundary around — same pattern TransactionsListPage/payables/
// receivables pages already use.
export default function AssetsPage() {
  return (
    <Suspense fallback={null}>
      <AssetsPageInner />
    </Suspense>
  );
}

function AssetsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Task A (Round 2) — ONE scope for the whole page, shared by the header total AND every
  // DrillDownTable section below (passed down as the `scope`/`onScopeChange` controlled props).
  // Before this fix the header fetched with no params at all while each section filtered itself
  // independently — the numbers only ever agreed on a completely unfiltered page. Seeded once
  // from the URL on mount so a link with ?branch=&from=&to= (the dashboard's card links, Task C)
  // opens already filtered.
  const [scope, setScope] = useState(() => ({
    branch: searchParams.get("branch") || "",
    dateFrom: searchParams.get("from") || "",
    dateTo: searchParams.get("to") || "",
  }));

  const [cashTotal, setCashTotal] = useState(null);
  const [loansTotal, setLoansTotal] = useState(null);
  const [receivablesTotal, setReceivablesTotal] = useState(null);
  const [unattributed, setUnattributed] = useState(null);
  // Distinct from the initial `null` totals: `refetching` is true only while a FILTER CHANGE is
  // in flight, so a filter change shows a skeleton instead of leaving the previous (now stale)
  // total sitting there looking current.
  const [refetching, setRefetching] = useState(false);
  const [settleTx, setSettleTx] = useState(null); // { transactionId, account, amount, narration, date } | null
  const [cancelTx, setCancelTx] = useState(null); // the row being cancelled, or null
  // Bumped on every successful settlement/cancellation — passed as `key` to BOTH the Loan
  // Accounts AND Cash & Bank DrillDownTables (either action moves money on both sides) so both
  // remount and refetch fresh. Only bumping the loans side left the destination bank account
  // showing stale data until a full page reload, which looked exactly like nothing had happened.
  const [refreshKey, setRefreshKey] = useState(0);

  // Task 5, Step 4 — summary strip + ageing chips for Receivables, ported from the old
  // standalone Receivables page.
  const [summary, setSummary] = useState(null);
  const [ageingBuckets, setAgeingBuckets] = useState([]);
  const [ageingFilter, setAgeingFilter] = useState("");

  // Task 5, Step 5 — deep-link restore (section/head/sub/doc), now written back to the URL
  // ALONGSIDE `scope` by the single sync effect below rather than its own separate one.
  const [receivablesInitialDrill, setReceivablesInitialDrill] = useState(undefined);
  const [receivablesDrill, setReceivablesDrill] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Advances — money WE lent out (advance salary/rent, personal advances) that must come back;
  // see src/models/Advance.js. A real Receivable document under revenueCategory "Advances", so it
  // already rides on the same /api/receivables/grouped?level=1 total the header above sums (no
  // separate header math needed), but gets its own dedicated section since its lifecycle (Record
  // Recovery/Further Advance) differs from an ordinary receivable's.
  const [advanceModal, setAdvanceModal] = useState(null); // { mode: "OUT"|"IN", receivable } | null
  const [advancesRefreshKey, setAdvancesRefreshKey] = useState(0);
  const [advanceHistoryDoc, setAdvanceHistoryDoc] = useState(null);
  const [advanceHistoryRows, setAdvanceHistoryRows] = useState([]);
  const [advanceHistoryLoading, setAdvanceHistoryLoading] = useState(false);

  const openAdvanceHistory = async (row) => {
    setAdvanceHistoryDoc(row);
    setAdvanceHistoryLoading(true);
    try {
      const res = await fetch(`/api/advances/grouped?level=4&documentId=${row._id}&limit=200`);
      const data = await res.json();
      setAdvanceHistoryRows(
        (data.rows || []).map((r) => ({
          _id: r._id,
          amount: r.amount,
          date: r.date,
          method: `${r.direction === "IN" ? "Recovered" : "Paid out"} · ${r.account}`,
          paymentId: r.reference,
          createdBy: r.createdBy,
        })),
      );
    } finally {
      setAdvanceHistoryLoading(false);
    }
  };

  const handleAdvanceSuccess = () => {
    setAdvanceModal(null);
    setAdvancesRefreshKey((k) => k + 1);
    fetchHeaderTotals();
  };

  // Balances (Cash & Bank / Loans / Receivables closing) are POINT-IN-TIME, not a flow — a
  // closing figure reads "everything up to this date", not "movement within this date range".
  // So the header total sends `to` only and DELIBERATELY OMITS `from`; close-book/accounts and
  // receivables/grouped both already default `from` internally to "1970-01-01" when it's absent,
  // which is exactly "as of `to`". `from`, when the user sets it, still reaches each section's
  // own opening/movement columns via the controlled `scope` prop below — this comment describes
  // ONLY the header total fetch. Do not "fix" this back to sending both.
  const closingQS = useCallback(
    (extra = {}) => {
      const p = new URLSearchParams();
      if (scope.branch) p.set("branch", scope.branch);
      p.set("to", scope.dateTo || new Date().toISOString().slice(0, 10));
      Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
      return p.toString();
    },
    [scope],
  );

  const fetchHeaderTotals = useCallback(() => {
    setRefetching(true);
    Promise.all([
      fetch(`/api/close-book/accounts?filter=cash&${closingQS()}`).then((r) => r.json()),
      fetch(`/api/close-book/accounts?filter=loans&${closingQS()}`).then((r) => r.json()),
      fetch(`/api/receivables/grouped?level=1&${closingQS()}`).then((r) => r.json()),
      fetch(`/api/receivables/summary${scope.branch ? `?branch=${scope.branch}` : ""}`).then((r) => r.json()),
      fetch(`/api/receivables/summary?ageing=1${scope.branch ? `&branch=${scope.branch}` : ""}`).then((r) => r.json()),
      fetch(`/api/close-book/balance-sheet?${closingQS({ from: "1970-01-01" })}`).then((r) => r.json()),
    ])
      .then(([cashJson, loansJson, recJson, summaryJson, ageingJson, unattrJson]) => {
        setCashTotal((cashJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0));
        setLoansTotal((loansJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0));
        setReceivablesTotal((recJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0));
        setSummary(summaryJson.overall || null);
        setAgeingBuckets(ageingJson.byBucket || []);
        setUnattributed(unattrJson.unattributed || { count: 0, amount: 0 });
      })
      .catch(() => {
        setCashTotal(0);
        setLoansTotal(0);
        setReceivablesTotal(0);
      })
      .finally(() => setRefetching(false));
  }, [closingQS, scope.branch]);

  useEffect(() => {
    fetchHeaderTotals();
  }, [fetchHeaderTotals]);

  // Restores /admin/assets?section=receivables&head=Transplant&sub=PATIENT_DUE&doc=<id> — the
  // URL Task 1's Entry Type badge points at for a settlement's linked receivable. `scope` itself
  // is already seeded synchronously in useState above; this only needs the drill path, which
  // requires a fetch when `doc` is present.
  useEffect(() => {
    const section = searchParams.get("section");
    if (section !== "receivables") {
      setReceivablesInitialDrill(null);
      return;
    }
    const head = searchParams.get("head") || "";
    const sub = searchParams.get("sub") || "";
    const doc = searchParams.get("doc") || "";

    if (doc) {
      fetch(`/api/receivables/${doc}`)
        .then((r) => r.json())
        .then((json) => {
          const rec = json.receivable;
          if (!rec) {
            setReceivablesInitialDrill(null);
            return;
          }
          setReceivablesInitialDrill({
            level: 3,
            headKey: rec.revenueCategory,
            headLabel: rec.revenueCategory,
            subKey: rec.purpose || "",
            subLabel: rec.purpose || "",
          });
        })
        .catch(() => setReceivablesInitialDrill(null));
    } else if (sub) {
      setReceivablesInitialDrill({ level: 3, headKey: head, headLabel: head, subKey: sub, subLabel: sub });
    } else if (head) {
      setReceivablesInitialDrill({ level: 2, headKey: head, headLabel: head });
    } else {
      setReceivablesInitialDrill(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single sync point for the URL — `scope` (branch/from/to) AND the receivables drill path
  // (section/head/sub/doc) are written together, so neither overwrites the other's params.
  useEffect(() => {
    const params = new URLSearchParams();
    if (scope.branch) params.set("branch", scope.branch);
    if (scope.dateFrom) params.set("from", scope.dateFrom);
    if (scope.dateTo) params.set("to", scope.dateTo);
    if (receivablesDrill && receivablesDrill.level > 1) {
      params.set("section", "receivables");
      if (receivablesDrill.headKey) params.set("head", receivablesDrill.headKey);
      if (receivablesDrill.subKey) params.set("sub", receivablesDrill.subKey);
      if (receivablesDrill.documentId) params.set("doc", receivablesDrill.documentId);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, receivablesDrill]);

  const ageingChipData = (bucket) => {
    const found = ageingBuckets.find((b) => b._id === bucket.value);
    return { count: found?.count || 0, totalPending: found?.totalPending || 0 };
  };

  const handleSettlementSuccess = () => {
    fetchHeaderTotals();
    // DrillDownTable has no external refresh hook, so a key bump is the clean way to force both
    // subtrees to remount and refetch — see the refreshKey comment above.
    setRefreshKey((k) => k + 1);
    setTimeout(() => setSettleTx(null), 1200);
  };

  const handleCancelDone = () => {
    fetchHeaderTotals();
    setRefreshKey((k) => k + 1);
  };

  const total = (cashTotal ?? 0) + (loansTotal ?? 0) + (receivablesTotal ?? 0);
  const loaded = cashTotal !== null && loansTotal !== null && receivablesTotal !== null;
  const asOfLabel = `As of ${formatDate(scope.dateTo || new Date())}${scope.branch ? ` · ${scope.branch}` : ""}`;

  // Task B — export exactly what the current filters produce: the same params, the same
  // endpoints, refetched fresh at limit=10000 rather than exported from the paginated in-memory
  // rows any table on screen is currently holding.
  const handleExport = async () => {
    setExporting(true);
    try {
      // /api/receivables/list and /api/transactions/get-all both key their date range on
      // dateFrom/dateTo, not from/to (close-book's own convention) — this is THEIR param name,
      // not a re-derivation of the balance-vs-flow rule above.
      const flowQS = (() => {
        const p = new URLSearchParams();
        if (scope.branch) p.set("branch", scope.branch);
        if (scope.dateFrom) p.set("dateFrom", scope.dateFrom);
        if (scope.dateTo) p.set("dateTo", scope.dateTo);
        return p.toString();
      })();

      // receivables/list clamps limit to 200, so the old `?limit=10000` here silently produced a
      // truncated export once there were more than 200 receivables in range. fetchAllPages walks
      // the pages instead. transactions/get-all genuinely honours a 10000 limit, so it stays.
      const [cashJson, loansJson, receivablesPaged, txJson] = await Promise.all([
        fetch(`/api/close-book/accounts?filter=cash&${closingQS()}`).then((r) => r.json()),
        fetch(`/api/close-book/accounts?filter=loans&${closingQS()}`).then((r) => r.json()),
        fetchAllPages((page, limit) => `/api/receivables/list?page=${page}&limit=${limit}&${flowQS}`, "receivables"),
        fetch(`/api/transactions/get-all?limit=10000&${flowQS}`).then((r) => r.json()),
      ]);
      const receivablesJson = { receivables: receivablesPaged.rows };
      if (receivablesPaged.truncated) {
        toast.error("Export is incomplete — too many receivables in range. Narrow the date filter.");
      }

      const cashRows = (cashJson.rows || []).map((r) => ({
        Account: r.label,
        Opening: r.opening,
        "Money In": r.movement,
        "Money Out": r.settled,
        Closing: r.closing,
      }));
      const loanRows = (loansJson.rows || []).map((r) => ({
        Account: r.label,
        Opening: r.opening,
        "Money In": r.movement,
        "Money Out": r.settled,
        Closing: r.closing,
      }));
      const receivableRows = (receivablesJson.receivables || []).map((r) => ({
        Head: r.revenueCategory || "—",
        "Sub-type": (r.purpose || "").replace(/_/g, " "),
        Party: r.payer?.label || "—",
        Total: r.totalAmount,
        Received: r.received,
        Pending: r.pending,
        "Due Date": r.dueDate ? new Date(r.dueDate) : null,
        Ageing: r.ageingBucket || "—",
        Status: r.isCancelled ? "Cancelled" : r.status,
      }));
      // Every Revenue/Expense transaction in the filtered period, flat — running balance is
      // deliberately not a column here: it's only meaningful WITHIN one account's own ledger
      // (see Cash & Bank/Loan Accounts sheets for those), not across a combined multi-account,
      // multi-category list.
      const txRows = (txJson.transactions || []).map((t) => ({
        Date: new Date(t.date),
        "Account/Head": t.furtherMode || t.expense || "—",
        Party: t.patient?.personal?.name || t.patientName || t.expenseGiver?.name || "—",
        Narration: t.remarks || t.procedure || t.expenseType || "—",
        "Entry Type": ENTRY_TYPES[t.entryType]?.label || "Regular",
        Method: t.method || "—",
        Amount: t.amount,
      }));

      const summaryRows = [
        ...filterProvenanceRows({ branch: scope.branch, dateFrom: scope.dateFrom, dateTo: scope.dateTo }),
        { Field: "Cash & Bank", Value: cashTotal },
        { Field: "Loan Accounts", Value: loansTotal },
        { Field: "Receivables", Value: receivablesTotal },
        { Field: "Total Assets", Value: total },
      ];

      await exportWorkbook({
        filename: `Assets_${scope.branch || "All"}_${scope.dateFrom || "start"}_to_${scope.dateTo || "today"}.xlsx`,
        sheets: [
          { name: "Summary", rows: summaryRows, colWidths: [22, 20] },
          { name: "Cash & Bank", rows: cashRows, colWidths: [22, 16, 16, 16, 16], currencyCols: ["Opening", "Money In", "Money Out", "Closing"] },
          { name: "Loan Accounts", rows: loanRows, colWidths: [22, 16, 16, 16, 16], currencyCols: ["Opening", "Money In", "Money Out", "Closing"] },
          { name: "Receivables", rows: receivableRows, colWidths: [16, 18, 22, 14, 14, 14, 14, 10, 16], currencyCols: ["Total", "Received", "Pending"] },
          { name: "Transactions", rows: txRows, colWidths: [12, 20, 22, 30, 18, 12, 14], currencyCols: ["Amount"] },
        ],
      });
      toast.success("Assets exported");
    } catch (error) {
      console.error("Error exporting assets:", error);
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assets</h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything the business owns or is owed — cash &amp; bank balances plus outstanding
              receivables.
            </p>
          </div>

          {/* Task A — the ONE filter bar for this page. Every section below is controlled by
              this same `scope`, so the header total and every table under it can never disagree. */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scope.branch}
              onChange={(e) => setScope((s) => ({ ...s, branch: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
            >
              <option value="">All branches</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            {/* Debounced: scope is lifted to this page, so each committed change re-runs the
                header's fetches AND every DrillDownTable below. A native date input fires per
                segment while typing, so this was up to 3 full rounds per date entered. */}
            <DebouncedDateInput
              value={scope.dateFrom}
              onCommit={(v) => setScope((s) => ({ ...s, dateFrom: v }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
            />
            <span className="text-xs text-gray-400">to</span>
            <DebouncedDateInput
              value={scope.dateTo}
              onCommit={(v) => setScope((s) => ({ ...s, dateTo: v }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
            />
            {(scope.branch || scope.dateFrom || scope.dateTo) && (
              <button
                onClick={() => setScope({ branch: "", dateFrom: "", dateTo: "" })}
                className="text-xs font-medium text-indigo-700 hover:text-indigo-800"
              >
                Clear filters
              </button>
            )}
            <button
              onClick={() => setAdvanceModal({ mode: "OUT", receivable: null })}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-teal-700"
            >
              <HandCoins className="w-3.5 h-3.5" />
              Record Advance
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download Excel
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Assets</p>
            {refetching || !loaded ? (
              <div className="h-9 w-48 bg-gray-100 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(total)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{asOfLabel}</p>
            <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-500">
              <span>Cash &amp; Bank: <strong className="text-gray-800">{loaded ? formatCurrency(cashTotal) : "…"}</strong></span>
              <span>Loan Accounts: <strong className="text-gray-800">{loaded ? formatCurrency(loansTotal) : "…"}</strong></span>
              <span>Receivables: <strong className="text-gray-800">{loaded ? formatCurrency(receivablesTotal) : "…"}</strong></span>
            </div>
          </div>

          {unattributed && unattributed.count > 0 && (
            <Link
              href="/admin/transactions?furtherMode=__UNTRACKED__"
              className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>{formatCurrency(unattributed.amount)}</strong> across{" "}
                <strong>{unattributed.count}</strong> transactions is missing account attribution
                and is excluded from this total.
              </p>
            </Link>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Cash &amp; Bank</h2>
            </div>
            <DrillDownTable
              key={refreshKey}
              levels={2}
              sectionConfig={{
                key: "cash-bank",
                apiBase: "/api/close-book/accounts",
                title: "Cash & Bank",
                columnLabels: {
                  opening: "Opening balance",
                  movement: "Money in",
                  settled: "Money out",
                  closing: "Balance",
                },
              }}
              scope={scope}
              onScopeChange={setScope}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Loan Accounts</h2>
            </div>
            <DrillDownTable
              key={refreshKey}
              levels={2}
              sectionConfig={{
                key: "loans",
                apiBase: "/api/close-book/accounts",
                title: "Loan Accounts",
                columnLabels: {
                  opening: "Opening balance",
                  movement: "Money in",
                  settled: "Money out",
                  closing: "Balance",
                },
              }}
              scope={scope}
              onScopeChange={setScope}
              renderLeafRowActions={(row) => (
                <LoanRowActions
                  row={row}
                  onSettle={() =>
                    setSettleTx({
                      transactionId: row._id,
                      account: row.account,
                      amount: row.amount,
                      narration: row.narration,
                      date: row.date,
                      branch: row.branch,
                    })
                  }
                  onCancel={() => setCancelTx(row)}
                />
              )}
            />
          </section>

          {settleTx && (
            <LoanSettlementModal
              fromAccount={settleTx.account}
              defaultAmount={settleTx.amount}
              contextLabel={settleTx.narration}
              sourceTransactionId={settleTx.transactionId}
              branch={settleTx.branch}
              onClose={() => setSettleTx(null)}
              onSuccess={handleSettlementSuccess}
            />
          )}

          {cancelTx && (
            <CancelLoanModal
              transaction={{
                _id: cancelTx._id,
                amount: cancelTx.amount,
                date: cancelTx.date,
                furtherMode: cancelTx.account,
                patientName: cancelTx.patientName,
                patient: cancelTx.patient,
              }}
              onClose={() => setCancelTx(null)}
              onDone={handleCancelDone}
            />
          )}

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Receivable" value={formatCurrency(summary.totalReceivable)} icon={HandCoins} color="from-emerald-500 to-emerald-600" />
              <MetricCard title="Received To Date" value={formatCurrency(summary.totalReceived)} icon={CheckCircle2} color="from-indigo-500 to-indigo-600" />
              <MetricCard title="Open (Pending)" value={formatCurrency(summary.totalPending)} icon={Clock} color="from-amber-500 to-amber-600" />
              <MetricCard title="Active Receivables" value={summary.count ?? 0} icon={AlertTriangle} color="from-rose-500 to-rose-600" />
            </div>
          )}

          {ageingBuckets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {AGEING_BUCKETS.map((b) => {
                const chip = ageingChipData(b);
                const active = ageingFilter === b.value;
                return (
                  <button
                    key={b.value}
                    onClick={() => setAgeingFilter((cur) => (cur === b.value ? "" : b.value))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      active
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {b.label} · {chip.count} · {formatCurrency(chip.totalPending)}
                  </button>
                );
              })}
            </div>
          )}

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Receivables</h2>
            </div>
            {receivablesInitialDrill !== undefined && (
              <DrillDownTable
                levels={3}
                sectionConfig={{
                  key: "receivables",
                  mode: "documents",
                  apiBase: "/api/receivables",
                  title: "Receivables",
                  columnLabels: {
                    opening: "Opening due",
                    movement: "Raised",
                    settled: "Received",
                    closing: "Still due",
                  },
                }}
                initialDrill={receivablesInitialDrill || undefined}
                onDrillChange={setReceivablesDrill}
                scope={scope}
                onScopeChange={setScope}
                extraParams={ageingFilter ? { ageing: ageingFilter } : undefined}
              />
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-teal-500" />
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Advances</h2>
              </div>
              <Link
                href="/admin/financing?tab=advances"
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Manage all advances <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <DrillDownTable
              key={advancesRefreshKey}
              levels={3}
              sectionConfig={{
                key: "advances",
                mode: "documents",
                documentShape: "receivable",
                hideCreateButtons: true,
                apiBase: "/api/advances",
                title: "Advances",
                columnLabels: {
                  opening: "Opening owed to us",
                  movement: "Advanced",
                  settled: "Recovered",
                  closing: "Still owed to us",
                },
              }}
              renderDocumentActions={(row) => (
                <AdvanceDocumentActions
                  row={row}
                  onRecover={(r) => setAdvanceModal({ mode: "IN", receivable: r })}
                  onFurther={(r) => setAdvanceModal({ mode: "OUT", receivable: r })}
                  onHistory={openAdvanceHistory}
                />
              )}
              scope={scope}
              onScopeChange={setScope}
            />
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

      {advanceHistoryDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-900">
                History — {advanceHistoryDoc.payer?.label || "Advance"}
              </h3>
              <button onClick={() => setAdvanceHistoryDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <DocumentHistory
                doc={advanceHistoryDoc}
                kind="receivable"
                transactions={advanceHistoryRows}
                loading={advanceHistoryLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
