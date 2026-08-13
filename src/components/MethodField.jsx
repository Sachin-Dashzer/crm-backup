"use client";

import BankRoutingFields from "@/components/BankRoutingFields";
import ExternalPartyFields from "@/components/ExternalPartyFields";
import { getMethodOptions, withLegacyMethod } from "@/constants/paymentMethods";

// The whole "HOW was this paid" cluster: Payment Method dropdown, then every field that
// method conditionally reveals — the offset-settlement note, ExternalPartyFields, the
// Receipt/Further Mode routing fields, and the Transaction ID field, whose placeholder and
// required-ness are themselves method-driven. All of this was previously re-declared in
// every panel (including a byte-identical getPaymentIdConfig in four separate files); one
// component now owns the whole conditional chain so a fifth panel doesn't re-fork it.
//
// The two base lists now live in src/constants/paymentMethods.js — every form in every panel
// reads them from there, so restricting a method is a one-line change in one file rather than
// an edit across five panels that will drift.
//
// `category` picks the option list AND which non-cash method applies:
//   TRANSPLANT / SERVICE  -> revenue set, "Paid to External"
//   MEDICINE               -> revenue set + "Including Package", "Paid to External"
//   EXPENSE                 -> expense set (cash + the three account-of-origin transfers), "Paid by Other"
function paymentIdConfig(method) {
  if (method === "card") return { placeholder: "Please enter card last no.", required: true };
  if (method?.toLowerCase() === "bajaj_loan" || method?.toLowerCase() === "fibe_loan")
    return { placeholder: "Please add the reference id", required: true };
  if (method === "cash") return { placeholder: "Please add transaction id", required: false };
  if (method === "including-package") return { placeholder: "N/A — included in package", required: false };
  return { placeholder: "Please add transaction id", required: true };
}

// `forEdit` narrows the list to what an edit form may safely offer — see getMethodOptions in
// src/constants/paymentMethods.js for why those three methods are create-only.
//
// `methodOptions` still accepts a full override for any caller that genuinely needs one, but
// no page should hardcode a list just to express "this is an edit form" — pass forEdit.
//
// Neither prop gates whether ExternalPartyFields/BankRoutingFields render — that stays keyed
// off the CURRENT value, never the option list, so a transaction that already carries one of
// the newer methods still shows its fields correctly even from a context that can't newly
// select it.
export default function MethodField({
  category,
  branch,
  value,
  onChange,
  disabled = false,
  methodOptions,
  forEdit = false,
}) {
  const isExpense = category === "EXPENSE";
  const externalMethod = isExpense ? "paid_by_other" : "paid_to_external";
  const idConfig = paymentIdConfig(value.method);

  // Wrap whichever list applies — the computed one or a caller override — so a stored method
  // that is no longer offered still renders and stays selected. Without this the <select>
  // would show blank for legacy rows and quietly write "" over the real value on the next save.
  const options = withLegacyMethod(
    methodOptions || getMethodOptions(category, { forEdit }),
    value.method,
  );

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
        <select
          value={value.method}
          onChange={(e) => onChange({ method: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
        {value.method === "offset_settlement" && (
          <p className="text-xs text-amber-600 mt-1">
            No cash movement; settles against an existing balance
          </p>
        )}
      </div>

      {value.method === externalMethod && (
        <ExternalPartyFields
          direction={isExpense ? "PAID_BY" : "RECEIVED_BY"}
          value={value.externalParty}
          onChange={(externalParty) => onChange({ externalParty })}
        />
      )}

      <BankRoutingFields
        costType={isExpense ? "Expenses" : "Revenue"}
        branch={branch}
        transactionCategory={category}
        method={value.method}
        receiptMode={value.receiptMode}
        furtherMode={value.furtherMode}
        onChange={(patch) => onChange(patch)}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Transaction ID {idConfig.required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={value.paymentId || ""}
          onChange={(e) => onChange({ paymentId: e.target.value })}
          placeholder={idConfig.placeholder}
          disabled={disabled || value.method === "including-package"}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
            value.method === "including-package" ? "bg-gray-50 cursor-not-allowed text-gray-400" : ""
          }`}
        />
      </div>
    </>
  );
}

export { paymentIdConfig as getPaymentIdConfig };
