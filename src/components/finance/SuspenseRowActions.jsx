"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

// A suspense entry lives in the SuspenseEntry collection, not Transactions — same reasoning as
// ContraRowActions: no edit/delete route resolves its _id, so it links into the existing
// Suspense manager (SuspenseManager, under the Transactions page's "Suspense" tab) instead,
// which already owns resolve/cancel for these entries.
export default function SuspenseRowActions() {
  return (
    <Link
      href="/admin/transactions?category=SUSPENSE"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
    >
      <HelpCircle className="w-3.5 h-3.5" /> Manage
    </Link>
  );
}
