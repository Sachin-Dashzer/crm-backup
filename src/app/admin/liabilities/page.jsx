"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Wallet, HelpCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import DrillDownTable from "@/components/finance/DrillDownTable";
import MetricCard from "@/components/MetricCard";
import { formatCurrency } from "@/lib/financeUI";
import { AGEING_BUCKETS } from "@/lib/ageing";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [payablesTotal, setPayablesTotal] = useState(null);
  const [suspenseTotal, setSuspenseTotal] = useState(null);

  // Task 5, Step 4 — summary strip + ageing chips, ported from the old standalone Payables page.
  const [summary, setSummary] = useState(null);
  const [ageingBuckets, setAgeingBuckets] = useState([]);
  const [ageingFilter, setAgeingFilter] = useState("");

  // Task 5, Step 5 — deep-link restore. `undefined` = not resolved yet (don't render the table
  // and risk a flash at level 1 before jumping to the right level); `null` = resolved, nothing
  // to restore.
  const [payablesInitialDrill, setPayablesInitialDrill] = useState(undefined);

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

    fetch("/api/payables/summary")
      .then((r) => r.json())
      .then((json) => setSummary(json.overall || null))
      .catch(() => setSummary(null));

    fetch("/api/payables/summary?ageing=1")
      .then((r) => r.json())
      .then((json) => setAgeingBuckets(json.byBucket || []))
      .catch(() => setAgeingBuckets([]));
  }, []);

  // Restores /admin/liabilities?section=payables&head=Rent&sub=Office%20Rent&doc=<id> — the URL
  // Task 1's Entry Type badge points at for a settlement's linked payable. `doc` alone (no
  // head/sub) is resolved by reading the document itself, since its head/sub aren't derivable
  // from the URL.
  useEffect(() => {
    const section = searchParams.get("section");
    if (section !== "payables") {
      setPayablesInitialDrill(null);
      return;
    }
    const head = searchParams.get("head") || "";
    const sub = searchParams.get("sub") || "";
    const doc = searchParams.get("doc") || "";

    if (doc) {
      fetch(`/api/payables/${doc}`)
        .then((r) => r.json())
        .then((json) => {
          const p = json.payable;
          if (!p) {
            setPayablesInitialDrill(null);
            return;
          }
          setPayablesInitialDrill({
            level: 3,
            headKey: p.expenseCategory,
            headLabel: p.expenseCategory,
            subKey: p.expenseSubType || "",
            subLabel: p.expenseSubType || "",
          });
        })
        .catch(() => setPayablesInitialDrill(null));
    } else if (sub) {
      setPayablesInitialDrill({ level: 3, headKey: head, headLabel: head, subKey: sub, subLabel: sub });
    } else if (head) {
      setPayablesInitialDrill({ level: 2, headKey: head, headLabel: head });
    } else {
      setPayablesInitialDrill(null);
    }
    // Deliberately once, on mount — the URL is the initial state, not a controlled binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePayablesDrillChange = useCallback(
    (drill) => {
      const params = new URLSearchParams();
      if (drill.level > 1) {
        params.set("section", "payables");
        if (drill.headKey) params.set("head", drill.headKey);
        if (drill.subKey) params.set("sub", drill.subKey);
        if (drill.documentId) params.set("doc", drill.documentId);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const ageingChipData = (bucket) => {
    const found = ageingBuckets.find((b) => b._id === bucket.value);
    return { count: found?.count || 0, totalPending: found?.totalPending || 0 };
  };

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

          {summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Owed" value={formatCurrency(summary.totalOwed)} icon={Wallet} color="from-indigo-500 to-indigo-600" />
              <MetricCard title="Total Paid" value={formatCurrency(summary.totalPaid)} icon={CheckCircle2} color="from-emerald-500 to-emerald-600" />
              <MetricCard title="Total Pending" value={formatCurrency(summary.totalPending)} icon={Clock} color="from-amber-500 to-amber-600" />
              <MetricCard title="Active Payables" value={summary.count ?? 0} icon={AlertTriangle} color="from-rose-500 to-rose-600" />
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
                        ? "bg-indigo-600 text-white border-indigo-600"
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
              <Wallet className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Payables</h2>
            </div>
            {payablesInitialDrill !== undefined && (
              <DrillDownTable
                levels={3}
                sectionConfig={{
                  key: "payables",
                  mode: "documents",
                  apiBase: "/api/payables",
                  title: "Payables",
                  columnLabels: {
                    opening: "Opening due",
                    movement: "Raised",
                    settled: "Paid",
                    closing: "Still owed",
                  },
                }}
                initialDrill={payablesInitialDrill || undefined}
                onDrillChange={handlePayablesDrillChange}
                extraParams={ageingFilter ? { ageing: ageingFilter } : undefined}
              />
            )}
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
