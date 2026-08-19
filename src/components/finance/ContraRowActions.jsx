"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";

// A contra transfer lives in the AccountTransfer collection, not Transactions — it has no
// /admin/transactions/edit/[id] counterpart (that route resolves a Transactions _id) and no
// DELETE_ENDPOINTS entry, so it gets its own action instead of Edit/Delete: a link into the
// existing Contra manager (ContraManager, rendered under the Transactions page's own "Contra"
// tab), which already owns full contra CRUD. This row never offers Settle/Cancel Loan either —
// see DrillDownTable's leafActions, which never calls this for a row that IS itself a transfer.
export default function ContraRowActions() {
  return (
    <Link
      href="/admin/transactions?category=CONTRA"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100"
    >
      <ArrowLeftRight className="w-3.5 h-3.5" /> Manage
    </Link>
  );
}
