"use client";

import { Lock } from "lucide-react";

// Shown in place of edit/delete on a leaf row whose (account, date) falls inside a closed
// AccountPeriod — reuses the same Lock icon DrillDownTable's txColumns already renders for the
// payables/receivables leaf, just promoted to a real, titled badge now that Task 3 gives every
// leaf row (transactions, contra, suspense) the same lock treatment.
export default function LockedBadge({ reason }) {
  return (
    <span
      title={reason || "This period is closed"}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
    >
      <Lock className="w-3 h-3" /> Locked
    </span>
  );
}
