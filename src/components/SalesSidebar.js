"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  LayoutDashboard,
  Users,
  Calendar,
  UserCog,
  UserPlus,
  DollarSign,
  BarChart3,
  TrendingUp,
  Target,
  Award,
  LogOut,
  X,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NavItem = ({ item, href, isActive, onClick, icon: Icon }) => (
  <Link href={href} className="block w-full">
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-3 ${
        isActive
          ? "bg-purple-100 text-purple-700 font-semibold shadow-sm"
          : "text-gray-600 hover:bg-gray-100 font-medium"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="flex-grow">{item}</span>
      {isActive && <div className="w-1 h-6 bg-purple-600 rounded-full"></div>}
    </button>
  </Link>
);

export default function SalesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("User");
  const [data , setdata] = useState({})

  useEffect(() => {
    const name = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userName="))
      ?.split("=")[1];
    if (name) setUserName(decodeURIComponent(name));
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/sidebar");
        if (!res.ok) throw new Error("Failed to fetch patient data");
        const ptdata = await res.json();
        setdata(ptdata);
      } catch (e) {
        console.log(e);
      }
    };
    fetchData();
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/sales/dashboard", icon: LayoutDashboard },
    { name: "Patients", path: "/sales/patients", icon: Users },
    {
      name: "Book Appointment",
      path: "/sales/book-appointment",
      icon: Calendar,
    },
    { name: "Agents", path: "/sales/agents", icon: UserCog },
    // { name: "Add Agents", path: "/sales/add-agents", icon: UserPlus },
    { name: "Transactions", path: "/sales/transactions", icon: DollarSign },
    { name: "Reports", path: "/sales/reports", icon: BarChart3 },
    { name: "Performance", path: "/sales/performance", icon: TrendingUp },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 lg:sticky w-80 bg-white border-r shadow-sm p-6 space-y-6 z-50 h-screen transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/sales/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">Ryan Clinic</h1>
              <p className="text-xs text-gray-500">Sales Panel</p>
            </div>
          </Link>
          <button
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">Target</span>
            </div>
            <p className="text-sm font-bold text-gray-900">₹180L</p>
          </div>
          <div className="p-3 bg-pink-50 rounded-lg border border-pink-100">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-4 h-4 text-pink-600" />
              <span className="text-xs text-gray-600">Achieved</span>
            </div>
            <p className="text-sm font-bold text-gray-900">₹{data ? data.finalvalue : 0}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide mt-3">
          {navItems.map((item) => (
            <NavItem
              key={item.name}
              item={item.name}
              href={item.path}
              icon={item.icon}
              isActive={pathname === item.path}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="space-y-3 border-t pt-4">
          <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {userName}
                </p>
                <p className="text-xs text-gray-600">Sales Team</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
