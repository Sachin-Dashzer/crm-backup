"use client";

import { useMemo } from "react";
import MethodField from "@/components/MethodField";
import BankRoutingFields from "@/components/BankRoutingFields";
import ExternalPartyFields from "@/components/ExternalPartyFields";
import ReceiptUpload from "@/components/ReceiptUpload";
import { NON_CASH_METHODS, UNSETTLED_METHODS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// §1.3 — the COMPOSITION of the money-form field components, which already existed separately
// (MethodField, BankRoutingFields, ExternalPartyFields, ReceiptUpload) but were never assembled.
// A settlement form that captures only paymentId is exactly what produced 4,309 transactions with
// no account attribution; this is the piece that stops that recurring.
//
// Deliberately NOT used by the four main transaction forms in this pass — they work today and
// migrating them is a separate change with its own regression surface. This is built around the
// settlement contexts, proven there first.

export const TRANSACTION_CONTEXTS = [
  "transplant",
  "service",
  "medicine",
  "expense",
  "receivable-receipt",
  "payable-payment",
  "collab-settlement",
  "voucher",
];

const SETTLEMENT_CONTEXTS = new Set([
  "receivable-receipt",
  "payable-payment",
  "collab-settlement",
]);

// A voucher only records that an obligation now exists — no cash moves yet, so payment method,
// transaction ID, and the "paid from" account routing (all of which the eventual settlement
// transaction captures) don't apply here and are hidden.
const HIDE_PAYMENT_FIELDS_CONTEXTS = new Set(["voucher"]);

// Which transactionCategory a context routes as. Settlements inherit the category of whatever
// they settle, so the caller passes it in; these are only the direct-entry defaults.
const CONTEXT_CATEGORY = {
  transplant: "TRANSPLANT",
  service: "SERVICE",
  medicine: "MEDICINE",
  expense: "EXPENSE",
};

const isExpenseSide = (context, categoryOverride) =>
  context === "expense" ||
  context === "payable-payment" ||
  categoryOverride === "EXPENSE";

/**
 * `value` is a single flat object the caller owns:
 *   { amount, method, paymentId, date, branch, receiptMode, furtherMode,
 *     remarks, receipts, externalParty }
 * `onChange(patch)` receives a partial and merges it caller-side.
 *
 * `validateTransactionFields(value, context, opts)` below is exported so the caller's submit
 * handler enforces the same rules this renders — one definition, not two.
 */
export default function TransactionFieldSet({
  context,
  value,
  onChange,
  transactionCategory,          // settlements: the category being settled
  branchLocked = false,         // collab settlement pins the clinic's branch
  showAmount = true,
  showBranch = true,
  showRemarks = true,
  showReceipts = true,
  amountLabel = "Amount (₹)",
  disabled = false,
  patientId,
}) {
  const category = transactionCategory || CONTEXT_CATEGORY[context] || "TRANSPLANT";
  const expenseSide = isExpenseSide(context, transactionCategory);
  const isSettlement = SETTLEMENT_CONTEXTS.has(context);
  const hidePaymentFields = HIDE_PAYMENT_FIELDS_CONTEXTS.has(context);

  const set = (patch) => onChange({ ...patch });

  // §1.2 — furtherMode is REQUIRED on any settlement moving real cash. A settlement with no
  // account attribution is unusable for close-book, which is the entire reason it is recorded.
  // NON_CASH_METHODS are the stated exception: nothing moved through an account.
  const furtherModeRequired = useMemo(
    () => isSettlement && !NON_CASH_METHODS.includes(value.method),
    [isSettlement, value.method],
  );

  const externalDirection = expenseSide ? "PAID_BY" : "RECEIVED_BY";
  const showExternal = !hidePaymentFields && UNSETTLED_METHODS.includes(value.method);

  return (
    <div className="space-y-4">
      {showAmount && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {amountLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            value={value.amount ?? ""}
            onChange={(e) => set({ amount: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="0"
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
          <input
            type="date"
            value={value.date || ""}
            onChange={(e) => set({ date: e.target.value })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        {showBranch && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Branch {branchLocked && <span className="text-xs text-gray-400">(fixed)</span>}
            </label>
            <select
              value={value.branch || ""}
              onChange={(e) => set({ branch: e.target.value })}
              disabled={disabled || branchLocked}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Select branch</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Method + the payment-id field it implies (card last-4, UTR, loan ref…), plus the "paid
          from" account routing — both describe how cash actually moved, which doesn't apply to a
          voucher: it only records that an obligation now exists, before any money moves. */}
      {!hidePaymentFields && (
        <>
          <MethodField
            category={category}
            branch={value.branch}
            value={{ method: value.method, paymentId: value.paymentId }}
            onChange={(patch) => set(patch)}
            disabled={disabled}
          />

          {/* Pre-filled from getBankRoutingDefaults for this branch/category/method — the same rule
              the transplant form applies — and always editable, per §1.2. */}
          <BankRoutingFields
            costType={expenseSide ? "Expenses" : "Revenue"}
            branch={value.branch}
            transactionCategory={category}
            method={value.method}
            receiptMode={value.receiptMode}
            furtherMode={value.furtherMode}
            onChange={(patch) => set(patch)}
          />

          {furtherModeRequired && !value.furtherMode && (
            <p className="text-xs text-red-600 -mt-2">
              Select the account this money {expenseSide ? "left from" : "landed in"} — without it this
              settlement can&apos;t be reconciled in Close Book.
            </p>
          )}
        </>
      )}

      {showExternal && (
        <ExternalPartyFields
          direction={externalDirection}
          value={value.externalParty || {}}
          onChange={(patch) => set({ externalParty: { ...(value.externalParty || {}), ...patch } })}
        />
      )}

      {showRemarks && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
          <textarea
            value={value.remarks || ""}
            onChange={(e) => set({ remarks: e.target.value })}
            rows={2}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            placeholder="Optional"
          />
        </div>
      )}

      {showReceipts && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Receipts</label>
          <ReceiptUpload
            receipts={value.receipts || []}
            onChange={(receipts) => set({ receipts })}
            section={context}
            patientId={patientId}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The submit-time counterpart of what the component renders. Exported so a caller cannot enforce
 * a different rule than the one shown on screen. Returns an error string, or null when valid.
 */
export function validateTransactionFields(value, context, { requireAmount = true } = {}) {
  const isSettlement = SETTLEMENT_CONTEXTS.has(context);
  const hidePaymentFields = HIDE_PAYMENT_FIELDS_CONTEXTS.has(context);

  if (requireAmount && !(parseFloat(value.amount) > 0)) {
    return "Enter an amount greater than zero";
  }
  if (!hidePaymentFields && !value.method) return "Select a payment method";
  if (!value.branch) return "Select a branch";

  if (hidePaymentFields) return null;

  // Mirrors furtherModeRequired above.
  if (isSettlement && !NON_CASH_METHODS.includes(value.method) && !value.furtherMode) {
    return "Select the account this money moved through — a settlement without account attribution can't be reconciled in Close Book";
  }

  if (UNSETTLED_METHODS.includes(value.method)) {
    const p = value.externalParty || {};
    if (!p.name?.trim()) return "Enter the name of the party who handled the money";
    if (!p.method) return "Select the method the external party used";
  }

  return null;
}

export { SETTLEMENT_CONTEXTS };
