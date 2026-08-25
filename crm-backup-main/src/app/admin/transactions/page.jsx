"use client";

import TransactionsListPage from "@/components/transactions/TransactionsListPage";

export default function AllTransactionsPage() {
  // No Sidebar prop: /admin routes get theirs from src/app/admin/layout.jsx, which keeps it
  // mounted across navigations. Other roles still pass their own.
  return <TransactionsListPage />;
}
