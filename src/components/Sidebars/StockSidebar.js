"use client";

import { useState, useEffect } from "react";
import {
  Boxes,
  LayoutDashboard,
  Package,
  PackagePlus,
  PackageCheck,
  ArrowLeftRight,
  FilePlus2,
  Store,
  UserPlus,
  ClipboardList,
  X,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LogoutButton from "../LogoutButton";

const NavItem = ({ item, href, isActive, onClick, icon: Icon }) => (
  <Link href={href} className="block w-full">
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group hover:scale-[1.01] ${
        isActive
          ? "bg-emerald-100 text-emerald-700 font-semibold shadow-sm border border-emerald-200"
          : "text-gray-600 hover:bg-gray-50 hover:shadow-sm font-medium"
      }`}
    >
      <Icon className={`w-4.5 h-4.5 shrink-0 transition-all duration-200 ${isActive ? "text-emerald-600 scale-110" : "text-gray-400 group-hover:text-emerald-500 group-hover:scale-110"}`} />
      <span className="grow">{item}</span>
      {isActive && <div className="w-2 h-2 rounded-full bg-emerald-500 nav-dot-pulse-emerald"></div>}
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
    { name: "Dashboard",          path: "/stocks/dashboard",            icon: LayoutDashboard },
    { name: "Create Stock",       path: "/stocks/create",               icon: PackagePlus },
    { name: "Add Stock",          path: "/stocks/addStock",             icon: PackageCheck },
    { name: "All Transactions",   path: "/stocks/transactions",         icon: ArrowLeftRight },
    { name: "New Transaction",    path: "/stocks/transactions/create",  icon: FilePlus2 },
    { name: "Vendors",            path: "/stocks/vendors",              icon: Store },
    { name: "Add Vendor",         path: "/stocks/vendors/create",       icon: UserPlus },
    { name: "Stock Audit",        path: "/stocks/audit",                icon: ClipboardList },
  ];

  return (
    <>
      <button
        onClick={() => setSidebarOpen && setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6 text-gray-700" />
      </button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen && setSidebarOpen(false)}
        ></div>
      )}

      <aside
        className={`fixed left-0 top-0 lg:sticky w-80 bg-white border-r shadow-sm p-6 space-y-6 z-50 h-screen transition-transform duration-300 flex flex-col ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center my-3 justify-between">
          <Link href="/stocks" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-linear-to-r from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center brand-glow">
              <Boxes className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">RyanCRM</h1>
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