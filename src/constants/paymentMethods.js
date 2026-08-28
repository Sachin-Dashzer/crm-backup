
export const METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  banking: "Bank Transfer",
  bajaj_loan: "Bajaj Loan",
  fibe_loan: "Fibe Loan",
  hdfc_skin_bank_transfer: "HDFC Skin Bank Transfer",
  hdfc_ryan_medihub_bank_transfer: "HDFC Ryan Medihub Bank Transfer",
  icici_medihub_bank_transfer: "ICICI Medihub Bank Transfer",
  offset_settlement: "Offset Settlement",
  "including-package": "Including Package",
  paid_to_external: "Paid to External",
  paid_by_other: "Paid by Other",
  other: "Other",
};

const opt = (value) => ({ value, label: METHOD_LABELS[value] || value });

export const EXPENSE_METHODS = [
  opt("cash"),
  opt("hdfc_skin_bank_transfer"),
  opt("icici_medihub_bank_transfer"),
  opt("hdfc_ryan_medihub_bank_transfer"),
];

export const REVENUE_METHODS = [
  opt("cash"),
  opt("card"),
  opt("upi"),
  opt("bajaj_loan"),
  opt("fibe_loan"),
  opt("banking"),
];

export function getMethodOptions(category, { forEdit = false } = {}) {
  const isExpense = category === "EXPENSE";
  const base = isExpense ? EXPENSE_METHODS : REVENUE_METHODS;

  const withPackage =
    !isExpense && category === "MEDICINE" && !forEdit
      ? [...base, opt("including-package")]
      : base;

  return [
    ...withPackage,
    opt("offset_settlement"),
    opt(isExpense ? "paid_by_other" : "paid_to_external"),
  ];
}

export function withLegacyMethod(options, currentValue) {
  if (!currentValue) return options;
  if (options.some((o) => o.value === currentValue)) return options;
  return [
    ...options,
    {
      value: currentValue,
      label: `${METHOD_LABELS[currentValue] || currentValue} (legacy)`,
      disabled: true,
    },
  ];
}
