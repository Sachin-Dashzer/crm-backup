"use client";

import { useEffect, useState } from "react";
import { X, Link2, Unlink, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/financeUI";

export default function SettleAgainstModal({ kind, row, onClose, onSuccess, toast }) {
  const isAdvance = kind === "advance";
  const endpoint = isAdvance ? `/api/advances/${row._id}` : `/api/borrowings/${row._id}`;
  const listEndpoint = isAdvance ? "/api/payables/list" : "/api/receivables/list";
  const refIdParam = isAdvance ? "payeeRefId" : "payerRefId";
  const settledField = isAdvance ? "settlesPayableId" : "settlesReceivableId";
  const targetLabel = isAdvance ? "payable" : "receivable";

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(row[settledField] ? String(row[settledField]) : "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!row.party?.refId) {
      setLoading(false);
      return;
    }
    const p = new URLSearchParams({ [refIdParam]: String(row.party.refId), limit: "50" });
    fetch(`${listEndpoint}?${p}`)
      .then((r) => r.json())
      .then((data) => setOptions(data[isAdvance ? "payables" : "receivables"] || []))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [row, refIdParam, listEndpoint, isAdvance]);

  const alreadySettling = !!row[settledField];

  const handleSettle = async () => {
    if (!selectedId) {
      toast.error(`Select a ${targetLabel} to settle against`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "settle", [settledField]: selectedId }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Settlement linked");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to link settlement");
      }
    } catch {
      toast.error("Failed to link settlement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnsettle = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unsettle" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Settlement unlinked");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to unlink settlement");
      }
    } catch {
      toast.error("Failed to unlink settlement");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-600" /> Settle Against…
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Links this {formatCurrency(row.amount)} {isAdvance ? "advance" : "borrowing"} —{" "}
            <strong>{row.party?.label}</strong> — against one of their own open{" "}
            {isAdvance ? "payables" : "receivables"}. Nets against what{" "}
            {isAdvance ? "they're" : "you're"} owed live — never changes the target document's own
            amount.
          </p>

          {alreadySettling && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-3">
              <span>Already settling a {targetLabel} — unlink first to pick a different one.</span>
              <button
                onClick={handleUnsettle}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 shrink-0"
              >
                <Unlink className="w-3.5 h-3.5" /> Unlink
              </button>
            </div>
          )}

          {!row.party?.refId ? (
            <p className="text-sm text-gray-400">
              This party has no linked record ({row.party?.kind || "OTHER"}) — settlement needs a
              real Vendor/Employee/Patient to match against.
            </p>
          ) : loading ? (
            <p className="text-sm text-gray-400">Loading open {targetLabel}s…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-gray-400">No open {targetLabel}s for this party.</p>
          ) : (
            !alreadySettling && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {options.map((opt) => (
                  <label
                    key={opt._id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer ${
                      selectedId === opt._id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="settleTarget"
                        checked={selectedId === opt._id}
                        onChange={() => setSelectedId(opt._id)}
                      />
                      <span className="text-sm text-gray-800">
                        {(opt.purpose || "").replace(/_/g, " ")}
                        {(opt.expenseSubType || opt.revenueSubType) ? ` — ${opt.expenseSubType || opt.revenueSubType}` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-amber-700 shrink-0">
                      {formatCurrency(opt.pending)} outstanding
                    </span>
                  </label>
                ))}
              </div>
            )
          )}
        </div>

        {!alreadySettling && (
          <div className="flex gap-3 p-5 border-t border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSettle}
              disabled={submitting || !selectedId}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link Settlement"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
