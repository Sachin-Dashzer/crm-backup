"use client";

import { useEffect, useMemo, useState } from "react";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  IndianRupee,
  TrendingUp,
  CreditCard,
  Building2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Download,
  ArrowUpDown,
  User,
  Receipt,
  BarChart3,
  Activity,
} from "lucide-react";

const BRANCHES = ["Delhi", "Mumbai", "Hyderabad"];
const PAYMENT_METHODS = ["cash", "upi", "banking", "other", "Loan"];
const PROCEDURES = [
  "hair transplant",
  "beard transplant",
  "prp",
  "gfc",
  "medicine",
  "Other",
];
const PAYMENT_TYPES = ["Booking", "Pending", "Full-payment", "Other"];

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function SalesTransactionDashboard() {
  const [revenue, setRevenue] = useState([]);
  const [filters, setFilters] = useState({
    branch: "",
    dateFrom: "",
    dateTo: "",
    paymentMethod: "",
    procedure: "",
    paymentType: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Sorting state
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
      const res = await fetch("/api/sales/transactions");
      if (!res.ok) throw new Error("Failed to fetch data");
      const data = await res.json();
      if (data.success && data.data) {
        setRevenue(data.data);
      } else {
        throw new Error("Invalid data format");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
  };

  // Filtering
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
    if (filters.paymentType)
      list = list.filter(
        (t) =>
          t.paymentType?.toLowerCase() === filters.paymentType.toLowerCase()
      );
    if (filters.dateFrom)
      list = list.filter((t) => new Date(t.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.date) <= to);
    }
    return list;
  }, [revenue, filters]);

  const searchedRows = useMemo(() => {
    if (!tableSearch) return filteredRevenue;

    return filteredRevenue.filter((row) => {
      const searchLower = tableSearch.toLowerCase();
      const patientName = row.patient?.personal?.name || "Walk-in Customer";
      return (
        patientName.toLowerCase().includes(searchLower) ||
        row.patient?.personal?.phone?.includes(searchLower) ||
        row.procedure?.toLowerCase().includes(searchLower) ||
        row.method?.toLowerCase().includes(searchLower) ||
        row.branch?.toLowerCase().includes(searchLower) ||
        row.remarks?.toLowerCase().includes(searchLower) ||
        row.amount.toString().includes(searchLower) ||
        row.paymentType?.toLowerCase().includes(searchLower)
      );
    });
  }, [filteredRevenue, tableSearch]);

  // Sorting
  const sortedRows = useMemo(() => {
    const sorted = [...searchedRows];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle patient name
        if (sortConfig.key === "patient") {
          aVal = a.patient?.personal?.name || "Walk-in Customer";
          bVal = b.patient?.personal?.name || "Walk-in Customer";
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
  }, [searchedRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Summary Statistics
  const stats = useMemo(() => {
    const totalRevenue = filteredRevenue.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );
    const totalTransactions = filteredRevenue.length;

    // Average transaction
    const avgTransaction =
      totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Group by payment method
    const byMethod = filteredRevenue.reduce((acc, t) => {
      const method = t.method || "other";
      acc[method] = (acc[method] || 0) + t.amount;
      return acc;
    }, {});

    // Group by branch
    const byBranch = filteredRevenue.reduce((acc, t) => {
      const branch = t.branch || "Unknown";
      acc[branch] = (acc[branch] || 0) + t.amount;
      return acc;
    }, {});

    // Group by procedure
    const byProcedure = filteredRevenue.reduce((acc, t) => {
      const procedure = t.procedure || "Other";
      acc[procedure] = (acc[procedure] || 0) + t.amount;
      return acc;
    }, {});

    // Group by payment type
    const byPaymentType = filteredRevenue.reduce((acc, t) => {
      const type = t.paymentType || "Other";
      acc[type] = (acc[type] || 0) + t.amount;
      return acc;
    }, {});

    // Recent transactions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTransactions = filteredRevenue.filter(
      (t) => new Date(t.date) >= sevenDaysAgo
    );
    const recentRevenue = recentTransactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );

    return {
      totalRevenue,
      totalTransactions,
      avgTransaction,
      byMethod,
      byBranch,
      byProcedure,
      byPaymentType,
      recentRevenue,
      recentCount: recentTransactions.length,
    };
  }, [filteredRevenue]);

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

  const clearFilters = () => {
    setFilters({
      branch: "",
      dateFrom: "",
      dateTo: "",
      paymentMethod: "",
      procedure: "",
      paymentType: "",
    });
    setTableSearch("");
    setPage(1);
  };

  const hasActiveFilters =
    Object.values(filters).some((value) => value !== "") || tableSearch;

  useEffect(() => {
    setPage(1);
  }, [filters, tableSearch]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Transaction ID",
      "Date",
      "Patient Name",
      "Phone",
      "Branch",
      "Procedure",
      "Payment Type",
      "Payment Method",
      "Amount",
      "Remarks",
    ];

    const csvData = sortedRows.map((t) => [
      t._id,
      formatDate(t.date),
      getPatientName(t.patient),
      t.patient?.personal?.phone || "N/A",
      t.branch || "",
      t.procedure || "",
      t.paymentType || "",
      t.method || "",
      t.amount || 0,
      t.remarks || "",
    ]);

    const csv = [headers, ...csvData]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-transactions-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
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
      <SalesSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Revenue Transactions
              </h1>
              <p className="text-gray-600">
                View and track all revenue transactions
              </p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex-1 sm:flex-none px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 text-gray-600 mx-auto ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button
                onClick={exportToCSV}
                disabled={sortedRows.length === 0}
                className="flex-1 sm:flex-none bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={20} strokeWidth={2.5} />
                <span className="font-semibold hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={TrendingUp}
            linear="from-emerald-400 to-green-500"
            count={`${stats.totalTransactions} transactions`}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="Avg Transaction"
            value={formatCurrency(stats.avgTransaction)}
            icon={BarChart3}
            linear="from-blue-400 to-indigo-500"
            count="Per transaction"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title="Last 7 Days"
            value={formatCurrency(stats.recentRevenue)}
            icon={Activity}
            linear="from-purple-400 to-pink-500"
            count={`${stats.recentCount} transactions`}
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
          />
          <StatCard
            title="Unique Patients"
            value={
              new Set(
                filteredRevenue.map((t) => t.patient?._id).filter(Boolean)
              ).size
            }
            icon={User}
            linear="from-amber-400 to-orange-500"
            count="Total patients"
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          {/* Controls */}
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-linear-to-r from-emerald-100 to-green-100 rounded-xl border-2 border-emerald-200">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Revenue Only View
                  </p>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex gap-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm w-full lg:w-64 transition-all"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2.5 rounded-xl transition-all ${
                    showFilters
                      ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                  }`}
                  title="Toggle filters"
                >
                  <Filter className="w-5 h-5" />
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all font-medium flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="px-6 pb-5 border-t border-gray-100 pt-5 bg-linear-to-b from-gray-50 to-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Select
                    label="Payment Type"
                    value={filters.paymentType}
                    onChange={(val) =>
                      setFilters({ ...filters, paymentType: val })
                    }
                    options={[
                      { value: "", label: "All Types" },
                      ...PAYMENT_TYPES.map((t) => ({ value: t, label: t })),
                    ]}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <DataTable
            rows={paginatedRows}
            getPatientName={getPatientName}
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

        {/* Revenue Breakdown Cards */}
        {Object.keys(stats.byBranch).length > 0 && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Branch */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Revenue by Branch
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.byBranch)
                  .sort(([, a], [, b]) => b - a)
                  .map(([branch, amount]) => (
                    <div
                      key={branch}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-semibold text-gray-700">
                        {branch}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* By Payment Method */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                Revenue by Payment Method
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.byMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => (
                    <div
                      key={method}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-semibold text-gray-700 uppercase">
                        {method}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* By Procedure */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                Revenue by Procedure
              </h3>
              <div className="space-y-3">
                {Object.entries(stats.byProcedure)
                  .sort(([, a], [, b]) => b - a)
                  .map(([procedure, amount]) => (
                    <div
                      key={procedure}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-semibold text-gray-700 capitalize">
                        {procedure}
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  linear,
  count,
  iconBg,
  iconColor,
}) {
  return (
    <div
      className={`bg-linear-to-br ${linear} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-white/90 text-sm font-medium mb-1">{title}</p>
            <h3 className="text-3xl font-bold">{value}</h3>
          </div>
          <div className={`${iconBg} p-3 rounded-xl`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
        <p className="text-white/80 text-sm font-medium">{count}</p>
      </div>
    </div>
  );
}

// Data Table Component
function DataTable({ rows, getPatientName, onSort, sortConfig, pagination }) {
  const columns = [
    { key: "patient", label: "Patient", sortable: true },
    { key: "procedure", label: "Procedure", sortable: true },
    { key: "paymentType", label: "Payment Type", sortable: true },
    { key: "method", label: "Method", sortable: true },
    { key: "amount", label: "Amount", sortable: true },
    { key: "date", label: "Date", sortable: true },
    { key: "branch", label: "Branch", sortable: true },
    { key: "remarks", label: "Remarks", sortable: false },
  ];

  const getProcedureColor = (proc) => {
    const colors = {
      "hair transplant": "bg-indigo-100 text-indigo-700 border-indigo-200",
      prp: "bg-emerald-100 text-emerald-700 border-emerald-200",
      "beard transplant": "bg-purple-100 text-purple-700 border-purple-200",
      medicine: "bg-amber-100 text-amber-700 border-amber-200",
      gfc: "bg-pink-100 text-pink-700 border-pink-200",
    };
    return (
      colors[proc?.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  const getMethodColor = (method) => {
    const colors = {
      cash: "bg-emerald-100 text-emerald-700 border-emerald-200",
      upi: "bg-blue-100 text-blue-700 border-blue-200",
      banking: "bg-purple-100 text-purple-700 border-purple-200",
      loan: "bg-orange-100 text-orange-700 border-orange-200",
    };
    return (
      colors[method?.toLowerCase()] ||
      "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  const getPaymentTypeColor = (type) => {
    const colors = {
      booking: "bg-blue-100 text-blue-700 border-blue-200",
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      "full-payment": "bg-green-100 text-green-700 border-green-200",
      other: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return (
      colors[type?.toLowerCase()] ||
      "bg-gray-100 text-gray-700 border-gray-200"
    );
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <ArrowUpDown className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortConfig.direction === "asc" ? (
      <ChevronLeft className="w-4 h-4 rotate-90 text-indigo-600" />
    ) : (
      <ChevronRight className="w-4 h-4 rotate-90 text-indigo-600" />
    );
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-linear-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider ${
                    col.sortable
                      ? "cursor-pointer hover:bg-gray-100 transition-colors group"
                      : ""
                  }`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
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
                  className="text-center py-16 text-gray-500"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-lg mb-1">
                        No transactions found
                      </p>
                      <p className="text-sm text-gray-500">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr
                  key={row._id || i}
                  className="hover:bg-indigo-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {getPatientName(row.patient)}
                        </p>
                        {row.patient?.personal?.phone && (
                          <p className="text-xs text-gray-500">
                            {row.patient.personal.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${getProcedureColor(
                        row.procedure
                      )}`}
                    >
                      {row.procedure}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPaymentTypeColor(
                        row.paymentType
                      )}`}
                    >
                      {row.paymentType || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${getMethodColor(
                        row.method
                      )}`}
                    >
                      {row.method?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600 text-base">
                    {formatCurrency(row.amount)}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                      {row.branch}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                    {row.remarks || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-5 border-t border-gray-200 bg-linear-to-b from-white to-gray-50">
        <p className="text-sm text-gray-600 font-medium">
          Showing{" "}
          <span className="font-bold text-gray-900">
            {pagination.startIdx + 1}
          </span>
          –<span className="font-bold text-gray-900">{pagination.endIdx}</span>{" "}
          of{" "}
          <span className="font-bold text-gray-900">
            {pagination.total.toLocaleString()}
          </span>{" "}
          transactions
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 font-medium">
              Rows per page:
            </span>
            <select
              className="text-sm border-2 border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white font-medium transition-all"
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-2.5 rounded-xl border-2 border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 min-w-24 text-center font-medium">
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
              className="p-2.5 rounded-xl border-2 border-gray-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  icon: Icon,
  placeholder,
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all ${
            Icon ? "pl-11 pr-4" : "px-4"
          } py-3`}
        />
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options, icon: Icon }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">
        {label}
      </span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white transition-all appearance-none ${
            Icon ? "pl-11 pr-10" : "px-4 pr-10"
          } py-3`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronLeft className="absolute right-3 top-1/2 transform -translate-y-1/2 -rotate-90 text-gray-400 w-5 h-5 pointer-events-none" />
      </div>
    </label>
  );
}