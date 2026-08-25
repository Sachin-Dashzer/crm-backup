"use client";
import StockDashboard from "@/components/StockDashboard";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";

// Super-admin: view-only, no add/purchase/edit buttons
const CONFIG = {
  SidebarComponent: SuperAdminSidebar,
  title:         "Inventory Overview",
  subtitle:      "Read-only view of stock across all branches",
  showAddStock:  false,
  showPurchase:  false,
  editBasePath:  null,
  viewBasePath:  "/stocks/view",
};

export default function SuperAdminStocksPage() {
  return <StockDashboard config={CONFIG} />;
}
