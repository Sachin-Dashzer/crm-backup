"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  HeartPulse,
  CalendarDays,
  Users,
  UsersRound,
  Receipt,
  BarChart3,
  FileBarChart,
  X,
  Menu,
  Zap,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { name: "Dashboard",      path: "/sales/dashboard",        icon: LayoutDashboard },
  { name: "Patients",       path: "/sales/patients",         icon: HeartPulse },
  { name: "Appointments",   path: "/sales/book-appointment", icon: CalendarDays },
  { name: "Sales Agents",   path: "/sales/agents",           icon: Users },
  { name: "Employees",      path: "/sales/employees",        icon: UsersRound },
  { name: "Transactions",   path: "/sales/transactions",     icon: Receipt },
  { name: "Reports",        path: "/sales/reports",          icon: FileBarChart },
  { name: "Performance",    path: "/sales/performance",      icon: BarChart3 },
];

function NavItem({ item, href, isActive, onClick }) {
  const Icon = item.icon;
  return (
    <Link href={href} className="block w-full" onClick={onClick}>
      <div
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-150 cursor-pointer ${
          isActive
            ? "bg-blue-50 text-blue-600 font-semibold shadow-xs border border-blue-100/80"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        }`}
      >
        <Icon
          className={`w-4.5 h-4.5 shrink-0 transition-colors ${
            isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
          }`}
        />
        <span className="text-sm grow">{item.name}</span>
        {isActive && (
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        )}
      </div>
    </Link>
  );
}

export default function SalesSidebar() {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();

  const userName = session?.user?.name || "Sales User";
  const userBranch = session?.user?.branch || "—";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-700"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 lg:sticky w-72 bg-white border-r border-slate-200 h-screen z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand header */}
        <div className="px-5 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <Link href="/sales/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-slate-900 font-bold text-sm tracking-tight leading-none">
                  RyanMediHub
                </p>
                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-widest mt-0.5">
                  Sales Panel
                </p>
              </div>
            </Link>
            <button
              className="lg:hidden p-1.5 hover:bg-slate-100 rounded-md transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* View-only badge */}
        <div className="mx-4 mt-3 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200/80 flex items-center gap-2 shadow-2xs">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[11px] text-amber-800 font-medium">Sales Workspace</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold px-3 mb-2">
            Navigation
          </p>
          {navItems.map((item) => (
            <NavItem
              key={item.name}
              item={item}
              href={item.path}
              isActive={pathname === item.path || pathname.startsWith(item.path + "/")}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate">{userBranch} · Sales</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150 text-sm font-medium"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
