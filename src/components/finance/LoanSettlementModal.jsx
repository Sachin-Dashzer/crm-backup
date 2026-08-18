"use client";

import { useState } from "react";
import { X, Landmark } from "lucide-react";
import { ACCOUNTS } from "@/constants/bankRouting";
import { useToast } from "@/components/Toast";

const LOAN_ACCOUNTS = ["Bajaj Loan", "Fibe Loan"];
// Every account EXCEPT the two loan accounts — settling a loan means moving the money it holds
// into a real bank/cash account, never into the other loan account.
const BANK_OPTIONS = ACCOUNTS.filter((a) => !LOAN_ACCOUNTS.includes(a));

// Records a loan settlement as a contra entry (AccountTransfer) FROM the loan-financing account
// (Bajaj Loan / Fibe Loan) TO the bank account the money was swept into — reusing
// /api/account-transfers/create exactly as the rest of Close Book does, so this settlement shows
// up in both accounts' ledgers and balances the same way any other internal transfer does. No new
// backend logic — this is only a purpose-built front end onto the existing contra-entry endpoint.
//
// `fromAccount` is fixed — the modal is opened from one specific loan-financing transaction row
// (inside that account's ledger drill-down), not chosen inside the modal. `defaultAmount` and
// `contextLabel` pre-fill from that row — the amount stays editable since the financier's actual
// settlement can differ (fees, partial settlement), but starts at what should reconcile.
//
// `sourceTransactionId` links the transfer this modal creates back to the loan transaction it
// settles, so a later loan cancellation (CancelLoanModal) can find and reverse this exact
// transfer instead of guessing by amount and date.
export default function LoanSettlementModal({ fromAccount, defaultAmount, contextLabel, sourceTransactionId, onClose, onSuccess }) {
  const toast = useToast();
  const [toAccount, setToAccount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : "");
  const [settlementId, setSettlementId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!toAccount) return toast.error("Select the settlement bank");
    if (!(parseFloat(amount) > 0)) return toast.error("Enter a settlement amount greater than zero");
    if (!settlementId.trim()) return toast.error("Enter a settlement ID");

    setSubmitting(true);
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
          reference: settlementId.trim(),
          remarks: `Loan settlement — ${fromAccount} → ${toAccount}`,
          sourceTransactionId: sourceTransactionId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to record settlement");
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
              disabled={submitting}
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
