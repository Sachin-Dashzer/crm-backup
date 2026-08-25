"use client";
import StaffTable from "@/components/StaffTable";

// No SidebarComponent: /admin routes get theirs from src/app/admin/layout.jsx.
const CONFIG = {
  addEmployeePath: "/admin/employees/add-employee",
  editBasePath:    "/admin/employees/update",
  canDelete:       false,
};

export default function AdminEmployeesPage() {
  return <StaffTable config={CONFIG} />;
}
