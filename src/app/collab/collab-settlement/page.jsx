"use client";

import { Fragment, useEffect, useState } from "react";
import CollabSidebar from "@/components/Sidebars/CollabSidebar";
import MetricCard from "@/components/MetricCard";
import BankRoutingFields from "@/components/BankRoutingFields";
import { REVENUE_METHODS } from "@/constants/paymentMethods";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import {
  Building2,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Loader2,
  User,
  Wallet,
  CreditCard,
  StickyNote,
  AlertTriangle,
  CheckCircle2,
  Percent,
  IndianRupee,
} from "lucide-react";

// The collab panel's read-oriented view of the same running account with partner clinics that
// /admin/collab-settlement shows. Deliberately NOT a copy of the admin page:
//
//   - No "Settle clinic" button. A settlement is an actual payment decision between the org and
//     a partner clinic; settlements/create stays admin-only and the button would only 403 here.
//   - No delete. Same reason, enforced server-side by settlements/[id].
//   - Recording a clinic collection IS available — the collab team enters the case, so they are
//     the ones who know what the patient later handed the clinic. That endpoint only appends to
//     clinicCollections; it never creates a Transaction or moves Patient.payments.
//
// Everything here reads through the same APIs the admin page uses, so the two can't drift.

const DEFAULT_CASE_FILTERS = { search: "", status: "", dateFrom: "", dateTo: "" };
const CASE_LIMIT = 20;

export default function CollabSettlementPage() {
  const toast = useToast();

  const [balances, setBalances] = useState([]);
  const [totals, setTotals] = useState({ totalReceivable: 0, totalPayable: 0 });
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [clinicSearch, setClinicSearch] = useState("");

  const [expandedClinic, setExpandedClinic] = useState(null);
  const [clinicCases, setClinicCases] = useState([]);
  const [caseTotal, setCaseTotal] = useState(0);
  const [casesLoading, setCasesLoading] = useState(false);
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [caseFilters, setCaseFilters] = useState(DEFAULT_CASE_FILTERS);
  const [casePage, setCasePage] = useState(1);

  const [collectionModalCase, setCollectionModalCase] = useState(null);

  const [settlements, setSettlements] = useState([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);

  const fetchBalances = async () => {
    setBalancesLoading(true);
    try {
      const res = await fetch("/api/collab-settlement/balances");
      const data = await res.json();
      if (res.ok) {
        setBalances(data.balances || []);
        setTotals({
          totalReceivable: data.totalReceivable || 0,
          totalPayable: data.totalPayable || 0,
        });
      } else {
        toast.error(data.error || "Failed to load balances");
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast.error("Failed to load balances");
    } finally {
      setBalancesLoading(false);
    }
  };

  const fetchCasesForClinic = async (clinic, filters, page) => {
    setCasesLoading(true);
    try {
      const params = new URLSearchParams({ clinic, page: String(page), limit: String(CASE_LIMIT) });
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const res = await fetch(`/api/collab-settlement/cases?${params}`);
      const data = await res.json();
      if (res.ok) {
        setClinicCases(data.cases || []);
        setCaseTotal(data.total || 0);
      } else {
        toast.error(data.error || "Failed to load cases");
      }
    } catch (error) {
      console.error("Error fetching cases:", error);
      toast.error("Failed to load cases");
    } finally {
      setCasesLoading(false);
    }
  };

  const fetchSettlements = async (clinic) => {
    setSettlementsLoading(true);
    try {
      const res = await fetch(
        `/api/collab-settlement/settlements?clinic=${encodeURIComponent(clinic)}&limit=50`,
      );
      const data = await res.json();
      if (res.ok) setSettlements(data.settlements || []);
    } catch (error) {
      console.error("Error fetching settlements:", error);
    } finally {
      setSettlementsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  useEffect(() => {
    if (expandedClinic) fetchCasesForClinic(expandedClinic, caseFilters, casePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedClinic, caseFilters, casePage]);

  useEffect(() => {
    if (expandedClinic) fetchSettlements(expandedClinic);
    else setSettlements([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedClinic]);

  const toggleClinic = (clinic) => {
    if (expandedClinic === clinic) {
      setExpandedClinic(null);
      setClinicCases([]);
      return;
    }
    setExpandedClinic(clinic);
    setExpandedCaseId(null);
    setCaseFilters(DEFAULT_CASE_FILTERS);
    setCasePage(1);
  };

  const handleCaseFilterChange = (key, value) => {
    setCasePage(1);
    setCaseFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearCaseFilters = () => {
    setCasePage(1);
    setCaseFilters(DEFAULT_CASE_FILTERS);
  };

  const refreshAfterChange = () => {
    fetchBalances();
    if (expandedClinic) {
      fetchCasesForClinic(expandedClinic, caseFilters, casePage);
      fetchSettlements(expandedClinic);
    }
  };

  const activeBalances = balances.filter((b) => b.netPosition !== 0 || b.caseCount > 0);
  const visibleBalances = clinicSearch
    ? activeBalances.filter((b) => b.clinic.toLowerCase().includes(clinicSearch.toLowerCase()))
    : activeBalances;
  const caseTotalPages = Math.max(1, Math.ceil(caseTotal / CASE_LIMIT));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <CollabSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Collab Clinic Settlement</h1>
            <p className="text-sm text-gray-500 mt-1">
              Running account with partner clinics — who owes whom, and how much
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <MetricCard
              title="Total Receivable (clinics owe us)"
              value={formatCurrency(totals.totalReceivable)}
              icon={TrendingUp}
              color="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              title="Total Payable (we owe clinics)"
              value={formatCurrency(totals.totalPayable)}
              icon={TrendingDown}
              color="from-rose-500 to-rose-600"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
            Settling a clinic is done by the admin team — this view is for tracking each clinic&apos;s
            position and recording what patients have paid the clinic directly.
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clinicSearch}
                onChange={(e) => setClinicSearch(e.target.value)}
                placeholder="Search clinic…"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm sm:max-w-xs"
              />
            </div>
          </div>

          {balancesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : activeBalances.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-500 text-sm">
              No collab cases yet.
            </div>
          ) : visibleBalances.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 text-center py-16 text-gray-500 text-sm">
              No clinics match &quot;{clinicSearch}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleBalances.map((b) => (
                <ClinicCard
                  key={b.clinic}
                  balance={b}
                  expanded={expandedClinic === b.clinic}
                  onToggle={() => toggleClinic(b.clinic)}
                />
              ))}
            </div>
          )}

          {expandedClinic && (
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">{expandedClinic} — Cases</h3>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative lg:col-span-2">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={caseFilters.search}
                      onChange={(e) => handleCaseFilterChange("search", e.target.value)}
                      placeholder="Search patient…"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <select
                    value={caseFilters.status}
                    onChange={(e) => handleCaseFilterChange("status", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="SETTLED">Settled</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={caseFilters.dateFrom}
                      onChange={(e) => handleCaseFilterChange("dateFrom", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                    <input
                      type="date"
                      value={caseFilters.dateTo}
                      onChange={(e) => handleCaseFilterChange("dateTo", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
                {(caseFilters.search ||
                  caseFilters.status ||
                  caseFilters.dateFrom ||
                  caseFilters.dateTo) && (
                  <button
                    onClick={clearCaseFilters}
                    className="mt-2 text-xs font-medium text-indigo-700 hover:text-indigo-800"
                  >
                    Clear all filters
                  </button>
                )}
              </div>

              {casesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              ) : clinicCases.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No cases match these filters.
                </p>
              ) : (
                <>
                  <div className="sm:hidden divide-y divide-gray-100">
                    {clinicCases.map((c) => (
                      <div key={c._id} className="py-3">
                        <button
                          onClick={() => setExpandedCaseId(expandedCaseId === c._id ? null : c._id)}
                          className="flex items-center justify-between w-full text-left mb-2"
                        >
                          <span className="font-medium text-gray-900 truncate flex items-center gap-1.5">
                            {expandedCaseId === c._id ? (
                              <ChevronUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0" />
                            )}
                            {c.patientName || "Unknown"}
                          </span>
                          <StatusBadge status={c.status} />
                        </button>
                        {c.paidToClinic > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                            Patient paid · {formatCurrency(c.paidToClinic)} with clinic
                          </span>
                        )}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                          <span>Package {formatCurrency(c.packageAmount)}</span>
                          <span className="text-right">
                            Clinic Share {formatCurrency(c.clinicShare)}
                          </span>
                          <span>Collected (us) {formatCurrency(c.collectedByUs)}</span>
                          <span className="text-right">
                            Collected (clinic) {formatCurrency(c.collectedByClinic)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-gray-500">Outstanding </span>
                            <span className="font-semibold text-amber-700">
                              {formatCurrency(c.patientOutstanding)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Case Net </span>
                            {c.clinicShareSettledAt ? (
                              <span
                                className={`font-bold ${
                                  c.caseNet > 0
                                    ? "text-emerald-700"
                                    : c.caseNet < 0
                                      ? "text-rose-600"
                                      : "text-gray-500"
                                }`}
                              >
                                {formatCurrency(c.caseNet)}
                              </span>
                            ) : (
                              <span className="font-medium text-gray-400 italic">Pending completion</span>
                            )}
                          </div>
                        </div>
                        {c.status === "OPEN" && (
                          <div className="flex justify-end mt-2">
                            <button
                              onClick={() => setCollectionModalCase(c)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100"
                            >
                              Record Collection
                            </button>
                          </div>
                        )}
                        {expandedCaseId === c._id && (
                          <div className="mt-3">
                            <CaseHistory collabCase={c} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-600">Patient</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Package</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">
                            Clinic Share
                          </th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">
                            Collected by Us
                          </th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">
                            Collected by Clinic
                          </th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">
                            Patient Outstanding
                          </th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Case Net</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                          <th className="text-right px-3 py-2 font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {clinicCases.map((c) => (
                          <Fragment key={c._id}>
                            <tr className="hover:bg-gray-50/60">
                              <td className="px-3 py-2">
                                <button
                                  onClick={() =>
                                    setExpandedCaseId(expandedCaseId === c._id ? null : c._id)
                                  }
                                  className="flex items-center gap-1.5 text-left font-medium text-gray-900 hover:text-indigo-600"
                                >
                                  {expandedCaseId === c._id ? (
                                    <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                                  )}
                                  <span className="truncate max-w-37.5">
                                    {c.patientName || "Unknown"}
                                  </span>
                                </button>
                                {c.paidToClinic > 0 && (
                                  <span
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    title="Patient has paid this amount directly to the partner clinic. It is not reflected on the patient's payment record until the clinic settles — do not chase the patient for it."
                                  >
                                    Patient paid · {formatCurrency(c.paidToClinic)} with clinic
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatCurrency(c.packageAmount)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {formatCurrency(c.clinicShare)}
                              </td>
                              <td className="px-3 py-2 text-right text-emerald-700">
                                {formatCurrency(c.collectedByUs)}
                              </td>
                              <td className="px-3 py-2 text-right text-indigo-700">
                                {formatCurrency(c.collectedByClinic)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-amber-700">
                                {formatCurrency(c.patientOutstanding)}
                              </td>
                              <td
                                className={
                                  c.clinicShareSettledAt
                                    ? `px-3 py-2 text-right font-bold ${
                                        c.caseNet > 0
                                          ? "text-emerald-700"
                                          : c.caseNet < 0
                                            ? "text-rose-600"
                                            : "text-gray-500"
                                      }`
                                    : "px-3 py-2 text-right font-medium text-gray-400 italic"
                                }
                              >
                                {c.clinicShareSettledAt ? formatCurrency(c.caseNet) : "Pending completion"}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={c.status} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                {c.status === "OPEN" && (
                                  <button
                                    onClick={() => setCollectionModalCase(c)}
                                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100"
                                  >
                                    Record Collection
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedCaseId === c._id && (
                              <tr>
                                <td colSpan={9} className="px-3 pb-4 bg-gray-50/60">
                                  <CaseHistory collabCase={c} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {!casesLoading && clinicCases.length > 0 && caseTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Page {casePage} of {caseTotalPages} · {caseTotal} total
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCasePage((p) => Math.max(1, p - 1))}
                      disabled={casePage <= 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCasePage((p) => Math.min(caseTotalPages, p + 1))}
                      disabled={casePage >= caseTotalPages}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Read-only here — deleting a settlement is admin-only, enforced server-side. */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <h4 className="text-sm font-bold text-gray-900 mb-3">
                  Settlement History ({settlements.length})
                </h4>
                {settlementsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  </div>
                ) : settlements.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No settlements recorded with {expandedClinic} yet.
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {settlements.map((s) => (
                      <div key={s._id} className="px-3 py-2.5">
                        <p className="text-sm font-medium text-gray-900">
                          <span
                            className={
                              s.direction === "THEY_PAID" ? "text-emerald-700" : "text-rose-600"
                            }
                          >
                            {s.direction === "THEY_PAID" ? "They paid us" : "We paid them"}
                          </span>{" "}
                          {formatCurrency(s.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(s.date)} · {(s.mode || "—").replace(/_/g, " ").toUpperCase()}
                          {s.reference ? ` · ${s.reference}` : ""}
                        </p>
                        {s.remarks && (
                          <p className="text-xs text-gray-400 italic mt-0.5">{s.remarks}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {collectionModalCase && (
        <RecordCollectionModal
          collabCase={collectionModalCase}
          onClose={() => setCollectionModalCase(null)}
          onSuccess={() => {
            setCollectionModalCase(null);
            refreshAfterChange();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function ClinicCard({ balance, expanded, onToggle }) {
  const { clinic, netPosition, openCaseCount, caseCount } = balance;
  const isReceivable = netPosition > 0;
  const isPayable = netPosition < 0;

  return (
    <button
      onClick={onToggle}
      className={`text-left bg-white rounded-xl shadow-sm border p-5 transition-all hover:shadow-md ${
        expanded ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-900">{clinic}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <p
        className={`text-xl font-bold ${
          isReceivable ? "text-emerald-600" : isPayable ? "text-rose-600" : "text-gray-500"
        }`}
      >
        {isReceivable && `Clinic owes us ${formatCurrency(netPosition)}`}
        {isPayable && `We owe clinic ${formatCurrency(Math.abs(netPosition))}`}
        {!isReceivable && !isPayable && "Square"}
      </p>
      <p className="text-xs text-gray-500 mt-2">
        {openCaseCount} open · {caseCount} total case{caseCount === 1 ? "" : "s"}
      </p>
    </button>
  );
}

function CaseHistory({ collabCase }) {
  const collections = collabCase.clinicCollections || [];
  const log = collabCase.log || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Clinic Collections ({collections.length})
        </h4>
        {collections.length === 0 ? (
          <p className="text-sm text-gray-400">No collections recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...collections].reverse().map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {formatCurrency(c.amount)}
                    {c.discount > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-amber-600">
                        + {formatCurrency(c.discount)} discount
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(c.date)} · {(c.mode || "—").replace(/_/g, " ").toUpperCase()}
                    {c.reference ? ` · ${c.reference}` : ""}
                    {c.furtherMode ? ` · ${c.furtherMode}` : ""}
                  </p>
                  {c.note && <p className="text-xs text-gray-400 italic mt-0.5">{c.note}</p>}
                </div>
                <p className="text-xs text-gray-500 text-right shrink-0 ml-3">
                  {c.recordedBy?.name || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Activity Log ({log.length})
        </h4>
        {log.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...log].reverse().map((entry, i) => (
              <li key={i} className="text-sm border-b border-gray-50 pb-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{entry.action}</span>
                  <span className="text-xs text-gray-500">{formatDate(entry.performedAt)}</span>
                </div>
                {entry.previousValue && (
                  <p className="text-xs text-gray-500">
                    {entry.previousValue} → {entry.newValue}
                  </p>
                )}
                {entry.note && <p className="text-xs text-gray-400 italic mt-0.5">{entry.note}</p>}
                <p className="text-xs text-gray-400 mt-0.5">by {entry.performedBy?.name || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecordCollectionModal({ collabCase, onClose, onSuccess, toast }) {
  // Which side actually took the money — the same split collabDerivation.js's
  // createCollectionTransaction makes for the amounts entered at case creation. Defaults to
  // CLINIC, the original and still most common case: the patient paying the clinic directly is
  // why this modal existed in the first place.
  const [collectedBy, setCollectedBy] = useState("CLINIC");
  const [amount, setAmount] = useState("");
  // Pre-fills `amount` to the patient's full remaining outstanding and locks it — the shortcut
  // for "this collection completes the case", mirroring CollabCaseForm's own checkbox.
  const [fullPackage, setFullPackage] = useState(false);
  // A waiver granted at the time of this collection — reduces the patient's outstanding the
  // same as a payment would, but is never money collected (see the model comment on
  // clinicCollections.discount).
  const [discount, setDiscount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  // Sent as `mode` (collectedBy:"CLINIC" — descriptive only) or `method` (collectedBy:"US" — the
  // real payment method) depending on which side is selected; one field covers both since they
  // draw from the same REVENUE_METHODS list.
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  // collectedBy:"CLINIC" — descriptive routing detail only (which instrument, which account, on
  // the CLINIC's side); never touches our own accounts/books, though it DOES book real revenue
  // (a paid_to_external Transaction, see collabDerivation.js). collectedBy:"US" — this is a real
  // cash-in, exactly like a direct payment, so these fields route it into one of OUR OWN
  // accounts the normal way.
  const [receiptMode, setReceiptMode] = useState("");
  const [furtherMode, setFurtherMode] = useState("");
  const [note, setNote] = useState("");
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Deliberate override, not a continuous lock: checking pre-fills once; unchecking just leaves
  // the current value editable rather than resetting it.
  useEffect(() => {
    if (fullPackage) setAmount(String(collabCase.patientOutstanding || 0));
  }, [fullPackage, collabCase.patientOutstanding]);

  const overBalance = parseFloat(amount || 0) + parseFloat(discount || 0) > collabCase.patientOutstanding;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid collection amount");
      return;
    }
    if (parseFloat(discount || 0) < 0) {
      toast.error("Discount cannot be negative");
      return;
    }
    if (overBalance && !allowOverpayment) {
      toast.error("Amount + discount exceeds patient's remaining outstanding — check the box to proceed anyway");
      return;
    }
    // Same requirement as every other payment-entry form in the app — cash is the only method
    // with no independently-verifiable trail, everything else needs one.
    if (paymentMethod !== "cash" && !reference.trim()) {
      toast.error("Enter the transaction ID / reference for this collection");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/collab-settlement/cases/${collabCase._id}/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          discount,
          date,
          collectedBy,
          method: collectedBy === "US" ? paymentMethod : undefined,
          mode: collectedBy === "CLINIC" ? paymentMethod : undefined,
          reference,
          receiptMode,
          furtherMode,
          note,
          allowOverpayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Collection recorded");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to record collection");
      }
    } catch (error) {
      console.error("Error recording collection:", error);
      toast.error("Failed to record collection");
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase =
    "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400";

  const SectionLabel = ({ children }) => (
    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{children}</p>
  );

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Record Collection</h3>
              <p className="text-xs text-gray-500">{collabCase.patientName || "Patient"} · {collabCase.clinic}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6 overflow-y-auto">
          {/* Who collected */}
          <div>
            <SectionLabel>Who collected this?</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCollectedBy("CLINIC")}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  collectedBy === "CLINIC"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-400 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{collabCase.clinic}</span>
              </button>
              <button
                type="button"
                onClick={() => setCollectedBy("US")}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  collectedBy === "US"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-400 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                Us directly
              </button>
            </div>

            {collectedBy === "CLINIC" ? (
              <div className="flex gap-2.5 mt-3 bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
                <Building2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-indigo-800">
                  Money <strong>{collabCase.patientName || "the patient"}</strong> paid directly to{" "}
                  <strong>{collabCase.clinic}</strong> — not to us. Still books revenue right now,
                  it just never lands in one of our own cash/bank accounts.
                </p>
              </div>
            ) : (
              <div className="flex gap-2.5 mt-3 bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                <User className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-emerald-800">
                  Money <strong>{collabCase.patientName || "the patient"}</strong> paid{" "}
                  <strong>us directly</strong> — an ordinary payment. Lands in one of our own
                  accounts below and updates the patient&apos;s own payment record.
                </p>
              </div>
            )}
          </div>

          {/* Amount */}
          <div>
            <SectionLabel>Amount</SectionLabel>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" /> Patient outstanding
                </span>
                <span className="font-bold text-amber-700">{formatCurrency(collabCase.patientOutstanding)}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Paid {collectedBy === "US" ? "to us directly" : `to ${collabCase.clinic}`}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    disabled={fullPackage}
                    className={`${inputBase} pl-7 text-base font-semibold`}
                    placeholder="0"
                  />
                </div>
              </div>

              <label
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  fullPackage ? "bg-indigo-50 border-indigo-300" : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={fullPackage}
                  onChange={(e) => setFullPackage(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4 shrink-0"
                />
                <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${fullPackage ? "text-indigo-600" : "text-gray-300"}`} />
                <span className={`text-xs font-medium ${fullPackage ? "text-indigo-800" : "text-gray-600"}`}>
                  This completes the case — pay the full remaining outstanding
                </span>
              </label>

              {overBalance && (
                <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-amber-300 bg-amber-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverpayment}
                    onChange={(e) => setAllowOverpayment(e.target.checked)}
                    className="accent-amber-600 w-4 h-4 shrink-0"
                  />
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-amber-800">
                    Exceeds patient&apos;s outstanding balance — allow anyway
                  </span>
                </label>
              )}

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                  <Percent className="w-3 h-3" /> Discount / Waiver (₹)
                </label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  min="0"
                  className={inputBase}
                  placeholder="0"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Reduces the patient&apos;s outstanding without being money collected — not part of the amount above.
                </p>
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div>
            <SectionLabel>Payment Details</SectionLabel>
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
                    <CreditCard className="w-3 h-3" /> Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={inputBase}
                  >
                    {[...REVENUE_METHODS, { value: "other", label: "Other" }].map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <BankRoutingFields
                  costType="Revenue"
                  branch={collabCase.clinic}
                  transactionCategory="TRANSPLANT"
                  method={paymentMethod}
                  receiptMode={receiptMode}
                  furtherMode={furtherMode}
                  onChange={(patch) => {
                    if (patch.receiptMode !== undefined) setReceiptMode(patch.receiptMode);
                    if (patch.furtherMode !== undefined) setFurtherMode(patch.furtherMode);
                  }}
                />
              </div>
              {collectedBy === "US" && (
                <p className="text-[11px] text-gray-400 -mt-2">
                  This is where the money actually lands — the same account fields any direct payment uses.
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Transaction ID / Reference {paymentMethod !== "cash" && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className={inputBase}
                  placeholder={paymentMethod === "cash" ? "Optional" : "Required for non-cash payments"}
                />
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5"><StickyNote className="w-3 h-3" /> Note</span>
            </SectionLabel>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={`${inputBase} resize-none`}
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 bg-white rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
