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
  Download,
  Upload,
  Eye,
  ArrowUpDown,
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
const COST_TYPES = ["Revenue", "Expenses"];
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
  }).format(amount);
};

export default function AmountDashboard() {
  const [revenue, setRevenue] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filters, setFilters] = useState({
    branch: "",
    dateFrom: "",
    dateTo: "",
    paymentMethod: "",
    procedure: "",
  });
  const [activeTab, setActiveTab] = useState("revenue");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

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
      toast.error("Failed to fetch patients:");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchPatients();
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
    if (filters.dateFrom)
      list = list.filter((t) => new Date(t.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.date) <= to);
    }
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
    if (filters.dateFrom)
      list = list.filter((e) => new Date(e.date) >= new Date(filters.dateFrom));
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((e) => new Date(e.date) <= to);
    }
    return list;
  }, [expenses, filters]);

  const searchedRows = useMemo(() => {
    const rows = activeTab === "revenue" ? filteredRevenue : filteredExpenses;
    if (!tableSearch) return rows;

    return rows.filter((row) => {
      const searchLower = tableSearch.toLowerCase();
      if (activeTab === "revenue") {
        const patientName = row.patient?.personal?.name || "Walk-in Customer";
        return (
          patientName.toLowerCase().includes(searchLower) ||
          row.procedure?.toLowerCase().includes(searchLower) ||
          row.method?.toLowerCase().includes(searchLower) ||
          row.branch?.toLowerCase().includes(searchLower) ||
          row.remarks?.toLowerCase().includes(searchLower) ||
          row.amount.toString().includes(searchLower)
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
  }, [activeTab, filteredRevenue, filteredExpenses, tableSearch]);

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

  // Totals
  const totalIncome = filteredRevenue.reduce(
    (sum, t) => sum + (t.amount || 0),
    0
  );
  const totalExpense = filteredExpenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  );
  const netBalance = totalIncome - totalExpense;
  const totalTransactions = filteredRevenue.length;
  const totalExpenseItems = filteredExpenses.length;

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
    closeModal();
  };

  const openDeleteConfirm = (transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;

    try {
      const res = await fetch("/api/admin/transaction/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: deletingTransaction._id }),
      });

      const data = await res.json();

      if (data.success) {
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingTransaction(null);
      } else {
        toast.error(data.message || "Failed to delete transaction");
      }
    } catch (err) {
      toast.error("An error occurred while deleting");
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-16 w-16 text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading financial data...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <ReceptionSidebar />
      <main className="flex-1 p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Financial Dashboard
              </h1>
              <p className="text-gray-600">
                Track revenue, expenses and transactions
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 text-gray-600 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button
                onClick={openCreateModal}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <Plus size={20} strokeWidth={2.5} />
                <span className="font-semibold">Add Transaction</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
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
            title="Total Transactions"
            value={(totalTransactions + totalExpenseItems).toLocaleString()}
            icon={CreditCard}
            gradient="from-amber-400 to-orange-500"
            count="All time"
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          {/* Tabs & Controls */}
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-6 py-4">
              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
                    activeTab === "revenue"
                      ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("revenue")}
                >
                  Revenue ({totalTransactions})
                </button>
                <button
                  className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
                    activeTab === "expenses"
                      ? "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setActiveTab("expenses")}
                >
                  Expenses ({totalExpenseItems})
                </button>
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
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="px-6 pb-5 border-t border-gray-100 pt-5 bg-gradient-to-b from-gray-50 to-white">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              </div>
            )}
          </div>

          {/* Table */}
          <DataTable
            type={activeTab}
            rows={paginatedRows}
            getPatientName={getPatientName}
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

// Delete Confirmation Modal
function DeleteConfirmModal({ transaction, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
        <div className="p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Delete Transaction?
          </h2>
          <p className="text-gray-600 text-center mb-6">
            Are you sure you want to delete this transaction? This action cannot
            be undone.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="font-bold text-gray-900">
                {formatCurrency(transaction?.amount || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Date:</span>
              <span className="font-medium text-gray-900">
                {formatDate(transaction?.date)}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
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

// Transaction Modal Component - UPDATED WITH FIXES
function TransactionModal({ transaction, patients, onClose, onSuccess }) {
  const isEdit = !!transaction;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchPatient, setSearchPatient] = useState("");
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [formData, setFormData] = useState({
    _id: transaction?._id || "",
    costType: transaction?.costType || "Revenue",
    method: transaction?.method || "cash",
    procedure: transaction?.procedure || "hair transplant",
    paymentType: transaction?.paymentType || "Booking",
    branch: transaction?.branch || "Delhi",
    amount: transaction?.amount || "",
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
        procedure: transaction.procedure || "hair transplant",
        paymentType: transaction.paymentType || "Booking",
        branch: transaction.branch || "Delhi",
        amount: transaction.amount || "",
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

  const selectedPatient = patients.find((p) => p._id === formData.patient);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.costType === "Revenue" && !formData.patient) {
      setError("Patient is required for revenue transactions");
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setError("Please enter a valid amount");
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
        ? "/api/admin/transaction/update"
        : "/api/transactions/create";
      const method = isEdit ? "PUT" : "POST";

      // Prepare payload - set patient to null for expenses
      const payload = {
        ...formData,
        // For expenses, explicitly set patient to null instead of empty string
        patient: formData.costType === "Expenses" ? null : formData.patient,
      };

      if (!isEdit) {
        delete payload._id; // Remove _id for new transactions
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        onSuccess();
        // You need to import toast or use the toast hook
        // toast.success("Data Updated Successfully");
      } else {
        setError(data.message || "Failed to save transaction");
      }
    } catch (err) {
      setError("An error occurred while saving");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-5 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-2xl font-bold text-white">
            {isEdit ? "Edit Transaction" : "Add New Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            type="button"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Debug info - remove in production */}
          {isEdit && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <strong>Debug:</strong> Transaction ID:{" "}
              {formData._id || "NOT FOUND"}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Type Selection */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Transaction Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {COST_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        costType: type,
                        patient: type === "Expenses" ? "" : formData.patient,
                      })
                    }
                    className={`p-4 rounded-xl border-2 transition-all font-semibold ${
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
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search patient by name or phone..."
                      value={searchPatient}
                      onChange={(e) => {
                        setSearchPatient(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                    />
                  </div>

                  {selectedPatient && !showPatientDropdown && (
                    <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {selectedPatient.personal?.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          Total -: {selectedPatient.payments?.totalAmount}{" "}
                          &nbsp; || &nbsp; Received -:{" "}
                          {selectedPatient.payments?.amountReceived} &nbsp; ||
                          &nbsp; Pending -:{" "}
                          {selectedPatient.payments?.pendingAmount} &nbsp; ||
                          &nbsp; &nbsp; Medicine -:{" "}
                          {selectedPatient.payments?.medicineAmount} &nbsp; ||
                          &nbsp;
                        </p>
                      </div>
                      <CheckCircle2 className="text-emerald-600" size={24} />
                    </div>
                  )}

                  {showPatientDropdown && (
                    <div className="max-h-60 overflow-y-auto border-2 border-gray-200 rounded-xl bg-white shadow-lg">
                      {filteredPatients.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
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
                            className={`w-full p-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0 ${
                              formData.patient === patient._id
                                ? "bg-indigo-50"
                                : ""
                            }`}
                          >
                            <p className="font-medium text-gray-900">
                              {patient.personal?.name} -{" "}
                              {patient.personal?.phone}
                            </p>
                            <p className="text-sm text-gray-600">
                              Total -: {patient.payments?.totalAmount} &nbsp; ||
                              &nbsp; Received -:{" "}
                              {patient.payments?.amountReceived} &nbsp; ||
                              &nbsp; Pending -:{" "}
                              {patient.payments?.pendingAmount} &nbsp; || &nbsp;
                              &nbsp; Medicine -:{" "}
                              {patient.payments?.medicineAmount} &nbsp; ||
                              &nbsp;
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
            />

            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(val) => setFormData({ ...formData, date: val })}
              required
              icon={Calendar}
              max={new Date().toISOString().split("T")[0]}
            />

            <div className="md:col-span-2">
              <Input
                label="Remarks"
                value={formData.remarks}
                onChange={(val) => setFormData({ ...formData, remarks: val })}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
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

// Stat Card Component
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
      className={`bg-gradient-to-br ${gradient} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}
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
function DataTable({
  type,
  rows,
  getPatientName,
  onEdit,
  onDelete,
  onSort,
  sortConfig,
  pagination,
}) {
  const columns =
    type === "revenue"
      ? [
          { key: "patient", label: "Patient", sortable: true },
          { key: "procedure", label: "Procedure", sortable: true },
          { key: "method", label: "Method", sortable: true },
          { key: "amount", label: "Amount", sortable: true },
          { key: "date", label: "Date", sortable: true },
          { key: "branch", label: "Branch", sortable: true },
          { key: "remarks", label: "Remarks", sortable: false },
          { key: "actions", label: "Actions", sortable: false },
        ]
      : [
          { key: "expense", label: "Expense", sortable: true },
          { key: "category", label: "Category", sortable: false }, // ← Changed from "expense" to "category"
          { key: "method", label: "Method", sortable: true },
          { key: "amount", label: "Amount", sortable: true },
          { key: "date", label: "Date", sortable: true },
          { key: "branch", label: "Branch", sortable: true },
          { key: "remarks", label: "Remarks", sortable: false },
          { key: "actions", label: "Actions", sortable: false },
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
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
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
                        No records found
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
                  {type === "revenue" ? (
                    <>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="font-medium text-gray-900">
                            {getPatientName(row.patient)}
                          </span>
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEdit(row)}
                            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600"
                            title="Edit transaction"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => onDelete(row)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                            title="Delete transaction"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {row.expense}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          {row.expense}
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
                      <td className="px-6 py-4 text-right font-bold text-rose-600 text-base">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onEdit(row)}
                            className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600"
                            title="Edit transaction"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => onDelete(row)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                            title="Delete transaction"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-5 border-t border-gray-200 bg-gradient-to-b from-white to-gray-50">
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
          records
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
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all ${
            Icon ? "pl-11 pr-4" : "px-4"
          } py-3`}
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
          <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
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
        <ChevronLeft className="absolute right-3 top-1/2 transform -translate-y-1/2 rotate-[-90deg] text-gray-400 w-5 h-5 pointer-events-none" />
      </div>
    </label>
  );
}
