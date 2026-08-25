"use client";

import AdminSidebar from "@/components/Sidebars/Sidebar";
import TransactionsListPage from "@/components/transactions/TransactionsListPage";

export default function AllTransactionsPage() {
  return <TransactionsListPage Sidebar={AdminSidebar} />;
}
