"use client";

import { useState, useCallback } from "react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  FileBarChart,
  Download,
  CalendarDays,
  Users,
  Trophy,
  TrendingUp,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Eye,
  Filter,
  ArrowRight,
  AlertCircle,
  Table,
  ClipboardList,
  UserCheck,
  Clock,
  Activity,
} from "lucide-react";

const BRANCHES = ["All", "Delhi", "Mumbai", "Hyderabad", "Noida", "Gurgaon"];
const DATE_RANGES = ["Today", "Yesterday", "Last 7 Days", "This Month", "All Time", "Custom"];

const REPORT_DEFINITIONS = [
  {
    id: "appointments",
    title: "Appointments & Consultations Report",
    description: "Scheduled patient consultations, visit dates, clinical statuses, and assigned telecallers",
    icon: CalendarDays,
    accent: "bg-blue-600",
    color: "text-blue-600",
    iconBg: "bg-blue-50 border-blue-200",
    badge: "Scheduling",
    badgeColor: "bg-blue-50 text-blue-600 border-blue-200",
    fields: ["Visit Date", "Patient Name", "Branch", "Status", "Quoted Technique", "Quoted Package", "Reference Agent", "Counsellor"],
  },
  {
    id: "leads",
    title: "Sales Leads & Inquiries Report",
    description: "Lead acquisition records, quote amounts, visit status, and conversion tracking across branches",
    icon: Users,
    accent: "bg-indigo-600",
    color: "text-indigo-600",
    iconBg: "bg-indigo-50 border-indigo-200",
    badge: "Pipeline",
    badgeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
    fields: ["Created Date", "Patient Name", "Branch", "Visit Date", "Status", "Quoted Technique", "Package", "Telecaller", "Amount Received"],
  },
  {
    id: "agent-performance",
    title: "Sales Agent Performance Report",
    description: "Performance scorecard strictly for sales telecallers: inquiries managed, conversions, and settled collections",
    icon: Trophy,
    accent: "bg-purple-600",
    color: "text-purple-600",
    iconBg: "bg-purple-50 border-purple-200",
    badge: "Agents Only",
    badgeColor: "bg-purple-50 text-purple-600 border-purple-200",
    fields: ["Agent Name", "Branch", "Status", "Total Leads", "Consultations", "Converted", "Conversion Rate %", "Total Revenue", "Avg Rev/Lead"],
  },
  {
    id: "revenue",
    title: "Revenue & Collections Ledger Report",
    description: "Itemized transaction records, payment methods, procedure types, and bank transaction IDs",
    icon: TrendingUp,
    accent: "bg-emerald-600",
    color: "text-emerald-600",
    iconBg: "bg-emerald-50 border-emerald-200",
    badge: "Financial",
    badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
    fields: ["Date", "Patient Name", "Branch", "Category", "Procedure", "Payment Type", "Method", "Amount (INR)", "Transaction ID"],
  },
  {
    id: "summary",
    title: "Executive Sales Summary Report",
    description: "High-level summary of total leads, portfolio conversion rate, total revenue, and active telecaller count",
    icon: BarChart3,
    accent: "bg-amber-600",
    color: "text-amber-600",
    iconBg: "bg-amber-50 border-amber-200",
    badge: "Executive",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    fields: ["Period", "Branch", "Total Leads", "Total Converted", "Conversion Rate %", "Total Revenue", "Active Agents"],
  },
  {
    id: "patients",
    title: "Patients Directory Report",
    description: "Complete directory of all registered patients with registration date, branch, stage, conversion status, and billed amounts",
    icon: ClipboardList,
    accent: "bg-cyan-600",
    color: "text-cyan-600",
    iconBg: "bg-cyan-50 border-cyan-200",
    badge: "Directory",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    fields: ["Registration Date", "Patient Name", "Age", "Gender", "Branch", "Current Stage", "Conversion Status", "Sales Agent", "Quoted Technique", "Total Billed", "Amount Received"],
  },
  {
    id: "converted-patients",
    title: "Converted Patients Report",
    description: "Patients who have been converted to surgery or completed procedures, including surgery dates and settled revenue",
    icon: UserCheck,
    accent: "bg-teal-600",
    color: "text-teal-600",
    iconBg: "bg-teal-50 border-teal-200",
    badge: "Converted",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    fields: ["Conversion Date", "Patient Name", "Branch", "Status", "Surgery Date", "Quoted Technique", "Sales Agent", "Total Billed", "Amount Received"],
  },
  {
    id: "pending-leads",
    title: "Pending Leads Report",
    description: "Active leads that have not yet converted or been disqualified — still in the sales pipeline requiring follow-up",
    icon: Clock,
    accent: "bg-orange-500",
    color: "text-orange-600",
    iconBg: "bg-orange-50 border-orange-200",
    badge: "Pipeline",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    fields: ["Created Date", "Patient Name", "Branch", "Current Status", "Visit Date", "Days Since Created", "Sales Agent", "Quoted Technique", "Quoted Package"],
  },
  {
    id: "daily-summary",
    title: "Daily Activity Summary Report",
    description: "Day-by-day breakdown of new registrations, consultations held, conversions achieved, and daily revenue collected",
    icon: Activity,
    accent: "bg-rose-600",
    color: "text-rose-600",
    iconBg: "bg-rose-50 border-rose-200",
    badge: "Daily",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    fields: ["Date", "Branch", "New Registrations", "Consultations", "New Conversions", "Revenue Collected"],
  },
];

function getISTDate(d = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default function SalesReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [dateRange, setDateRange] = useState("This Month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const buildDateParams = useCallback(() => {
    const now = new Date();
    let dateFrom = "";
    let dateTo = "";

    if (dateRange === "Today") {
      dateFrom = getISTDate(now);
      dateTo = getISTDate(now);
    } else if (dateRange === "Yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      dateFrom = getISTDate(y);
      dateTo = getISTDate(y);
    } else if (dateRange === "Last 7 Days") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      dateFrom = getISTDate(past);
      dateTo = getISTDate(now);
    } else if (dateRange === "This Month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = getISTDate(start);
      dateTo = getISTDate(now);
    } else if (dateRange === "Custom" && customFrom) {
      dateFrom = customFrom;
      dateTo = customTo || customFrom;
    }

    return { dateFrom, dateTo };
  }, [dateRange, customFrom, customTo]);

  // Genuine CSV download from GET /api/sales/reports
  const downloadReport = async (reportId) => {
    setDownloadingId(reportId);
    try {
      const { dateFrom, dateTo } = buildDateParams();
      const params = new URLSearchParams({
        type: reportId,
        format: "csv",
      });

      if (selectedBranch !== "All") params.set("branch", selectedBranch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/sales/reports?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-${reportId}-${getISTDate(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report download failed:", err);
      alert("Failed to generate report. Please verify connection and try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Preview table data from backend
  const previewReport = async (report) => {
    setPreviewingId(report.id);
    setPreviewTitle(report.title);
    try {
      const { dateFrom, dateTo } = buildDateParams();
      const params = new URLSearchParams({
        type: report.id,
      });

      if (selectedBranch !== "All") params.set("branch", selectedBranch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/sales/reports?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setPreviewData(json.data || []);
      }
    } catch (err) {
      console.error("Report preview failed:", err);
      alert("Failed to load report preview.");
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
      <SalesSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/80 flex items-center justify-center">
                <FileBarChart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Sales Reports & CSV Exports
                </h1>
                <p className="text-xs text-slate-500">
                  Generate, inspect, and export verified CRM sales reports and agent scorecards
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5" />
                View-Only
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Branch Filter */}
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Filter by Branch
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b === "All" ? "All Operational Branches" : `${b} Clinic`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period Preset */}
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Report Timeframe
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  {DATE_RANGES.map((d) => (
                    <option key={d} value={d}>
                      Period: {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Note */}
              <div className="flex flex-col justify-end">
                <span className="text-xs text-slate-500">
                  Exports are generated directly by <code className="text-blue-600 font-mono">/api/sales/reports</code> in compliant RFC-4180 CSV format.
                </span>
              </div>
            </div>

            {/* Custom Dates Row */}
            {dateRange === "Custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">From Date</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">To Date</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_DEFINITIONS.map((report) => {
              const Icon = report.icon;
              const isDownloading = downloadingId === report.id;
              const isPreviewing = previewingId === report.id;

              return (
                <div
                  key={report.id}
                  className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 sm:p-6 flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-md transition-all shadow-xs group"
                >
                  <div className={`absolute inset-x-0 top-0 h-[3px] ${report.accent || "bg-blue-600"}`} />
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${report.iconBg}`}>
                        <Icon className={`w-6 h-6 ${report.color}`} />
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${report.badgeColor}`}>
                        {report.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900 tracking-tight">
                        {report.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {report.description}
                      </p>
                    </div>

                    {/* Included Fields */}
                    <div className="pt-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">
                        Export Columns:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {report.fields.map((f, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => previewReport(report)}
                      disabled={isPreviewing || isDownloading}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50 border border-slate-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isPreviewing ? "Loading..." : "Preview"}
                    </button>
                    <button
                      onClick={() => downloadReport(report.id)}
                      disabled={isDownloading || isPreviewing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      <Download className={`w-3.5 h-3.5 ${isDownloading ? "animate-bounce" : ""}`} />
                      {isDownloading ? "Generating..." : "Download CSV"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Data Preview Drawer */}
          {previewData && (
            <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm space-y-3 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Table className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{previewTitle} Preview</h3>
                    <p className="text-xs text-slate-500">
                      Showing first {previewData.length} records generated by backend
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewData(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                >
                  Close Preview
                </button>
              </div>

              {previewData.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No records returned for current filter parameters.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 sticky top-0 text-[10px] uppercase tracking-wider text-slate-500">
                        {Object.keys(previewData[0] || {}).map((header, i) => (
                          <th key={i} className="px-3.5 py-2.5 whitespace-nowrap font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                          {Object.values(row).map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap"
                            >
                              {String(val ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
