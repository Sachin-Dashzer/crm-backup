"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { ReversedBadge, ReversalBadge } from "./StatusBadges";
import LockedBadge from "./LockedBadge";

export default function LoanRowActions({ row, onSettle, onCancel }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/transactions/${row._id}/cancel-loan`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setStatus(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row._id]);

  if (row.reversalOf) return <ReversalBadge reason={row.reversalReason} />;
  if (row.isReversed) return <ReversedBadge />;
  if (row.lockReason) return <LockedBadge reason={row.lockReason} />;
  if (row.approvalStatus && row.approvalStatus !== "APPROVED") return null;

  if (loading) {
    return <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin inline" />;
  }

  const fullySettled = status && status.remaining <= 0 && status.totalSettled > 0;
  if (fullySettled) {
    return (
      <Link
        href="/admin/transactions?category=CONTRA"
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold rounded-lg hover:bg-sky-100"
        title={`Settled — ${status.settlementTransfers?.length || 1} transfer(s)`}
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> Settled
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSettle(status)}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-lg hover:bg-orange-100"
      >
        <ArrowRightLeft className="w-3.5 h-3.5" /> Settle
      </button>
      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100"
      >
        <Ban className="w-3.5 h-3.5" /> Cancel Loan
      </button>
    </div>
  );
}
