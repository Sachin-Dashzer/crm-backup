"use client";

import { TDS_TAX_TYPES } from "@/constants/expenseCategories";
import { computeTaxBreakdown } from "@/lib/taxMath";

// Shared "Include GST" / "Include TDS" controls plus the live breakdown panel, used by both
// the Payable Expenses and Direct Payments sections so the two can never disagree about the
// arithmetic. The numbers shown here come from src/lib/taxMath.js — the exact same function
// the server runs when it writes the payables, so what the user audits at entry time is what
// gets stored.
//
// `allowTDS` is false for Direct Payments: that section pays in full when logged and creates
// no payables, and TDS necessarily creates a "Taxes" payable for the withheld amount.
//
// `value` shape: { includeGST, gstRate, gstAmount, includeTDS, tdsRate, tdsAmount, tdsCategory }
// `baseAmount` is the net-of-GST amount the user typed into the section's Amount field.

const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function TaxBreakdownFields({
  value = {},
  baseAmount,
  onChange,
  allowTDS = true,
  // Visual tint so the block sits naturally inside either the amber payable panel or a
  // plain white card.
  tone = "amber",
}) {
  const base = parseFloat(baseAmount) || 0;
  const breakdown = computeTaxBreakdown({
    baseAmount: base,
    includeGST: value.includeGST,
    gstRate: value.gstRate,
    gstAmount: value.gstAmount,
    includeTDS: allowTDS && value.includeTDS,
    tdsRate: value.tdsRate,
    tdsAmount: value.tdsAmount,
    tdsCategory: value.tdsCategory,
  });

  const border = tone === "amber" ? "border-amber-300" : "border-gray-300";
  const divider = tone === "amber" ? "border-amber-200" : "border-gray-200";
  const labelColor = tone === "amber" ? "text-amber-800" : "text-gray-700";

  const set = (patch) => onChange({ ...value, ...patch });

  const showBreakdown = base > 0 && (breakdown.gstAmount > 0 || breakdown.tdsAmount > 0);

  return (
    <div className={`border-t ${divider} pt-3 space-y-3`}>
      {/* ── Include GST ── */}
      <div>
        <label className={`flex items-center gap-2 text-xs font-medium ${labelColor}`}>
          <input
            type="checkbox"
            checked={!!value.includeGST}
            onChange={(e) =>
              set({ includeGST: e.target.checked, gstRate: "", gstAmount: "" })
            }
          />
          Include GST
        </label>

        {value.includeGST && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              value={value.gstRate ?? ""}
              onChange={(e) => set({ gstRate: e.target.value, gstAmount: "" })}
              placeholder="GST rate (%)"
              className={`px-2 py-1.5 border ${border} rounded-lg text-sm`}
            />
            <input
              type="number"
              min="0"
              value={
                value.gstAmount ||
                (breakdown.gstAmount ? breakdown.gstAmount.toFixed(2) : "")
              }
              onChange={(e) => set({ gstAmount: e.target.value, gstRate: "" })}
              placeholder="GST amount (₹)"
              className={`px-2 py-1.5 border ${border} rounded-lg text-sm`}
            />
          </div>
        )}
      </div>

      {/* ── Include TDS ── */}
      {allowTDS && (
        <div>
          <label className={`flex items-center gap-2 text-xs font-medium ${labelColor}`}>
            <input
              type="checkbox"
              checked={!!value.includeTDS}
              onChange={(e) =>
                set({
                  includeTDS: e.target.checked,
                  tdsCategory: "",
                  tdsRate: "",
                  tdsAmount: "",
                })
              }
            />
            Include TDS
          </label>

          {value.includeTDS && (
            <div className="mt-2 space-y-2">
              <select
                value={value.tdsCategory || ""}
                onChange={(e) => set({ tdsCategory: e.target.value })}
                className={`w-full px-2 py-1.5 border ${border} rounded-lg text-sm`}
              >
                <option value="">TDS category</option>
                {TDS_TAX_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  value={value.tdsRate ?? ""}
                  onChange={(e) => set({ tdsRate: e.target.value, tdsAmount: "" })}
                  placeholder="TDS rate (%)"
                  className={`px-2 py-1.5 border ${border} rounded-lg text-sm`}
                />
                <input
                  type="number"
                  min="0"
                  value={
                    value.tdsAmount ||
                    (breakdown.tdsAmount ? breakdown.tdsAmount.toFixed(2) : "")
                  }
                  onChange={(e) => set({ tdsAmount: e.target.value, tdsRate: "" })}
                  placeholder="TDS amount (₹)"
                  className={`px-2 py-1.5 border ${border} rounded-lg text-sm`}
                />
              </div>
              {value.includeGST && (
                <p className="text-[11px] text-gray-600">
                  TDS is calculated on the base amount ({formatCurrency(breakdown.baseAmount)}),
                  excluding GST.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Live breakdown — auditable at entry time ── */}
      {showBreakdown && (
        <div className="bg-white/70 border border-gray-200 rounded-lg p-3 text-xs">
          <p className="font-semibold text-gray-700 mb-2">Breakdown</p>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-500">Base (net) amount</dt>
              <dd className="font-medium text-gray-900">
                {formatCurrency(breakdown.baseAmount)}
              </dd>
            </div>
            {breakdown.gstAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">
                  GST{breakdown.gstRate ? ` @${breakdown.gstRate}%` : ""}
                  <span className="text-gray-400"> · display only</span>
                </dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(breakdown.gstAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-1">
              <dt className="text-gray-500">Invoice total</dt>
              <dd className="font-semibold text-gray-900">
                {formatCurrency(breakdown.invoiceTotal)}
              </dd>
            </div>
            {breakdown.tdsAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">
                  TDS{breakdown.tdsRate ? ` @${breakdown.tdsRate}%` : ""} on base
                </dt>
                <dd className="font-medium text-rose-600">
                  −{formatCurrency(breakdown.tdsAmount)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1">
              <dt className="font-semibold text-gray-700">
                {allowTDS && breakdown.tdsAmount > 0 ? "Payable to vendor" : "Net payable"}
              </dt>
              <dd className="font-bold text-emerald-700">
                {formatCurrency(breakdown.vendorPayable)}
              </dd>
            </div>
            {breakdown.tdsAmount > 0 && (
              <div className="flex justify-between">
                <dt className="font-semibold text-gray-700">Payable to government (TDS)</dt>
                <dd className="font-bold text-amber-700">
                  {formatCurrency(breakdown.tdsPayable)}
                </dd>
              </div>
            )}
          </dl>
          {breakdown.gstAmount > 0 && (
            <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-100">
              GST is recorded for reference only — it never becomes a payable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
