"use client";
import StaffTable from "@/components/StaffTable";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";

// Super-admin: view-only, no add/delete
const CONFIG = {
  SidebarComponent: SuperAdminSidebar,
  addEmployeePath: null,
  editBasePath:    "/admin/employees/update",
  canDelete:       false,
};

export default function SuperAdminEmployeesPage() {
  return <StaffTable config={CONFIG} />;
}
