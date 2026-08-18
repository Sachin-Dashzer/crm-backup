"use client";

import RootTransactionFieldSet, {
  validateTransactionFields,
} from "@/components/TransactionFieldSet";
import TaxBreakdownFields from "@/components/TaxBreakdownFields";
import { deriveClinicSettlement } from "@/lib/collabFormula";

// The accounting UI's own thin composition over @/components/TransactionFieldSet — the shared
// amount/method/paymentId/date/branch/receiptMode/furtherMode/remarks/receipts field set already
// built for the settlement contexts (see that file's header). This adds the two pieces specific
// to the four contexts this pass covers and nothing else:
//
//   - context="voucher"            -> the GST/TDS breakdown panel (TaxBreakdownFields), reusing
//                                      computeTaxBreakdown so the number shown here is exactly
//                                      what /api/payables/create or /api/receivables/create
//                                      would compute from the same inputs.
//   - context="collab-settlement"  -> a plain-text direction line derived from
//                                      collabFormula.deriveClinicSettlement — never re-derived
//                                      here, so it can't drift from the server's own math.
//
// `context` is otherwise passed straight through: "receivable-receipt" | "payable-payment" also
// render via the same root component, unmodified.
export default function TransactionFieldSet({
  context,
  value,
  onChange,
  taxValue,
  onTaxChange,
  clinicLabel,
  clinicReceived,
  clinicShare,
  ...rest
}) {
  return (
    <div className="space-y-4">
      <RootTransactionFieldSet context={context} value={value} onChange={onChange} {...rest} />

      {context === "voucher" && (
        <TaxBreakdownFields
          value={taxValue || {}}
          baseAmount={value.amount}
          onChange={onTaxChange}
          allowTDS
        />
      )}

      {context === "collab-settlement" && clinicLabel && (
        <CollabDirectionLine
          clinicLabel={clinicLabel}
          clinicReceived={clinicReceived}
          clinicShare={clinicShare}
        />
      )}
    </div>
  );
}

function CollabDirectionLine({ clinicLabel, clinicReceived, clinicShare }) {
  const { kind, amount } = deriveClinicSettlement({
    clinicReceived: Number(clinicReceived) || 0,
    clinicShare: Number(clinicShare) || 0,
  });
  const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  if (kind === "NONE") {
    return (
      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        {clinicLabel} collected exactly its share — nothing to settle.
      </p>
    );
  }

  const text =
    kind === "RECEIVABLE"
      ? `You are recording that ${clinicLabel} paid you ${fmt(amount)}`
      : `You are recording that you paid ${clinicLabel} ${fmt(amount)}`;

  return (
    <p className="text-sm font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
      {text}
    </p>
  );
}

export { validateTransactionFields };
