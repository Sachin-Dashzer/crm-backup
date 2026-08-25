"use client";

import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";
import TransactionsListPage from "@/components/transactions/TransactionsListPage";

export default function AllTransactionsPage() {
  return <TransactionsListPage Sidebar={SuperAdminSidebar} />;
}
