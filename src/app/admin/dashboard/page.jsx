"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Landmark, ScrollText, Scale, AlertTriangle, ArrowRight, ArrowUpRight, Filter, HandCoins,
  Wallet, HelpCircle, TrendingUp, TrendingDown, RefreshCw, X,
} from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import AccountMultiSelect from "@/components/finance/AccountMultiSelect";
import { formatCurrency } from "@/lib/financeUI";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

function periodRange(preset, custom) {
  let to = new Date();
  to.setHours(23, 59, 59, 999);
  let from;
  if (preset === "custom" && custom?.from) {
    from = new Date(custom.from);
    from.setHours(0, 0, 0, 0);
    to = custom.to ? new Date(custom.to) : new Date(custom.from);
    to.setHours(23, 59, 59, 999);
  } else if (preset === "30") {
    from = new Date();
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  } else if (preset === "90") {
    from = new Date();
    from.setDate(from.getDate() - 89);
    from.setHours(0, 0, 0, 0);
  } else {
    from = new Date(to.getFullYear(), to.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
  }
  const lengthMs = Math.max(to.getTime() - from.getTime(), 0);
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - lengthMs);
  return { from, to, priorFrom, priorTo };
}

const iso = (d) => d.toISOString().slice(0, 10);
const fmtK = (n) =>
  Math.abs(n) >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : Math.abs(n) >= 1000 ? `₹${(n / 1000).toFixed(0)}K` : `₹${n || 0}`;

const AGEING_BUCKET_ORDER = ["current", "1-30", "31-60", "61-90", "90+"];

const bucketMap = (rows) => {
  const map = {};
  (rows || []).forEach((r) => {
    if (r._id) map[r._id] = (map[r._id] || 0) + (r.totalPending || 0);
  });
  return map;
};
const overdueAmount = (rows) =>
  (rows || []).filter((r) => r._id && r._id !== "current").reduce((s, r) => s + (r.totalPending || 0), 0);
const overdueCount = (rows) =>
  (rows || []).filter((r) => r._id && r._id !== "current").reduce((s, r) => s + (r.count || 0), 0);

// C3 — every card names its own basis so "the number looks wrong" defaults to "which basis is
// this" before anything else. Accrual = booked (P&L); Cash = actually moved (Receipts/Payments);
// "As of <date>" = a point-in-time balance (Assets/Liabilities/Net Position) — three genuinely
// different kinds of number that happen to share a page.
function BasisTag({ children }) {
  return (
    <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
      {children}
    </span>
  );
}

// Local card wrapper — deliberately NOT the shared MetricCard (used across many other pages);
// this page needs a real <Link> (so middle-click/new-tab work, per C3) plus a basis tag and a
// skeleton/error sub-state MetricCard doesn't have, and retrofitting those onto a component many
// other pages depend on risked regressing all of them for one page's needs.
function DashboardCard({ href, title, basis, value, icon: Icon, color, subtitle, status = "ready", onRetry }) {
  const body = (
    <div
      className={`group relative bg-white rounded-2xl shadow-sm p-4 sm:p-6 transition-all duration-200 h-full ${
        href ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-400" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg bg-linear-to-r ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {href && (
          <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-gray-600 text-sm font-medium">{title}</p>
        {basis && <BasisTag>{basis}</BasisTag>}
      </div>
      {status === "loading" ? (
        <div className="h-7 w-28 bg-gray-100 rounded animate-pulse mt-1" />
      ) : status === "error" ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-rose-600">Failed to load</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRetry?.();
            }}
            className="text-xs font-semibold text-indigo-600 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="text-xl font-bold text-gray-900">
          {value === null || value === undefined ? "No data for this period" : value}
        </p>
      )}
      {subtitle && <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">{body}</Link>
  ) : (
    body
  );
}

export default function AdminDashboard() {
  // Draft = bound to the filter controls, edited freely. Applied = what every fetch below
  // actually uses. They only converge when Apply is clicked, so changing the period, branch, or
  // account selection doesn't refetch anything until the user says so.
  const [draftPreset, setDraftPreset] = useState("month");
  const [draftCustomRange, setDraftCustomRange] = useState({ from: "", to: "" });
  const [draftAccounts, setDraftAccounts] = useState(ACCOUNTS);
  const [draftBranch, setDraftBranch] = useState("");

  const [appliedPreset, setAppliedPreset] = useState("month");
  const [appliedCustomRange, setAppliedCustomRange] = useState({ from: "", to: "" });
  const [appliedAccounts, setAppliedAccounts] = useState(ACCOUNTS);
  const [appliedBranch, setAppliedBranch] = useState("");

  const isDirty =
    draftPreset !== appliedPreset ||
    draftCustomRange.from !== appliedCustomRange.from ||
    draftCustomRange.to !== appliedCustomRange.to ||
    draftAccounts.length !== appliedAccounts.length ||
    draftAccounts.some((a) => !appliedAccounts.includes(a)) ||
    draftBranch !== appliedBranch;

  const applyFilters = () => {
    setAppliedPreset(draftPreset);
    setAppliedCustomRange(draftCustomRange);
    setAppliedAccounts(draftAccounts);
    setAppliedBranch(draftBranch);
  };

  const resetFilters = () => {
    setDraftPreset("month");
    setDraftCustomRange({ from: "", to: "" });
    setDraftAccounts(ACCOUNTS);
    setDraftBranch("");
    setAppliedPreset("month");
    setAppliedCustomRange({ from: "", to: "" });
    setAppliedAccounts(ACCOUNTS);
    setAppliedBranch("");
  };

  const customReady = appliedPreset !== "custom" || !!appliedCustomRange.from;
  const { from, to, priorFrom, priorTo } = useMemo(
    () => periodRange(appliedPreset, appliedCustomRange),
    [appliedPreset, appliedCustomRange],
  );

  const [assets, setAssets] = useState(null);
  const [liabilities, setLiabilities] = useState(null);
  const [cashFlow, setCashFlow] = useState(null); // { receipts, payments, balanceLeft }
  const [pnl, setPnl] = useState(null);
  const [priorPnl, setPriorPnl] = useState(null);
  const [expenseByHead, setExpenseByHead] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [ageing, setAgeing] = useState({ payables: {}, receivables: {} });
  const [attention, setAttention] = useState(null);
  // The whole Row 1-3 + charts batch shares ONE status — see the header comment on the effect
  // for why this is deliberately not 11 independent per-card loading states.
  const [batchStatus, setBatchStatus] = useState("loading"); // "loading" | "error" | "ready"
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Shared query-string builder for every "open the filtered page" link (C2) — every destination
  // gets the SAME from/to/branch the cards were computed with, so a card never links to a page
  // that shows a different number than the card itself.
  const buildFilterQS = (extra = {}) => {
    const p = new URLSearchParams();
    if (appliedBranch) p.set("branch", appliedBranch);
    p.set("from", iso(from));
    p.set("to", iso(to));
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  };

  // All 9 Row 1-3 cards + the ageing/expense charts come from ONE effect, keyed only to APPLIED
  // filters. Deliberately ONE Promise.all, not 11 independent effects: this page exists because
  // 11 independently-filtered fetches is exactly the bug class Task A fixed on Assets/
  // Liabilities — splitting into per-card effects would let two cards legitimately show figures
  // computed from two different filter states mid-transition. The tradeoff is that "loading"/
  // "error" is a single batch status rather than per-card; a genuinely empty result (a fetch that
  // SUCCEEDED with zero rows) still renders its own "No data for this period" card instead of ₹0.
  useEffect(() => {
    if (!customReady) return;
    let cancelled = false;
    async function run() {
      setBatchStatus("loading");
      try {
        const accountsQS =
          appliedAccounts.length < ACCOUNTS.length ? `&accounts=${appliedAccounts.join(",")}` : "";
        const branchQS = appliedBranch ? `&branch=${appliedBranch}` : "";

        const [
          cashJson, receivablesJson, payablesJson, suspenseJson,
          pnlJson, priorPnlJson, headJson, ageingPayJson, ageingRecJson, unattributedJson, cashFlowJson,
        ] = await Promise.all([
          // Row 1 balances are AS OF the period's end date (`to` only, no `from`) — a balance
          // sheet figure is a point-in-time position, not a flow. Cash/Suspense now filter by
          // `accounts` SERVER-SIDE (Task C4) — no more `.filter(inSelection)` after the fact,
          // which could only ever agree with the server by coincidence.
          //
          // No `filter` = every account in ACCOUNTS, including the Bajaj/Fibe loan-financing
          // settlement accounts — those are ordinary asset accounts (money the financier pays the
          // clinic), not a liability, so they belong in this total same as Cash Book/Paytm/etc.
          fetch(`/api/close-book/accounts?to=${iso(to)}${accountsQS}${branchQS}`).then((r) => r.json()),
          fetch(`/api/receivables/grouped?level=1&to=${iso(to)}${branchQS}`).then((r) => r.json()),
          fetch(`/api/payables/grouped?level=1&to=${iso(to)}${branchQS}`).then((r) => r.json()),
          fetch(`/api/suspense?groupBy=account&to=${iso(to)}${accountsQS}${branchQS}`).then((r) => r.json()),
          // Row 2 — accrual Income/Expense, current period and the prior period of equal length.
          fetch(`/api/close-book/pnl?from=${iso(from)}&to=${iso(to)}${accountsQS}${branchQS}`).then((r) => r.json()),
          fetch(`/api/close-book/pnl?from=${iso(priorFrom)}&to=${iso(priorTo)}${accountsQS}${branchQS}`).then((r) => r.json()),
          fetch(`/api/payables/grouped?level=1&from=${iso(from)}&to=${iso(to)}${branchQS}`).then((r) => r.json()),
          // Ageing is inherently "as of NOW" (days overdue from today), never a period range — a
          // due date that already passed before the applied window would be misreported if this
          // were scoped to from/to. Branch is the only filter that legitimately applies. Do not
          // "fix" this into a period-filtered fetch.
          fetch(`/api/payables/summary?ageing=1${appliedBranch ? `&branch=${appliedBranch}` : ""}`).then((r) => r.json()),
          fetch(`/api/receivables/summary?ageing=1${appliedBranch ? `&branch=${appliedBranch}` : ""}`).then((r) => r.json()),
          // All-time by design — a balance-sheet position, not a period figure; relabelled
          // "All-time unattributed" below rather than pretending it's scoped to the period.
          fetch(`/api/close-book/balance-sheet?from=1970-01-01&to=${iso(to)}${branchQS}`).then((r) => r.json()),
          // Row 3 — cash-basis Receipts/Payments for the SAME applied period + accounts + branch.
          fetch(`/api/close-book/cash-flow?from=${iso(from)}&to=${iso(to)}${accountsQS}${branchQS}`).then((r) => r.json()),
        ]);
        if (cancelled) return;

        const cashRows = cashJson.rows || [];
        const cashTotal = cashRows.reduce((s, r) => s + (r.closing || 0), 0);
        const cashOpening = cashRows.reduce((s, r) => s + (r.opening || 0), 0);
        const receivablesTotal = (receivablesJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0);
        const payablesTotal = (payablesJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0);
        const suspenseTotal = (suspenseJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0);

        setAssets({ cashTotal, receivablesTotal, total: cashTotal + receivablesTotal });
        setLiabilities({ payablesTotal, suspenseTotal, total: payablesTotal + suspenseTotal });
        const receipts = cashFlowJson.receipts || 0;
        const payments = cashFlowJson.payments || 0;
        setCashFlow({ receipts, payments, balanceLeft: cashFlowJson.balanceLeft || 0 });
        setPnl({ income: pnlJson.income || 0, expense: pnlJson.expense || 0 });
        setPriorPnl({ income: priorPnlJson.income || 0, expense: priorPnlJson.expense || 0 });

        setExpenseByHead([...(headJson.rows || [])].sort((a, b) => b.movement - a.movement).slice(0, 10));

        setAgeing({ payables: bucketMap(ageingPayJson.byBucket), receivables: bucketMap(ageingRecJson.byBucket) });

        setAttention({
          overduePayables: { amount: overdueAmount(ageingPayJson.byBucket), count: overdueCount(ageingPayJson.byBucket) },
          overdueReceivables: { amount: overdueAmount(ageingRecJson.byBucket), count: overdueCount(ageingRecJson.byBucket) },
          suspenseCount: (suspenseJson.rows || []).reduce((s, r) => s + (r.count || 0), 0),
          unattributed: unattributedJson.unattributed || { count: 0, amount: 0 },
        });

        // Dev-only reconciliation check — cashTotal (a closing BALANCE) and cashFlow.balanceLeft
        // (a period FLOW) only coincide when the period's own opening balance is zero, so this
        // decomposes the same way Round 1's Receipts/Payments reconciliation strip does:
        // opening + receipts - payments should equal closing, to the rupee, by construction.
        // A real divergence here means one of the two routes drifted from accountBalances.js.
        if (process.env.NODE_ENV === "development") {
          const expectedClosing = Math.round((cashOpening + receipts - payments) * 100) / 100;
          if (Math.abs(expectedClosing - cashTotal) > 1) {
            console.warn(
              "[Dashboard] Cash reconciliation mismatch: opening + receipts - payments != closing.",
              { cashOpening, receipts, payments, expectedClosing, cashTotal, from: iso(from), to: iso(to), appliedBranch, appliedAccounts },
            );
          }
        }

        setLastRefreshed(new Date());
        setBatchStatus("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard fetch failed:", error);
          setBatchStatus("error");
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [from, to, priorFrom, priorTo, customReady, appliedAccounts, appliedBranch, refreshNonce]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const now = new Date();
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        months.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), start, end });
      }
      const branchQS = appliedBranch ? `&branch=${appliedBranch}` : "";
      const results = await Promise.all(
        months.map((m) =>
          fetch(`/api/transactions/get-all?dateFrom=${iso(m.start)}&dateTo=${iso(m.end)}&limit=1${branchQS}`).then((r) => r.json()),
        ),
      );
      if (cancelled) return;
      setMonthlyTrend(
        months.map((m, i) => {
          const s = results[i].stats || {};
          return {
            month: m.label,
            Income: (s.TRANSPLANT?.total || 0) + (s.SERVICE?.total || 0) + (s.MEDICINE?.total || 0),
            Expense: s.EXPENSE?.total || 0,
          };
        }),
      );
    }
    run();
    return () => { cancelled = true; };
  }, [appliedBranch, refreshNonce]);

  const netPosition = assets && liabilities ? assets.total - liabilities.total : null;
  const profit = pnl ? pnl.income - pnl.expense : null;
  const priorProfit = priorPnl ? priorPnl.income - priorPnl.expense : null;
  // Only a genuine prior figure supports a percentage — a prior of 0 would otherwise render as
  // either a nonsensical 0% or an infinite swing, neither of which is honest about "no prior
  // data to compare against".
  const growth = (curr, prior) => (prior > 0 ? Math.round(((curr - prior) / prior) * 100) : null);

  const ageingChartData = AGEING_BUCKET_ORDER.map((b) => ({
    bucket: b,
    Payables: ageing.payables[b] || 0,
    Receivables: ageing.receivables[b] || 0,
  }));

  const periodLabel =
    appliedPreset === "month" ? "This Month"
    : appliedPreset === "30" ? "Last 30 Days"
    : appliedPreset === "90" ? "Last 90 Days"
    : appliedCustomRange.from
      ? `${new Date(appliedCustomRange.from).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} – ${
          appliedCustomRange.to ? new Date(appliedCustomRange.to).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "…"
        }`
      : "Custom Range";

  const accountFilterActive = appliedAccounts.length < ACCOUNTS.length;
  const activeFilterChips = [
    appliedBranch && { key: "branch", label: appliedBranch, clear: () => { setDraftBranch(""); setAppliedBranch(""); } },
    appliedPreset !== "month" && {
      key: "period",
      label: periodLabel,
      clear: () => { setDraftPreset("month"); setAppliedPreset("month"); setDraftCustomRange({ from: "", to: "" }); setAppliedCustomRange({ from: "", to: "" }); },
    },
    accountFilterActive && {
      key: "accounts",
      label: `${appliedAccounts.length} accounts`,
      clear: () => { setDraftAccounts(ACCOUNTS); setAppliedAccounts(ACCOUNTS); },
    },
  ].filter(Boolean);

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* C3 — sticky filter bar */}
        <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[#f8f9fc]/95 backdrop-blur-sm border-b border-gray-100 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Financial Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Assets, liabilities, and P&amp;L at a glance.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
              >
                <option value="">All branches</option>
                {ALL_BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <AccountMultiSelect
                options={ACCOUNTS}
                selected={draftAccounts}
                onChange={setDraftAccounts}
              />
              <select
                value={draftPreset}
                onChange={(e) => setDraftPreset(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
              >
                <option value="month">This Month</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
              {draftPreset === "custom" && (
                <>
                  <input
                    type="date"
                    value={draftCustomRange.from}
                    onChange={(e) => setDraftCustomRange((c) => ({ ...c, from: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
                  />
                  <input
                    type="date"
                    value={draftCustomRange.to}
                    min={draftCustomRange.from}
                    onChange={(e) => setDraftCustomRange((c) => ({ ...c, to: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white shadow-sm"
                  />
                </>
              )}
              <button
                onClick={applyFilters}
                disabled={!isDirty}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Filter className="w-3.5 h-3.5" /> Apply
              </button>
              <button
                onClick={() => setRefreshNonce((n) => n + 1)}
                title="Refresh"
                className="p-2 border border-gray-200 rounded-xl bg-white shadow-sm hover:bg-gray-50"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${batchStatus === "loading" ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                {chip.label}
                <button onClick={chip.clear} className="p-0.5 rounded-full hover:bg-indigo-100">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {activeFilterChips.length > 0 && (
              <button onClick={resetFilters} className="text-xs font-medium text-gray-500 hover:text-gray-700">
                Reset all
              </button>
            )}
            {lastRefreshed && (
              <span className="ml-auto text-xs text-gray-400">
                Last refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Row 1 — as of {periodLabel}'s end date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard
            href={`/admin/assets?${buildFilterQS()}`}
            title="Total Assets"
            basis={`As of ${new Date(to).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
            value={assets ? formatCurrency(assets.total) : null}
            icon={Landmark}
            color="from-emerald-500 to-emerald-600"
            status={batchStatus}
            onRetry={() => setRefreshNonce((n) => n + 1)}
          />
          <DashboardCard
            href={`/admin/liabilities?${buildFilterQS()}`}
            title="Total Liabilities"
            basis={`As of ${new Date(to).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
            value={liabilities ? formatCurrency(liabilities.total) : null}
            icon={ScrollText}
            color="from-rose-500 to-rose-600"
            status={batchStatus}
            onRetry={() => setRefreshNonce((n) => n + 1)}
          />
          <DashboardCard
            title="Net Position"
            basis="As of today"
            value={netPosition != null ? formatCurrency(netPosition) : null}
            icon={Scale}
            color={netPosition >= 0 ? "from-indigo-500 to-indigo-600" : "from-red-500 to-red-600"}
            status={batchStatus}
            onRetry={() => setRefreshNonce((n) => n + 1)}
          />
        </div>

        {/* Sub-cards — Cash & Bank / Receivables / Payables / Suspense */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            href={`/admin/assets?section=cash-bank&${buildFilterQS()}`}
            title="Cash & Bank"
            basis="As of period end"
            value={assets ? formatCurrency(assets.cashTotal) : null}
            icon={Landmark}
            color="from-emerald-400 to-emerald-500"
            status={batchStatus}
          />
          <DashboardCard
            href={`/admin/assets?section=receivables&${buildFilterQS()}`}
            title="Receivables"
            basis="As of period end"
            value={assets ? formatCurrency(assets.receivablesTotal) : null}
            icon={HandCoins}
            color="from-teal-400 to-teal-500"
            status={batchStatus}
            subtitle={accountFilterActive ? "Has no account of its own — unaffected by the account filter" : undefined}
          />
          <DashboardCard
            href={`/admin/liabilities?section=payables&${buildFilterQS()}`}
            title="Payables"
            basis="As of period end"
            value={liabilities ? formatCurrency(liabilities.payablesTotal) : null}
            icon={Wallet}
            color="from-rose-400 to-rose-500"
            status={batchStatus}
            subtitle={accountFilterActive ? "Has no account of its own — unaffected by the account filter" : undefined}
          />
          <DashboardCard
            href={`/admin/liabilities?section=suspense&${buildFilterQS()}`}
            title="Suspense"
            basis="As of period end"
            value={liabilities ? formatCurrency(liabilities.suspenseTotal) : null}
            icon={HelpCircle}
            color="from-amber-400 to-amber-500"
            status={batchStatus}
          />
        </div>

        {/* Row 2 — P&L strip (accrual) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Profit &amp; Loss — {periodLabel}
            </h2>
            <BasisTag>Accrual</BasisTag>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Income = direct sales + receivables raised this period, minus what's double-counted
            against them. Expense = direct expenses + payables raised this period, minus what's
            double-counted against them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Income", value: pnl?.income, prior: priorPnl?.income, href: `/admin/close-book?tab=pnl&${buildFilterQS()}`, Trend: TrendingUp },
              { label: "Expense", value: pnl?.expense, prior: priorPnl?.expense, href: `/admin/close-book?tab=pnl&${buildFilterQS()}`, Trend: TrendingDown },
              { label: "Profit", value: profit, prior: priorProfit, href: `/admin/close-book?tab=pnl&${buildFilterQS()}`, Trend: TrendingUp },
            ].map((row) => {
              const g = growth(row.value, row.prior);
              return (
                <Link
                  key={row.label}
                  href={row.href}
                  className="group border border-gray-100 rounded-xl p-4 hover:shadow-sm hover:border-gray-200 transition-all block"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{row.label}</p>
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {batchStatus === "loading" ? (
                    <div className="h-6 w-24 bg-gray-100 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-xl font-bold text-gray-900 mt-1">
                      {row.value != null ? formatCurrency(row.value) : "No data for this period"}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {row.prior != null ? (
                      g == null ? (
                        <>Prior period: {formatCurrency(row.prior)} (—)</>
                      ) : (
                        <>Prior period: {formatCurrency(row.prior)} ({g >= 0 ? "+" : ""}{g}%)</>
                      )
                    ) : null}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Row 3 — Cash flow strip (cash basis) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Cash Flow — {periodLabel}
            </h2>
            <BasisTag>Cash</BasisTag>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Every positive (Receipts) and negative (Payments) transaction posted to your bank/
            further-mode accounts, excluding internal contra transfers between your own accounts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href={`/admin/receipts?${buildFilterQS()}`} className="group block border border-emerald-100 bg-emerald-50/40 rounded-xl p-4 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Receipts</p>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {batchStatus === "loading" ? (
                <div className="h-6 w-24 bg-emerald-100/60 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {cashFlow ? formatCurrency(cashFlow.receipts) : "No data for this period"}
                </p>
              )}
            </Link>
            <Link href={`/admin/payments?${buildFilterQS()}`} className="group block border border-rose-100 bg-rose-50/40 rounded-xl p-4 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide">Payments</p>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {batchStatus === "loading" ? (
                <div className="h-6 w-24 bg-rose-100/60 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {cashFlow ? formatCurrency(cashFlow.payments) : "No data for this period"}
                </p>
              )}
            </Link>
            <Link href={`/admin/assets?section=cash-bank&${buildFilterQS()}`} className="group block border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between">
                <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wide">Balance Left</p>
                <ArrowUpRight className="w-3.5 h-3.5 text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {batchStatus === "loading" ? (
                <div className="h-6 w-24 bg-indigo-100/60 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {cashFlow ? formatCurrency(cashFlow.balanceLeft) : "No data for this period"}
                </p>
              )}
            </Link>
          </div>
        </div>

        {/* Row 4 — three charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Expense by Head — Top 10</h3>
            {expenseByHead.length === 0 && batchStatus === "ready" ? (
              <p className="text-sm text-gray-400 py-16 text-center">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={expenseByHead} layout="vertical" margin={{ left: 8, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar
                    dataKey="movement"
                    name="Raised"
                    radius={[0, 6, 6, 0]}
                    fill="#f43f5e"
                    cursor="pointer"
                    onClick={(data) => {
                      window.location.href = `/admin/payments?head=${encodeURIComponent(data.label)}&${buildFilterQS()}`;
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Income vs Expense — Last 6 Months</h3>
              <BasisTag>Accrual</BasisTag>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Ageing — Payables vs Receivables</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ageingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="Payables"
                  stackId="a"
                  fill="#f97316"
                  cursor="pointer"
                  onClick={(data) => {
                    window.location.href = `/admin/liabilities?section=payables&ageing=${data.bucket}&${buildFilterQS()}`;
                  }}
                />
                <Bar
                  dataKey="Receivables"
                  stackId="a"
                  fill="#0ea5e9"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    window.location.href = `/admin/assets?section=receivables&ageing=${data.bucket}&${buildFilterQS()}`;
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 5 — attention list */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Needs Attention</h2>
          <div className="space-y-2">
            <AttentionRow
              label="Overdue payables"
              count={attention?.overduePayables?.count}
              amount={attention?.overduePayables?.amount}
              href={`/admin/liabilities?section=payables&ageing=1-30&${buildFilterQS()}`}
            />
            <AttentionRow
              label="Overdue receivables"
              count={attention?.overdueReceivables?.count}
              amount={attention?.overdueReceivables?.amount}
              href={`/admin/assets?section=receivables&ageing=1-30&${buildFilterQS()}`}
            />
            <AttentionRow
              label="Unreclassified suspense entries"
              count={attention?.suspenseCount}
              href={`/admin/liabilities?section=suspense&${buildFilterQS()}`}
            />
            <AttentionRow
              label="Transactions missing account attribution (all-time)"
              count={attention?.unattributed?.count}
              amount={attention?.unattributed?.amount}
              href="/admin/transactions?furtherMode=__UNTRACKED__"
            />
            {attention && !attention.overduePayables?.count && !attention.overdueReceivables?.count &&
              !attention.suspenseCount && !attention.unattributed?.count && (
                <p className="text-sm text-gray-400 py-2">Nothing needs attention right now.</p>
              )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AttentionRow({ label, count, amount, href }) {
  if (!count) return null;
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">
          {count}
          {amount != null ? ` · ${formatCurrency(amount)}` : ""}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
      </div>
    </Link>
  );
}
