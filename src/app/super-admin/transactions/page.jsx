"use client";

import { Suspense } from "react";
import Sidebar from "@/components/Sidebars/SuperAdminSidebar";
import TransactionTable from "@/components/TransactionTable";

const CONFIG = {
  title:           "Transactions",
  subtitle:        "All revenue and expense records across branches",
  columns:         ["date","patient","branch","category","costType","procedure","paymentType","method","amount"],
  actions:         ["edit","view","bill"],
  editBasePath:    "/admin/transactions/edit",
  viewBasePath:    "/super-admin/patients",
  showCsvExport:   true,
  defaultPageSize: 50,
  pageSizeOptions: [25, 50, 100, 200],
  filters: {
    showCostType:    true,
    showCategory:    true,
    showMethod:      true,
    showPaymentType: true,
    showBranch:      true,
  },
};

export default function SuperAdminTransactionsPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full" /></div>}>
        <TransactionTable config={CONFIG} />
      </Suspense>
    </div>
  );
}
