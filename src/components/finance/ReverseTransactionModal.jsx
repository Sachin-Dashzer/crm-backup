"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/financeUI";

const todayISO = () => new Date().toLocaleDateString("en-CA");
const asInputDate = (d) => (d ? new Date(d).toLocaleDateString("en-CA") : todayISO());

export default function ReverseTransactionModal({ transaction, onClose, onDone }) {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(todayISO());
  const [remarks, setRemarks] = useState("");

  const id = transaction?._id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/transactions/${id}/reverse`);
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(d.error || "Could not read this transaction's reversal state");
        } else {
          setState(d);
          setAmount(String(d.remaining ?? ""));
          setDate(d.originalPeriodLocked ? todayISO() : asInputDate(transaction?.date));
        }
      } catch {
        if (!cancelled) setError("Could not read this transaction's reversal state");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, transaction?.date]);

  const requested = Number(amount) || 0;
  const remaining = state?.remaining ?? 0;
  const isPartial = requested > 0 && requested < remaining - 0.01;

  const patientName = transaction?.patient?.personal?.name || transaction?.patientName || null;
  const receivedNow = Number(transaction?.patient?.payments?.amountReceived ?? NaN);
  const receivedAfter = Number.isFinite(receivedNow) ? Math.max(0, receivedNow - requested) : null;
  const isRevenue = transaction?.costType === "Revenue";
  const account = transaction?.furtherMode;
  const blocked = state?.blockedReason;

  const submit = async () => {
    if (!reason.trim()) return toast.error("A reason is required");
    if (!(requested > 0)) return toast.error("Enter an amount greater than zero");
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: requested,
          reason: reason.trim(),
          date,
          remarks: remarks.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError([d.error, ...(d.reasons || []), d.hint].filter(Boolean).join(" "));
        return;
      }
      toast.success(d.message || "Reversal recorded");
      onDone?.(d);
      onClose();
    } catch {
      setError("Failed to record the reversal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-gray-900">Reverse / Refund</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin inline" />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Original</span>
                <span className="font-semibold text-gray-900">{formatCurrency(state?.originalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-700">{formatDate(transaction?.date)}</span>
              </div>
              {account ? (
                <div className="flex justify-between">
                  <span className="text-gray-500">Account</span>
                  <span className="text-gray-700">{account}</span>
                </div>
              ) : null}
              {state?.alreadyReversed > 0 ? (
                <div className="flex justify-between pt-1 border-t border-gray-200 mt-1">
                  <span className="text-purple-700 font-medium">Already reversed</span>
                  <span className="font-semibold text-purple-700">
                    {formatCurrency(state.alreadyReversed)} · {formatCurrency(state.remaining)} left
                  </span>
                </div>
              ) : null}
            </div>

            {blocked ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {blocked}
              </div>
            ) : (
              <>
                {!account && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    This transaction names no account, so the reversal cannot put the money back
                    into one either. Both rows will be missing from Cash &amp; Bank.
                  </div>
                )}

                {state?.originalPeriodLocked && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
                    The original sits in a closed period, so this reversal is dated <b>today</b>. A
                    closed period stays closed and the correction lands in the open one.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Amount to reverse *
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      max={remaining}
                      min={0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Up to {formatCurrency(remaining)}. Lower it for a partial refund.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={date}
                      disabled={state?.originalPeriodLocked}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Loan cancelled · Patient refund · Duplicate entry"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Goes into the narration, so this row explains itself in a bank reconciliation
                    months later.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
                  <input
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="w-4 h-4" /> What this will do
                  </div>
                  <p>
                    Creates a <b>−{formatCurrency(requested)}</b> entry
                    {patientName ? (
                      <>
                        {" "}
                        for <b>{patientName}</b>
                      </>
                    ) : null}
                    , dated {formatDate(date)}.
                  </p>
                  <p>
                    {isRevenue ? "Revenue" : "Expenses"}
                    {account ? (
                      <>
                        {" "}
                        and <b>{account}</b> both drop
                      </>
                    ) : (
                      " drops"
                    )}{" "}
                    by {formatCurrency(requested)}.
                  </p>
                  {isRevenue && patientName && receivedAfter !== null ? (
                    <p>
                      {patientName}&apos;s received amount goes from {formatCurrency(receivedNow)} to{" "}
                      <b>{formatCurrency(receivedAfter)}</b>
                      {receivedAfter === 0 ? ", which will move their status backward." : "."}
                    </p>
                  ) : null}
                  {isPartial ? (
                    <p className="text-red-700">
                      Partial — the original stays open, with{" "}
                      {formatCurrency(remaining - requested)} still reversible.
                    </p>
                  ) : (
                    <p className="text-red-700">Full reversal — the original will be marked Reversed.</p>
                  )}
                  <p className="text-xs text-red-600 pt-1">
                    Both rows stay visible. Nothing is deleted or hidden — the pair is the audit
                    trail.
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
                disabled={submitting || !!blocked || !reason.trim() || !(requested > 0)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording…
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reverse {formatCurrency(requested)}
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
