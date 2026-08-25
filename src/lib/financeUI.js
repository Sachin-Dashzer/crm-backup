// Shared visual language for the Receivables / Payables / Transactions pages — imported by all
// three so status colors and money/date formatting can never drift apart between them.

export const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

export const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// One palette for every status word that appears across all three pages — Payable's "Paid" and
// Receivable's "Received" are both settled, so they share the same green, etc.
export const STATUS_STYLES = {
  Pending: "bg-gray-100 text-gray-600 border-gray-200",
  "Partially Paid": "bg-amber-100 text-amber-700 border-amber-200",
  "Partially Received": "bg-amber-100 text-amber-700 border-amber-200",
  Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Received: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Overdue: "bg-red-100 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-400 border-gray-200 line-through",
  // Collab-settlement case statuses share the same palette — OPEN is unresolved (grey, like
  // Pending), SETTLED is resolved (green, like Paid/Received), CANCELLED matches exactly.
  OPEN: "bg-gray-100 text-gray-600 border-gray-200",
  SETTLED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-400 border-gray-200 line-through",
  // Transaction approvalStatus (WhatsApp expense approval workflow) — PENDING carries real
  // urgency (needs action), unlike a Payable's "Pending" (just not due yet), so it gets amber
  // rather than gray. APPROVED shares the same green as Paid/Received.
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
        STATUS_STYLES[status] || "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}
