// Single source of truth for how a transaction row is classified in the /admin/transactions
// list and its Entry Type filter — labels + badge colours only. Purely presentational: the
// classification itself (deriveEntryType) lives in the get-all route, next to the fields it
// reads, and is never persisted (see that route's header comment).
export const ENTRY_TYPES = {
  REGULAR: { label: "Regular", tone: "gray" },
  RECEIPT_SETTLEMENT: { label: "Receipt (Settlement)", tone: "emerald" },
  PAYMENT_SETTLEMENT: { label: "Payment (Settlement)", tone: "rose" },
  EXTERNAL_RECEIPT: { label: "Paid to External", tone: "amber" },
  EXTERNAL_PAYMENT: { label: "Paid by Other", tone: "amber" },
  NON_CASH: { label: "Non-Cash", tone: "slate" },
  REVERSAL: { label: "Reversal", tone: "purple" },
};

// Tailwind classes per tone — kept here (not inline in the badge component) so a new tone only
// ever needs adding in one place.
export const ENTRY_TYPE_TONE_CLASSES = {
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
};

export const ENTRY_TYPE_FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "REGULAR", label: "Regular only" },
  { value: "SETTLEMENT", label: "Settlements only" },
  { value: "EXTERNAL", label: "External party only" },
  { value: "REVERSAL", label: "Reversals only" },
];
