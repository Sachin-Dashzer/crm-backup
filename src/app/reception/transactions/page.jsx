"use client";

import { useEffect, useMemo, useState } from "react";
import ReceptionSidebar from "@/components/ReceptionSidebar";
import { useToast } from "@/components/Toast";
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
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Loader2,
  Menu,
  Tag,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ========== UTILITY FUNCTIONS ==========
const calculateNetAmount = (transaction) => {
  if (!transaction) return 0;
  const amount = parseFloat(transaction.amount) || 0;
  const discount = parseFloat(transaction.discount) || 0;
  return Math.max(0, amount - discount);
};

const getTodayDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
};

const formatDateForDisplay = (date) => {
  if (!date) return "N/A";
  const dateObj = new Date(date);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(dateObj.getTime() + istOffset);
  return istDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const BRANCHES = ["Delhi", "Mumbai", "Hyderabad"];
const PAYMENT_METHODS = ["upi", "cash", "card", "banking", "Loan", "other"];
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

const COST_TYPES = ["Revenue", "Expenses"];
const PAYMENT_TYPES = ["Booking", "Pending", "Full-payment", "Other"];

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
            be undone and will update patient balance if applicable.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Original Amount:</span>
              <span
                className={`font-bold text-gray-900 text-sm sm:text-base ${
                  hasDiscount ? "line-through text-gray-500" : ""
                }`}
              >
                {formatCurrency(transaction?.amount || 0)}
              </span>
            </div>
            {hasDiscount && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Discount:</span>
                  <span className="font-bold text-amber-600 text-sm sm:text-base">
                    -{formatCurrency(transaction?.discount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">
                    Net Amount:
                  </span>
                  <span className="font-bold text-emerald-600 text-sm sm:text-base">
                    {formatCurrency(netAmount)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Date:</span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">
                {formatDateForDisplay(transaction?.date)}
              </span>
            </div>
            {transaction?.patient && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Patient balance will be updated automatically
                </div>
              </div>
            )}
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

// ========== MAIN COMPONENT ==========
export default function AmountDashboard() {
  const [revenue, setRevenue] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [patients, setPatients] = useState([]);
  
  // Set default filters to today's date
  const [filters, setFilters] = useState({
    branch: "",
    dateFrom: getTodayDate(), // Default to today
    dateTo: getTodayDate(),   // Default to today
    paymentMethod: "",
    procedure: "",
  });
  
  const [activeTab, setActiveTab] = useState("revenue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const toast = useToast();

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

  // Store all data separately for searching
  const [allRevenue, setAllRevenue] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);

  useEffect(() => {
    fetchData();
    fetchPatients();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/transactions/get-data");
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      if (data.success && data.data) {
        setRevenue(data.data.Revenue || []);
        setExpenses(data.data.Expenses || []);
        setAllRevenue(data.data.Revenue || []); // Store all revenue for searching
        setAllExpenses(data.data.Expenses || []); // Store all expenses for searching
      } else {
        throw new Error("Invalid data format");
      }
    } catch (e) {
      setError(e.message);
      toast.error("Error loading data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/admin/get-patient");
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
      }
    } catch (e) {
      toast.error("Failed to fetch patients");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchPatients();
  };

  // Timezone-aware date filtering
  const filterByDateRange = (items, dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return items;

    return items.filter((item) => {
      const itemDate = new Date(item.date);

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        const fromDateIST = new Date(fromDate.getTime() - 5.5 * 60 * 60 * 1000);
        if (itemDate < fromDateIST) return false;
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        const toDateIST = new Date(toDate.getTime() - 5.5 * 60 * 60 * 1000);
        if (itemDate > toDateIST) return false;
      }

      return true;
    });
  };

  // Filtering with timezone support (for display)
  const filteredRevenue = useMemo(() => {
    let list = [...revenue];
    if (filters.branch)
      list = list.filter(
        (t) => t.branch.toLowerCase() === filters.branch.toLowerCase()
      );
    if (filters.paymentMethod)
      list = list.filter(
        (t) => t.method.toLowerCase() === filters.paymentMethod.toLowerCase()
      );
    if (filters.procedure)
      list = list.filter(
        (t) => t.procedure.toLowerCase() === filters.procedure.toLowerCase()
      );

    list = filterByDateRange(list, filters.dateFrom, filters.dateTo);
    return list;
  }, [revenue, filters]);

  const filteredExpenses = useMemo(() => {
    let list = [...expenses];
    if (filters.branch)
      list = list.filter(
        (e) => e.branch.toLowerCase() === filters.branch.toLowerCase()
      );
    if (filters.paymentMethod)
      list = list.filter(
        (e) => e.method.toLowerCase() === filters.paymentMethod.toLowerCase()
      );

    list = filterByDateRange(list, filters.dateFrom, filters.dateTo);
    return list;
  }, [expenses, filters]);

  // Calculate totals with discount (for display - today's data by default)
  const totalIncome = useMemo(() => {
    return filteredRevenue.reduce((sum, t) => sum + calculateNetAmount(t), 0);
  }, [filteredRevenue]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0),
      0
    );
  }, [filteredExpenses]);

  // Calculate total discount
  const totalDiscount = useMemo(() => {
    return filteredRevenue.reduce(
      (sum, t) => sum + (parseFloat(t.discount) || 0),
      0
    );
  }, [filteredRevenue]);

  const netBalance = totalIncome - totalExpense;
  const totalTransactions = filteredRevenue.length;
  const totalExpenseItems = filteredExpenses.length;

  // For searching - use all data when there's a search term
  const searchedRows = useMemo(() => {
    // If there's a search term, search across all data (not just today's)
    // Otherwise, use the filtered data (which defaults to today)
    const rowsToSearch = tableSearch 
      ? (activeTab === "revenue" ? allRevenue : allExpenses)
      : (activeTab === "revenue" ? filteredRevenue : filteredExpenses);
    
    if (!tableSearch) return rowsToSearch;

    return rowsToSearch.filter((row) => {
      const searchLower = tableSearch.toLowerCase();
      if (activeTab === "revenue") {
        const patientName = row.patient?.personal?.name || "Walk-in Customer";
        const patientPhone = row.patient?.personal?.phone || "";
        return (
          patientName.toLowerCase().includes(searchLower) ||
          patientPhone.includes(searchLower) ||
          row.procedure?.toLowerCase().includes(searchLower) ||
          row.method?.toLowerCase().includes(searchLower) ||
          row.branch?.toLowerCase().includes(searchLower) ||
          row.remarks?.toLowerCase().includes(searchLower) ||
          row.amount.toString().includes(searchLower) ||
          (row.discount && row.discount.toString().includes(searchLower)) ||
          row.patient?.payments?.totalAmount?.toString().includes(searchLower)
        );
      } else {
        return (
          row.expense?.toLowerCase().includes(searchLower) ||
          row.method?.toLowerCase().includes(searchLower) ||
          row.branch?.toLowerCase().includes(searchLower) ||
          row.remarks?.toLowerCase().includes(searchLower) ||
          row.amount.toString().includes(searchLower)
        );
      }
    });
  }, [activeTab, filteredRevenue, filteredExpenses, allRevenue, allExpenses, tableSearch]);

  // Sorting
  const sortedRows = useMemo(() => {
    const sorted = [...searchedRows];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle patient name for revenue
        if (sortConfig.key === "patient" && activeTab === "revenue") {
          aVal = a.patient?.personal?.name || "Walk-in Customer";
          bVal = b.patient?.personal?.name || "Walk-in Customer";
        }

        // Handle net amount calculation for amount sorting
        if (sortConfig.key === "amount" && activeTab === "revenue") {
          aVal = calculateNetAmount(a);
          bVal = calculateNetAmount(b);
        }

        // Handle dates
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
  }, [searchedRows, sortConfig, activeTab]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Pagination
  const total = sortedRows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  const startIdx = (current - 1) * perPage;
  const endIdx = Math.min(startIdx + perPage, total);
  const paginatedRows = sortedRows.slice(startIdx, endIdx);

  const getPatientName = (patient) => {
    if (!patient) return "Walk-in Customer";
    return patient.personal?.name || "N/A";
  };
  
  const getPatientNumber = (patient) => {
    if (!patient) return "";
    return patient.personal?.phone || "";
  };
  
  const clearFilters = () => {
    setFilters({
      branch: "",
      dateFrom: getTodayDate(), // Reset to today after clear
      dateTo: getTodayDate(),   // Reset to today after clear
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
  }, [filters, activeTab, tableSearch]);

  const openCreateModal = () => {
    setEditingTransaction(null);
    setShowModal(true);
  };

  const openEditModal = (transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTransaction(null);
  };

  const handleSuccess = () => {
    fetchData();
    fetchPatients();
    closeModal();
    toast.success("Transaction saved successfully");
  };

  const openDeleteConfirm = (transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;

    try {
      const res = await fetch("/api/transactions/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: deletingTransaction._id }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Transaction deleted successfully");
        fetchData();
        fetchPatients();
        setShowDeleteConfirm(false);
        setDeletingTransaction(null);
      } else {
        toast.error(data.message || "Failed to delete transaction");
      }
    } catch (err) {
      toast.error("An error occurred while deleting");
    }
  };

  // Excel Download Function
  const downloadExcel = async () => {
    try {
      setDownloading(true);

      // Import xlsx dynamically
      const { utils, writeFile } = await import("xlsx");

      // Prepare data based on active tab
      const dataToExport = sortedRows.map((row) => {
        if (activeTab === "revenue") {
          const netAmount = calculateNetAmount(row);
          const hasDiscount = parseFloat(row.discount || 0) > 0;
          const patientData = row.patient;

          return {
            Date: formatDateForDisplay(row.date),
            "Patient Name": patientData?.personal?.name || "Walk-in Customer",
            Phone: patientData?.personal?.phone || "N/A",
            Branch: row.branch || "",
            Procedure: row.procedure || "",
            "Payment Type": row.paymentType || "",
            "Payment Method": row.method?.toUpperCase() || "",
            "Original Amount": parseFloat(row.amount) || 0,
            Discount: hasDiscount ? parseFloat(row.discount) || 0 : 0,
            "Net Amount": netAmount,
            "Pending Amount": patientData?.payments?.pendingAmount || 0,
            "Total Package": patientData?.payments?.totalAmount || 0,
            "Amount Received": patientData?.payments?.amountReceived || 0,
            Remarks: row.remarks || "",
          };
        } else {
          return {
            Date: formatDateForDisplay(row.date),
            Branch: row.branch || "",
            "Expense Type": row.expense || "",
            "Payment Method": row.method?.toUpperCase() || "",
            Amount: parseFloat(row.amount) || 0,
            "Given To": row.expenseGiver || "",
            Remarks: row.remarks || "",
          };
        }
      });

      // Create workbook
      const wb = utils.book_new();
      const ws = utils.json_to_sheet(dataToExport);

      // Set column widths
      const maxWidth = 30;
      const colWidths = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth),
      }));
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      utils.book_append_sheet(
        wb,
        ws,
        activeTab === "revenue" ? "Revenue" : "Expenses"
      );

      // Generate filename
      const filterInfo = [];
      if (filters.branch) filterInfo.push(filters.branch);
      if (filters.dateFrom || filters.dateTo) {
        const dateRange = `${filters.dateFrom || "Start"}_to_${
          filters.dateTo || "End"
        }`;
        filterInfo.push(dateRange);
      }

      const filterSuffix =
        filterInfo.length > 0 ? `_${filterInfo.join("_")}` : "";
      const fileName = `${activeTab}_transactions${filterSuffix}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      writeFile(wb, fileName);

      toast.success(`✓ Downloaded ${sortedRows.length} ${activeTab} records!`);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download Excel file");
    } finally {
      setDownloading(false);
    }
  };

  // Quick filter presets
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
          <p className="text-gray-600 font-medium">Loading financial data...</p>
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
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
      `}
      >
        <ReceptionSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto min-w-0">
        {/* Header */}
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
                  Financial Dashboard
                </h1>
                <p className="text-gray-600 text-sm sm:text-base">
                  Track revenue, expenses and transactions
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
              <button
                onClick={openCreateModal}
                className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-1 sm:gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base shrink-0"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="font-semibold hidden xs:inline">
                  Add Transaction
                </span>
                <span className="font-semibold xs:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            gradient="from-emerald-400 to-green-500"
            count={`${totalTransactions} transactions`}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpense)}
            icon={TrendingDown}
            gradient="from-rose-400 to-red-500"
            count={`${totalExpenseItems} transactions`}
            iconBg="bg-rose-100"
            iconColor="text-rose-600"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(netBalance)}
            icon={DollarSign}
            gradient={
              netBalance >= 0
                ? "from-indigo-400 to-purple-500"
                : "from-gray-400 to-gray-500"
            }
            count={netBalance >= 0 ? "Positive Balance" : "Negative Balance"}
            iconBg={netBalance >= 0 ? "bg-indigo-100" : "bg-gray-100"}
            iconColor={netBalance >= 0 ? "text-indigo-600" : "text-gray-600"}
          />
          <StatCard
            title="Total Discount"
            value={formatCurrency(totalDiscount)}
            icon={Tag}
            gradient="from-amber-400 to-orange-500"
            count={`On ${
              filteredRevenue.filter((t) => (t.discount || 0) > 0).length
            } transactions`}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Tabs & Controls */}
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 p-4 sm:px-6 sm:py-4">
              {/* Tabs */}
              <div className="flex gap-1 sm:gap-2 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                <button
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeTab === "revenue"
                      ? "bg-linear-to-r from-emerald-500 to-green-600 text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("revenue")}
                >
                  Revenue ({totalTransactions})
                </button>
                <button
                  className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap shrink-0 ${
                    activeTab === "expenses"
                      ? "bg-linear-to-r from-rose-500 to-red-600 text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("expenses")}
                >
                  Expenses ({totalExpenseItems})
                </button>
              </div>

              {/* Search & Filter Controls */}
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
                  title="Toggle filters"
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

            {/* Filters Panel */}
            {showFilters && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 border-t border-gray-100 pt-4 sm:pt-5 bg-linear-to-b from-indigo-50/30 to-white">
                {/* Quick Filter Buttons */}
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

                {/* Detailed Filters */}
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
                  {activeTab === "revenue" && (
                    <Select
                      label="Procedure"
                      value={filters.procedure}
                      onChange={(val) =>
                        setFilters({ ...filters, procedure: val })
                      }
                      options={[
                        { value: "", label: "All Procedures" },
                        ...PROCEDURES.map((p) => ({ value: p, label: p })),
                      ]}
                    />
                  )}
                </div>

                {/* Active Filters Summary */}
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

          {/* Table */}
          <DataTable
            type={activeTab}
            rows={paginatedRows}
            getPatientName={getPatientName}
            getPatientNumber={getPatientNumber}
            onEdit={openEditModal}
            onDelete={openDeleteConfirm}
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

      {/* Transaction Modal */}
      {showModal && (
        <TransactionModal
          transaction={editingTransaction}
          patients={patients}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
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
    </div>
  );
}

// ========== TRANSACTION MODAL COMPONENT ==========
function TransactionModal({ transaction, patients, onClose, onSuccess }) {
  const isEdit = !!transaction;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPatient, setSearchPatient] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const toast = useToast();

  const [formData, setFormData] = useState({
    _id: transaction?._id || "",
    costType: transaction?.costType || "Revenue",
    method: transaction?.method || "cash",
    procedure: transaction?.procedure || "Sapphire FUE",
    paymentType: transaction?.paymentType || "Booking",
    branch: transaction?.branch || "Delhi",
    amount: transaction?.amount || "",
    discount: transaction?.discount || "0",
    date: transaction?.date
      ? new Date(transaction.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    expense: transaction?.expense || "",
    remarks: transaction?.remarks || "",
    patient: transaction?.patient?._id || "",
  });

  // Update formData when transaction prop changes
  useEffect(() => {
    if (transaction) {
      setFormData({
        _id: transaction._id,
        costType: transaction.costType || "Revenue",
        method: transaction.method || "cash",
        procedure: transaction.procedure || "Sapphire FUE",
        paymentType: transaction.paymentType || "Booking",
        branch: transaction.branch || "Delhi",
        amount: transaction.amount || "",
        discount: transaction.discount || "0",
        date: transaction.date
          ? new Date(transaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        expense: transaction.expense || "",
        remarks: transaction.remarks || "",
        patient: transaction.patient?._id || "",
      });
    }
  }, [transaction]);

  const filteredPatients = useMemo(() => {
    if (!searchPatient) return patients.slice(0, 10);
    return patients
      .filter(
        (p) =>
          p.personal?.name
            ?.toLowerCase()
            .includes(searchPatient.toLowerCase()) ||
          p.personal?.phone?.includes(searchPatient)
      )
      .slice(0, 10);
  }, [patients, searchPatient]);

  // Define selectedPatient BEFORE using it in pendingAmount
  const selectedPatient = useMemo(() => {
    return patients.find((p) => p._id === formData.patient);
  }, [patients, formData.patient]);

  // Calculate pending amount for the patient
  const pendingAmount = useMemo(() => {
    if (formData.costType !== "Revenue" || !selectedPatient) return 0;

    const existingPendingAmount =
      parseFloat(selectedPatient.payments?.pendingAmount) || 0;
    const formAmount = parseFloat(formData.amount) || 0;
    const formDiscount = parseFloat(formData.discount) || 0;

    return Math.max(0, existingPendingAmount - formAmount - formDiscount);
  }, [formData.amount, formData.discount, formData.costType, selectedPatient]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.costType === "Revenue" && !formData.patient) {
      setError("Patient is required for revenue transactions");
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    const discountValue = parseFloat(formData.discount) || 0;
    if (discountValue < 0) {
      setError("Discount cannot be negative");
      return;
    }


    if (formData.costType === "Expenses" && !formData.expense) {
      setError("Expense type is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = isEdit
        ? "/api/transactions/update"
        : "/api/transactions/create";
      const method = isEdit ? "PUT" : "POST";

      // Prepare payload
      const payload = {
        ...formData,
        patient: formData.costType === "Expenses" ? null : formData.patient,
        discount:
          formData.costType === "Revenue" ? formData.discount || "0" : "0",
        amount: formData.amount,
      };

      if (!isEdit) {
        delete payload._id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || "Failed to save transaction");
      }
    } catch (err) {
      setError("An error occurred while saving");
      console.error("Transaction save error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-3xl w-full my-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-linear-to-r from-indigo-500 to-purple-600 px-4 sm:px-8 py-4 sm:py-5 flex justify-between items-center rounded-t-2xl sm:rounded-t-3xl z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {isEdit ? "Edit Transaction" : "Add New Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 sm:p-2 hover:bg-white/20 rounded-xl transition-colors"
            type="button"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2 sm:gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {/* Type Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Transaction Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {COST_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        costType: type,
                        patient: type === "Expenses" ? "" : formData.patient,
                        discount: type === "Expenses" ? "0" : formData.discount,
                      })
                    }
                    className={`p-3 sm:p-4 rounded-xl border-2 transition-all font-semibold text-sm sm:text-base ${
                      formData.costType === type
                        ? type === "Revenue"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md"
                          : "border-rose-500 bg-rose-50 text-rose-700 shadow-md"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Selection - Only for Revenue */}
            {formData.costType === "Revenue" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Patient <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="text"
                      placeholder="Search patient by name or phone..."
                      value={searchPatient}
                      onChange={(e) => {
                        setSearchPatient(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      className="w-full pl-9 sm:pl-11 pr-4 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm sm:text-base"
                    />
                  </div>

                  {selectedPatient && !showPatientDropdown && (
                    <div className="p-3 sm:p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                          {selectedPatient.personal?.name}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          Total:{" "}
                          {formatCurrency(
                            selectedPatient.payments?.totalAmount || 0
                          )}{" "}
                          | Received:{" "}
                          {formatCurrency(
                            selectedPatient.payments?.amountReceived || 0
                          )}{" "}
                          | Pending:{" "}
                          {formatCurrency(
                            selectedPatient.payments?.pendingAmount || 0
                          )}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          Medicine:{" "}
                          {formatCurrency(
                            selectedPatient.payments?.medicineAmount || 0
                          )}{" "}
                          | Discount:{" "}
                          {formatCurrency(
                            selectedPatient.payments?.discount || 0
                          )}
                        </p>
                      </div>
                      <CheckCircle2
                        className="text-emerald-600 shrink-0 ml-2"
                        size={20}
                      />
                    </div>
                  )}

                  {showPatientDropdown && (
                    <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl bg-white shadow-lg">
                      {filteredPatients.length === 0 ? (
                        <div className="p-3 text-center text-gray-500 text-sm">
                          No patients found
                        </div>
                      ) : (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient._id}
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                patient: patient._id,
                              });
                              setSearchPatient("");
                              setShowPatientDropdown(false);
                            }}
                            className={`w-full p-2 sm:p-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0 ${
                              formData.patient === patient._id
                                ? "bg-indigo-50"
                                : ""
                            }`}
                          >
                            <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                              {patient.personal?.name} -{" "}
                              {patient.personal?.phone}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              Total:{" "}
                              {formatCurrency(
                                patient.payments?.totalAmount || 0
                              )}{" "}
                              | Received:{" "}
                              {formatCurrency(
                                patient.payments?.amountReceived || 0
                              )}{" "}
                              | Pending:{" "}
                              {formatCurrency(
                                patient.payments?.pendingAmount || 0
                              )}
                            </p>
                            <p className="text-xs text-gray-600 truncate">
                              Medicine:{" "}
                              {formatCurrency(
                                patient.payments?.medicineAmount || 0
                              )}{" "}
                              | Discount:{" "}
                              {formatCurrency(patient.payments?.discount || 0)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Select
              label="Branch"
              value={formData.branch}
              onChange={(val) => setFormData({ ...formData, branch: val })}
              options={BRANCHES.map((b) => ({ value: b, label: b }))}
              required
              icon={Building2}
            />

            {formData.costType === "Revenue" ? (
              <>
                <Select
                  label="Procedure"
                  value={formData.procedure}
                  onChange={(val) =>
                    setFormData({ ...formData, procedure: val })
                  }
                  options={PROCEDURES.map((p) => ({ value: p, label: p }))}
                  required
                />
                <Select
                  label="Payment Type"
                  value={formData.paymentType}
                  onChange={(val) =>
                    setFormData({ ...formData, paymentType: val })
                  }
                  options={PAYMENT_TYPES.map((t) => ({ value: t, label: t }))}
                  required
                />
              </>
            ) : (
              <Input
                label="Expense Type"
                value={formData.expense}
                onChange={(val) => setFormData({ ...formData, expense: val })}
                required
                placeholder="e.g., Rent, Salary, Utilities"
              />
            )}

            <Select
              label="Payment Method"
              value={formData.method}
              onChange={(val) => setFormData({ ...formData, method: val })}
              options={PAYMENT_METHODS.map((m) => ({
                value: m,
                label: m.toUpperCase(),
              }))}
              required
              icon={CreditCard}
            />

            <Input
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={(val) => setFormData({ ...formData, amount: val })}
              required
              icon={DollarSign}
              placeholder="0"
              min="1"
              step="0.01"
            />

            {/* Discount Field - Only for Revenue */}
            {formData.costType === "Revenue" && (
              <Input
                label="Discount"
                type="number"
                value={formData.discount}
                onChange={(val) => setFormData({ ...formData, discount: val })}
                icon={Tag}
                placeholder="0"
                min="0"
                step="0.01"
              />
            )}

            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(val) => setFormData({ ...formData, date: val })}
              required
              icon={Calendar}
              max={new Date().toISOString().split("T")[0]}
            />

            {/* Pending Amount Display */}
            {formData.costType === "Revenue" && selectedPatient && (
              <div className="flex items-end">
                <div className="w-full p-3 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 mb-1">
                    {formData.amount
                      ? "Pending Amount (After Transaction)"
                      : "Current Pending Amount"}
                  </p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatCurrency(pendingAmount)}
                  </p>
                  {formData.amount ? (
                    <p className="text-xs text-blue-600 mt-1">
                      Existing Pending:{" "}
                      {formatCurrency(
                        selectedPatient.payments?.pendingAmount || 0
                      )}{" "}
                      - Payment: {formatCurrency(formData.amount)} - Discount:{" "}
                      {formatCurrency(formData.discount)}
                    </p>
                  ) : (
                    <p className="text-xs text-blue-600 mt-1">
                      Enter payment amount to see updated balance
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="md:col-span-2">
              <Input
                label="Remarks"
                value={formData.remarks}
                onChange={(val) => setFormData({ ...formData, remarks: val })}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>

          <div className="flex flex-col xs:flex-row gap-3 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50 text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                "Update Transaction"
              ) : (
                "Create Transaction"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ========== DATA TABLE COMPONENT ==========
function DataTable({
  type,
  rows,
  getPatientName,
  getPatientNumber,
  onEdit,
  onDelete,
  onSort,
  sortConfig,
  pagination,
}) {
  const columns =
    type === "revenue"
      ? [
        { key: "date", label: "Date", sortable: true },
          { key: "patient", label: "Patient", sortable: true },
          { key: "procedure", label: "Procedure", sortable: true },
          { key: "method", label: "Method", sortable: true },
          { key: "totalPackage", label: "Total Package", sortable: false },
          { key: "amount", label: "Amount", sortable: true },
          { key: "pending", label: "Pending", sortable: false },
          { key: "branch", label: "Branch", sortable: true },
          { key: "remarks", label: "Remarks", sortable: false },
          { key: "actions", label: "Actions", sortable: false },
        ]
      : [
          { key: "expense", label: "Expense", sortable: true },
          { key: "category", label: "Category", sortable: false },
          { key: "method", label: "Method", sortable: true },
          { key: "amount", label: "Amount", sortable: true },
          { key: "date", label: "Date", sortable: true },
          { key: "branch", label: "Branch", sortable: true },
          { key: "remarks", label: "Remarks", sortable: false },
          { key: "actions", label: "Actions", sortable: false },
        ];

  const getProcedureColor = (proc) => {
    const colors = {
      "sapphire fue": "bg-indigo-100 text-indigo-700 border-indigo-200",
      dhi: "bg-purple-100 text-purple-700 border-purple-200",
      "turkish dhi": "bg-pink-100 text-pink-700 border-pink-200",
      "beard transplant": "bg-amber-100 text-amber-700 border-amber-200",
      prp: "bg-emerald-100 text-emerald-700 border-emerald-200",
      gfc: "bg-cyan-100 text-cyan-700 border-cyan-200",
      medicine: "bg-orange-100 text-orange-700 border-orange-200",
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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-225">
          <thead className="bg-linear-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider ${
                    col.sortable
                      ? "cursor-pointer hover:bg-gray-100 transition-colors group"
                      : ""
                  }`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="truncate">{col.label}</span>
                    {col.sortable && <SortIcon columnKey={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-12 sm:py-16 text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-base sm:text-lg mb-1">
                        No records found
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const netAmount = calculateNetAmount(row);
                const hasDiscount = parseFloat(row.discount || 0) > 0;
                const pendingAmount = row.patient?.payments?.pendingAmount || 0;
                const totalPackage = row.patient?.payments?.totalAmount || 0;
                const phoneNumber = getPatientNumber(row.patient);

                return (
                  <tr
                    key={row._id || i}
                    className="hover:bg-indigo-50/50 transition-colors"
                  >
                    {type === "revenue" ? (
                      <>
                      <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-gray-700 font-semibold text-sm">
                          {formatDateForDisplay(row.date)}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* <div className="w-6 h-6 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                            </div> */}
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate">
                                {getPatientName(row.patient)}
                                <br />
                                <span className="text-xs font-semibold text-black">
                                  {" "}
                                  {phoneNumber || "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span
                            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border ${getProcedureColor(
                              row.procedure
                            )}`}
                          >
                            {row.procedure}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span
                            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border ${getMethodColor(
                              row.method
                            )}`}
                          >
                            {row.method?.toUpperCase()}
                          </span>
                        </td>

                        <td className="px-3 text-center sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="font-bold text-indigo-600 text-sm">
                            {formatCurrency(totalPackage)}
                          </div>
                        </td>

                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="text-center">
                            {hasDiscount ? (
                              <>
                                <div className="font-bold text-emerald-600 text-sm sm:text-base">
                                  {formatCurrency(netAmount)}
                                </div>
                                <div className="text-xs text-gray-500 line-through">
                                  {formatCurrency(row.amount)}
                                </div>
                                <div className="text-xs text-amber-600 font-medium mt-0.5 flex items-center justify-end gap-1">
                                  <Tag className="w-3 h-3" />-
                                  {formatCurrency(row.discount)}
                                </div>
                              </>
                            ) : (
                              <div className="font-bold text-emerald-600 text-sm sm:text-base">
                                {formatCurrency(netAmount)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="text-center">
                            <span
                              className={`font-semibold text-sm ${
                                pendingAmount > 0
                                  ? "text-orange-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {formatCurrency(pendingAmount)}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                            {row.branch}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-gray-600 text-sm max-w-30 lg:max-w-xs truncate">
                          {row.remarks || "-"}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => onEdit(row)}
                              className="p-1.5 sm:p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600"
                              title="Edit transaction"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => onDelete(row)}
                              className="p-1.5 sm:p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                              title="Delete transaction"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 font-medium text-gray-900 text-sm">
                          {row.expense}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                            {row.expense}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span
                            className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border ${getMethodColor(
                              row.method
                            )}`}
                          >
                            {row.method?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right font-bold text-rose-600 text-sm sm:text-base">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-gray-700 font-medium text-sm">
                          {formatDateForDisplay(row.date)}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                            {row.branch}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-gray-600 text-sm max-w-30 lg:max-w-xs truncate">
                          {row.remarks || "-"}
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              onClick={() => onEdit(row)}
                              className="p-1.5 sm:p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600"
                              title="Edit transaction"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => onDelete(row)}
                              className="p-1.5 sm:p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                              title="Delete transaction"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-4 sm:py-5 border-t border-gray-200 bg-linear-to-b from-white to-gray-50">
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {pagination.startIdx + 1}
          </span>
          –<span className="font-bold text-gray-900">{pagination.endIdx}</span>{" "}
          of{" "}
          <span className="font-bold text-gray-900">
            {pagination.total.toLocaleString()}
          </span>{" "}
          records
        </p>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600 font-medium hidden xs:inline">
              Rows per page:
            </span>
            <select
              className="text-xs sm:text-sm border-2 border-gray-200 rounded-xl px-2 sm:px-4 py-1.5 sm:py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white font-medium transition-all"
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
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => pagination.setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-1.5 sm:p-2.5 rounded-xl border-2 border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <span className="text-xs sm:text-sm text-gray-600 min-w-20 sm:min-w-24 text-center font-medium">
              Page{" "}
              <span className="font-bold text-gray-900">{pagination.page}</span>{" "}
              of{" "}
              <span className="font-bold text-gray-900">
                {pagination.pages}
              </span>
            </span>
            <button
              onClick={() =>
                pagination.setPage((p) => Math.min(pagination.pages, p + 1))
              }
              disabled={pagination.page >= pagination.pages}
              className="p-1.5 sm:p-2.5 rounded-xl border-2 border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
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
  step,
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
          step={step}
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