"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

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
