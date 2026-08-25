"use client";
import StockDashboard from "@/components/StockDashboard";
import StockSidebar from "@/components/Sidebars/StockSidebar";

const CONFIG = {
  SidebarComponent: StockSidebar,
  showAddStock:  true,
  addStockPath:  "/stocks/create",
  showPurchase:  true,
  purchasePath:  "/stocks/addStock",
  editBasePath:  "/stocks/edit",
  viewBasePath:  "/stocks/view",
};

export default function StocksDashboardPage() {
  return <StockDashboard config={CONFIG} />;
}
