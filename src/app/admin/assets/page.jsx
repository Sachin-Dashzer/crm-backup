"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, Banknote, HandCoins, AlertTriangle, ArrowRightLeft, Ban } from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import DrillDownTable from "@/components/finance/DrillDownTable";
import LoanSettlementModal from "@/components/finance/LoanSettlementModal";
import CancelLoanModal from "@/components/finance/CancelLoanModal";
import { ReversedBadge, ReversalBadge } from "@/components/finance/StatusBadges";
import { formatCurrency } from "@/lib/financeUI";

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
  const [cashTotal, setCashTotal] = useState(null);
  const [loansTotal, setLoansTotal] = useState(null);
  const [receivablesTotal, setReceivablesTotal] = useState(null);
  const [unattributed, setUnattributed] = useState(null);
  const [settleTx, setSettleTx] = useState(null); // { transactionId, account, amount, narration, date } | null
  const [cancelTx, setCancelTx] = useState(null); // the row being cancelled, or null
  // Bumped on every successful settlement/cancellation — passed as `key` to BOTH the Loan
  // Accounts AND Cash & Bank DrillDownTables (either action moves money on both sides) so both
  // remount and refetch fresh. Only bumping the loans side left the destination bank account
  // showing stale data until a full page reload, which looked exactly like nothing had happened.
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchLoansTotal = useCallback(() => {
    fetch("/api/close-book/accounts?filter=loans")
      .then((r) => r.json())
      .then((json) => {
        const rows = json.rows || [];
        setLoansTotal(rows.reduce((s, r) => s + (r.closing || 0), 0));
      })
      .catch(() => setLoansTotal(0));
  }, []);

  const fetchCashTotal = useCallback(() => {
    fetch("/api/close-book/accounts?filter=cash")
      .then((r) => r.json())
      .then((json) => {
        const rows = json.rows || [];
        setCashTotal(rows.reduce((s, r) => s + (r.closing || 0), 0));
      })
      .catch(() => setCashTotal(0));
  }, []);

  useEffect(() => {
    fetchCashTotal();
    fetchLoansTotal();

    fetch("/api/receivables/grouped?level=1")
      .then((r) => r.json())
      .then((json) => {
        const rows = json.rows || [];
        setReceivablesTotal(rows.reduce((s, r) => s + (r.closing || 0), 0));
      })
      .catch(() => setReceivablesTotal(0));

    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/close-book/balance-sheet?from=1970-01-01&to=${today}`)
      .then((r) => r.json())
      .then((json) => setUnattributed(json.unattributed || { count: 0, amount: 0 }))
      .catch(() => setUnattributed({ count: 0, amount: 0 }));
  }, [fetchLoansTotal, fetchCashTotal]);

  const handleSettlementSuccess = () => {
    fetchLoansTotal();
    fetchCashTotal();
    // DrillDownTable has no external refresh hook, so a key bump is the clean way to force both
    // subtrees to remount and refetch — see the refreshKey comment above.
    setRefreshKey((k) => k + 1);
    setTimeout(() => setSettleTx(null), 1200);
  };

  const handleCancelDone = () => {
    fetchLoansTotal();
    fetchCashTotal();
    setRefreshKey((k) => k + 1);
  };

  const total = (cashTotal ?? 0) + (loansTotal ?? 0) + (receivablesTotal ?? 0);
  const loaded = cashTotal !== null && loansTotal !== null && receivablesTotal !== null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assets</h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything the business owns or is owed — cash &amp; bank balances plus outstanding
              receivables.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Assets</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {loaded ? formatCurrency(total) : "…"}
            </p>
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
              renderLeafRowActions={(row) => {
                // A reversal row (negative amount, points at the original) or an original that
                // has already been fully reversed gets a badge instead of Settle/Cancel — you
                // can't settle or re-cancel a loan that's already been undone.
                if (row.reversalOf) return <ReversalBadge reason={row.reversalReason} />;
                if (row.isReversed) return <ReversedBadge />;
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSettleTx({
                          transactionId: row._id,
                          account: row.account,
                          amount: row.amount,
                          narration: row.narration,
                          date: row.date,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Settle
                    </button>
                    <button
                      onClick={() => setCancelTx(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100"
                    >
                      <Ban className="w-3.5 h-3.5" /> Cancel Loan
                    </button>
                  </div>
                );
              }}
            />
          </section>

          {settleTx && (
            <LoanSettlementModal
              fromAccount={settleTx.account}
              defaultAmount={settleTx.amount}
              contextLabel={settleTx.narration}
              sourceTransactionId={settleTx.transactionId}
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

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Receivables</h2>
            </div>
            <DrillDownTable
              levels={3}
              sectionConfig={{
                key: "receivables",
                apiBase: "/api/receivables",
                title: "Receivables",
                columnLabels: {
                  opening: "Opening due",
                  movement: "Raised",
                  settled: "Received",
                  closing: "Still due",
                },
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
