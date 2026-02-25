"use client";

import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import { useToast } from "@/components/Toast";
import BillGenerator from "@/components/BillGenerator";
import {
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Edit2,
  User,
  Calendar,
  IndianRupee,
  CreditCard,
  Building2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Loader2,
  Menu,
  Tag,
  ArrowUpDown,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Mail,
  FileText,
  ArrowRight,
  MapPin,
  History,
  UserCheck,
  Scissors,
  Heart,
  Pill,
  Receipt,
  Package,
  FileText as Bill,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ========== UTILITY FUNCTIONS ==========
const calculateNetAmount = (transaction) => {
  if (!transaction) return 0;
  const amount = parseFloat(transaction.amount) || 0;
  return Math.max(0, amount);
};

const getTodayDate = () => {
  const now = new Date();
  return now.toISOString().split("T")[0];
};

const formatDateForDisplay = (date) => {
  if (!date) return "N/A";
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const formatFieldName = (fieldName) => {
  if (!fieldName) return "";
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const BRANCHES = ["Delhi", "Mumbai", "Hyderabad"];
const PAYMENT_METHODS = ["upi", "cash", "card", "banking", "Loan", "other"];
const TRANSPLANT_PROCEDURES = [
  "Sapphire FUE",
  "DHI",
  "Turkish DHI",
  "Beard Transplant",
];
const SERVICE_PROCEDURES = ["PRP", "GFC", "Alopecia", "Headwash", "Canacot"];
const TRANSACTION_CATEGORIES = [
  { value: "TRANSPLANT", label: "Transplant", icon: Scissors, color: "indigo" },
  { value: "SERVICE", label: "Services", icon: Heart, color: "pink" },
  { value: "MEDICINE", label: "Medicine", icon: Pill, color: "emerald" },
  { value: "EXPENSE", label: "Expenses", icon: Receipt, color: "rose" },
];

const getCategoryGradientClass = (categoryValue, isActive) => {
  if (!isActive) return "bg-gray-50 text-gray-600 hover:bg-gray-100";

  const gradients = {
    TRANSPLANT:
      "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md",
    SERVICE: "bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md",
    MEDICINE:
      "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md",
    EXPENSE: "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-md",
  };

  return gradients[categoryValue] || "bg-gray-50 text-gray-600";
};


// ========== STAT CARD COMPONENT ==========
function StatCard({
  title,
  value,
  icon: Icon,
  gradient,
  count,
  iconBg,
  iconColor,
}) {
  return (
    <div
      className={`bg-linear-to-br ${gradient} p-4 sm:p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/10 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16" />
      <div className="relative">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-xs sm:text-sm font-medium mb-1 truncate">
              {title}
            </p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
              {value}
            </h3>
          </div>
          <div className={`${iconBg} p-2 sm:p-3 rounded-xl shrink-0 ml-2`}>
            <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${iconColor}`} />
          </div>
        </div>
        <p className="text-white/80 text-xs sm:text-sm font-medium truncate">
          {count}
        </p>
      </div>
    </div>
  );
}

// ========== DELETE CONFIRM MODAL COMPONENT ==========
function DeleteConfirmModal({ transaction, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  const netAmount = calculateNetAmount(transaction);
  const hasDiscount = parseFloat(transaction?.discount || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4">
        <div className="p-6 sm:p-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-2">
            Delete Transaction?
          </h2>
          <p className="text-gray-600 text-center mb-4 sm:mb-6 text-sm sm:text-base">
            Are you sure you want to delete this transaction? This action cannot
            be undone.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Category:</span>
              <span className="font-bold text-gray-900 text-sm sm:text-base">
                {transaction?.transactionCategory || "Uncategorized"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="font-bold text-emerald-600 text-sm sm:text-base">
                {formatCurrency(netAmount)}
              </span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Discount:</span>
                <span className="font-bold text-amber-600 text-sm sm:text-base">
                  -{formatCurrency(transaction?.discount || 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Date:</span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">
                {formatDateForDisplay(transaction?.date)}
              </span>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50 text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== HELPER COMPONENTS ==========
function Input({
  label,
  type = "text",
  value,
  onChange,
  icon: Icon,
  required,
  placeholder,
  min,
  max,
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm sm:text-base ${
            Icon ? "pl-9 sm:pl-11 pr-4" : "px-4"
          } py-2.5 sm:py-3`}
        />
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options, required, icon: Icon }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white transition-all appearance-none text-sm sm:text-base ${
            Icon ? "pl-9 sm:pl-11 pr-8 sm:pr-10" : "px-4 pr-8 sm:pr-10"
          } py-2.5 sm:py-3`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronLeft className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 rotate-90 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
      </div>
    </label>
  );
}

// ========== EXPANDED ROW DETAILS COMPONENT ==========
function ExpandedRowDetails({ transaction, isExpanded }) {
  const [activeTab, setActiveTab] = useState("summary");

  if (!isExpanded) return null;

  return (
    <div className="bg-linear-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 border-t-2 border-indigo-200 animate-in slide-in-from-top duration-300">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Complete Audit Trail
              </h3>
              <p className="text-sm text-slate-600">
                Full transaction history and changes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 bg-white rounded-xl px-4 py-3 shadow-md border border-slate-200 w-full sm:w-auto">
            <div className="text-center flex-1 sm:flex-initial">
              <div className="text-2xl font-bold text-indigo-700">
                {transaction.editors?.length || 0}
              </div>
              <div className="text-xs text-slate-600 font-medium">
                Total Edits
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-center flex-1 sm:flex-initial">
              <div className="text-2xl font-bold text-emerald-700">1</div>
              <div className="text-xs text-slate-600 font-medium">Creator</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-white rounded-xl p-1.5 shadow-sm border border-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "summary"
                ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-4 h-4" />
              <span>Summary</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === "history"
                ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Change History</span>
            </div>
          </button>
        </div>

        <div className="space-y-4">
          {activeTab === "summary" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-linear-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                    <UserCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Created By
                    </h4>
                    <p className="text-xs text-slate-600">
                      Original entry creator
                    </p>
                  </div>
                </div>
                {transaction.createdBy ? (
                  <div className="space-y-3">
                    <p className="text-base font-bold text-slate-900">
                      {transaction.createdBy.name}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-slate-700 truncate text-xs">
                          {transaction.createdBy.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-slate-900 font-semibold text-xs">
                          {transaction.createdBy.branch}
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>
                          {formatDateTime(transaction.createdBy.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">
                    No creator information available
                  </p>
                )}
              </div>

              {transaction.editors && transaction.editors.length > 0 && (
                <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-linear-to-br from-indigo-400 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                      <Edit2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Last Edited By
                      </h4>
                      <p className="text-xs text-slate-600">
                        Most recent modification
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-bold text-slate-900">
                      {transaction.editors[transaction.editors.length - 1].name}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-slate-700 truncate text-xs">
                          {
                            transaction.editors[transaction.editors.length - 1]
                              .email
                          }
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-slate-900 font-semibold text-xs">
                          {
                            transaction.editors[transaction.editors.length - 1]
                              .branch
                          }
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>
                          {formatDateTime(
                            transaction.editors[transaction.editors.length - 1]
                              .date,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {transaction.editors && transaction.editors.length > 0 ? (
                transaction.editors
                  .slice()
                  .reverse()
                  .map((editor, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl p-5 shadow-lg border-2 border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-lg">
                              {editor.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-900">
                              {editor.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {editor.email}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-md">
                          Edit #{transaction.editors.length - idx}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="text-slate-700 font-medium">
                            {editor.branch}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-slate-600">
                            {formatDateTime(editor.date)}
                          </span>
                        </div>
                      </div>

                      {editor.updatedFields?.length > 0 && (
                        <div className="space-y-3 pt-4 border-t border-slate-200">
                          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-indigo-600" />
                            Changed {editor.updatedFields.length} field(s):
                          </p>
                          <div className="space-y-3">
                            {editor.updatedFields.map((field, fieldIdx) => (
                              <div
                                key={fieldIdx}
                                className="bg-linear-to-r from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
                                    <ArrowRight className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="font-bold text-slate-900 text-sm">
                                    {formatFieldName(field.name)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="bg-red-50 rounded-lg p-3 border-2 border-red-200">
                                    <span className="text-xs text-red-700 font-bold block mb-1">
                                      Previous Value:
                                    </span>
                                    <p className="text-sm text-slate-900 font-medium wrap-break-words">
                                      {field.previousValue || "(Empty)"}
                                    </p>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                                    <span className="text-xs text-green-700 font-bold block mb-1">
                                      New Value:
                                    </span>
                                    <p className="text-sm text-slate-900 font-medium wrap-break-words">
                                      {field.newValue || "(Empty)"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-12 bg-white rounded-xl shadow-lg border border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-base font-semibold text-slate-700 mb-1">
                    No Edit History
                  </p>
                  <p className="text-sm text-slate-500">
                    This record hasn't been modified since creation
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ========== DATA TABLE COMPONENT ==========
function DataTable({
  category,
  rows,
  onEdit,
  onDelete,
  onSort,
  sortConfig,
  pagination,
  onGenerateBill,
}) {
  const router = useRouter();
  const [expandedRow, setExpandedRow] = useState(null);

  const hasUndefinedCategory = (row) => {
    const category = row.transactionCategory || row.category;
    return !category || category === "";
  };

  const getColumns = () => {
    const baseColumns = [
      { key: "date", label: "Date", sortable: true, width: "110px" },
    ];

    switch (category) {
      case "TRANSPLANT":
        return [
          ...baseColumns,
          { key: "patient", label: "Patient", sortable: true, width: "160px" },
          {
            key: "procedure",
            label: "Procedure",
            sortable: true,
            width: "130px",
          },
          {
            key: "paymentType",
            label: "Payment Type",
            sortable: true,
            width: "120px",
          },
          { key: "amount", label: "Amount", sortable: true, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          {
            key: "paymentId",
            label: "Trans ID",
            sortable: true,
            width: "150px",
          },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "audit", label: "Audit", sortable: false, width: "120px" },
          { key: "actions", label: "Actions", sortable: false, width: "120px" },
        ];
      case "SERVICE":
        return [
          ...baseColumns,
          {
            key: "patient",
            label: "Patient/Customer",
            sortable: true,
            width: "160px",
          },
          {
            key: "procedure",
            label: "Service",
            sortable: true,
            width: "100px",
          },
          { key: "quantity", label: "Sessions", sortable: true, width: "90px" },
          {
            key: "perSessionCost",
            label: "Per Session",
            sortable: true,
            width: "120px",
          },
          { key: "amount", label: "Total", sortable: true, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          {
            key: "paymentId",
            label: "Trans ID",
            sortable: true,
            width: "150px",
          },
          { key: "batchId", label: "Batch", sortable: false, width: "100px" },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "audit", label: "Audit", sortable: false, width: "120px" },
          { key: "actions", label: "Actions", sortable: false, width: "120px" },
        ];
      case "MEDICINE":
        return [
          ...baseColumns,
          {
            key: "patient",
            label: "Patient/Customer",
            sortable: true,
            width: "160px",
          },
          {
            key: "medicine",
            label: "Medicine",
            sortable: true,
            width: "160px",
          },
          { key: "quantity", label: "Qty", sortable: true, width: "80px" },
          {
            key: "perUnitCost",
            label: "Per Unit",
            sortable: true,
            width: "110px",
          },
          { key: "amount", label: "Total", sortable: true, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          {
            key: "paymentId",
            label: "Trans ID",
            sortable: true,
            width: "150px",
          },
          { key: "batchId", label: "Batch", sortable: false, width: "100px" },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "audit", label: "Audit", sortable: false, width: "120px" },
          { key: "actions", label: "Actions", sortable: false, width: "120px" },
        ];
      case "EXPENSE":
        return [
          ...baseColumns,
          { key: "expense", label: "Expense", sortable: true, width: "160px" },
          {
            key: "expenseGiver",
            label: "Paid To",
            sortable: false,
            width: "160px",
          },
          { key: "amount", label: "Amount", sortable: true, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          {
            key: "paymentId",
            label: "Trans ID",
            sortable: true,
            width: "150px",
          },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "audit", label: "Audit", sortable: false, width: "120px" },
          { key: "actions", label: "Actions", sortable: false, width: "120px" },
        ];
      default:
        return baseColumns;
    }
  };

  const columns = getColumns();

  const getProcedureColor = (proc) => {
    const colors = {
      "sapphire fue": "bg-indigo-100 text-indigo-700 border-indigo-200",
      dhi: "bg-purple-100 text-purple-700 border-purple-200",
      "turkish dhi": "bg-pink-100 text-pink-700 border-pink-200",
      "beard transplant": "bg-amber-100 text-amber-700 border-amber-200",
      prp: "bg-emerald-100 text-emerald-700 border-emerald-200",
      gfc: "bg-cyan-100 text-cyan-700 border-cyan-200",
      alopecia: "bg-rose-100 text-rose-700 border-rose-200",
      headwash: "bg-sky-100 text-sky-700 border-sky-200",
      canacot: "bg-lime-100 text-lime-700 border-lime-200",
    };

    return (
      colors[proc?.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  const getMethodColor = (method) => {
    const colors = {
      cash: "bg-emerald-100 text-emerald-700 border-emerald-200",
      upi: "bg-blue-100 text-blue-700 border-blue-200",
      card: "bg-purple-100 text-purple-700 border-purple-200",
      banking: "bg-indigo-100 text-indigo-700 border-indigo-200",
      loan: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return (
      colors[method?.toLowerCase()] ||
      "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortConfig.direction === "asc" ? (
      <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-90 text-indigo-600" />
    ) : (
      <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 rotate-90 text-indigo-600" />
    );
  };

  const toggleExpanded = (rowId) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  };

  const gridTemplateColumns = columns.map((col) => col.width).join(" ");

  const getPatientName = (row) => {
    if (row.patient && typeof row.patient === "object") {
      return row.patient.personal?.name || "N/A";
    }
    return row.patientName || "Walk-in Customer";
  };

  const getPatientPhone = (row) => {
    if (row.patient && typeof row.patient === "object") {
      return row.patient.personal?.phone || "";
    }
    return row.patientPhone || "";
  };

  const getMedicineName = (row) => {
    if (row.medicineId && typeof row.medicineId === "object") {
      return row.medicineId.name || "N/A";
    }
    return "N/A";
  };

  const getExpenseGiverName = (row) => {
    // ✅ Already correct - handles both VENDOR and MANUAL
    if (row.expenseGiver?.type === "VENDOR") {
      if (typeof row.expenseGiver.vendorId === "object") {
        return (
          row.expenseGiver.vendorId?.name || row.expenseGiver.name || "N/A"
        );
      }
      return row.expenseGiver.name || "N/A";
    }
    return row.expenseGiver?.name || "N/A";
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Desktop Header - Keep same */}
      <div
        className="hidden md:grid items-center bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 min-h-13 px-2"
        style={{ gridTemplateColumns }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-2 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide truncate ${
              col.sortable
                ? "cursor-pointer hover:bg-slate-200/50 transition-colors duration-150 group"
                : ""
            }`}
            onClick={() => col.sortable && onSort(col.key)}
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate">{col.label}</span>
              {col.sortable && <SortIcon columnKey={col.key} />}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Header - Keep same */}
      <div className="md:hidden bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {category} Records
            </h3>
            <p className="text-xs text-slate-600">
              Showing {rows.length} of {pagination.total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-700">Sorted by</p>
            <p className="text-sm font-bold text-indigo-700">
              {sortConfig.key.replace(/([A-Z])/g, " $1").trim()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No records found
            </h3>
            <p className="text-sm text-slate-600 text-center max-w-md">
              Try adjusting your search filters or add a new{" "}
              {category.toLowerCase()} transaction
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const netAmount = calculateNetAmount(row);
              const hasDiscount = parseFloat(row.discount || 0) > 0;
              const isExpanded = expandedRow === row._id;

              return (
                <div key={row._id || i}>
                  <div
                    className={`group transition-all duration-200 ${
                      isExpanded ? "bg-indigo-50/50" : "hover:bg-indigo-50/30"
                    }`}
                  >
                    {/* Desktop View - Keep all same until actions column */}
                    <div
                      className="hidden md:grid items-center min-h-16 px-2"
                      style={{ gridTemplateColumns }}
                    >
                      <div className="px-2 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium text-slate-900">
                            {formatDateForDisplay(row.date)}
                          </div>
                        </div>
                      </div>

                      {category === "TRANSPLANT" && (
                        <>
                          <div className="px-2 py-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {getPatientName(row)}
                              </div>
                              <div className="text-xs text-slate-600 font-medium">
                                {getPatientPhone(row) || "No phone"}
                              </div>
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getProcedureColor(row.procedure)}`}
                            >
                              {row.procedure}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              {row.paymentType}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-700">
                                {formatCurrency(netAmount)}
                              </div>
                              {hasDiscount && (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <Tag className="w-3 h-3 text-amber-500" />
                                  <span className="text-xs text-amber-600 font-medium">
                                    -{formatCurrency(row.discount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}
                            >
                              {row.method?.toUpperCase()}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            {row.paymentId ? (
                              <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">
                                {row.paymentId}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {row.branch}
                            </span>
                          </div>
                        </>
                      )}

                      {category === "SERVICE" && (
                        <>
                          <div className="px-2 py-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {getPatientName(row)}
                              </div>
                              <div className="text-xs text-slate-600 font-medium">
                                {getPatientPhone(row) || "No phone"}
                              </div>
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getProcedureColor(row.procedure)}`}
                            >
                              {row.procedure}
                            </span>
                          </div>
                          <div className="px-2 py-3 text-center">
                            <div className="text-sm font-bold text-indigo-700">
                              {row.quantity || 1}
                            </div>
                          </div>
                          <div className="px-2 py-3 text-center">
                            <div className="text-sm font-medium text-slate-900">
                              {formatCurrency(row.perSessionCost || 0)}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-700">
                                {formatCurrency(netAmount)}
                              </div>
                              {hasDiscount && (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <Tag className="w-3 h-3 text-amber-500" />
                                  <span className="text-xs text-amber-600 font-medium">
                                    -{formatCurrency(row.discount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}
                            >
                              {row.method?.toUpperCase()}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            {row.paymentId ? (
                              <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">
                                {row.paymentId}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            {row.batchId ? (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-indigo-600" />
                                <span className="text-xs font-mono text-indigo-700">
                                  {row.batchId.slice(-8)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {row.branch}
                            </span>
                          </div>
                        </>
                      )}

                      {category === "MEDICINE" && (
                        <>
                          <div className="px-2 py-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {getPatientName(row)}
                              </div>
                              <div className="text-xs text-slate-600 font-medium">
                                {getPatientPhone(row) || "No phone"}
                              </div>
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {getMedicineName(row)}
                            </div>
                          </div>
                          <div className="px-2 py-3 text-center">
                            <div className="text-sm font-bold text-indigo-700">
                              {row.quantity || 1}
                            </div>
                          </div>
                          <div className="px-2 py-3 text-center">
                            <div className="text-sm font-medium text-slate-900">
                              {formatCurrency(row.perUnitCost || 0)}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-700">
                                {formatCurrency(netAmount)}
                              </div>
                              {hasDiscount && (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <Tag className="w-3 h-3 text-amber-500" />
                                  <span className="text-xs text-amber-600 font-medium">
                                    -{formatCurrency(row.discount)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}
                            >
                              {row.method?.toUpperCase()}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            {row.paymentId ? (
                              <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">
                                {row.paymentId}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            {row.batchId ? (
                              <div className="flex items-center gap-1">
                                <Package className="w-3 h-3 text-indigo-600" />
                                <span className="text-xs font-mono text-indigo-700">
                                  {row.batchId.slice(-8)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {row.branch}
                            </span>
                          </div>
                        </>
                      )}

                      {category === "EXPENSE" && (
                        <>
                          <div className="px-2 py-3">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {row.expense || row.expenseCategory || "N/A"}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <div className="text-sm text-slate-900 truncate">
                              {getExpenseGiverName(row)}
                            </div>
                          </div>
                          <div className="px-2 py-3 text-right">
                            <div className="text-sm font-bold text-rose-600">
                              {formatCurrency(row.amount)}
                            </div>
                          </div>
                          <div className="px-2 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}
                            >
                              {row.method?.toUpperCase()}
                            </span>
                          </div>
                          <div className="px-2 py-3">
                            {row.paymentId ? (
                              <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">
                                {row.paymentId}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>
                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                              {row.branch}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Audit Column */}
                      <div className="px-2 py-3">
                        <button
                          onClick={() => toggleExpanded(row._id)}
                          className={`group/btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 border-2 ${
                            isExpanded
                              ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md"
                              : "bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700"
                          }`}
                        >
                          {row.editors?.length > 0 ? (
                            <>
                              <div className="relative">
                                <Edit2 className="w-3.5 h-3.5" />
                                <span
                                  className={`absolute -top-1 -right-1 w-3 h-3 text-[8px] font-bold rounded-full flex items-center justify-center ${
                                    isExpanded
                                      ? "bg-white text-indigo-700"
                                      : "bg-indigo-600 text-white"
                                  }`}
                                >
                                  {row.editors.length}
                                </span>
                              </div>
                              <span className="text-xs font-semibold">
                                {row.editors[
                                  row.editors.length - 1
                                ]?.name?.split(" ")[0] || "Edited"}
                              </span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span className="text-xs font-semibold">
                                {row.createdBy?.name?.split(" ")[0] ||
                                  "Created"}
                              </span>
                            </>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-0.5" />
                          )}
                        </button>
                      </div>

                      {/* Actions Column */}
                      <div className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onGenerateBill(row)}
                            className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600 hover:text-emerald-800"
                            title="Generate Bill"
                          >
                            <Bill size={18} />
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/admin/transactions/edit/${row._id}`)
                            }
                            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600 hover:text-indigo-800"
                            title="Edit record"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => onDelete(row)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 hover:text-red-800"
                            title="Delete record"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Mobile View */}
                    <div className="md:hidden p-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  category === "TRANSPLANT"
                                    ? getProcedureColor(row.procedure)
                                    : category === "SERVICE"
                                      ? getProcedureColor(row.procedure)
                                      : category === "MEDICINE"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-rose-100 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {category === "TRANSPLANT" ||
                                category === "SERVICE"
                                  ? row.procedure
                                  : category === "MEDICINE"
                                    ? getMedicineName(row)
                                    : row.expense ||
                                      row.expenseCategory ||
                                      "Expense"}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${getMethodColor(row.method)}`}
                              >
                                {row.method?.toUpperCase()}
                              </span>
                              {hasUndefinedCategory(row) && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold border border-amber-200">
                                  <AlertCircle className="w-3 h-3" />
                                  Uncategorized
                                </span>
                              )}
                            </div>
                            <h4 className="text-base font-bold text-slate-900">
                              {category !== "EXPENSE"
                                ? getPatientName(row)
                                : getExpenseGiverName(row)}
                            </h4>
                            {category !== "EXPENSE" && (
                              <p className="text-sm text-slate-600 font-medium">
                                {getPatientPhone(row)}
                              </p>
                            )}
                            {category === "EXPENSE" && (
                              <p className="text-sm text-slate-600 font-medium">
                                {row.expense ||
                                  row.expenseCategory ||
                                  "General Expense"}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-lg font-bold ${
                                category === "EXPENSE"
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {formatCurrency(netAmount)}
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatDateForDisplay(row.date)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {(category === "SERVICE" ||
                            category === "MEDICINE") && (
                            <>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">
                                  {category === "SERVICE"
                                    ? "Sessions"
                                    : "Quantity"}
                                </p>
                                <p className="text-sm font-semibold text-indigo-700">
                                  {row.quantity || 1}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">
                                  {category === "SERVICE"
                                    ? "Per Session"
                                    : "Per Unit"}
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                  {formatCurrency(
                                    category === "SERVICE"
                                      ? row.perSessionCost
                                      : row.perUnitCost,
                                  )}
                                </p>
                              </div>
                            </>
                          )}

                          {category === "TRANSPLANT" && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">
                                Payment Type
                              </p>
                              <p className="text-sm font-semibold text-blue-700">
                                {row.paymentType || "N/A"}
                              </p>
                            </div>
                          )}

                          {category === "EXPENSE" && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">
                                Expense Type
                              </p>
                              <p className="text-sm font-semibold text-rose-700">
                                {row.expense || row.expenseCategory || "N/A"}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Branch
                            </p>
                            <p className="text-sm font-semibold text-purple-700">
                              {row.branch}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Transaction ID
                            </p>
                            <p className="text-sm font-mono text-slate-700 truncate">
                              {row.paymentId || "-"}
                            </p>
                          </div>
                          {row.batchId && (
                            <div className="col-span-2">
                              <p className="text-xs text-slate-500 mb-1">
                                Batch ID
                              </p>
                              <p className="text-sm font-mono text-indigo-700">
                                {row.batchId.slice(-8)}
                              </p>
                            </div>
                          )}
                        </div>

                        {row.remarks && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">
                              Remarks
                            </p>
                            <p className="text-sm text-slate-700">
                              {row.remarks}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <button
                            onClick={() => toggleExpanded(row._id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              isExpanded
                                ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            }`}
                          >
                            {row.editors?.length > 0 ? (
                              <>
                                <Edit2 size={14} />
                                <span>History ({row.editors.length})</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={14} />
                                <span>Audit Trail</span>
                              </>
                            )}
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>

                          <div className="flex items-center gap-2">
                            {/* ✅ FIX 3: Pass entire row object, not just ID */}
                            <button
                              onClick={() => onGenerateBill(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                            >
                              <Bill size={14} />
                              Bill
                            </button>
                            <button
                              onClick={() =>
                                router.push(
                                  `/admin/transactions/edit/${row._id}`,
                                )
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                            >
                              <Edit2 size={14} />
                              Edit
                            </button>
                            <button
                              onClick={() => onDelete(row)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ExpandedRowDetails
                    transaction={row}
                    isExpanded={isExpanded}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination - Keep same */}
      <div className="border-t border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">
              {pagination.startIdx + 1}-{pagination.endIdx}
            </span>
            <span className="mx-2">of</span>
            <span className="font-medium text-slate-900">
              {pagination.total.toLocaleString()}
            </span>
            <span className="ml-2">records</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 hidden sm:inline">
                Show
              </span>
              <select
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium transition-all"
                value={pagination.perPage}
                onChange={(e) => {
                  pagination.setPerPage(Number(e.target.value));
                  pagination.setPage(1);
                }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-sm text-slate-600 hidden sm:inline">
                per page
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => pagination.setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 mx-2">
                {(() => {
                  const pages = [];
                  const totalPages = pagination.pages;
                  const currentPage = pagination.page;

                  if (currentPage > 2) {
                    pages.push(1);
                    if (currentPage > 3) pages.push("...");
                  }

                  for (
                    let i = Math.max(1, currentPage - 1);
                    i <= Math.min(totalPages, currentPage + 1);
                    i++
                  ) {
                    pages.push(i);
                  }

                  if (currentPage < totalPages - 1) {
                    if (currentPage < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }

                  return pages.map((page, idx) =>
                    page === "..." ? (
                      <span key={idx} className="px-2 text-slate-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={idx}
                        onClick={() => pagination.setPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === currentPage
                            ? "bg-indigo-600 text-white border border-indigo-600"
                            : "text-slate-700 hover:bg-slate-100 border border-transparent"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  );
                })()}
              </div>
              <button
                onClick={() =>
                  pagination.setPage((p) => Math.min(pagination.pages, p + 1))
                }
                disabled={pagination.page >= pagination.pages}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN COMPONENT ==========
export default function AllTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("TRANSPLANT");
  const [filters, setFilters] = useState({
    branch: "",
    dateFrom: getTodayDate(),
    dateTo: getTodayDate(),
    paymentMethod: "",
    procedure: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [showBillGenerator, setShowBillGenerator] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const toast = useToast();
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/transactions/get-all");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.success && data.transactions) {
        setTransactions(data.transactions);
      } else {
        throw new Error(data.message || data.error || "Invalid data format");
      }
    } catch (e) {
      setError(e.message);
      toast?.error?.("Error loading data: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  const filterByDateRange = (items, dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return items;

    return items.filter((item) => {
      const itemDate = new Date(item.date);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
      return true;
    });
  };

  const filteredTransactions = useMemo(() => {
    let list = transactions.filter((t) => {
      const category = t.transactionCategory || t.category;
      if (activeCategory === "TRANSPLANT") {
        // ✅ Include undefined/empty categories in TRANSPLANT for backward compatibility
        return category === "TRANSPLANT" || !category || category === "";
      }
      return category === activeCategory;
    });

    if (filters.branch) {
      list = list.filter(
        (t) => t.branch?.toLowerCase() === filters.branch.toLowerCase(),
      );
    }

    if (filters.paymentMethod) {
      list = list.filter(
        (t) => t.method?.toLowerCase() === filters.paymentMethod.toLowerCase(),
      );
    }

    if (
      filters.procedure &&
      (activeCategory === "TRANSPLANT" || activeCategory === "SERVICE")
    ) {
      list = list.filter(
        (t) => t.procedure?.toLowerCase() === filters.procedure.toLowerCase(),
      );
    }

    list = filterByDateRange(list, filters.dateFrom, filters.dateTo);

    return list;
  }, [transactions, activeCategory, filters]);

  // ✅ Calculate stats from ALL categories but with active filters applied
  const categoryStats = useMemo(() => {
    const stats = {
      TRANSPLANT: { count: 0, total: 0 },
      SERVICE: { count: 0, total: 0 },
      MEDICINE: { count: 0, total: 0 },
      EXPENSE: { count: 0, total: 0 },
    };

    // Apply filters but NOT category filter
    let filteredList = transactions;

    // Apply branch filter
    if (filters.branch) {
      filteredList = filteredList.filter(
        (t) => t.branch?.toLowerCase() === filters.branch.toLowerCase(),
      );
    }

    // Apply payment method filter
    if (filters.paymentMethod) {
      filteredList = filteredList.filter(
        (t) => t.method?.toLowerCase() === filters.paymentMethod.toLowerCase(),
      );
    }

    // Apply procedure filter (only for TRANSPLANT/SERVICE)
    if (filters.procedure) {
      filteredList = filteredList.filter(
        (t) => t.procedure?.toLowerCase() === filters.procedure.toLowerCase(),
      );
    }

    // Apply date range filter
    filteredList = filterByDateRange(
      filteredList,
      filters.dateFrom,
      filters.dateTo,
    );

    // Now calculate stats for each category from the filtered list
    filteredList.forEach((t) => {
      const category = t.transactionCategory || t.category;
      const actualCategory = category || "TRANSPLANT";
      if (stats[actualCategory]) {
        stats[actualCategory].count++;
        stats[actualCategory].total += calculateNetAmount(t);
      }
    });

    return stats;
  }, [transactions, filters]); // Depend on transactions and filters
  const searchedRows = useMemo(() => {
    if (!tableSearch) return filteredTransactions;

    return filteredTransactions.filter((row) => {
      const searchLower = tableSearch.toLowerCase();
      const commonMatch =
        row.method?.toLowerCase().includes(searchLower) ||
        row.branch?.toLowerCase().includes(searchLower) ||
        row.remarks?.toLowerCase().includes(searchLower) ||
        row.paymentId?.toLowerCase().includes(searchLower) ||
        row.amount?.toString().includes(searchLower);

      if (commonMatch) return true;

      if (activeCategory === "TRANSPLANT" || activeCategory === "SERVICE") {
        const patientName =
          row.patient?.personal?.name || row.patientName || "";
        const patientPhone =
          row.patient?.personal?.phone || row.patientPhone || "";
        return (
          patientName.toLowerCase().includes(searchLower) ||
          patientPhone.includes(searchLower) ||
          row.procedure?.toLowerCase().includes(searchLower)
        );
      }

      if (activeCategory === "MEDICINE") {
        const patientName =
          row.patient?.personal?.name || row.patientName || "";
        const patientPhone =
          row.patient?.personal?.phone || row.patientPhone || "";
        const medicineName =
          typeof row.medicineId === "object" ? row.medicineId?.name : "";
        return (
          patientName.toLowerCase().includes(searchLower) ||
          patientPhone.includes(searchLower) ||
          medicineName?.toLowerCase().includes(searchLower)
        );
      }

      if (activeCategory === "EXPENSE") {
        const expenseName = row.expense || row.expenseCategory || "";
        const giverName = row.expenseGiver?.name || "";
        return (
          expenseName.toLowerCase().includes(searchLower) ||
          giverName.toLowerCase().includes(searchLower)
        );
      }

      return false;
    });
  }, [filteredTransactions, tableSearch, activeCategory]);

  const sortedRows = useMemo(() => {
    const sorted = [...searchedRows];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "patient") {
          aVal =
            a.patient?.personal?.name || a.patientName || "Walk-in Customer";
          bVal =
            b.patient?.personal?.name || b.patientName || "Walk-in Customer";
        }

        if (sortConfig.key === "date") {
          aVal = new Date(aVal);
          bVal = new Date(bVal);
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [searchedRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const total = sortedRows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  const startIdx = (current - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const paginatedRows = sortedRows.slice(startIdx, endIdx);

  const clearFilters = () => {
    setFilters({
      branch: "",
      dateFrom: getTodayDate(),
      dateTo: getTodayDate(),
      paymentMethod: "",
      procedure: "",
    });
    setTableSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    Object.values(filters).some((value) => value !== "") || tableSearch;

  useEffect(() => {
    setPage(1);
  }, [filters, activeCategory, tableSearch]);

  const openDeleteConfirm = (transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;

    try {
      const category =
        deletingTransaction.transactionCategory ||
        deletingTransaction.category ||
        "TRANSPLANT";

      const endpoint =
        category === "TRANSPLANT"
          ? "/api/transactions/transplant/delete"
          : category === "SERVICE"
            ? "/api/transactions/service/delete"
            : category === "MEDICINE"
              ? "/api/transactions/medicine/delete"
              : "/api/transactions/expense/delete";

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: deletingTransaction._id }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Transaction deleted successfully");
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingTransaction(null);
      } else {
        toast.error(data.error || "Failed to delete transaction");
      }
    } catch (err) {
      toast.error("An error occurred while deleting");
    }
  };

  const openBillGenerator = (data) => {
    try {
      // Check if this is a revenue transaction with a patient
      const isRevenueTransaction = data.costType === "Revenue";
      const hasCategory =
        data.transactionCategory &&
        data.transactionCategory !== "undefined" &&
        data.transactionCategory !== "";


      if (
        isRevenueTransaction &&
        (!hasCategory || data.transactionCategory === "TRANSPLANT") &&
        data.patient
      ) {
        // Check if patient is populated object or just an ID
        const patientId =
          typeof data.patient === "object" ? data.patient._id : data.patient;

        if (patientId) {
          setSelectedTransactionId(patientId);
        } else {
          // Fallback to transaction ID if patient ID not available
          setSelectedTransactionId(data._id);
        }
      } else {
        // For all other transactions (SERVICE, MEDICINE, EXPENSE), use transaction ID
        setSelectedTransactionId(data._id);
      }

      setShowBillGenerator(true);
    } catch (error) {
      console.error("Error opening bill generator:", error);
      toast.error("Failed to open bill generator");
    }
  };

  const closeBillGenerator = () => {
    setShowBillGenerator(false);
    setSelectedTransactionId(null);
  };

  const downloadExcel = async () => {
    try {
      setDownloading(true);
      const { utils, writeFile } = await import("xlsx");

      // Main transaction data with patient properties first
      const dataToExport = sortedRows.map((row) => {
        const base = {
          Remarks: row.remarks || "",
          Category: row.transactionCategory || row.category || "Uncategorized",
          "Created By": row.createdBy?.name || "N/A",
          "Created By Branch": row.createdBy?.branch || "N/A",
          "Created By Email": row.createdBy?.email || "N/A",
          "Created At": formatDateTime(row.createdBy?.date),
          "Total Edits": row.editors?.length || 0,
        };

        if (activeCategory === "TRANSPLANT") {
          return {
            Date: formatDateForDisplay(row.date),
            "Patient Name":
              row.patient?.personal?.name || row.patientName || "N/A",
            "Patient Phone":
              row.patient?.personal?.phone || row.patientPhone || "N/A",
            Branch: row.branch || "",
            Procedure: row.procedure || "",
            "Payment Type": row.paymentType || "",
            "Payment Method": row.method?.toUpperCase() || "",
            "Original Amount": parseFloat(row.amount) || 0,
            "Trans ID": row.paymentId || "",
            Discount: parseFloat(row.discount) || 0,
            "Batch ID": row.batchId || "",
            "Total Amount": row.patient?.payments?.totalAmount || 0,
            "Pending Amount": row.patient?.payments?.pendingAmount || 0,
            "Received Amount": row.patient?.payments?.amountReceived || 0,
            ...base,
          };
        }

        if (activeCategory === "SERVICE") {
          return {
            Date: formatDateForDisplay(row.date),
            "Patient/Customer":
              row.patient?.personal?.name || row.patientName || "Walk-in",
            Phone: row.patient?.personal?.phone || row.patientPhone || "",
            Email: row.patient?.personal?.email || "",
            Branch: row.branch || "",
            Service: row.procedure || "",
            Sessions: row.quantity || 1,
            "Per Session": row.perSessionCost || 0,
            "Payment Method": row.method?.toUpperCase() || "",
            Amount: parseFloat(row.amount) || 0,
            "Trans ID": row.paymentId || "",
            Discount: parseFloat(row.discount) || 0,
            "Batch ID": row.batchId || "",
            ...base,
          };
        }

        if (activeCategory === "MEDICINE") {
          return {
            Date: formatDateForDisplay(row.date),
            "Patient/Customer":
              row.patient?.personal?.name || row.patientName || "Walk-in",
            Phone: row.patient?.personal?.phone || row.patientPhone || "",
            Email: row.patient?.personal?.email || "",
            Branch: row.branch || "",
            Medicine:
              typeof row.medicineId === "object" ? row.medicineId?.name : "N/A",
            Quantity: row.quantity || 1,
            "Per Unit": row.perUnitCost || 0,
            "Payment Method": row.method?.toUpperCase() || "",
            Amount: parseFloat(row.amount) || 0,
            "Trans ID": row.paymentId || "",
            Discount: parseFloat(row.discount) || 0,
            "Batch ID": row.batchId || "",
            ...base,
          };
        }

        if (activeCategory === "EXPENSE") {
          return {
            Date: formatDateForDisplay(row.date),
            Branch: row.branch || "",
            "Expense Type": row.expense || row.expenseCategory || "",
            "Paid To": row.expenseGiver?.name || "N/A",
            "Payment Method": row.method?.toUpperCase() || "",
            Amount: parseFloat(row.amount) || 0,
            "Trans ID": row.paymentId || "",
            Discount: parseFloat(row.discount) || 0,
            "Batch ID": row.batchId || "",
            ...base,
          };
        }

        return base;
      });

      // Edit History data - properly extracting from updatedFields
      const editHistoryData = sortedRows.flatMap((row) => {
        if (!row.editors || row.editors.length === 0) return [];

        return row.editors.flatMap((editor, editorIndex) => {
          // If no updatedFields or empty, show just the edit event
          if (!editor.updatedFields || editor.updatedFields.length === 0) {
            return [
              {
                "Trans ID": row.paymentId || "",
                "Transaction Date": formatDateForDisplay(row.date),
                "Patient Name":
                  row.patient?.personal?.name || row.patientName || "N/A",
                "Patient Phone":
                  row.patient?.personal?.phone || row.patientPhone || "",
                Branch: row.branch || "",
                Category:
                  row.transactionCategory || row.category || "Uncategorized",
                "Transaction Amount": parseFloat(row.amount) || 0,
                "Edit Number": editorIndex + 1,
                "Edited By": editor.name || "N/A",
                "Editor Email": editor.email || "N/A",
                "Editor Branch": editor.branch || "N/A",
                "Edited At": formatDateTime(editor.date),
                "Field Changed": "General Edit",
                "Previous Value": "",
                "New Value": "",
              },
            ];
          }

          // Show each field change as a separate row
          return editor.updatedFields.map((field, fieldIndex) => ({
            "Trans ID": row.paymentId || "",
            "Transaction Date": formatDateForDisplay(row.date),
            "Patient Name":
              row.patient?.personal?.name || row.patientName || "N/A",
            "Patient Phone":
              row.patient?.personal?.phone || row.patientPhone || "",
            Branch: row.branch || "",
            Category:
              row.transactionCategory || row.category || "Uncategorized",
            "Transaction Amount": parseFloat(row.amount) || 0,
            "Edit Number": `${editorIndex + 1}.${fieldIndex + 1}`,
            "Edited By": editor.name || "N/A",
            "Editor Email": editor.email || "N/A",
            "Editor Branch": editor.branch || "N/A",
            "Edited At": formatDateTime(editor.date),
            "Field Changed": field.name || "N/A",
            "Previous Value": field.previousValue || "",
            "New Value": field.newValue || "",
          }));
        });
      });

      // Create workbook
      const wb = utils.book_new();

      // Add main transactions sheet with column widths
      const ws1 = utils.json_to_sheet(dataToExport);
      const maxWidth = 30;
      const colWidths1 = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth),
      }));
      ws1["!cols"] = colWidths1;
      utils.book_append_sheet(wb, ws1, `${activeCategory} Transactions`);

      // Add edit history sheet (only if there's edit history)
      if (editHistoryData.length > 0) {
        const ws2 = utils.json_to_sheet(editHistoryData);
        const colWidths2 = Object.keys(editHistoryData[0] || {}).map((key) => ({
          wch: Math.min(Math.max(key.length, 10), maxWidth),
        }));
        ws2["!cols"] = colWidths2;
        utils.book_append_sheet(wb, ws2, "Edit History");
      }

      // Generate filename
      const fileName = `${activeCategory}_Transactions_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Save file
      writeFile(wb, fileName);

      const totalSheets = editHistoryData.length > 0 ? 2 : 1;
      const totalFieldChanges = editHistoryData.filter(
        (row) => row["Field Changed"] !== "General Edit",
      ).length;

      toast.success(
        `Downloaded ${sortedRows.length} ${activeCategory} records with ${totalFieldChanges} field changes! (${totalSheets} sheets)`,
      );
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download Excel file");
    } finally {
      setDownloading(false);
    }
  };

  const applyQuickFilter = (preset) => {
    const today = getTodayDate();
    const date = new Date();

    switch (preset) {
      case "today":
        setFilters({ ...filters, dateFrom: today, dateTo: today });
        break;
      case "yesterday":
        const yesterday = new Date(date.setDate(date.getDate() - 1))
          .toISOString()
          .split("T")[0];
        setFilters({ ...filters, dateFrom: yesterday, dateTo: yesterday });
        break;
      case "week":
        const weekAgo = new Date(date.setDate(date.getDate() - 7))
          .toISOString()
          .split("T")[0];
        setFilters({ ...filters, dateFrom: weekAgo, dateTo: getTodayDate() });
        break;
      case "month":
        const monthAgo = new Date(date.setMonth(date.getMonth() - 1))
          .toISOString()
          .split("T")[0];
        setFilters({ ...filters, dateFrom: monthAgo, dateTo: getTodayDate() });
        break;
      case "all":
        setFilters({ ...filters, dateFrom: "", dateTo: "" });
        break;
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-16 w-16 text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading transactions...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl border border-red-100">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}
      >
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto min-w-0">
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-white border-2 border-gray-200 shadow-sm"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  All Transactions
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  View and manage all transaction categories
                </p>
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={downloadExcel}
                disabled={downloading || sortedRows.length === 0}
                className="bg-linear-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-1 sm:gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span className="font-semibold hidden xs:inline">
                      Downloading...
                    </span>
                  </>
                ) : (
                  <>
                    <Download size={18} strokeWidth={2.5} />
                    <span className="font-semibold hidden xs:inline">
                      Export Excel
                    </span>
                    <span className="font-semibold xs:hidden">Excel</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 sm:p-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 shrink-0"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>

              {/* <button
                onClick={() => router.push("/admin/transactions/create")}
                className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-1 sm:gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base shrink-0"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="font-semibold hidden xs:inline">
                  Add Transaction
                </span>
                <span className="font-semibold xs:inline">Add</span>
              </button> */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6">
          <StatCard
            title="Transplants"
            value={formatCurrency(categoryStats.TRANSPLANT.total)}
            icon={Scissors}
            gradient="from-indigo-400 to-purple-500"
            count={`${categoryStats.TRANSPLANT.count} transactions`}
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
          />
          <StatCard
            title="Services"
            value={formatCurrency(categoryStats.SERVICE.total)}
            icon={Heart}
            gradient="from-pink-400 to-rose-500"
            count={`${categoryStats.SERVICE.count} transactions`}
            iconBg="bg-pink-100"
            iconColor="text-pink-600"
          />
          <StatCard
            title="Medicines"
            value={formatCurrency(categoryStats.MEDICINE.total)}
            icon={Pill}
            gradient="from-emerald-400 to-green-500"
            count={`${categoryStats.MEDICINE.count} transactions`}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="Expenses"
            value={formatCurrency(categoryStats.EXPENSE.total)}
            icon={Receipt}
            gradient="from-rose-400 to-red-500"
            count={`${categoryStats.EXPENSE.count} transactions`}
            iconBg="bg-rose-100"
            iconColor="text-rose-600"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 p-4 sm:px-6 sm:py-4">
              <div className="flex gap-1 sm:gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                {TRANSACTION_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.value}
                      className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${getCategoryGradientClass(cat.value, activeCategory === cat.value)}`}
                      onClick={() => setActiveCategory(cat.value)}
                    >
                      <Icon size={18} />
                      {cat.label} ({categoryStats[cat.value].count})
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2 sm:gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-9 sm:pl-11 pr-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm w-full lg:w-64 transition-all"
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 sm:p-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${
                    showFilters
                      ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                  {showFilters ? (
                    <ChevronUp className="w-4 h-4 hidden sm:block" />
                  ) : (
                    <ChevronDown className="w-4 h-4 hidden sm:block" />
                  )}
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap shrink-0"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden xs:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 border-t border-gray-100 pt-4 sm:pt-5 bg-linear-to-b from-indigo-50/30 to-white">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quick Filters
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Today", value: "today" },
                      { label: "Yesterday", value: "yesterday" },
                      { label: "Last 7 Days", value: "week" },
                      { label: "Last 30 Days", value: "month" },
                      { label: "All Time", value: "all" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => applyQuickFilter(preset.value)}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all text-xs sm:text-sm font-semibold"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                  <Select
                    label="Branch"
                    value={filters.branch}
                    onChange={(val) => setFilters({ ...filters, branch: val })}
                    options={[
                      { value: "", label: "All Branches" },
                      ...BRANCHES.map((b) => ({ value: b, label: b })),
                    ]}
                    icon={Building2}
                  />
                  <Input
                    label="From Date"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(val) =>
                      setFilters({ ...filters, dateFrom: val })
                    }
                    icon={Calendar}
                  />
                  <Input
                    label="To Date"
                    type="date"
                    value={filters.dateTo}
                    onChange={(val) => setFilters({ ...filters, dateTo: val })}
                    icon={Calendar}
                  />
                  <Select
                    label="Payment Method"
                    value={filters.paymentMethod}
                    onChange={(val) =>
                      setFilters({ ...filters, paymentMethod: val })
                    }
                    options={[
                      { value: "", label: "All Methods" },
                      ...PAYMENT_METHODS.map((m) => ({
                        value: m,
                        label: m.toUpperCase(),
                      })),
                    ]}
                    icon={CreditCard}
                  />
                  {(activeCategory === "TRANSPLANT" ||
                    activeCategory === "SERVICE") && (
                    <Select
                      label="Procedure"
                      value={filters.procedure}
                      onChange={(val) =>
                        setFilters({ ...filters, procedure: val })
                      }
                      options={[
                        { value: "", label: "All Procedures" },
                        ...(activeCategory === "TRANSPLANT"
                          ? TRANSPLANT_PROCEDURES
                          : SERVICE_PROCEDURES
                        ).map((p) => ({ value: p, label: p })),
                      ]}
                    />
                  )}
                </div>

                {hasActiveFilters && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-indigo-900">
                        Active Filters:
                      </span>
                      <span className="text-xs text-indigo-700">
                        {sortedRows.length} results
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filters.branch && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Branch: {filters.branch}
                        </span>
                      )}
                      {filters.dateFrom && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          From: {formatDateForDisplay(filters.dateFrom)}
                        </span>
                      )}
                      {filters.dateTo && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          To: {formatDateForDisplay(filters.dateTo)}
                        </span>
                      )}
                      {filters.paymentMethod && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Method: {filters.paymentMethod.toUpperCase()}
                        </span>
                      )}
                      {filters.procedure && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Procedure: {filters.procedure}
                        </span>
                      )}
                      {tableSearch && (
                        <span className="px-2 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
                          Search: "{tableSearch}"
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DataTable
            category={activeCategory}
            rows={paginatedRows}
            onEdit={(row) => router.push(`/admin/transactions/edit/${row._id}`)}
            onDelete={openDeleteConfirm}
            onGenerateBill={openBillGenerator}
            onSort={handleSort}
            sortConfig={sortConfig}
            pagination={{
              page: current,
              pages,
              perPage,
              setPage,
              setPerPage,
              startIdx,
              endIdx,
              total,
            }}
          />
        </div>
      </main>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          transaction={deletingTransaction}
          onClose={() => {
            setShowDeleteConfirm(false);
            setDeletingTransaction(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      {showBillGenerator && selectedTransactionId && (
        <BillGenerator
          transactionId={selectedTransactionId}
          onClose={closeBillGenerator}
        />
      )}
    </div>
  );
}
