"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import AdminSidebar from "@/components/Sidebars/Sidebar";
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
  IndianRupee,
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
  ChevronDown,
  ChevronUp,
  Hash,
  Clock,
  Mail,
  FileText,
  ArrowRight,
  MapPin,
  History,
  UserCheck,
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
  return now.toISOString().split('T')[0];
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
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
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
const PAYMENT_METHODS = ["upi", "cash", "card", "banking", "loan", "other"];
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
  linear,
  count,
  iconBg,
  iconColor,
}) {
  return (
    <div
      className={`bg-linear-to-br ${linear} p-4 sm:p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}
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
            {transaction?.paymentId && (
              <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                <span className="text-sm text-gray-600">TransID / CardNo:</span>
                <span className="font-bold text-gray-900 text-sm sm:text-base">
                  {transaction.paymentId}
                </span>
              </div>
            )}
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
    paymentId: transaction?.paymentId || "",
    branch: transaction?.branch || "Delhi",
    amount: transaction?.amount?.toString() || "",
    discount: transaction?.discount?.toString() || "0",
    date: transaction?.date
      ? new Date(transaction.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    expense: transaction?.expense || "",
    remarks: transaction?.remarks || "",
    patient: transaction?.patient?._id || "",
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        _id: transaction._id,
        costType: transaction.costType || "Revenue",
        method: transaction.method || "cash",
        procedure: transaction.procedure || "Sapphire FUE",
        paymentType: transaction.paymentType || "Booking",
        paymentId: transaction.paymentId || "",
        branch: transaction.branch || "Delhi",
        amount: transaction.amount?.toString() || "",
        discount: transaction.discount?.toString() || "0",
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

  const selectedPatient = useMemo(() => {
    return patients.find((p) => p._id === formData.patient);
  }, [patients, formData.patient]);

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

      const payload = {
        ...formData,
        patient: formData.costType === "Expenses" ? null : formData.patient,
        discount:
          formData.costType === "Revenue" ? formData.discount || "0" : "0",
        amount: formData.amount,
        paymentId: formData.paymentId || undefined,
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
        toast.success(isEdit ? "Transaction updated successfully" : "Transaction created successfully");
      } else {
        setError(data.message || "Failed to save transaction");
        toast.error(data.message || "Failed to save transaction");
      }
    } catch (err) {
      setError("An error occurred while saving");
      toast.error("An error occurred while saving");
      console.error("Transaction save error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-3xl w-full my-4 max-h-[90vh] overflow-y-auto">
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
              icon={IndianRupee}
              placeholder="0"
              min="1"
              step="0.01"
            />

            <Input
              label="TransID / CardNo"
              value={formData.paymentId}
              onChange={(val) => setFormData({ ...formData, paymentId: val })}
              icon={Hash}
              placeholder="Enter transaction reference ID"
            />

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

// ========== EXPANDED ROW DETAILS COMPONENT ==========
function ExpandedRowDetails({ transaction, isExpanded }) {
  const [activeTab, setActiveTab] = useState("summary");

  if (!isExpanded) return null;

  return (
    <div className="bg-linear-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 border-t-2 border-indigo-200 animate-in slide-in-from-top duration-300">
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-linear-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Complete Audit Trail</h3>
              <p className="text-sm text-slate-600">Full transaction history and changes</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 sm:gap-4 bg-white rounded-xl px-4 py-3 shadow-md border border-slate-200 w-full sm:w-auto">
            <div className="text-center flex-1 sm:flex-initial">
              <div className="text-2xl font-bold text-indigo-700">
                {transaction.totalEdits || 0}
              </div>
              <div className="text-xs text-slate-600 font-medium">Total Edits</div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-center flex-1 sm:flex-initial">
              <div className="text-2xl font-bold text-emerald-700">1</div>
              <div className="text-xs text-slate-600 font-medium">Creator</div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <div className="text-center flex-1 sm:flex-initial">
              <div className="text-2xl font-bold text-purple-700">
                {new Set(transaction.editors?.map((e) => e.email) || []).size || 0}
              </div>
              <div className="text-xs text-slate-600 font-medium">Editors</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
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

        {/* Content */}
        <div className="space-y-4">
          {activeTab === "summary" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Creator Card */}
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-linear-to-br from-emerald-400 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                    <UserCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Created By</h4>
                    <p className="text-xs text-slate-600">Original entry creator</p>
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
                        <span>{formatDateTime(transaction.createdBy.date)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No creator information available</p>
                )}
              </div>

              {/* Last Editor Card */}
              {transaction.lastEditedBy && (
                <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-linear-to-br from-indigo-400 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                      <Edit2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Last Edited By</h4>
                      <p className="text-xs text-slate-600">Most recent modification</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-base font-bold text-slate-900">
                      {transaction.lastEditedBy.name}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="text-slate-700 truncate text-xs">
                          {transaction.lastEditedBy.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-purple-600" />
                        </div>
                        <span className="text-slate-900 font-semibold text-xs">
                          {transaction.lastEditedBy.branch}
                        </span>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>{formatDateTime(transaction.lastEditedBy.date)}</span>
                      </div>
                    </div>

                    {/* Modified Fields */}
                    {transaction.lastEditedBy.updatedFields?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-600" />
                          Modified Fields ({transaction.lastEditedBy.updatedFields.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {transaction.lastEditedBy.updatedFields.map((field, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-linear-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 shadow-sm"
                            >
                              {formatFieldName(field.name)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
                      {/* Editor Header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-linear-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                            <span className="text-white font-bold text-lg">
                              {editor.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-900">{editor.name}</p>
                            <p className="text-xs text-slate-600">{editor.email}</p>
                          </div>
                        </div>
                        <span className="px-3 py-1.5 bg-linear-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-md">
                          Edit #{transaction.editors.length - idx}
                        </span>
                      </div>

                      {/* Editor Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="text-slate-700 font-medium">{editor.branch}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Clock className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="text-slate-600">{formatDateTime(editor.date)}</span>
                        </div>
                      </div>

                      {/* Changed Fields */}
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
                                      {field.previousValue || '(Empty)'}
                                    </p>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 border-2 border-green-200">
                                    <span className="text-xs text-green-700 font-bold block mb-1">
                                      New Value:
                                    </span>
                                    <p className="text-sm text-slate-900 font-medium wrap-break-words">
                                      {field.newValue || '(Empty)'}
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
                  <p className="text-base font-semibold text-slate-700 mb-1">No Edit History</p>
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
  const [expandedRow, setExpandedRow] = useState(null);

  const columns =
    type === "revenue"
      ? [
          { key: "date", label: "Date", sortable: true, width: "110px" },
          { key: "patient", label: "Patient", sortable: true, width: "160px" },
          { key: "procedure", label: "Procedure", sortable: true, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          { key: "totalPackage", label: "Total", sortable: false, width: "120px" },
          { key: "amount", label: "Amount", sortable: true, width: "130px" },
          { key: "paymentId", label: "Trans ID", sortable: true, width: "150px" },
          { key: "pending", label: "Pending", sortable: false, width: "110px" },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "creator", label: "Audit", sortable: false, width: "120px" },
          { key: "remarks", label: "Remarks", sortable: false, width: "180px" },
          { key: "actions", label: "Actions", sortable: false, width: "90px" },
        ]
      : [
          { key: "date", label: "Date", sortable: true, width: "110px" },
          { key: "expense", label: "Expense", sortable: true, width: "160px" },
          { key: "category", label: "Category", sortable: false, width: "130px" },
          { key: "method", label: "Method", sortable: true, width: "110px" },
          { key: "amount", label: "Amount", sortable: true, width: "130px" },
          { key: "paymentId", label: "Trans ID", sortable: true, width: "150px" },
          { key: "branch", label: "Branch", sortable: true, width: "110px" },
          { key: "creator", label: "Audit", sortable: false, width: "120px" },
          { key: "remarks", label: "Remarks", sortable: false, width: "180px" },
          { key: "actions", label: "Actions", sortable: false, width: "90px" },
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

  const toggleExpanded = (rowId) => {
    setExpandedRow(expandedRow === rowId ? null : rowId);
  };

  const gridTemplateColumns = columns.map(col => col.width).join(' ');

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Desktop Table Header */}
      <div 
        className="hidden md:grid items-center bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 min-h-[52px] px-2"
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

      {/* Mobile Header */}
      <div className="md:hidden bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {type === "revenue" ? "Revenue Records" : "Expense Records"}
            </h3>
            <p className="text-xs text-slate-600">
              Showing {rows.length} of {pagination.total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-700">Sorted by</p>
            <p className="text-sm font-bold text-indigo-700">
              {sortConfig.key.replace(/([A-Z])/g, ' $1').trim()}
            </p>
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No records found</h3>
            <p className="text-sm text-slate-600 text-center max-w-md">
              Try adjusting your search filters or add a new {type === "revenue" ? "revenue" : "expense"} record
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const netAmount = calculateNetAmount(row);
              const hasDiscount = parseFloat(row.discount || 0) > 0;
              const pendingAmount = row.patient?.payments?.pendingAmount || 0;
              const totalPackage = row.patient?.payments?.totalAmount || 0;
              const phoneNumber = getPatientNumber(row.patient);
              const isExpanded = expandedRow === row._id;

              return (
                <div key={row._id || i}>
                  {/* Main Row */}
                  <div className={`group transition-all duration-200 ${
                    isExpanded ? 'bg-indigo-50/50' : 'hover:bg-indigo-50/30'
                  }`}>
                    {/* Desktop View - Grid Layout */}
                    <div 
                      className="hidden md:grid items-center min-h-[64px] px-2"
                      style={{ gridTemplateColumns }}
                    >
                      {type === "revenue" ? (
                        <>
                          <div className="px-2 py-3">
                            <div className="text-sm font-medium text-slate-900">
                              {formatDateForDisplay(row.date)}
                            </div>
                          </div>

                          <div className="px-2 py-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {getPatientName(row.patient)}
                              </div>
                              <div className="text-xs text-slate-600 font-medium">
                                {phoneNumber || "No phone"}
                              </div>
                            </div>
                          </div>

                          <div className="px-2 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getProcedureColor(row.procedure)}`}>
                              {row.procedure}
                            </span>
                          </div>

                          <div className="px-2 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>
                              {row.method?.toUpperCase()}
                            </span>
                          </div>

                          <div className="px-2 py-3 text-center">
                            <div className="text-sm font-bold text-indigo-700">
                              {formatCurrency(totalPackage)}
                            </div>
                          </div>

                          <div className="px-2 py-3">
                            <div className="text-center">
                              <div className={`text-sm font-bold ${hasDiscount ? 'text-emerald-700' : 'text-emerald-600'}`}>
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
                            {row.paymentId ? (
                              <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">
                                {row.paymentId}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </div>

                          <div className="px-2 py-3 text-center">
                            <span className={`text-sm font-semibold ${pendingAmount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                              {formatCurrency(pendingAmount)}
                            </span>
                          </div>

                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              {row.branch}
                            </span>
                          </div>

                          <div className="px-2 py-3">
                            <button
                              onClick={() => toggleExpanded(row._id)}
                              className={`group/btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 border-2 ${
                                isExpanded
                                  ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md'
                                  : 'bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700'
                              }`}
                            >
                              {row.totalEdits > 0 ? (
                                <>
                                  <div className="relative">
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span className={`absolute -top-1 -right-1 w-3 h-3 text-[8px] font-bold rounded-full flex items-center justify-center ${
                                      isExpanded ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                    }`}>
                                      {row.totalEdits}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold">
                                    {row.lastEditedBy?.name?.split(" ")[0] || "Edited"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span className="text-xs font-semibold">
                                    {row.createdBy?.name?.split(" ")[0] || "Created"}
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

                          <div className="px-2 py-3">
                            <p className="text-sm text-slate-600 truncate">
                              {row.remarks || <span className="text-slate-400">No remarks</span>}
                            </p>
                          </div>

                          <div className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onEdit(row)}
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
                        </>
                      ) : (
                        <>
                          <div className="px-2 py-3">
                            <div className="text-sm font-medium text-slate-900">
                              {formatDateForDisplay(row.date)}
                            </div>
                          </div>

                          <div className="px-2 py-3">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {row.expense}
                            </div>
                          </div>

                          <div className="px-2 py-3">
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              {row.expense}
                            </span>
                          </div>

                          <div className="px-2 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>
                              {row.method?.toUpperCase()}
                            </span>
                          </div>

                          <div className="px-2 py-3 text-right">
                            <div className="text-sm font-bold text-rose-600">
                              {formatCurrency(row.amount)}
                            </div>
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
                            <span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                              {row.branch}
                            </span>
                          </div>

                          <div className="px-2 py-3">
                            <button
                              onClick={() => toggleExpanded(row._id)}
                              className={`group/btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 border-2 ${
                                isExpanded
                                  ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md'
                                  : 'bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700'
                              }`}
                            >
                              {row.totalEdits > 0 ? (
                                <>
                                  <div className="relative">
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span className={`absolute -top-1 -right-1 w-3 h-3 text-[8px] font-bold rounded-full flex items-center justify-center ${
                                      isExpanded ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                    }`}>
                                      {row.totalEdits}
                                    </span>
                                  </div>
                                  <span className="text-xs font-semibold">
                                    {row.lastEditedBy?.name?.split(" ")[0] || "Edited"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span className="text-xs font-semibold">
                                    {row.createdBy?.name?.split(" ")[0] || "Created"}
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

                          <div className="px-2 py-3">
                            <p className="text-sm text-slate-600 truncate">
                              {row.remarks || <span className="text-slate-400">No remarks</span>}
                            </p>
                          </div>

                          <div className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onEdit(row)}
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
                        </>
                      )}
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden p-4">
                      <div className="space-y-4">
                        {/* Header Row */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${type === 'revenue' ? getProcedureColor(row.procedure) : 'bg-amber-100 text-amber-700'}`}>
                                {type === 'revenue' ? row.procedure : row.expense}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getMethodColor(row.method)}`}>
                                {row.method?.toUpperCase()}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-slate-900">
                              {type === 'revenue' ? getPatientName(row.patient) : row.expense}
                            </h4>
                            {type === 'revenue' && (
                              <p className="text-sm text-slate-600 font-medium">{phoneNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${type === 'revenue' ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {formatCurrency(type === 'revenue' ? netAmount : row.amount)}
                            </div>
                            <p className="text-xs text-slate-500">{formatDateForDisplay(row.date)}</p>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          {type === 'revenue' && (
                            <>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Total Package</p>
                                <p className="text-sm font-semibold text-indigo-700">
                                  {formatCurrency(totalPackage)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-1">Pending</p>
                                <p className={`text-sm font-semibold ${pendingAmount > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                                  {formatCurrency(pendingAmount)}
                                </p>
                              </div>
                            </>
                          )}
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Branch</p>
                            <p className="text-sm font-semibold text-blue-700">{row.branch}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Transaction ID</p>
                            <p className="text-sm font-mono text-slate-700 truncate">
                              {row.paymentId || '-'}
                            </p>
                          </div>
                        </div>

                        {/* Remarks */}
                        {row.remarks && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Remarks</p>
                            <p className="text-sm text-slate-700">{row.remarks}</p>
                          </div>
                        )}

                        {/* Footer Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <button
                            onClick={() => toggleExpanded(row._id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              isExpanded
                                ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            {row.totalEdits > 0 ? (
                              <>
                                <Edit2 size={14} />
                                <span>History ({row.totalEdits})</span>
                              </>
                            ) : (
                              <>
                                <UserCheck size={14} />
                                <span>Audit Trail</span>
                              </>
                            )}
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onEdit(row)}
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

                  {/* Expanded Row Details */}
                  <ExpandedRowDetails transaction={row} isExpanded={isExpanded} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enhanced Pagination */}
      <div className="border-t border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{pagination.startIdx + 1}-{pagination.endIdx}</span>
            <span className="mx-2">of</span>
            <span className="font-medium text-slate-900">{pagination.total.toLocaleString()}</span>
            <span className="ml-2">records</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Rows per page */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 hidden sm:inline">Show</span>
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
              <span className="text-sm text-slate-600 hidden sm:inline">per page</span>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => pagination.setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-400 transition-all disabled:hover:bg-white disabled:hover:border-slate-300"
                aria-label="Previous page"
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
                    if (currentPage > 3) pages.push('...');
                  }
                  
                  for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) {
                    pages.push(i);
                  }
                  
                  if (currentPage < totalPages - 1) {
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  
                  return pages.map((page, idx) => (
                    page === '...' ? (
                      <span key={idx} className="px-2 text-slate-400">...</span>
                    ) : (
                      <button
                        key={idx}
                        onClick={() => pagination.setPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === currentPage
                            ? 'bg-indigo-600 text-white border border-indigo-600'
                            : 'text-slate-700 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  ));
                })()}
              </div>

              <button
                onClick={() => pagination.setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages}
                className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-400 transition-all disabled:hover:bg-white disabled:hover:border-slate-300"
                aria-label="Next page"
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
export default function AmountDashboard() {
  const [revenue, setRevenue] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [patients, setPatients] = useState([]);

  const [filters, setFilters] = useState({
    branch: "",
    dateFrom: getTodayDate(),
    dateTo: getTodayDate(),
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

  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const toast = useToast();

  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

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
        setAllRevenue(data.data.Revenue || []);
        setAllExpenses(data.data.Expenses || []);
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
      const res = await fetch("/api/patients/get-patient");
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

  const totalIncome = useMemo(() => {
    return filteredRevenue.reduce((sum, t) => sum + calculateNetAmount(t), 0);
  }, [filteredRevenue]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, e) => sum + (parseFloat(e.amount) || 0),
      0
    );
  }, [filteredExpenses]);

  const totalDiscount = useMemo(() => {
    return filteredRevenue.reduce(
      (sum, t) => sum + (parseFloat(t.discount) || 0),
      0
    );
  }, [filteredRevenue]);

  const netBalance = totalIncome - totalExpense;
  const totalTransactions = filteredRevenue.length;
  const totalExpenseItems = filteredExpenses.length;

  const searchedRows = useMemo(() => {
    const rowsToSearch = tableSearch
      ? activeTab === "revenue"
        ? allRevenue
        : allExpenses
      : activeTab === "revenue"
      ? filteredRevenue
      : filteredExpenses;

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
          row.paymentId?.toLowerCase().includes(searchLower) ||
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
          row.paymentId?.toLowerCase().includes(searchLower) ||
          row.amount.toString().includes(searchLower)
        );
      }
    });
  }, [
    activeTab,
    filteredRevenue,
    filteredExpenses,
    allRevenue,
    allExpenses,
    tableSearch,
  ]);

  const sortedRows = useMemo(() => {
    const sorted = [...searchedRows];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "patient" && activeTab === "revenue") {
          aVal = a.patient?.personal?.name || "Walk-in Customer";
          bVal = b.patient?.personal?.name || "Walk-in Customer";
        }

        if (sortConfig.key === "amount" && activeTab === "revenue") {
          aVal = calculateNetAmount(a);
          bVal = calculateNetAmount(b);
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
  }, [searchedRows, sortConfig, activeTab]);

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

  const downloadExcel = async () => {
    try {
      setDownloading(true);

      const { utils, writeFile } = await import("xlsx");

      // Main transaction data
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
            "TransID / CardNo": row.paymentId || "",
            Discount: hasDiscount ? parseFloat(row.discount) || 0 : 0,
            "Net Amount": netAmount,
            "Pending Amount": patientData?.payments?.pendingAmount || 0,
            "Total Package": patientData?.payments?.totalAmount || 0,
            "Amount Received": patientData?.payments?.amountReceived || 0,
            Remarks: row.remarks || "",
            "Created By": row.createdBy?.name || "N/A",
            "Created By Email": row.createdBy?.email || "N/A",
            "Created By Branch": row.createdBy?.branch || "N/A",
            "Created At": formatDateTime(row.createdBy?.date),
            "Last Edited By": row.lastEditedBy?.name || "N/A",
            "Last Edited By Email": row.lastEditedBy?.email || "N/A",
            "Last Edited By Branch": row.lastEditedBy?.branch || "N/A",
            "Last Edited At": formatDateTime(row.lastEditedBy?.date),
            "Total Edits": row.totalEdits || 0,
          };
        } else {
          return {
            Date: formatDateForDisplay(row.date),
            Branch: row.branch || "",
            "Expense Type": row.expense || "",
            "Payment Method": row.method?.toUpperCase() || "",
            Amount: parseFloat(row.amount) || 0,
            "TransID / CardNo": row.paymentId || "",
            "Given To": row.expenseGiver || "",
            Remarks: row.remarks || "",
            "Created By": row.createdBy?.name || "N/A",
            "Created By Email": row.createdBy?.email || "N/A",
            "Created By Branch": row.createdBy?.branch || "N/A",
            "Created At": formatDateTime(row.createdBy?.date),
            "Last Edited By": row.lastEditedBy?.name || "N/A",
            "Last Edited By Email": row.lastEditedBy?.email || "N/A",
            "Last Edited By Branch": row.lastEditedBy?.branch || "N/A",
            "Last Edited At": formatDateTime(row.lastEditedBy?.date),
            "Total Edits": row.totalEdits || 0,
          };
        }
      });

      // Detailed edit history data
      const editHistoryData = [];
      sortedRows.forEach((row) => {
        if (row.editors && row.editors.length > 0) {
          row.editors.forEach((editor, editIndex) => {
            const baseInfo = {
              "Transaction Date": formatDateForDisplay(row.date),
              "Transaction ID": row.paymentId || "N/A",
            };

            if (activeTab === "revenue") {
              baseInfo["Patient Name"] = row.patient?.personal?.name || "Walk-in Customer";
              baseInfo["Patient Phone"] = row.patient?.personal?.phone || "N/A";
              baseInfo["Procedure"] = row.procedure || "";
            } else {
              baseInfo["Expense Type"] = row.expense || "";
            }

            baseInfo["Edit Number"] = `Edit #${editIndex + 1} of ${row.editors.length}`;
            baseInfo["Editor Name"] = editor.name || "N/A";
            baseInfo["Editor Email"] = editor.email || "N/A";
            baseInfo["Editor Branch"] = editor.branch || "N/A";
            baseInfo["Edit Date/Time"] = formatDateTime(editor.date);

            // If there are field changes, create a row for each changed field
            if (editor.updatedFields && editor.updatedFields.length > 0) {
              editor.updatedFields.forEach((field) => {
                editHistoryData.push({
                  ...baseInfo,
                  "Field Changed": formatFieldName(field.name),
                  "Previous Value": field.previousValue || "(Empty)",
                  "New Value": field.newValue || "(Empty)",
                });
              });
            } else {
              // If no specific fields recorded, just add the edit record
              editHistoryData.push({
                ...baseInfo,
                "Field Changed": "No field details available",
                "Previous Value": "-",
                "New Value": "-",
              });
            }
          });
        }
      });

      // Create workbook
      const wb = utils.book_new();

      // Add main transactions sheet
      const ws = utils.json_to_sheet(dataToExport);
      const maxWidth = 30;
      const colWidths = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(Math.max(key.length, 10), maxWidth),
      }));
      ws["!cols"] = colWidths;
      utils.book_append_sheet(
        wb,
        ws,
        activeTab === "revenue" ? "Revenue" : "Expenses"
      );

      // Add detailed edit history sheet if there are edits
      if (editHistoryData.length > 0) {
        const wsHistory = utils.json_to_sheet(editHistoryData);
        const historyColWidths = Object.keys(editHistoryData[0] || {}).map((key) => ({
          wch: Math.min(Math.max(key.length, 15), maxWidth),
        }));
        wsHistory["!cols"] = historyColWidths;
        utils.book_append_sheet(wb, wsHistory, "Edit History");
      }

      // Add summary sheet
      const summaryData = [
        { "Report Details": "Report Type", "Value": activeTab === "revenue" ? "Revenue Transactions" : "Expense Transactions" },
        { "Report Details": "Generated On", "Value": formatDateTime(new Date()) },
        { "Report Details": "Total Records", "Value": sortedRows.length },
        { "Report Details": "Records with Edits", "Value": sortedRows.filter(r => r.totalEdits > 0).length },
        { "Report Details": "Total Edit Actions", "Value": sortedRows.reduce((sum, r) => sum + (r.totalEdits || 0), 0) },
        { "Report Details": "", "Value": "" },
        { "Report Details": "Applied Filters:", "Value": "" },
        { "Report Details": "Branch", "Value": filters.branch || "All Branches" },
        { "Report Details": "Date From", "Value": filters.dateFrom || "No limit" },
        { "Report Details": "Date To", "Value": filters.dateTo || "No limit" },
        { "Report Details": "Payment Method", "Value": filters.paymentMethod || "All Methods" },
      ];

      if (activeTab === "revenue") {
        summaryData.push({ "Report Details": "Procedure", "Value": filters.procedure || "All Procedures" });
      }

      const wsSummary = utils.json_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 25 }, { wch: 40 }];
      utils.book_append_sheet(wb, wsSummary, "Report Summary");

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
      const fileName = `${activeTab}_transactions_with_audit${filterSuffix}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      writeFile(wb, fileName);

      toast.success(`✓ Downloaded ${sortedRows.length} ${activeTab} records with complete audit trail!`);
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

        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6">
          <StatCard
            title="Total Revenue"
            value={formatCurrency(totalIncome)}
            icon={TrendingUp}
            linear="from-emerald-400 to-green-500"
            count={`${totalTransactions} transactions`}
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
          />
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalExpense)}
            icon={TrendingDown}
            linear="from-rose-400 to-red-500"
            count={`${totalExpenseItems} transactions`}
            iconBg="bg-rose-100"
            iconColor="text-rose-600"
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(netBalance)}
            icon={IndianRupee}
            linear={
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
            linear="from-amber-400 to-orange-500"
            count={`On ${
              filteredRevenue.filter((t) => (t.discount || 0) > 0).length
            } transactions`}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 p-4 sm:px-6 sm:py-4">
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

      {showModal && (
        <TransactionModal
          transaction={editingTransaction}
          patients={patients}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

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