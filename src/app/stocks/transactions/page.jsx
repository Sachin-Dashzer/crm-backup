"use client";

import { Suspense } from "react";
import Sidebar from "@/components/Sidebars/StockSidebar";
import TransactionTable from "@/components/TransactionTable";

const CONFIG = {
  title:           "Stock Transactions",
  subtitle:        "Medicine and expense transaction records",
  columns:         ["date","patient","branch","category","procedure","method","amount","remarks"],
  actions:         ["edit","bill"],
  editBasePath:    "/stocks/transactions/edit",
  showCsvExport:   true,
  defaultPageSize: 25,
  pageSizeOptions: [25, 50, 100],
  filters: {
    showCostType:    false,
    showCategory:    true,
    showMethod:      true,
    showPaymentType: false,
    showBranch:      true,
  },
};

export default function StocksTransactionsPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full" /></div>}>
        <TransactionTable config={CONFIG} />
      </Suspense>
    </div>
  );
}
