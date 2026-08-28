"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  Users,
  UserCheck,
  UserX,
  Calendar,
  BarChart2,
  Clock,
} from "lucide-react";
import HRSidebar from "@/components/Sidebars/HRSidebar";

const reports = [
  {
    id: "employees",
    title: "All Employees Report",
    description: "Complete list of all employees with role, contact, and status",
    icon: Users,
    color: "from-violet-500 to-indigo-600",
    includes: ["Name, Phone, Email", "Role & Active Status", "Linked Patient Count", "Date Joined"],
  },
  {
    id: "employees-by-role",
    title: "Employees by Role",
    description: "Summary of employee count grouped by role",
    icon: BarChart2,
    color: "from-blue-500 to-cyan-600",
    includes: ["Role Name", "Total Count", "Active Count", "Inactive Count"],
  },
  {
    id: "candidates",
    title: "All Candidates Report",
    description: "Full candidate list with application details and evaluation scores",
    icon: FileText,
    color: "from-emerald-500 to-green-600",
    includes: ["Name, Position, Contact", "Experience & Salary", "Application Status", "HR Comments & Remarks"],
  },
  {
    id: "candidates",
    title: "Selected Candidates",
    description: "List of candidates who have been selected",
    icon: UserCheck,
    color: "from-teal-500 to-emerald-600",
    includes: ["Candidate Details", "Position Applied", "Expected Salary", "Previous Company"],
    statusFilter: "Selected",
  },
  {
    id: "candidates",
    title: "Rejected Candidates",
    description: "List of candidates who have been rejected",
    icon: UserX,
    color: "from-red-500 to-rose-600",
    includes: ["Candidate Details", "Position Applied", "Rejection Stage", "Final Remarks"],
    statusFilter: "Rejected",
  },
  {
    id: "interview-schedule",
    title: "Interview Schedule",
    description: "All candidates with scheduled interviews sorted by date",
    icon: Calendar,
    color: "from-amber-500 to-orange-600",
    includes: ["Candidate Name & Contact", "Position", "Interview Date", "Experience & Salary"],
  },
];

export default function HRReportsPage() {
  const [loading, setLoading] = useState({});
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });

  const downloadReport = async (report) => {
    const key = report.title;
    setLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const params = new URLSearchParams({ type: report.id });
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (report.statusFilter) params.append("status", report.statusFilter);

      const res = await fetch(`/api/hr/reports?${params}`);
      const data = await res.json();

      if (data.success && data.csvData) {
        const blob = new Blob([data.csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.filename}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        alert(data.message || "Failed to generate report");
      }
    } catch (err) {
      console.error("Report download error:", err);
      alert("Failed to download report. Please try again.");
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HRSidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">Download HR reports in CSV format</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Date Range Filter (optional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            {(filters.startDate || filters.endDate) && (
              <button
                onClick={() => setFilters({ startDate: "", endDate: "" })}
                className="mt-3 text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear dates
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
              >
                <div className={`h-1.5 bg-linear-to-r ${report.color}`} />
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 bg-linear-to-br ${report.color} rounded-lg shrink-0`}>
                      <report.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">{report.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Includes</p>
                    <ul className="space-y-1">
                      {report.includes.map((item, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-violet-500 rounded-full shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => downloadReport(report)}
                    disabled={loading[report.title]}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-linear-to-r ${report.color} text-white rounded-lg text-sm font-semibold transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading[report.title] ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download CSV
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-violet-50 border border-violet-200 rounded-xl p-5">
            <div className="flex gap-3">
              <FileText className="h-5 w-5 text-violet-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Report Information</p>
                <ul className="text-sm text-gray-600 space-y-0.5">
                  <li>• All reports are downloaded in CSV format</li>
                  <li>• Use the date range filter to scope reports to a specific period</li>
                  <li>• Leave dates empty to include all records</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
