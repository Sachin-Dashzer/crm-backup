"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatCurrency, formatDate, StatusBadge } from "@/lib/financeUI";
import { formatAgeing } from "@/lib/ageing";

// Read-only "complete detail" view for one Payable/Receivable document — the level-3 documents
// table (DrillDownTable) only ever shows party/purpose/totalAmount/paid/pending/status/due, so
// this fetches the single-document GET (/api/payables/[id] or /api/receivables/[id], the same
// live paid/pending aggregation the list uses) to show everything else: category/sub-type,
// period, branch, remarks, receipts, TDS link (payable only), and the full log.
export default function DocumentDetailModal({ documentId, kind, onClose }) {
  const isPayable = kind === "payable";
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(isPayable ? `/api/payables/${documentId}` : `/api/receivables/${documentId}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const d = isPayable ? json.payable : json.receivable;
        if (d) setDoc(d);
        else setError(json.error || "Failed to load document");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, isPayable]);

  const Row = ({ label, value }) =>
    value === undefined || value === null || value === "" ? null : (
      <div className="flex justify-between gap-4 py-1 text-sm">
        <dt className="text-gray-500">{label}</dt>
        <dd className="text-gray-800 font-medium text-right">{value}</dd>
      </div>
    );

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      <dl>{children}</dl>
    </div>
  );

  const party = doc && (isPayable ? doc.payee : doc.payer);
  const settled = doc && (isPayable ? doc.paid : doc.received);
  const pending = doc?.pending ?? (doc ? Math.max((doc.totalAmount || 0) - (settled || 0), 0) : 0);
  const ageing = doc ? formatAgeing(doc.daysOverdue) : null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">
            {isPayable ? "Payable" : "Receivable"} Details
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="p-10 text-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin inline" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(doc.totalAmount)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{party?.label || "—"}</p>
                </div>
                <StatusBadge status={doc.isCancelled ? "Cancelled" : doc.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Section title={isPayable ? "Payee" : "Payer"}>
                  <Row label="Label" value={party?.label} />
                  <Row label="Kind" value={party?.kind} />
                  <Row label="Ref ID" value={party?.refId} />
                </Section>

                <Section title="Classification">
                  <Row label="Purpose" value={doc.purpose} />
                  <Row label={isPayable ? "Expense Category" : "Revenue Category"} value={isPayable ? doc.expenseCategory : doc.revenueCategory} />
                  {isPayable && <Row label="Sub-type" value={doc.expenseSubType} />}
                  <Row label="Period" value={doc.period?.month ? `${doc.period.month}/${doc.period.year}` : null} />
                </Section>

                <Section title="Amounts">
                  <Row label={isPayable ? "Owed" : "Expected"} value={formatCurrency(doc.totalAmount)} />
                  <Row label={isPayable ? "Paid" : "Received"} value={formatCurrency(settled)} />
                  <Row label="Pending" value={formatCurrency(pending)} />
                </Section>

                <Section title="Dates & Location">
                  <Row label="Due Date" value={doc.dueDate ? formatDate(doc.dueDate) : "—"} />
                  <Row label="Ageing" value={ageing?.text} />
                  <Row label="Branch" value={doc.branch} />
                  <Row label="Created" value={doc.createdAt ? formatDate(doc.createdAt) : null} />
                </Section>

                {doc.tdsLink?.role && (
                  <Section title="TDS Link">
                    <Row label="Role" value={doc.tdsLink.role} />
                    <Row label="Gross Amount" value={doc.tdsLink.grossAmount != null ? formatCurrency(doc.tdsLink.grossAmount) : null} />
                    <Row label="TDS Rate" value={doc.tdsLink.tdsRate != null ? `${doc.tdsLink.tdsRate}%` : null} />
                    <Row label="TDS Amount" value={doc.tdsLink.tdsAmount != null ? formatCurrency(doc.tdsLink.tdsAmount) : null} />
                  </Section>
                )}

                <Section title="Created By">
                  <Row label="Name" value={doc.createdBy?.name} />
                  <Row label="Email" value={doc.createdBy?.email} />
                  <Row label="Branch" value={doc.createdBy?.branch} />
                </Section>
              </div>

              {doc.remarks && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Remarks</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{doc.remarks}</p>
                </div>
              )}

              {doc.receipts?.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Receipts ({doc.receipts.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {doc.receipts.map((r) => (
                      <a
                        key={r.publicId || r.url}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-700 hover:bg-slate-200 truncate max-w-[10rem]"
                      >
                        {r.fileName || "File"}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {doc.log?.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Activity Log ({doc.log.length})
                  </p>
                  <ul className="space-y-2">
                    {[...doc.log].reverse().map((entry, i) => (
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
