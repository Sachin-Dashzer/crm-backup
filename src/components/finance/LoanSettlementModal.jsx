"use client";

import { useEffect, useState } from "react";
import { X, Landmark } from "lucide-react";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { formatCurrency } from "@/lib/financeUI";
import { useToast } from "@/components/Toast";

const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];
const BANK_OPTIONS = ACCOUNTS.filter((a) => !LOAN_ACCOUNTS.includes(a));

export default function LoanSettlementModal({
  fromAccount,
  defaultAmount,
  contextLabel,
  sourceTransactionId,
  branch: defaultBranch,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [toAccount, setToAccount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : "");
  const [settlementId, setSettlementId] = useState("");
  const [branch, setBranch] = useState(defaultBranch || "");
  const [noBranch, setNoBranch] = useState(!defaultBranch);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [alreadySettled, setAlreadySettled] = useState(0);
  const [overSettlement, setOverSettlement] = useState(null);
  const [allowOverSettlement, setAllowOverSettlement] = useState(false);

  useEffect(() => {
    if (!sourceTransactionId) return;
    fetch(`/api/transactions/${sourceTransactionId}/cancel-loan`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return;
        setAlreadySettled(json.totalSettled || 0);
        const rem = json.remaining ?? defaultAmount ?? 0;
        setRemaining(rem);
        if (json.totalSettled > 0) setAmount(String(Math.max(rem, 0)));
      })
      .catch(() => {});
  }, [sourceTransactionId]);

  const handleSubmit = async () => {
    if (!toAccount) return toast.error("Select the settlement bank");
    if (!(parseFloat(amount) > 0)) return toast.error("Enter a settlement amount greater than zero");
    if (!settlementId.trim()) return toast.error("Enter a settlement ID");
    if (!noBranch && !branch) return toast.error("Select a branch, or tick company-level");

    setSubmitting(true);
    setOverSettlement(null);
    try {
      const res = await fetch("/api/account-transfers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fromAccount,
          toAccount,
          amount: parseFloat(amount),
          date,
          branch: noBranch ? undefined : branch,
          reference: settlementId.trim(),
          remarks: `Loan settlement — ${fromAccount} → ${toAccount}`,
          sourceTransactionId: sourceTransactionId || undefined,
          transferKind: sourceTransactionId ? "LOAN_SETTLEMENT" : "MANUAL",
          allowOverSettlement,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.remaining !== undefined) {
          setOverSettlement({ alreadySettled: json.alreadySettled, remaining: json.remaining });
          setSubmitting(false);
          return;
        }
        throw new Error(json.error || "Failed to record settlement");
      }
      toast.success("Loan settlement recorded");
      setDone(true);
      onSuccess?.();
    } catch (err) {
      toast.error(err.message || "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Landmark className="w-4.5 h-4.5 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-900">Settle {fromAccount}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {contextLabel && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              Settling: <span className="font-medium text-gray-700">{contextLabel}</span>
            </p>
          )}

          {sourceTransactionId && remaining != null && (
            <p className="text-xs text-gray-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              Loan amount <b>{formatCurrency(defaultAmount)}</b> · Already settled{" "}
              <b>{formatCurrency(alreadySettled)}</b> · Remaining <b>{formatCurrency(remaining)}</b>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Settlement date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting || done}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Settlement amount (₹)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting || done}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Settlement ID</label>
            <input
              type="text"
              value={settlementId}
              onChange={(e) => setSettlementId(e.target.value)}
              disabled={submitting || done}
              placeholder="UTR / reference number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Settlement bank</label>
            <select
              value={toAccount}
              onChange={(e) => setToAccount(e.target.value)}
              disabled={submitting || done}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              <option value="">Select account</option>
              {BANK_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={submitting || done || noBranch}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              <option value="">Select branch</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={noBranch}
                onChange={(e) => setNoBranch(e.target.checked)}
                disabled={submitting || done}
              />
              Company-level (no branch)
            </label>
          </div>

          {overSettlement && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1.5">
              <p>
                This would exceed the loan amount — ₹{overSettlement.alreadySettled.toLocaleString("en-IN")} already
                settled, ₹{overSettlement.remaining.toLocaleString("en-IN")} remaining.
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowOverSettlement}
                  onChange={(e) => setAllowOverSettlement(e.target.checked)}
                />
                Record it anyway (fee/short settlement)
              </label>
            </div>
          )}

          {done ? (
            <button
              disabled
              className="w-full py-2.5 bg-emerald-100 text-emerald-700 font-semibold rounded-lg"
            >
              Settlement recorded
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || (!!overSettlement && !allowOverSettlement)}
              className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Recording…" : "Record Settlement"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
