"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import TransactionFieldSet, { validateTransactionFields } from "@/components/TransactionFieldSet";
import { formatCurrency } from "@/lib/financeUI";

// Extracted from admin/payables/page.jsx (Task 5, Step 1) — behaviour unchanged, only the
// location moved, so the Liabilities page's Level-3 document drill-down and the (now retired)
// standalone Payables page can share exactly one implementation.

// Same purpose-label map the old payables page kept inline — display-only, duplicated here
// rather than shared, same as every other small UI label enum in this codebase.
const PURPOSE_LABELS = {
  SALARY: "Salary",
  INCENTIVE: "Incentive",
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  COLLAB_CLINIC: "Collab Clinic",
  PATIENT_COMMISSION: "Patient Commission",
  TAX: "Taxes",
  MEDICAL_CONSUMABLES: "Medical Consumables",
  MEDICINE_PROCUREMENT: "Medicine Procurement",
  PROFESSIONAL_EXPENSES: "Professional Expenses",
  LAB_EXPENSES: "Lab Expenses",
  INTEREST_EXPENSES: "Interest Expenses",
  SOFTWARE_RENTAL: "Software Rental",
  HARDWARE_RENTAL: "Hardware Rental",
  OTHER: "Other",
};

export function buildGiverForPayable(payable) {
  const { kind, refId, label } = payable.payee || {};
  if (kind === "EMPLOYEE") return { type: "EMPLOYEE", refId, name: label };
  if (kind === "PATIENT") return { type: "PATIENT", refId, name: label };
  if (kind === "VENDOR") return { type: "VENDOR", vendorId: refId, name: label };
  return { type: "MANUAL", name: label }; // RENT_UNIT, UTILITY_UNIT, COLLAB_CLINIC, OTHER
}

export default function RecordPaymentModal({ payable, onClose, onSuccess, toast }) {
  // Flat object handed to TransactionFieldSet — see the receipt modal for the same shape. The
  // routing fields here are what was missing: a payment with no furtherMode never reaches an
  // account in Close Book.
  const [fields, setFields] = useState({
    amount: String(payable.pending || ""),
    date: new Date().toISOString().split("T")[0],
    method: "cash",
    paymentId: "",
    branch: payable.branch || "",
    receiptMode: "",
    furtherMode: "",
    remarks: "",
    receipts: [],
    externalParty: {},
  });
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const overBalance = parseFloat(fields.amount || 0) > payable.pending;

  const handleSubmit = async () => {
    const invalid = validateTransactionFields(fields, "payable-payment");
    if (invalid) {
      toast.error(invalid);
      return;
    }
    if (overBalance && !allowOverpayment) {
      toast.error("Amount exceeds pending balance — check 'Allow overpayment' to proceed anyway");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transactions/expense/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseCategory: payable.expenseCategory,
          expenseType: payable.expenseSubType,
          amount: fields.amount,
          method: fields.method,
          paymentId: fields.paymentId,
          branch: fields.branch,
          date: fields.date,
          receiptMode: fields.receiptMode,
          furtherMode: fields.furtherMode,
          receipts: fields.receipts,
          externalParty: fields.externalParty?.name ? fields.externalParty : undefined,
          remarks: fields.remarks || `Payment against payable — ${payable.payee?.label}`,
          patientId: payable.relatedPatient || undefined,
          expenseGiver: buildGiverForPayable(payable),
          payableId: payable._id,
          allowOverpayment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payment recorded");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-semibold text-gray-900 truncate">{payable.payee?.label}</p>
            <p className="text-gray-500 mt-1">
              {PURPOSE_LABELS[payable.purpose]} · Pending:{" "}
              <span className="font-bold text-rose-600">{formatCurrency(payable.pending)}</span>
            </p>
          </div>

          <div>
            {/* Full parity with a directly-entered expense — the routing fields are the
                point: a payment with no furtherMode never lands in a Close Book account. */}
            <TransactionFieldSet
              context="payable-payment"
              value={fields}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
              transactionCategory="EXPENSE"
              patientId={payable.relatedPatient || undefined}
            />
            {overBalance && (
              <label className="flex items-center gap-2 mt-3 text-xs text-amber-700">
                <input type="checkbox" checked={allowOverpayment} onChange={(e) => setAllowOverpayment(e.target.checked)} />
                Amount exceeds pending balance — allow overpayment
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
