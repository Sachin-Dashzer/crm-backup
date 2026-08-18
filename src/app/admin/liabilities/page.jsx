"use client";

import { Suspense, useEffect, useState } from "react";
import { Wallet, HelpCircle } from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import DrillDownTable from "@/components/finance/DrillDownTable";
import { formatCurrency } from "@/lib/financeUI";

// Liabilities = Payables + Suspense (unresolved unexplained bank movement — a liability until
// it's identified, since it's money we can't yet say we own). Page total is the sum of the same
// two closing figures the sections below compute.
//
// NOTE: "Bajaj Loan"/"Fibe Loan" in ACCOUNTS are NOT a liability here — they're patient-financing
// SETTLEMENT accounts (money the financier pays the clinic when a patient pays via that loan
// product), functionally identical to Cash Book/Paytm/etc. That balance belongs on the Assets
// page's Cash & Bank section, not here.
//
// See the identical Suspense-boundary note in admin/assets/page.jsx — DrillDownTable's
// AccountingTable leaf uses useSearchParams internally.
export default function LiabilitiesPage() {
  return (
    <Suspense fallback={null}>
      <LiabilitiesPageInner />
    </Suspense>
  );
}

function LiabilitiesPageInner() {
  const [payablesTotal, setPayablesTotal] = useState(null);
  const [suspenseTotal, setSuspenseTotal] = useState(null);

  useEffect(() => {
    fetch("/api/payables/grouped?level=1")
      .then((r) => r.json())
      .then((json) => {
        const rows = json.rows || [];
        setPayablesTotal(rows.reduce((s, r) => s + (r.closing || 0), 0));
      })
      .catch(() => setPayablesTotal(0));

    fetch("/api/suspense?groupBy=account")
      .then((r) => r.json())
      .then((json) => {
        const rows = json.rows || [];
        setSuspenseTotal(rows.reduce((s, r) => s + (r.closing || 0), 0));
      })
      .catch(() => setSuspenseTotal(0));
  }, []);

  const loaded = payablesTotal !== null && suspenseTotal !== null;
  const total = (payablesTotal ?? 0) + (suspenseTotal ?? 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Liabilities</h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything the business owes — payables and unresolved suspense entries.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Liabilities</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {loaded ? formatCurrency(total) : "…"}
            </p>
            <div className="flex flex-wrap gap-6 mt-3 text-sm text-gray-500">
              <span>Payables: <strong className="text-gray-800">{loaded ? formatCurrency(payablesTotal) : "…"}</strong></span>
              <span>Suspense: <strong className="text-gray-800">{loaded ? formatCurrency(suspenseTotal) : "…"}</strong></span>
            </div>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Payables</h2>
            </div>
            <DrillDownTable
              levels={3}
              sectionConfig={{
                key: "payables",
                apiBase: "/api/payables",
                title: "Payables",
                columnLabels: {
                  opening: "Opening due",
                  movement: "Raised",
                  settled: "Paid",
                  closing: "Still owed",
                },
              }}
            />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Suspense</h2>
            </div>
            <DrillDownTable
              levels={2}
              sectionConfig={{
                key: "suspense",
                apiBase: "/api/suspense",
                title: "Suspense",
                columnLabels: {
                  opening: "Opening",
                  movement: "Received",
                  settled: "Reclassified",
                  closing: "Unresolved",
                },
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
