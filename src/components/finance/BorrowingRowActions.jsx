"use client";

import Link from "next/link";
import { HandCoins } from "lucide-react";

// A borrowing lives in the Borrowing collection, not Transactions — same reasoning as
// ContraRowActions/SuspenseRowActions: no /admin/transactions/edit/[id] route resolves its _id,
// and unlike contra/suspense it has NO manager tab on /admin/transactions either (borrowings are
// deliberately never surfaced there — see that page's own note). Its actual actions (Record
// Repayment / Add Tranche) live on the Liabilities page's own Borrowings section instead, so
// this just links there rather than opening anything itself.
export default function BorrowingRowActions() {
  return (
    <Link
      href="/admin/liabilities?section=borrowings"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100"
    >
      <HandCoins className="w-3.5 h-3.5" /> Manage
    </Link>
  );
}
