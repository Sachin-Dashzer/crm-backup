"use client";

import { useState } from "react";
import { X, Loader2, Ban, Trash2 } from "lucide-react";
import DebouncedDateInput from "@/components/finance/DebouncedDateInput";
import { formatCurrency } from "@/lib/financeUI";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// Edits ONE Advance row (OUT or IN) in place — exact mirror of EditBorrowingModal. direction and
// receivableId are structural and never editable here (see /api/advances/[id]'s PUT handler).
export default function EditAdvanceModal({ advance, onClose, onSuccess, toast }) {
  const [amount, setAmount] = useState(String(advance.amount));
  const [date, setDate] = useState(new Date(advance.date).toISOString().split("T")[0]);
  const [account, setAccount] = useState(advance.account);
  const [branch, setBranch] = useState(advance.branch || "");
  const [reference, setReference] = useState(advance.reference || "");
  const [remarks, setRemarks] = useState(advance.remarks || "");
  const [allowOverRecovery, setAllowOverRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advances/${advance._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          date,
          account,
          branch: branch || null,
          reference,
          remarks,
          allowOverRecovery,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Advance updated");
        onSuccess();
      } else {
        setError(data.error || "Failed to update");
      }
    } catch {
      setError("Failed to update — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  };

  const setLifecycle = async (action) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advances/${advance._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === "cancel" ? "Advance cancelled" : "Advance reinstated");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Permanently delete this ${advance.direction === "IN" ? "recovery" : "advance"} row (${formatCurrency(advance.amount)})?\n\nThis cannot be undone.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/advances/${advance._id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Advance deleted");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            Edit {advance.direction === "IN" ? "Recovery" : "Advance"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{advance.party?.label}</p>
            <p className="text-gray-500 mt-1">
              {advance.direction === "IN" ? "Recovery" : "Paid out"} ·{" "}
              {advance.isCancelled ? (
                <span className="text-red-600 font-semibold">Cancelled</span>
              ) : (
                <span className="text-emerald-600 font-semibold">Active</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={advance.isCancelled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                disabled={advance.isCancelled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
              >
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <DebouncedDateInput
              value={date}
              onCommit={setDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-amber-700">
            <input
              type="checkbox"
              checked={allowOverRecovery}
              onChange={(e) => setAllowOverRecovery(e.target.checked)}
            />
            Allow over-recovery (only matters if this is a recovery amount increase)
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={advance.isCancelled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
            >
              <option value="">Company-level (no branch)</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={advance.isCancelled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={advance.isCancelled}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none disabled:bg-gray-50"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-5 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            {!advance.isCancelled && (
              <button
                onClick={save}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </button>
            )}
          </div>
          <button
            onClick={() => setLifecycle(advance.isCancelled ? "reinstate" : "cancel")}
            disabled={submitting}
            className={`w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
              advance.isCancelled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            <Ban className="w-4 h-4" />
            {advance.isCancelled ? "Reinstate" : "Cancel"}
          </button>
          {advance.isCancelled && (
            <button
              onClick={remove}
              disabled={submitting}
              className="w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete Permanently
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
