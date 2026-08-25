"use client";
import StaffTable from "@/components/StaffTable";
import HRSidebar from "@/components/Sidebars/HRSidebar";

const CONFIG = {
  SidebarComponent: HRSidebar,
  addEmployeePath: "/hr/employees/add-employee",
  editBasePath:    "/hr/employees/update",
  canDelete:       true,
};

export default function HREmployeesPage() {
  return <StaffTable config={CONFIG} />;
}
