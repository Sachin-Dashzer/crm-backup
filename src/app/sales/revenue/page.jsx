"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Revenue section has been permanently removed from the Sales Panel.
 * Any direct visits are redirected to Sales Transactions.
 */
export default function SalesRevenueRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/transactions");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Redirecting to Transactions...</p>
      </div>
    </div>
  );
}
