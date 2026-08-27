"use client";

import { HandCoins, History, Plus } from "lucide-react";
import { StatusBadge } from "@/lib/financeUI";
import LockedBadge from "./LockedBadge";

// Level-3 (document) row actions for the Liabilities page's "Borrowings" section — a document
// there is a real Payable, but its lifecycle is Record Repayment / Add Tranche, not the generic
// Record Payment/Revise/Cancel every other Payable gets (see DrillDownTable's
// renderDocumentActions override, and the Payable model's own note that a "Borrowings" payable
// is never created any way other than through this flow). Deliberately no Cancel action here —
// cancelling means cancelling a specific Borrowing row (IN or OUT), which only makes unambiguous
// sense per-row; see /api/borrowings/[id]'s PATCH for that guarded capability, exposed for a
// later pass rather than a document-level button that would have to guess which row is meant.
export default function BorrowingDocumentActions({ row, onRepay, onTranche, onHistory }) {
  const pending = row.pending ?? Math.max((row.totalAmount || 0) - (row.paid || 0), 0);

  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
      {row.isCancelled ? (
        <StatusBadge status="Cancelled" />
      ) : row.lockReason ? (
        <LockedBadge reason={row.lockReason} />
      ) : (
        <>
          {pending > 0 && (
            <button
              onClick={() => onRepay(row)}
              title="Record Repayment"
              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              <HandCoins className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onTranche(row)}
            title="Add Tranche"
            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      <button
        onClick={() => onHistory(row)}
        title="View History"
        className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100"
      >
        <History className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
