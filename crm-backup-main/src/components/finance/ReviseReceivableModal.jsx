"use client";

import { useState } from "react";
import { X, Loader2, Ban, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/financeUI";

// Extracted from admin/receivables/page.jsx's ReviseModal (Task 5, Step 1) — behaviour
// unchanged, only the location and name moved (ReviseModal -> ReviseReceivableModal, to sit
// alongside its Payable mirror without a naming collision).
export default function ReviseReceivableModal({ receivable, onClose, onSuccess, toast }) {
  const [totalAmount, setTotalAmount] = useState(String(receivable.totalAmount));
  const [dueDate, setDueDate] = useState(receivable.dueDate ? receivable.dueDate.split("T")[0] : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const save = async (extra = {}) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: totalAmount !== String(receivable.totalAmount) ? totalAmount : undefined,
          dueDate: dueDate || null,
          note,
          ...extra,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receivable updated");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to update receivable");
      }
    } catch (error) {
      console.error("Error updating receivable:", error);
      toast.error("Failed to update receivable");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    const ok = window.confirm(
      `Permanently delete this receivable?\n\n` +
        `  ${receivable.payer?.label || "Receivable"} · ${formatCurrency(receivable.totalAmount)}\n\n` +
        `Cancelling instead keeps the record and the audit trail. Delete cannot be undone.`,
    );
    if (!ok) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || "Failed to delete receivable");
      toast.success("Receivable deleted");
      onSuccess();
    } catch (error) {
      console.error("Error deleting receivable:", error);
      toast.error("Failed to delete receivable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Revise Receivable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{receivable.payer?.label}</p>
            <p className="text-gray-500 mt-1">
              Already received:{" "}
              <span className="font-semibold text-emerald-700">{formatCurrency(receivable.received)}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount Expected (₹)</label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              placeholder="Reason for the change (optional)"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-5 border-t border-gray-100">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
              Close
            </button>
            <button
              onClick={() => save()}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
          <button
            onClick={() => save({ isCancelled: !receivable.isCancelled })}
            disabled={submitting}
            className={`w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
              receivable.isCancelled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            <Ban className="w-4 h-4" />
            {receivable.isCancelled ? "Reinstate Receivable" : "Cancel Receivable"}
          </button>
          {/* Offered under Cancel, not beside it: cancelling keeps the record and is reversible,
              so it should stay the obvious choice. The API refuses outright if any receipt has
              already been logged against this receivable. */}
          <button
            onClick={remove}
            disabled={submitting}
            className="w-full px-4 py-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
