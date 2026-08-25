"use client";

import { useEffect, useRef } from "react";
import {
  ACCOUNTS,
  RECEIPT_MODES,
  getBankRoutingDefaults,
  getExpenseFurtherModeDefault,
} from "@/constants/bankRouting";

// Shared bank-routing field(s) for every transaction section (Transplant, Services, Medicine,
// Expense). Renders as grid cell(s) — drop it directly inside the existing
// `grid grid-cols-1 md:grid-cols-2 gap-4` container, right after the Payment Method field.
//
// Revenue (default, costType !== "Expenses"): renders Receipt Mode + Further Mode ("Received In
// Account" — which account the money arrived in), pre-filled from branch/transactionCategory/method
// via src/constants/bankRouting.js.
//
// Expense (costType === "Expenses"): renders only the further-mode field, labeled "Paid From
// Account" (which account the money left from), pre-filled from method alone.
//
// In both cases, on first mount, if the caller already has values (e.g. an edit page hydrating a
// saved transaction), those are left alone instead of being overwritten by the current map.
//
// `forEdit` (edit forms only): the first effect run is NEVER treated as a prefill opportunity,
// full stop — not even when receiptMode/furtherMode come in blank. An edit form's first render
// is always "just hydrated an existing transaction"; injecting a guessed default over a
// genuinely-stored value (including a legitimately blank one on an old record) isn't this
// component's call to make. The bug this fixes: `mounted` is a ref, which survives for the
// lifetime of this component INSTANCE — but the parent edit pages don't remount that instance
// when navigating from editing one transaction to another (same route, different [id], no key),
// so `mounted.current` was already `true` from the PREVIOUS transaction's session, making
// `firstRun` false and skipping the "leave it alone" guard entirely. That silently overwrote the
// freshly-loaded value with the generic per-method default (e.g. every "cash" transaction's
// furtherMode was rewritten to "Cash Book", clobbering values like "Cash ( backend )"). The
// callers now also pass `key={transactionId}` to force a real remount per transaction — this
// prop-based guard is the second, independent layer, since a ref reset alone still depended on
// receiptMode/furtherMode already being non-empty.
export default function BankRoutingFields({
  costType,
  branch,
  transactionCategory,
  method,
  receiptMode,
  furtherMode,
  onChange,
  forEdit = false,
}) {
  const isExpense = costType === "Expenses";
  const mounted = useRef(false);

  useEffect(() => {
    const defaults = isExpense
      ? { receiptMode: "", furtherMode: getExpenseFurtherModeDefault(method) }
      : getBankRoutingDefaults(branch, transactionCategory, method);
    const firstRun = !mounted.current;
    mounted.current = true;

    if (firstRun && (forEdit || receiptMode || furtherMode)) return;

    onChange(
      isExpense
        ? { furtherMode: defaults.furtherMode }
        : { receiptMode: defaults.receiptMode, furtherMode: defaults.furtherMode },
    );
    // Only branch/category/method should trigger a re-prefill, not every keystroke on the fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpense, branch, transactionCategory, method]);

  const furtherModeField = (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isExpense ? "Paid From Account" : "Received In Account"}
      </label>
      <select
        value={furtherMode || ""}
        onChange={(e) =>
          onChange(
            isExpense
              ? { furtherMode: e.target.value }
              : { receiptMode, furtherMode: e.target.value },
          )
        }
        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
      >
        <option value="">Select account</option>
        {ACCOUNTS.map((account) => (
          <option key={account} value={account}>
            {account}
          </option>
        ))}
        {furtherMode && !ACCOUNTS.includes(furtherMode) && (
          <option value={furtherMode}>{furtherMode}</option>
        )}
      </select>
    </div>
  );

  if (isExpense) return furtherModeField;

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Mode</label>
        <select
          value={receiptMode || ""}
          onChange={(e) => onChange({ receiptMode: e.target.value, furtherMode })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">Select receipt mode</option>
          {RECEIPT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
          {receiptMode && !RECEIPT_MODES.includes(receiptMode) && (
            <option value={receiptMode}>{receiptMode}</option>
          )}
        </select>
      </div>
      {furtherModeField}
    </>
  );
}
