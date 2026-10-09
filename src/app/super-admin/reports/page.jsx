"use client";

import { useState, useMemo, useEffect } from "react";
import SuperAdminSidebar from "@/components/Sidebars/SuperAdminSidebar";
import { MAIN_BRANCHES, COLLAB_BRANCHES, ALL_BRANCHES } from "@/lib/branches";
import {
  Download,
  Filter,
  Search,
  Calendar,
  FileText,
  Users,
  IndianRupee,
  Activity,
  TrendingUp,
  BarChart2,
  Star,
  X,
  RotateCw,
  ChevronDown,
  Package,
  Megaphone,
  Briefcase,
  Stethoscope,
  HeartPulse,
  FileBarChart,
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  History,
  LayoutGrid,
  List,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";

const BRANCHES = ["All", ...ALL_BRANCHES];

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const DATE_PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "last7" },
  { label: "Last 30 Days", value: "last30" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "All Time", value: "allTime" },
  { label: "Custom Range", value: "custom" },
];

const TECHNIQUES = [
  "Sapphire FUE",
  "DHI",
  "Turkish DHI",
  "Beard Transplant",
  "PRP",
  "Alopecia",
  "Headwash",
  "GFC",
  "Other",
];

const PROCEDURES = [
  "Sapphire FUE",
  "DHI",
  "Turkish DHI",
  "Beard Transplant",
  "PRP",
  "GFC",
  "Medicine",
  "Other",
];

const PAYMENT_TYPES = ["Booking", "Pending", "Full-payment", "Other"];

const PATIENT_STATUSES = [
  "NEW",
  "NOT_VISITED",
  "NOT_CONVERTED",
  "CONSULTED",
  "SURGERY_BOOKED",
  "BOOKING_DONE",
  "CLOSED",
];

const HR_STATUSES = [
  "Applied",
  "Interview Scheduled",
  "Selected",
  "Rejected",
  "On Hold",
];

const COLOR_MAP = {
  amber:  { accent: "bg-amber-500",   soft: "bg-amber-50",   text: "text-amber-700",  border: "border-amber-200",  badge: "bg-amber-100 text-amber-700" },
  orange: { accent: "bg-orange-500",  soft: "bg-orange-50",  text: "text-orange-700", border: "border-orange-200", badge: "bg-orange-100 text-orange-700" },
  blue:   { accent: "bg-blue-500",    soft: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",   badge: "bg-blue-100 text-blue-700" },
  green:  { accent: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-700",border: "border-emerald-200",badge: "bg-emerald-100 text-emerald-700" },
  purple: { accent: "bg-purple-500",  soft: "bg-purple-50",  text: "text-purple-700", border: "border-purple-200", badge: "bg-purple-100 text-purple-700" },
  red:    { accent: "bg-red-500",     soft: "bg-red-50",     text: "text-red-700",    border: "border-red-200",    badge: "bg-red-100 text-red-700" },
  indigo: { accent: "bg-indigo-500",  soft: "bg-indigo-50",  text: "text-indigo-700", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-700" },
  teal:   { accent: "bg-teal-500",    soft: "bg-teal-50",    text: "text-teal-700",   border: "border-teal-200",   badge: "bg-teal-100 text-teal-700" },
  pink:   { accent: "bg-pink-500",    soft: "bg-pink-50",    text: "text-pink-700",   border: "border-pink-200",   badge: "bg-pink-100 text-pink-700" },
};

const REPORTS = [
  {
    id: 1,
    type: "patients-comprehensive",
    category: "Patient Reports",
    name: "Comprehensive Patient Report",
    description: "Complete master record — demographics, medical history, counselling packages, surgical notes, and payments.",
    icon: HeartPulse,
    filters: ["branch", "status", "technique", "staff"],
  },
  {
    id: 2,
    type: "patients-status",
    category: "Patient Reports",
    name: "Patient Status Pipeline",
    description: "Conversion lifecycle analysis across all status stages from initial contact through to completed surgery.",
    icon: Activity,
    filters: ["branch", "status"],
  },
  {
    id: 3,
    type: "patients-medical",
    category: "Patient Reports",
    name: "Medical History Report",
    description: "Clinical patient records including blood group, allergies, vitals, diabetes, hypertension, HIV, and HCV.",
    icon: FileText,
    filters: ["branch"],
  },
  {
    id: 4,
    type: "patients-surgery",
    category: "Patient Reports",
    name: "Surgery Schedule Report",
    description: "Detailed surgical manifest — allocated surgeons, technicians, technique, graft count, and aftercare plan.",
    icon: Stethoscope,
    filters: ["branch", "staff"],
  },
  {
    id: 5,
    type: "patients-counselling",
    category: "Patient Reports",
    name: "Counselling Outcomes Report",
    description: "Pre-op consultations breakdown — recommended techniques, quoted packages, procedure readiness, and medicines.",
    icon: ClipboardList,
    filters: ["branch", "staff"],
  },
  {
    id: 6,
    type: "outstanding-payments",
    category: "Patient Reports",
    name: "Outstanding Payments Report",
    description: "Accounts receivable log of patients with pending balances, ordered by highest outstanding dues.",
    icon: IndianRupee,
    filters: ["branch", "status"],
  },
  {
    id: 7,
    type: "grafts-analysis",
    category: "Patient Reports",
    name: "Grafts Analysis Report",
    description: "Surgical precision auditing — suggested vs planned vs successfully implanted grafts with implantation efficiency.",
    icon: BarChart2,
    filters: ["branch", "technique"],
  },

  {
    id: 8,
    type: "employees-all",
    category: "Staff Reports",
    name: "All Employees Master List",
    description: "Enterprise staff directory with role assignments, operational branch, contact info, and patient count.",
    icon: Users,
    filters: ["branch"],
  },
  {
    id: 9,
    type: "counsellors",
    category: "Staff Reports",
    name: "Counsellor Performance",
    description: "Counsellor metrics — lead conversion rates, package values, and surgical readiness velocity.",
    icon: TrendingUp,
    filters: ["branch", "staff"],
  },
  {
    id: 10,
    type: "agents",
    category: "Staff Reports",
    name: "Agent Referral Performance",
    description: "Agent attribution metrics — total referral volume, qualified consults, and revenue generated per agent.",
    icon: Users,
    filters: ["branch", "staff"],
  },
  {
    id: 11,
    type: "doctors",
    category: "Staff Reports",
    name: "Doctor Performance Report",
    description: "Surgical productivity — total operations performed, technique distribution, and grafts implanted per surgery.",
    icon: Activity,
    filters: ["branch", "staff", "technique"],
  },
  {
    id: 12,
    type: "implanters",
    category: "Staff Reports",
    name: "Implanter Efficiency Report",
    description: "Technical implanter throughput — procedure count, graft handling, and average grafts implanted per case.",
    icon: BarChart2,
    filters: ["branch", "staff"],
  },
  {
    id: 13,
    type: "technicians",
    category: "Staff Reports",
    name: "Technician Workload Report",
    description: "Paramedical staff utilization — senior tech hours, grafting person allocations, and helper distributions.",
    icon: Briefcase,
    filters: ["branch", "staff"],
  },

  {
    id: 14,
    type: "revenue",
    category: "Financial Reports",
    name: "Gross Revenue Report",
    description: "Itemized gross collections across all centers with payment modes (UPI, Cash, Cards, Loans), and amounts.",
    icon: IndianRupee,
    filters: ["branch", "procedure", "paymentType"],
  },
  {
    id: 15,
    type: "expenses",
    category: "Financial Reports",
    name: "Expenses & Disbursements",
    description: "Operational expenditure trail — clinical inventory, doctor payouts, clinic maintenance, and vendor payouts.",
    icon: IndianRupee,
    filters: ["branch"],
  },
  {
    id: 16,
    type: "transactions-all",
    category: "Financial Reports",
    name: "Complete Transaction Ledger",
    description: "Consolidated financial audit — combined credits and debits with transaction IDs, mode, and timestamps.",
    icon: FileText,
    filters: ["branch", "procedure", "paymentType"],
  },
  {
    id: 17,
    type: "procedure-revenue",
    category: "Financial Reports",
    name: "Procedure-wise Revenue",
    description: "Revenue contribution breakdown by procedure category (FUE, DHI, Turkish DHI, PRP, GFC, Medicine).",
    icon: BarChart2,
    filters: ["branch", "procedure"],
  },
  {
    id: 18,
    type: "techniques",
    category: "Financial Reports",
    name: "Technique Revenue Analysis",
    description: "Technique profitability matrix — graft volume, average case price, and gross revenue per surgical technique.",
    icon: BarChart2,
    filters: ["branch", "technique"],
  },
  {
    id: 19,
    type: "branch-comparison",
    category: "Financial Reports",
    name: "Branch Comparison Matrix",
    description: "Cross-center benchmarking — patients handled, surgical volume, revenue, expenses, and net profit.",
    icon: TrendingUp,
    filters: [],
  },

  {
    id: 20,
    type: "stocks-all",
    category: "Inventory Reports",
    name: "Stock Inventory Report",
    description: "Complete warehouse valuation — itemized on-hand quantity, purchase price, MRP, and total stock value.",
    icon: Package,
    filters: [],
  },
  {
    id: 21,
    type: "vendors-all",
    category: "Inventory Reports",
    name: "Vendor Registry & Orders",
    description: "Supplier profiles — contact personnel, GST numbers, product categories, and transaction counts.",
    icon: Briefcase,
    filters: [],
  },

  {
    id: 22,
    type: "leads-all",
    category: "Leads Reports",
    name: "Inbound Leads Master Log",
    description: "Omnichannel lead records — source tags, location, planned visit dates, remarks, and creation dates.",
    icon: Megaphone,
    filters: [],
  },

  {
    id: 30,
    type: "transaction-changes-log",
    category: "Audit Logs",
    name: "Transaction Changes Audit",
    description: "Immutable change history for payment edits — previous vs updated values, and editor details.",
    icon: History,
    filters: ["branch"],
    apiPath: "/api/super-admin/logs",
  },
  {
    id: 31,
    type: "stock-changes-log",
    category: "Audit Logs",
    name: "Inventory Edits Audit",
    description: "Audit trail for all stock adjustments — quantity changes, price adjustments, and timestamps.",
    icon: Package,
    filters: ["branch"],
    apiPath: "/api/super-admin/logs",
  },
  {
    id: 32,
    type: "patient-changes-log",
    category: "Audit Logs",
    name: "Patient Records Audit",
    description: "Compliance history of edits made to patient personal, medical, or counselling records across all clinics.",
    icon: ShieldAlert,
    filters: ["branch"],
    apiPath: "/api/super-admin/logs",
  },

  {
    id: 23,
    type: "hr-interviews-all",
    category: "HR Reports",
    name: "All Candidates Master Log",
    description: "Recruitment funnel — applied roles, interview status, experience, salary details, and evaluation scores.",
    icon: Users,
    filters: ["hrStatus"],
  },
  {
    id: 24,
    type: "hr-selected",
    category: "HR Reports",
    name: "Selected Candidates Roster",
    description: "Offers and selections — final agreed salary, position applied, experience, and HR remarks.",
    icon: CheckCircle2,
    filters: [],
  },
  {
    id: 25,
    type: "hr-rejected",
    category: "HR Reports",
    name: "Rejected Candidates Log",
    description: "Recruitment screening audit — candidate evaluation ratings, feedback notes, and documented rejection reasons.",
    icon: Users,
    filters: [],
  },
  {
    id: 26,
    type: "hr-position-wise",
    category: "HR Reports",
    name: "Position-wise HR Summary",
    description: "Talent pipeline breakdown — candidate count, selection rate, and average salary per applied position.",
    icon: BarChart2,
    filters: [],
  },
  {
    id: 27,
    type: "hr-evaluation-scores",
    category: "HR Reports",
    name: "Evaluation Scorecard Report",
    description: "Granular scoring breakdown — communication, technical expertise, personality, motivation, and stability.",
    icon: TrendingUp,
    filters: ["hrStatus"],
  },
  {
    id: 28,
    type: "hr-salary-analysis",
    category: "HR Reports",
    name: "Salary Analysis Matrix",
    description: "Compensation benchmarking — previous CTC vs expected vs final salary variance across all job profiles.",
    icon: IndianRupee,
    filters: [],
  },
];

const CATEGORIES = ["All", ...new Set(REPORTS.map((r) => r.category))];

function buildDateRange(preset, custom) {
  const now = new Date();

  if (preset === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "yesterday") {
    const from = new Date(now);
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "last7") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "last30") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "thisMonth") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "lastMonth") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  if (preset === "custom" && custom.from) {
    const from = new Date(custom.from);
    from.setHours(0, 0, 0, 0);
    const to = custom.to ? new Date(custom.to) : new Date(custom.from);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }
  return { from: null, to: null };
}

function PieChart(props) { return <BarChart2 {...props} />; }

function ReportCard({ report, filters, loadingId, favorites, onDownload, onToggleFavorite }) {
  const c = COLOR_MAP[report.color] || COLOR_MAP.blue;
  const Icon = report.icon;
  const isLoading = loadingId === report.id;
  const isFav = favorites.includes(report.id);

  return (
    <div
      className={`bg-white rounded-2xl border ${c.border} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group`}
    >
      <div className={`h-1 ${c.accent}`} />

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl ${c.soft} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <button
            onClick={() => onToggleFavorite(report.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              isFav ? "text-amber-500 bg-amber-50" : "text-gray-300 hover:text-amber-400 hover:bg-amber-50"
            }`}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`w-4 h-4 ${isFav ? "fill-amber-500" : ""}`} />
          </button>
        </div>

        <div className="mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${c.text} opacity-80`}>
            {report.category}
          </span>
          <h3 className="font-semibold text-gray-900 text-sm mt-0.5 leading-snug">
            {report.name}
          </h3>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">
          {report.description}
        </p>

        {report.filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {report.filters.includes("branch") && filters.branch && filters.branch !== "All" && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.branch}
              </span>
            )}
            {report.filters.includes("status") && filters.status && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.status}
              </span>
            )}
            {report.filters.includes("technique") && filters.technique && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.technique}
              </span>
            )}
            {report.filters.includes("procedure") && filters.procedure && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.procedure}
              </span>
            )}
            {report.filters.includes("paymentType") && filters.paymentType && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.paymentType}
              </span>
            )}
            {report.filters.includes("hrStatus") && filters.hrStatus && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                {filters.hrStatus}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => onDownload(report)}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${
            isLoading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : `${c.accent} text-white hover:opacity-90 hover:shadow-md active:scale-95`
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Excel
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-2xl shadow-xl border max-w-sm transition-all duration-300 ${
        isError ? "bg-red-50 border-red-200 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"
      }`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
      ) : (
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && <p className="text-xs mt-0.5 text-gray-600">{toast.message}</p>}
      </div>
      <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Report Preview Modal Component ────────────────────────────────────────── */
function formatCell(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return val.toLocaleString("en-IN");
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    return new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  return String(val);
}

function PreviewModal({ report, previewState, onClose, onDownloadExcel, onDownloadCSV }) {
  if (!report) return null;
  const Icon = report.icon;
  const { data, loading, error, totalCount } = previewState;
  const previewRows = data ? data.slice(0, 15) : [];
  const columns = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-base truncate">{report.name}</h3>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  {report.category}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{report.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-3 shrink-0"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Stats Bar */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            {loading ? (
              <span className="flex items-center gap-2 text-amber-600 font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                Fetching report data...
              </span>
            ) : error ? (
              <span className="text-red-600 font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Error loading data
              </span>
            ) : data && data.length > 0 ? (
              <span>
                Found <strong className="text-gray-900 font-bold">{totalCount}</strong> matching records. Showing first{" "}
                <strong className="text-gray-900 font-bold">{previewRows.length}</strong> in preview.
              </span>
            ) : (
              <span>No matching records found for active filters.</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => onDownloadCSV(report, data)}
              disabled={loading || !data || data.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              Export CSV
            </button>
            <button
              onClick={() => onDownloadExcel(report, data)}
              disabled={loading || !data || data.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Full Excel
            </button>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-900">Generating Report Preview...</p>
              <p className="text-xs text-gray-500 mt-1">Applying active date range and filter criteria</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Failed to Load Preview</h4>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">No Records Found</h4>
              <p className="text-xs text-gray-500 mt-1">
                There are no matching entries for the current date range and filter criteria. Try expanding your date range or clearing filters.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider sticky top-0 border-b border-gray-200 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center text-gray-400">#</th>
                      {columns.map((col) => (
                        <th key={col} className="py-2.5 px-3.5 whitespace-nowrap">
                          {col.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                        {columns.map((col) => (
                          <td key={col} className="py-2.5 px-3.5 whitespace-nowrap text-gray-800">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <span>Tip: Use full Excel download for complete formulas and multi-sheet summaries.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-200/80 hover:bg-gray-300 text-gray-700 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Favorites state (persisted in localStorage)
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sa_favoriteReports");
      if (stored) setFavorites(JSON.parse(stored));
    } catch {}
  }, []);

  const [datePreset, setDatePreset] = useState("last30");
  const [customDates, setCustomDates] = useState({ from: "", to: "" });
  const [pendingCustom, setPendingCustom] = useState({ from: "", to: "" });
  const [filters, setFilters] = useState({
    branch: "All",
    status: "",
    technique: "",
    staff: "",
    procedure: "",
    paymentType: "",
    hrStatus: "",
  });

  const showToast = (title, message, type = "success") => {
    setToast({ title, message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const toggleFavorite = (id, e) => {
    if (e) e.stopPropagation();
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem("sa_favoriteReports", JSON.stringify(next));
    } catch {}
  };

  const clearFilters = () => {
    setDatePreset("last30");
    setCustomDates({ from: "", to: "" });
    setPendingCustom({ from: "", to: "" });
    setFilters({
      branch: "All",
      status: "",
      technique: "",
      staff: "",
      procedure: "",
      paymentType: "",
      hrStatus: "",
    });
    setSearchTerm("");
    setFavoritesOnly(false);
  };

  const removeFilterKey = (key) => {
    if (key === "date") {
      setDatePreset("allTime");
      setCustomDates({ from: "", to: "" });
    } else if (key === "branch") {
      setFilters((prev) => ({ ...prev, branch: "All" }));
    } else {
      setFilters((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const applyCustomDates = () => {
    if (!pendingCustom.from) return;
    setCustomDates(pendingCustom);
    setDatePreset("custom");
  };

  const visibleReports = useMemo(() => {
    let list = REPORTS;
    if (activeCategory !== "All") {
      list = list.filter((r) => r.category === activeCategory);
    }
    if (favoritesOnly) {
      list = list.filter((r) => favorites.includes(r.id));
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.description.toLowerCase().includes(s) ||
          r.category.toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => {
      const af = favorites.includes(a.id);
      const bf = favorites.includes(b.id);
      if (af && !bf) return -1;
      if (!af && bf) return 1;
      return a.id - b.id;
    });
  }, [activeCategory, favoritesOnly, searchTerm, favorites]);

  const activeFilterCount = [
    filters.branch !== "All" && filters.branch,
    filters.status,
    filters.technique,
    filters.procedure,
    filters.paymentType,
    filters.hrStatus,
    datePreset !== "last30" && datePreset !== "allTime" && datePreset,
  ].filter(Boolean).length;

  const handleDownload = async (report) => {
    setLoadingId(report.id);

    try {
      const { from, to } = buildDateRange(datePreset, customDates);
      const isLogReport = !!report.apiPath;

      const params = new URLSearchParams({ type: report.type });

      if (from) params.append("from", from);
      if (to) params.append("to", to);

      if (filters.branch && filters.branch !== "All") params.append("branch", filters.branch);
      if (!isLogReport) {
        if (filters.status) params.append("statusFilter", filters.status);
        if (filters.technique) params.append("techniqueFilter", filters.technique);
        if (filters.staff) params.append("staffFilter", filters.staff);
        if (filters.procedure) params.append("procedureFilter", filters.procedure);
        if (filters.paymentType) params.append("paymentTypeFilter", filters.paymentType);
        if (filters.hrStatus) params.append("hrStatus", filters.hrStatus);
      }

      const endpoint = report.apiPath || "/api/super-admin/reports";
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || `Request failed (${res.status})`);
      }

      if (!result.data || result.data.length === 0) {
        showToast(
          "No Data Found",
          "Try adjusting the date range or filters.",
          "error"
        );
        return;
      }

      const { utils, writeFile } = await import("xlsx");
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(result.data);

      const cols = Object.keys(result.data[0] || {});
      ws["!cols"] = cols.map((k) => ({
        wch: Math.min(Math.max(k.length + 2, 12), 40),
      }));

      utils.book_append_sheet(wb, ws, "Report");

      const meta = [
        { Field: "Report Name", Value: report.name },
        { Field: "Category", Value: report.category },
        {
          Field: "Date Range",
          Value: datePreset === "custom" ? `${customDates.from} — ${customDates.to}` : datePreset,
        },
        { Field: "Branch Filter", Value: filters.branch || "All" },
        { Field: "Total Records", Value: reportData.length },
        { Field: "Generated At", Value: new Date().toLocaleString("en-IN") },
      ];
      const metaWs = utils.json_to_sheet(meta);
      metaWs["!cols"] = [{ wch: 20 }, { wch: 40 }];
      utils.book_append_sheet(wb, metaWs, "Info");

      const fileName = `${report.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`;
      writeFile(wb, fileName);
      showToast("Report Downloaded!", `${reportData.length} records saved as ${fileName}`);
    } catch (err) {
      console.error(err);
      showToast("Download Failed", err.message, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach((cat) => {
      counts[cat] = cat === "All" ? REPORTS.length : REPORTS.filter((r) => r.category === cat).length;
    });
    return counts;
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SuperAdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-md">
                    <FileBarChart className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Reports Center</h1>
                </div>
                <p className="text-sm text-gray-500 ml-12">
                  Generate and download {REPORTS.length} report & log types across all modules
                </p>
              </div>

              <div className="flex items-center gap-3 ml-12 sm:ml-0">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-semibold text-amber-700">{favorites.length} Favorited</span>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <Filter className="w-4.5 h-4.5 text-amber-600" />
                  <span className="font-semibold text-gray-900 text-sm">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                      {activeFilterCount} active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <span>{showAdvancedFilters ? "Hide" : "Show"} Advanced</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Date Range
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {DATE_PRESETS.filter((p) => p.value !== "custom").map((p) => (
                        <button
                          key={p.value}
                          onClick={() => setDatePreset(p.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            datePreset === p.value
                              ? "bg-amber-500 text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setDatePreset("custom")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          datePreset === "custom"
                            ? "bg-amber-500 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Branch
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {BRANCHES.map((b) => (
                        <button
                          key={b}
                          onClick={() => setFilters((f) => ({ ...f, branch: b }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            filters.branch === b
                              ? "bg-amber-500 text-white shadow-sm"
                              : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Search Reports
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name or category..."
                        className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {datePreset === "custom" && (
                  <div className="flex flex-wrap items-end gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <Calendar className="w-4 h-4 text-amber-600 self-center" />
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 mb-1">From</label>
                      <input
                        type="date"
                        value={pendingCustom.from}
                        onChange={(e) => setPendingCustom((p) => ({ ...p, from: e.target.value }))}
                        className="px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 mb-1">To</label>
                      <input
                        type="date"
                        value={pendingCustom.to}
                        onChange={(e) => setPendingCustom((p) => ({ ...p, to: e.target.value }))}
                        min={pendingCustom.from}
                        className="px-3 py-2 text-sm border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <button
                      onClick={applyCustomDates}
                      disabled={!pendingCustom.from}
                      className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Apply
                    </button>
                    {customDates.from && (
                      <span className="text-xs text-amber-700 font-medium">
                        Active: {customDates.from} → {customDates.to || customDates.from}
                      </span>
                    )}
                  </div>
                )}

                {showAdvancedFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-1 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Patient Status
                      </label>
                      <select
                        value={filters.status}
                        onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                      >
                        <option value="">All Statuses</option>
                        {PATIENT_STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Technique
                      </label>
                      <select
                        value={filters.technique}
                        onChange={(e) => setFilters((f) => ({ ...f, technique: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                      >
                        <option value="">All Techniques</option>
                        {TECHNIQUES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Procedure
                      </label>
                      <select
                        value={filters.procedure}
                        onChange={(e) => setFilters((f) => ({ ...f, procedure: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                      >
                        <option value="">All Procedures</option>
                        {PROCEDURES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        Payment Type
                      </label>
                      <select
                        value={filters.paymentType}
                        onChange={(e) => setFilters((f) => ({ ...f, paymentType: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                      >
                        <option value="">All Payment Types</option>
                        {PAYMENT_TYPES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                        HR Candidate Status
                      </label>
                      <select
                        value={filters.hrStatus}
                        onChange={(e) => setFilters((f) => ({ ...f, hrStatus: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                      >
                        <option value="">All Statuses</option>
                        {HR_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map((cat) => {
                const isSelected = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap border transition-all duration-150 ${
                      isSelected
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50/40 shadow-xs"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {categoryCounts[cat] || 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleReports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">No reports matched your criteria</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                  Try adjusting your search terms, changing the active category, or resetting active filters.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 font-medium">
                    Showing <span className="font-bold text-gray-900">{visibleReports.length}</span> reports
                    {searchTerm && ` for "${searchTerm}"`}
                  </p>
                  {loadingId && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating report...
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleReports.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      filters={filters}
                      loadingId={loadingId}
                      favorites={favorites}
                      onDownload={handleDownload}
                      onToggleFavorite={toggleFavorite}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                Quick Reference — Report Coverage
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Patient Reports", count: 7, color: "bg-blue-50 text-blue-700 border-blue-200", icon: HeartPulse },
                  { label: "Staff Reports", count: 6, color: "bg-purple-50 text-purple-700 border-purple-200", icon: Users },
                  { label: "Financial Reports", count: 6, color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: IndianRupee },
                  { label: "HR Reports", count: 6, color: "bg-amber-50 text-amber-700 border-amber-200", icon: Briefcase },
                  { label: "Leads & Inventory", count: 3, color: "bg-pink-50 text-pink-700 border-pink-200", icon: Package },
                  { label: "Audit Logs", count: 4, color: "bg-red-50 text-red-700 border-red-200", icon: ShieldAlert },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = activeCategory === item.label;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setActiveCategory(isActive ? "All" : item.label)}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? "ring-2 ring-amber-400/50 border-amber-300 bg-amber-50"
                          : "bg-gray-50/70 border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${item.color} border flex items-center justify-center mb-2`}>
                        <ItemIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-gray-900 leading-tight truncate w-full">{item.label}</span>
                      <span className="text-[10px] text-gray-500 mt-0.5">{item.count} reports</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
