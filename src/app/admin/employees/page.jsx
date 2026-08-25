"use client";
import StaffTable from "@/components/StaffTable";
import Sidebar from "@/components/Sidebars/Sidebar";

const CONFIG = {
  SidebarComponent: Sidebar,
  addEmployeePath: "/admin/employees/add-employee",
  editBasePath:    "/admin/employees/update",
  canDelete:       false,
};

export default function AdminEmployeesPage() {
  return <StaffTable config={CONFIG} />;
}
