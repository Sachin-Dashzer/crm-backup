"use client";

import { HandCoins, History, Plus } from "lucide-react";
import { StatusBadge } from "@/lib/financeUI";
import LockedBadge from "./LockedBadge";

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
