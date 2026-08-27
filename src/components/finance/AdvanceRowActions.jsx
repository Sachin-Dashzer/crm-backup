"use client";

import Link from "next/link";
import { HandCoins } from "lucide-react";

// An advance lives in the Advance collection, not Transactions — exact mirror of
// BorrowingRowActions. No /admin/transactions/edit/[id] route resolves its _id, and it has no
// manager tab on /admin/transactions either. Its actual actions (Record Recovery / Further
// Advance) live on the Assets page's own Advances section / the dedicated /admin/advances page.
export default function AdvanceRowActions() {
  return (
    <Link
      href="/admin/advances"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
    >
      <HandCoins className="w-3.5 h-3.5" /> Manage
    </Link>
  );
}
