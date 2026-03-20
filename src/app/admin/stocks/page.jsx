"use client";
import StockDashboard from "@/components/StockDashboard";
import Sidebar from "@/components/Sidebars/Sidebar";

const CONFIG = {
  SidebarComponent: Sidebar,
  showAddStock:  true,
  addStockPath:  "/stocks/create",
  showPurchase:  true,
  purchasePath:  "/stocks/addStock",
  editBasePath:  "/stocks/edit",
  viewBasePath:  "/stocks/view",
};

export default function AdminStocksPage() {
  return <StockDashboard config={CONFIG} />;
}
