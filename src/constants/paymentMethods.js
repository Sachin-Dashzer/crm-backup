// The single source of truth for which payment methods each kind of transaction FORM offers.
//
// SCOPE — read before changing anything here:
// This file restricts what the UI *offers*. It must never be used to validate what the
// database *accepts*. The `method` enum in src/models/Transactions.js is deliberately wider
// and stays wider: it holds values that real stored rows still use, and narrowing it would
// make those rows fail validation on their next save. Retiring a method from a form is a
// presentation decision; retiring it from the schema is data loss.
//
// Direction of the three bank-transfer methods: they name the account money LEFT FROM, so
// they are expense-side only. See EXPENSE_METHOD_ACCOUNT_MAP in src/constants/bankRouting.js,
// which maps exactly these three (plus cash) to their account — the two lists agree by design.

// Display labels for every value in the Transactions.method enum, including ones no form
// offers any more. Legacy values still have to render readably when an old row is opened,
// so this map covers the full enum rather than only the offered subset.
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

// Expense forms offer exactly these four: cash, plus the three accounts money can leave from.
// Everything previously offered (card / upi / bajaj_loan / fibe_loan / banking) is retired from
// entry but still renders on existing rows via withLegacyMethod().
export const EXPENSE_METHODS = [
  opt("cash"),
  opt("hdfc_skin_bank_transfer"),
  opt("icici_medihub_bank_transfer"),
  opt("hdfc_ryan_medihub_bank_transfer"),
];

// Revenue forms: money coming in. The three bank-transfer methods are excluded because they
// describe money going out — they have never appeared on a revenue row in this database.
export const REVENUE_METHODS = [
  opt("cash"),
  opt("card"),
  opt("upi"),
  opt("bajaj_loan"),
  opt("fibe_loan"),
  opt("banking"),
];

// Builds the full option list for a form, including the conditional non-cash entries.
//
// paid_to_external / paid_by_other are now offered on EDIT as well as create. They were
// withheld from edit because their side effect — an atomically created payable/receivable —
// existed only in the create routes, so selecting one while editing would persist the method
// with no counterpart document. Since these methods are excluded from revenue and expense
// totals (UNSETTLED_METHODS) on the understanding that the linked document gets settled later
// by a transaction that DOES count, a missing document meant the amount left the books
// entirely. The update routes now run syncExternalPartyOnUpdate (src/lib/externalPartyDerivation.js),
// which creates, updates or cancels that document to match the edit, so the gap is closed.
//
// `forEdit` still drops including-package: that one signals "bundled into an already-paid
// package" at the point of sale and has no edit-time counterpart. Offset settlement has no
// side effect and has always been available in both.
export function getMethodOptions(category, { forEdit = false } = {}) {
  const isExpense = category === "EXPENSE";
  const base = isExpense ? EXPENSE_METHODS : REVENUE_METHODS;

  // Medicine can be bundled into an already-paid transplant package — no cash of its own.
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

// Returns `options` with `currentValue` appended as a disabled "(legacy)" entry when that
// value is no longer offered.
//
// Why this exists: a <select> whose value isn't among its options renders as blank. The user
// sees an empty method field, saves an unrelated change, and the stored method is silently
// overwritten with "". Appending the value keeps it visible and selected so an untouched
// field round-trips unchanged. `disabled` stops anyone newly picking a retired method while
// still letting the browser display it as the current selection.
//
// Pass-through when currentValue is empty or already offered, so callers can wrap
// unconditionally without branching.
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
