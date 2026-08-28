"use client";

import { useEffect, useRef } from "react";
import {
  ACCOUNTS,
  RECEIPT_MODES,
  getBankRoutingDefaults,
  getExpenseFurtherModeDefault,
} from "@/constants/bankRouting";

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
