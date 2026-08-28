
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
    vendorPayable,
    tdsPayable: tds,
  };
}

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
