"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  IndianRupee,
  BarChart3,
  TrendingUp,
  Shield,
  UserPlus,
  X,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import LogoutButton from "../LogoutButton";

const NavItem = ({ item, href, isActive, onClick, icon: Icon, badge }) => (
  <Link href={href} className="block w-full">
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-3 group ${
        isActive
          ? "bg-linear-to-r from-indigo-100 to-purple-100 text-indigo-700 font-semibold shadow-sm"
          : "text-gray-600 hover:bg-gray-50 font-medium hover:text-indigo-600"
      }`}
    >
      <Icon
        className={`w-5 h-5 ${
          isActive ? "text-indigo-600" : "group-hover:text-indigo-500"
        }`}
      />
      <span className="grow">{item}</span>
      {badge && (
        <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
          {badge}
        </span>
      )}
      {isActive && (
        <div className="w-1 h-6 bg-linear-to-b from-indigo-600 to-purple-600 rounded-full"></div>
      )}
    </button>
  </Link>
);

const NavSection = ({ title, children }) => (
  <div className="mb-4">
    <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
      {title}
    </h3>
    <div className="space-y-1">{children}</div>
  </div>
);

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("Admin");

  const { data: session } = useSession();

  useEffect(() => {
    if (session) {
      // Log everything at once
      console.table({
        "Full Name": session.user?.name,
        Email: session.user?.email,
        Role: session.user?.role,
        Branch: session.user?.branch,
        "User ID": session.user?.id,
      });

      // Set username
      setUserName(session.user?.email || "Admin");
    }
  }, [session]);

  
  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 lg:sticky w-80 bg-linear-to-b from-white to-gray-50 border-r border-gray-200 shadow-xl p-6 space-y-6 z-50 h-screen transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl bg-linear-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Ryan Clinic
              </h1>
              <p className="text-xs text-gray-500 font-medium">
                Admin Control Center
              </p>
            </div>
          </Link>
          <button
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto mt-4 scrollbar-hide">
          {/* Main Section */}
          <NavSection title="">
            <NavItem
              item="Dashboard"
              href="/admin/dashboard"
              icon={LayoutDashboard}
              isActive={pathname === "/admin/dashboard"}
              onClick={() => setSidebarOpen(false)}
            />
          </NavSection>

          {/* Management Section */}
          <NavSection title="Management">
            <NavItem
              item="Patients"
              href="/admin/patients"
              icon={Users}
              isActive={
                pathname === "/admin/patients" ||
                pathname.startsWith("/admin/patients/")
              }
              onClick={() => setSidebarOpen(false)}
            />
            {/* <NavItem
              item="Add Patient"
              href="/admin/add-patient"
              icon={UserPlus}
              isActive={pathname === "/admin/add-patient"}
              onClick={() => setSidebarOpen(false)}
            /> */}
            <NavItem
              item="Employees"
              href="/admin/employees"
              icon={UserCog}
              isActive={pathname === "/admin/employees"}
              onClick={() => setSidebarOpen(false)}
            />
          </NavSection>

          {/* Financial Section */}
          <NavSection title="Financial">
            <NavItem
              item="Amounts"
              href="/admin/amounts"
              icon={IndianRupee}
              isActive={pathname === "/admin/amounts"}
              onClick={() => setSidebarOpen(false)}
            />
            <NavItem
              item="View Bills"
              href="/admin/view-bill"
              icon={IndianRupee}
              isActive={pathname === "/admin/view-bill"}
              onClick={() => setSidebarOpen(false)}
            />
          </NavSection>

          {/* Analytics Section */}
          <NavSection title="Analytics">
            <NavItem
              item="Reports"
              href="/admin/reports"
              icon={BarChart3}
              isActive={pathname === "/admin/reports"}
              onClick={() => setSidebarOpen(false)}
            />
            <NavItem
              item="Performance"
              href="/admin/performance"
              icon={TrendingUp}
              isActive={pathname === "/admin/performance"}
              onClick={() => setSidebarOpen(false)}
            />
          </NavSection>

          {/* System Section */}
          <NavSection title="Settings">
            <NavItem
              item="User Log"
              href="/admin/manage-users"
              icon={UserCog}
              isActive={pathname === "/admin/manage-users"}
              onClick={() => setSidebarOpen(false)}
            />
            {/* <NavItem
              item="Settings"
              href="/admin/settings"
              icon={Settings}
              isActive={pathname === "/admin/settings"}
              onClick={() => setSidebarOpen(false)}
            /> */}
          </NavSection>
        </nav>
        {/* User Info & Logout */}
        <div className="space-y-3 border-t pt-4">
          <div className="p-3 bg-linear-to-r from-green-50 to-emerald-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                <Shield className="w-6 h-6 text-white" />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {userName}
                </p>
                <p className="text-xs text-gray-600">Admin Panel</p>
              </div>
            </div>
          </div>

          <LogoutButton />
        </div>{" "}
      </aside>
    </>
  );
}
