"use client";
import StockDashboard from "@/components/StockDashboard";

// No SidebarComponent: /admin routes get theirs from src/app/admin/layout.jsx.
const CONFIG = {
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
