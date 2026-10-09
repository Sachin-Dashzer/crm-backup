"use client";

import StaffTable from "@/components/StaffTable";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";

const CONFIG = {
  SidebarComponent: SalesSidebar,
  addEmployeePath: "/sales/employees/add-employee",
  editBasePath:    "/sales/employees/update",
  canDelete:       false, // Sales MUST NEVER be able to delete employees
};

export default function SalesEmployeesPage() {
  return <StaffTable config={CONFIG} />;
}
