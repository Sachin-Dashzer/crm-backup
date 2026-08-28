"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Loader2, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/financeUI";

export default function CancelLoanModal({ transaction, onClose, onDone }) {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [loanState, setLoanState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [reason, setReason] = useState("Loan cancelled");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [done, setDone] = useState(null);

  const id = transaction?._id;
  const account = transaction?.furtherMode;
  const patientName = transaction?.patient?.personal?.name || transaction?.patientName || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reverseRes, loanRes] = await Promise.all([
          fetch(`/api/transactions/${id}/reverse`).then((r) => r.json()),
          fetch(`/api/transactions/${id}/cancel-loan`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setState(reverseRes);
        setLoanState(loanRes);
      } catch {
        if (!cancelled) setError("Could not read this loan's cancellation state");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const settlementTransfers = loanState?.settlementTransfers || [];
  const isCaseB = settlementTransfers.length > 0;
  const totalSettled = loanState?.totalSettled || 0;
  const blocked = state?.blockedReason;
  const amount = state?.remaining ?? transaction?.amount ?? 0;

  const submit = async () => {
    if (!reason.trim()) return toast.error("A reason is required");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}/cancel-loan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: reason.trim(), date }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, ...(d.reasons || []), d.hint].filter(Boolean).join(" "));
        return;
      }
      toast.success(d.message || "Loan cancelled");
      setDone(d);
      onDone?.(d);
    } catch {
      setError("Failed to cancel this loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Cancel Loan</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : done ? (
          <div className="p-5 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {done.message}
            </div>
            {done.patientStatus && done.patientStatus.before !== done.patientStatus.after && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Patient status changed: <b>{done.patientStatus.before || "—"}</b> →{" "}
                <b>{done.patientStatus.after || "—"}</b> (amount received now{" "}
                {formatCurrency(done.patientStatus.amountReceived)})
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-900">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-700">{formatDate(transaction?.date)}</span>
              </div>
              {account && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Account</span>
                  <span className="text-gray-700">{account}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-gray-200 mt-1">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${isCaseB ? "text-sky-700" : "text-gray-700"}`}>
                  {isCaseB
                    ? settlementTransfers.length > 1
                      ? `Settled in ${settlementTransfers.length} parts → ${formatCurrency(totalSettled)}`
                      : `Settled → ${settlementTransfers[0].toAccount}`
                    : "Not yet settled"}
                </span>
              </div>
            </div>

            {blocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {blocked}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Cancellation date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4" /> What this will do
                  </div>
                  {isCaseB ? (
                    <p>
                      This will reverse <b>{formatCurrency(amount)}</b>
                      {patientName ? (
                        <>
                          {" "}
                          for <b>{patientName}</b>
                        </>
                      ) : null}{" "}
                      and undo{" "}
                      {settlementTransfers.length > 1 ? (
                        <>
                          <b>{settlementTransfers.length}</b> settlement transfers totalling{" "}
                          <b>{formatCurrency(totalSettled)}</b> out of <b>{account}</b>
                        </>
                      ) : (
                        <>
                          the transfer of <b>{formatCurrency(settlementTransfers[0].amount)}</b> from{" "}
                          <b>{account}</b> to <b>{settlementTransfers[0].toAccount}</b>
                        </>
                      )}
                      . Revenue drops by {formatCurrency(amount)}; every account balance involved
                      returns to where it was before settlement.
                    </p>
                  ) : (
                    <p>
                      This will reverse <b>{formatCurrency(amount)}</b>
                      {patientName ? (
                        <>
                          {" "}
                          for <b>{patientName}</b>
                        </>
                      ) : null}
                      . Revenue and the <b>{account}</b> balance both drop by {formatCurrency(amount)}.
                    </p>
                  )}
                  <p className="text-xs text-red-600 pt-1">
                    Both/all rows stay visible. Nothing is deleted or hidden — the pair (or
                    quartet) is the audit trail.
                  </p>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={submit}
                disabled={submitting || !!blocked || !reason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cancelling…
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Cancel Loan
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
