"use client";

import { useState, useEffect } from "react";
import { 
  Package,
  LayoutDashboard,
  Users,
  Edit,
  ShoppingCart,
  FileCheck,
  LogOut,
  X,
  Menu,
  Building2
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "../LogoutButton";

const NavItem = ({ item, href, isActive, onClick, icon: Icon }) => (
  <Link href={href} className="block w-full">
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-300 flex items-center gap-3 ${
        isActive
          ? "bg-emerald-100 text-emerald-700 font-semibold shadow-sm"
          : "text-gray-600 hover:bg-gray-100 font-medium"
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="grow">{item}</span>
      {isActive && <div className="w-1 h-6 bg-emerald-600 rounded-full"></div>}
    </button>
  </Link>
);

export default function StockSidebar({ sidebarOpen, setSidebarOpen }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const name = document.cookie
      .split('; ')
      .find(row => row.startsWith('userName='))
      ?.split('=')[1];
    if (name) setUserName(decodeURIComponent(name));
  }, []);

  const navItems = [
    { name: "Dashboard", path: "/stocks/dashboard", icon: LayoutDashboard },
    { name: "Create Stock", path: "/stocks/create", icon: Building2 },
    { name: "Add Stock", path: "/stocks/addStock", icon: ShoppingCart },
    { name: "All Transaction", path: "/stocks/transactions", icon: Building2 },
    { name: "Create Transaction", path: "/stocks/transactions/create", icon: FileCheck },
    { name: "Vendors", path: "/stocks/vendors", icon: Users },
    { name: "Add Vendor", path: "/stocks/vendors/create", icon: Users },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen && setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 lg:sticky w-80 bg-white border-r shadow-sm p-6 space-y-6 z-50 h-screen transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center my-3 justify-between">
          <Link href="/stocks" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-linear-to-r from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">LearCRM</h1>
              <p className="text-xs text-gray-500">Stock Management</p>
            </div>
          </Link>
          <button 
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
            onClick={() => setSidebarOpen && setSidebarOpen(false)}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Quick Stats */}
        {/* <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-gray-600">Total Items</span>
            </div>
            <p className="text-lg font-bold text-gray-900">--</p>
          </div>
          <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-teal-600" />
              <span className="text-xs text-gray-600">Low Stock</span>
            </div>
            <p className="text-lg font-bold text-gray-900">--</p>
          </div>
        </div> */}

        {/* Navigation */}
        <nav className="flex-1 mt-5 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => (
            <NavItem
              key={item.name}
              item={item.name}
              href={item.path}
              icon={item.icon}
              isActive={pathname === item.path}
              onClick={() => setSidebarOpen && setSidebarOpen(false)}
            />
          ))}
        </nav>

        {/* User Info & Logout */}
        <div className="space-y-3 border-t pt-4">
          <div className="p-3 bg-linear-to-r from-emerald-50 to-teal-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-r from-emerald-600 to-teal-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{userName}</p>
                <p className="text-xs text-gray-600">Stock Manager</p>
              </div>
            </div>
          </div>

          <LogoutButton />
        </div>
      </aside>
    </>
  );
}