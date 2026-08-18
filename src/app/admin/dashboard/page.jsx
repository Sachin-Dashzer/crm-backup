"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Landmark, ScrollText, Scale, AlertTriangle, ArrowRight, Filter } from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import MetricCard from "@/components/MetricCard";
import AccountMultiSelect from "@/components/finance/AccountMultiSelect";
import { formatCurrency } from "@/lib/financeUI";
import { ACCOUNTS } from "@/constants/bankRouting";

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

export default function AdminDashboard() {
  const router = useRouter();

  // Draft = bound to the filter controls, edited freely. Applied = what every fetch below
  // actually uses. They only converge when Apply is clicked, so changing the period or the
  // account selection doesn't refetch anything until the user says so.
  const [draftPreset, setDraftPreset] = useState("month");
  const [draftCustomRange, setDraftCustomRange] = useState({ from: "", to: "" });
  const [draftAccounts, setDraftAccounts] = useState(ACCOUNTS);

  const [appliedPreset, setAppliedPreset] = useState("month");
  const [appliedCustomRange, setAppliedCustomRange] = useState({ from: "", to: "" });
  const [appliedAccounts, setAppliedAccounts] = useState(ACCOUNTS);

  const isDirty =
    draftPreset !== appliedPreset ||
    draftCustomRange.from !== appliedCustomRange.from ||
    draftCustomRange.to !== appliedCustomRange.to ||
    draftAccounts.length !== appliedAccounts.length ||
    draftAccounts.some((a) => !appliedAccounts.includes(a));

  const applyFilters = () => {
    setAppliedPreset(draftPreset);
    setAppliedCustomRange(draftCustomRange);
    setAppliedAccounts(draftAccounts);
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

  // All 9 cards (Rows 1-3) come from this one effect, keyed only to APPLIED filters — nothing
  // refetches while the user is still adjusting the draft controls.
  useEffect(() => {
    if (!customReady) return;
    let cancelled = false;
    async function run() {
      const accountsQS =
        appliedAccounts.length < ACCOUNTS.length ? `&accounts=${appliedAccounts.join(",")}` : "";

      const [
        cashJson, receivablesJson, payablesJson, suspenseJson,
        pnlJson, priorPnlJson, headJson, ageingPayJson, ageingRecJson, unattributedJson, cashFlowJson,
      ] = await Promise.all([
        // Row 1 balances are AS OF the period's end date (`to` only, no `from`) — a balance
        // sheet figure is a point-in-time position, not a flow, so it reads "everything up to
        // this date" rather than "movement within this date range".
        //
        // No `filter` = every account in ACCOUNTS, including the Bajaj/Fibe loan-financing
        // settlement accounts — those are ordinary asset accounts (money the financier pays the
        // clinic), not a liability, so they belong in this total same as Cash Book/Paytm/etc.
        fetch(`/api/close-book/accounts?to=${iso(to)}`).then((r) => r.json()),
        fetch(`/api/receivables/grouped?level=1&to=${iso(to)}`).then((r) => r.json()),
        fetch(`/api/payables/grouped?level=1&to=${iso(to)}`).then((r) => r.json()),
        fetch(`/api/suspense?groupBy=account&to=${iso(to)}`).then((r) => r.json()),
        // Row 2 — accrual Income/Expense, current period and the prior period of equal length.
        fetch(`/api/close-book/pnl?from=${iso(from)}&to=${iso(to)}${accountsQS}`).then((r) => r.json()),
        fetch(`/api/close-book/pnl?from=${iso(priorFrom)}&to=${iso(priorTo)}${accountsQS}`).then((r) => r.json()),
        fetch(`/api/payables/grouped?level=1&from=${iso(from)}&to=${iso(to)}`).then((r) => r.json()),
        fetch("/api/payables/summary?ageing=1").then((r) => r.json()),
        fetch("/api/receivables/summary?ageing=1").then((r) => r.json()),
        fetch(`/api/close-book/balance-sheet?from=1970-01-01&to=${iso(to)}`).then((r) => r.json()),
        // Row 3 — cash-basis Receipts/Payments for the SAME applied period + accounts.
        fetch(`/api/close-book/cash-flow?from=${iso(from)}&to=${iso(to)}${accountsQS}`).then((r) => r.json()),
      ]);
      if (cancelled) return;

      // Further Mode filter — restrict the account-keyed totals to the applied accounts. Every
      // account selected (the default) is equivalent to no filter at all.
      const inSelection = (row) => appliedAccounts.includes(row.key);
      const cashTotal = (cashJson.rows || []).filter(inSelection).reduce((s, r) => s + (r.closing || 0), 0);
      const receivablesTotal = (receivablesJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0);
      const payablesTotal = (payablesJson.rows || []).reduce((s, r) => s + (r.closing || 0), 0);
      const suspenseTotal = (suspenseJson.rows || []).filter(inSelection).reduce((s, r) => s + (r.closing || 0), 0);

      setAssets({ cashTotal, receivablesTotal, total: cashTotal + receivablesTotal });
      setLiabilities({ payablesTotal, suspenseTotal, total: payablesTotal + suspenseTotal });
      setCashFlow({
        receipts: cashFlowJson.receipts || 0,
        payments: cashFlowJson.payments || 0,
        balanceLeft: cashFlowJson.balanceLeft || 0,
      });
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
    }
    run();
    return () => { cancelled = true; };
  }, [from, to, priorFrom, priorTo, customReady, appliedAccounts]);

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
      const results = await Promise.all(
        months.map((m) =>
          fetch(`/api/transactions/get-all?dateFrom=${iso(m.start)}&dateTo=${iso(m.end)}&limit=1`).then((r) => r.json()),
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
  }, []);

  const netPosition = assets && liabilities ? assets.total - liabilities.total : null;
  const profit = pnl ? pnl.income - pnl.expense : null;
  const priorProfit = priorPnl ? priorPnl.income - priorPnl.expense : null;
  const growth = (curr, prior) => (prior ? Math.round(((curr - prior) / prior) * 100) : 0);

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

  return (
    <div className="flex min-h-screen bg-[#f8f9fc]">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Financial Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Assets, liabilities, and P&amp;L at a glance.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
          </div>
        </div>

        {/* Row 1 — as of {periodLabel}'s end date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            title="Total Assets"
            value={assets ? formatCurrency(assets.total) : "…"}
            icon={Landmark}
            color="from-emerald-500 to-emerald-600"
            onClick={() => router.push("/admin/assets")}
          />
          <MetricCard
            title="Total Liabilities"
            value={liabilities ? formatCurrency(liabilities.total) : "…"}
            icon={ScrollText}
            color="from-rose-500 to-rose-600"
            onClick={() => router.push("/admin/liabilities")}
          />
          <MetricCard
            title="Net Position"
            value={netPosition != null ? formatCurrency(netPosition) : "…"}
            icon={Scale}
            color={netPosition >= 0 ? "from-indigo-500 to-indigo-600" : "from-red-500 to-red-600"}
          />
        </div>

        {/* Row 2 — P&L strip (accrual) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
            Profit &amp; Loss — {periodLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Income = direct sales + receivables raised this period, minus what's double-counted
            against them. Expense = direct expenses + payables raised this period, minus what's
            double-counted against them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Income", value: pnl?.income, prior: priorPnl?.income },
              { label: "Expense", value: pnl?.expense, prior: priorPnl?.expense },
              { label: "Profit", value: profit, prior: priorProfit },
            ].map((row) => (
              <div key={row.label} className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide">{row.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {row.value != null ? formatCurrency(row.value) : "…"}
                </p>
                {row.prior != null && (
                  <p className="text-xs text-gray-400 mt-1">
                    Prior period: {formatCurrency(row.prior)} (
                    {growth(row.value, row.prior) >= 0 ? "+" : ""}
                    {growth(row.value, row.prior)}%)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Row 3 — Cash flow strip (cash basis) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
            Cash Flow — {periodLabel}
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Every positive (Receipts) and negative (Payments) transaction posted to your bank/
            further-mode accounts, excluding internal contra transfers between your own accounts.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-4">
              <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Receipts</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {cashFlow ? formatCurrency(cashFlow.receipts) : "…"}
              </p>
            </div>
            <div className="border border-rose-100 bg-rose-50/40 rounded-xl p-4">
              <p className="text-xs text-rose-700 font-semibold uppercase tracking-wide">Payment</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {cashFlow ? formatCurrency(cashFlow.payments) : "…"}
              </p>
            </div>
            <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4">
              <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wide">Balance Left</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {cashFlow ? formatCurrency(cashFlow.balanceLeft) : "…"}
              </p>
            </div>
          </div>
        </div>

        {/* Row 4 — three charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Expense by Head — Top 10</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={expenseByHead} layout="vertical" margin={{ left: 8, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Bar dataKey="movement" name="Raised" radius={[0, 6, 6, 0]} fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Income vs Expense — Last 6 Months</h3>
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
                <Bar dataKey="Payables" stackId="a" fill="#f97316" />
                <Bar dataKey="Receivables" stackId="a" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
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
              href="/admin/liabilities"
            />
            <AttentionRow
              label="Overdue receivables"
              count={attention?.overdueReceivables?.count}
              amount={attention?.overdueReceivables?.amount}
              href="/admin/assets"
            />
            <AttentionRow
              label="Unreclassified suspense entries"
              count={attention?.suspenseCount}
              href="/admin/liabilities"
            />
            <AttentionRow
              label="Transactions missing account attribution"
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
