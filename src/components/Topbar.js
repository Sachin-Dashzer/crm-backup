"use client";

import { Menu, Bell, Search } from "lucide-react";
import { useState } from "react";

export default function Topbar({
  setSidebarOpen,
  timeRange,
  setTimeRange,
  branch,
  setBranch,
  customDates,
  setCustomDates,
  role
}) {
  const [showNotifications, setShowNotifications] = useState(false);

  const branches = ['All', 'Mumbai', 'Delhi', 'Hyderabad'];
  const timeRanges = ['Today', 'Yesterday', 'Last 7 Days', 'Custom'];

  return (
    <div className="mb-6 lg:mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
         
          <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
            >
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

          {/* Time Range Filter */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-sm"
          >
            {timeRanges.map((range) => (
              <option key={range} value={range}>{range}</option>
            ))}
          </select>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 sm:w-80 bg-white rounded-lg shadow-lg border z-50">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="p-4 text-sm text-gray-600">
                  No new notifications
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      {timeRange === 'Custom' && setCustomDates && (
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={customDates?.from || ''}
            onChange={(e) => setCustomDates({ ...customDates, from: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            type="date"
            value={customDates?.to || ''}
            onChange={(e) => setCustomDates({ ...customDates, to: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  );
}
