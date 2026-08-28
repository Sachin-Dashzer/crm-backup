"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import TransactionFieldSet, { validateTransactionFields } from "@/components/TransactionFieldSet";
import { formatCurrency } from "@/lib/financeUI";

const PURPOSE_LABELS = {
  PATIENT_DUE: "Patient Due",
  COLLAB_SETTLEMENT: "Collab Settlement",
  REFUND_DUE: "Refund Due",
  ADVANCE_RECOVERY: "Advance Recovery",
  OTHER: "Other",
};

export default function RecordReceiptModal({ receivable, onClose, onSuccess, toast }) {
  const [fields, setFields] = useState({
    amount: String(receivable.pending || ""),
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    paymentId: "",
    branch: receivable.branch || "",
    receiptMode: "",
    furtherMode: "",
    remarks: "",
    receipts: [],
    externalParty: {},
  });
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const overBalance = parseFloat(fields.amount || 0) > receivable.pending;

  const handleSubmit = async () => {
    const invalid = validateTransactionFields(fields, "receivable-receipt");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (overBalance && !allowOverpayment) {
      toast.error("Amount exceeds outstanding balance — check 'Allow overpayment' to proceed anyway");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/receivables/${receivable._id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          allowOverpayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receipt recorded");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to record receipt");
      }
    } catch (error) {
      console.error("Error recording receipt:", error);
      toast.error("Failed to record receipt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold text-gray-900">Record Receipt</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{receivable.payer?.label}</p>
            <p className="text-gray-500 mt-1">
              {PURPOSE_LABELS[receivable.purpose] || receivable.purpose} · Pending:{" "}
              <span className="font-bold text-amber-600">{formatCurrency(receivable.pending)}</span>
            </p>
          </div>

          <div>
            <TransactionFieldSet
              context="receivable-receipt"
              value={fields}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
              transactionCategory={receivable.revenueCategory || undefined}
              patientId={receivable.relatedPatient || undefined}
            />
            {overBalance && (
              <label className="flex items-center gap-2 mt-3 text-xs text-amber-700">
                <input
                  type="checkbox"
                  checked={allowOverpayment}
                  onChange={(e) => setAllowOverpayment(e.target.checked)}
                />
                Amount exceeds outstanding balance — allow overpayment
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Recording…" : "Record Receipt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
