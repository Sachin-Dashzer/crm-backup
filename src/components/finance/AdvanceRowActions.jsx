"use client";

import Link from "next/link";
import { HandCoins } from "lucide-react";

export default function AdvanceRowActions() {
  return (
    <Link
      href="/admin/financing?tab=advances"
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
    >
      <HandCoins className="w-3.5 h-3.5" /> Manage
    </Link>
  );
}
