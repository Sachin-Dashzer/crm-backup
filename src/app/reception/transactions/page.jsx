"use client";

import { Suspense } from "react";
import Sidebar from "@/components/Sidebars/ReceptionSidebar";
import TransactionTable from "@/components/TransactionTable";

const CONFIG = {
  title:           "Transactions",
  subtitle:        "Revenue & expense transactions",
  columns:         ["date","patient","branch","procedure","paymentType","method","amount"],
  actions:         ["edit","bill","delete"],
  editBasePath:    "/reception/transactions/edit",
  createPath:      "/reception/transactions/create",
  showCsvExport:   false,
  defaultPageSize: 25,
  pageSizeOptions: [25, 50, 100],
  filters: {
    showCostType:    false,
    showCategory:    true,
    showMethod:      true,
    showPaymentType: true,
    showBranch:      false,
  },
};

export default function ReceptionTransactionsPage() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full" /></div>}>
        <TransactionTable config={CONFIG} />
      </Suspense>
    </div>
  );
}
