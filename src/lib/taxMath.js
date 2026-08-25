// THE GST/TDS breakdown. Dependency-free so the entry forms and the server import the
// identical function — the live breakdown a user sees at entry time is computed by the
// same code that writes the payables, so the two cannot drift.
//
// The rule that is easy to get wrong, and the whole reason this lives in one place:
//
//   *** TDS IS COMPUTED ON THE BASE AMOUNT, EXCLUDING GST. ***
//
// Worked example — rent, 20,000 base, GST 10%, TDS 10%:
//
//   base (net)          20,000
//   GST @10%             2,000   display only — never becomes a payable
//   invoice total       22,000   = base + GST
//   TDS @10% ON BASE     2,000   = 20,000 x 10%, NOT 22,000 x 10%
//   paid to vendor      20,000   = invoice total - TDS
//   paid to government   2,000   = TDS
//
// Conservation invariant, asserted by the verification script and true for every rate
// combination: vendorPayable + tdsPayable === invoiceTotal. That invariant is what pins
// the vendor figure down. Reading "base -> vendor payable" as vendorPayable === base
// only coincides at gstAmount === tdsAmount (as in the example above); it breaks
// conservation at every other rate pair, and would silently change the pre-existing
// GST-untucked behaviour (20,000 base, 10% TDS -> vendor 18,000) that shipped earlier.

// Money is rupees-and-paise; keep every intermediate off binary-float edges.
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A direct rupee entry always wins over a rate. Returns 0 when neither is usable, so an
// unticked/blank section contributes nothing rather than NaN.
function resolveAmount({ directAmount, rate, applyTo }) {
  if (directAmount !== undefined && directAmount !== null && directAmount !== "") {
    const parsed = parseFloat(directAmount);
    return Number.isFinite(parsed) ? round2(parsed) : 0;
  }
  if (rate !== undefined && rate !== null && rate !== "") {
    const parsedRate = parseFloat(rate);
    if (!Number.isFinite(parsedRate)) return 0;
    return round2((applyTo * parsedRate) / 100);
  }
  return 0;
}

export function computeTaxBreakdown({
  baseAmount,
  includeGST = false,
  gstRate,
  gstAmount,
  includeTDS = false,
  tdsRate,
  tdsAmount,
  tdsCategory,
} = {}) {
  const base = round2(baseAmount);

  const gst = includeGST
    ? resolveAmount({ directAmount: gstAmount, rate: gstRate, applyTo: base })
    : 0;
  const invoiceTotal = round2(base + gst);

  // applyTo is `base`, never `invoiceTotal` — this is the confirmed rule.
  const tds = includeTDS
    ? resolveAmount({ directAmount: tdsAmount, rate: tdsRate, applyTo: base })
    : 0;

  const vendorPayable = round2(invoiceTotal - tds);

  return {
    baseAmount: base,
    gstRate: includeGST && gstRate !== "" && gstRate != null ? parseFloat(gstRate) : null,
    gstAmount: gst,
    invoiceTotal,
    tdsApplied: includeTDS && tds > 0,
    tdsRate: includeTDS && tdsRate !== "" && tdsRate != null ? parseFloat(tdsRate) : null,
    tdsAmount: tds,
    tdsCategory: includeTDS ? tdsCategory || "" : "",
    // What actually gets written:
    vendorPayable, // -> vendor payable (or, for a direct payment, the amount paid)
    tdsPayable: tds, // -> separate "Taxes" payable; 0 means none is created
    // GST deliberately has no corresponding payable field. It is embedded in
    // invoiceTotal/vendorPayable and recorded for display, nothing more.
  };
}

// Shape stored on Transactions.taxDetails. Kept here so every writer produces the same
// keys and a reader never has to guess which are present.
export function toTaxDetails(breakdown) {
  return {
    baseAmount: breakdown.baseAmount,
    gstRate: breakdown.gstRate,
    gstAmount: breakdown.gstAmount,
    invoiceTotal: breakdown.invoiceTotal,
    tdsApplied: breakdown.tdsApplied,
    tdsRate: breakdown.tdsRate,
    tdsAmount: breakdown.tdsAmount,
    tdsCategory: breakdown.tdsCategory,
  };
}
