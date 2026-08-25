"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";
import DrillDownTable from "@/components/finance/DrillDownTable";
import { formatCurrency } from "@/lib/financeUI";
import DebouncedDateInput from "@/components/finance/DebouncedDateInput";

// Receipts & Payments is the missing cash-basis statement, and it is the mirror of the P&L.
// Its inclusion rule is the EXACT INVERSE of the P&L's:
//
//                                        | P&L      | Receipts & Payments
//   isSettlement: true                  | EXCLUDE  | INCLUDE — cash genuinely moved
//   paid_to_external / paid_by_other    | EXCLUDE  | EXCLUDE — cash never touched us
//   offset_settlement, including-package| INCLUDE  | EXCLUDE — no cash moved
//   reversals (negative rows)           | INCLUDE  | INCLUDE — they net out correctly
//
// See src/lib/cashFlowAggregation.js for the shared match/bucketing this page and /admin/receipts
// both call through — nothing here re-derives that rule. This page is the cash-OUT half; see
// /admin/receipts for the cash-IN half and the shared reconciliation strip logic.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageInner />
    </Suspense>
  );
}

function PaymentsPageInner() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayStr());
  const [recon, setRecon] = useState(null);
  const [receiptsTotal, setReceiptsTotal] = useState(null);
  const [paymentsTotal, setPaymentsTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/receipts-payments/reconciliation?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/receipts/grouped?level=1&from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`/api/payments/grouped?level=1&from=${from}&to=${to}`).then((r) => r.json()),
    ])
      .then(([r, receipts, payments]) => {
        setRecon(r);
        setReceiptsTotal((receipts.rows || []).reduce((s, x) => s + (x.movement || 0), 0));
        setPaymentsTotal((payments.rows || []).reduce((s, x) => s + (x.movement || 0), 0));
      })
      .catch(() => setRecon(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  const expected =
    recon && receiptsTotal !== null && paymentsTotal !== null
      ? round2(recon.opening + receiptsTotal - paymentsTotal + recon.contraNet + recon.suspenseNet)
      : null;
  const delta = recon && expected !== null ? round2(expected - recon.closing) : 0;
  const matches = recon && Math.abs(delta) < 0.01;

  const handleExport = async () => {
    setExporting(true);
    try {
      const json = await fetch(`/api/payments/grouped?level=1&from=${from}&to=${to}`).then((r) => r.json());
      const rows = (json.rows || []).map((r) => ({
        "Expense Head": r.label,
        "Before Period": r.opening,
        "This Period": r.movement,
        "Total To Date": r.closing,
        Count: r.count,
      }));
      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }];
      utils.book_append_sheet(wb, ws, "Payments");
      writeFile(wb, `payments_${from}_to_${to}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Payments</h1>
              <p className="text-sm text-gray-500 mt-1">
                Every rupee that actually left a cash or bank account — pure cash basis, the
                mirror of Receipts.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export
            </button>
          </div>

          {/* ── Reconciliation strip — identical math to /admin/receipts, same period tied to
              the same Close Book cash figure. Kept as its own fetch (not shared state) so
              either page can be opened standalone without the other having run first. ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Period</span>
              {/* Debounced — see the identical note in admin/receipts/page.jsx. */}
              <DebouncedDateInput
                value={from}
                onCommit={setFrom}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
              />
              <span className="text-gray-400 text-xs">to</span>
              <DebouncedDateInput
                value={to}
                onCommit={setTo}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs"
              />
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Reconciling…</p>
            ) : recon ? (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span>Opening: <strong className="text-gray-900">{formatCurrency(recon.opening)}</strong></span>
                <span className="text-emerald-700">+Receipts: <strong>{formatCurrency(receiptsTotal)}</strong></span>
                <span className="text-rose-700">−Payments: <strong>{formatCurrency(paymentsTotal)}</strong></span>
                {recon.contraNet !== 0 && (
                  <span className="text-sky-700">
                    {recon.contraNet > 0 ? "+" : ""}Contra: <strong>{formatCurrency(recon.contraNet)}</strong>
                  </span>
                )}
                {recon.suspenseNet !== 0 && (
                  <span className="text-amber-700">
                    {recon.suspenseNet > 0 ? "+" : ""}Suspense: <strong>{formatCurrency(recon.suspenseNet)}</strong>
                  </span>
                )}
                <span>=Closing: <strong className="text-gray-900">{formatCurrency(recon.closing)}</strong></span>
                {matches ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> matches Close Book
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                    <AlertTriangle className="w-4 h-4" /> off by {formatCurrency(Math.abs(delta))}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Reconciliation unavailable.</p>
            )}

            {!loading && recon && !matches && (
              <Link
                href="/admin/transactions?furtherMode=__UNTRACKED__"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Review untracked transactions
              </Link>
            )}
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Payments</h2>
            </div>
            <DrillDownTable
              levels={3}
              sectionConfig={{
                key: "payments",
                mode: "grouped",
                apiBase: "/api/payments",
                title: "Payments",
                columnLabels: {
                  opening: "Before this period",
                  movement: "This period",
                  settled: "—",
                  closing: "Total to date",
                },
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
