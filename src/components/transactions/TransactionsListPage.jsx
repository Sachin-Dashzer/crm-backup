"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import BillGenerator from "@/components/BillGenerator";
import { ALL_BRANCHES } from "@/lib/branches";
import { formatCurrency, StatusBadge } from "@/lib/financeUI";
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
  CreditCard,
  Building2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Loader2,
  Tag,
  ArrowUpDown,
  ChevronDown,
  Package,
  FileText as Bill,
  FileDown,
  Clock,
  ChevronUp,
  Receipt,
  Percent,
  Users,
  Link2,
  HelpCircle,
  ArrowLeftRight,
  Image as ImageIcon,
  Landmark,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { METHOD_LABELS } from "@/constants/paymentMethods";
import { UNSETTLED_METHODS, FURTHER_MODES } from "@/constants/bankRouting";
import { EXPENSE_CATEGORIES, getExpenseTypes } from "@/constants/expenseCategories";
import SuspenseManager from "@/components/SuspenseManager";
import ContraManager from "@/components/ContraManager";

// ========== UTILITY FUNCTIONS ==========
const calculateNetAmount = (transaction) => Math.max(0, parseFloat(transaction?.amount) || 0);

const getTodayDate = () => new Date().toISOString().split("T")[0];

const formatDateForDisplay = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// Shared by the expense table rows and the expense Excel export, so the name shown on screen is
// always the name written to the sheet. A VENDOR payee may arrive populated (an object) or as a
// bare id depending on the query, hence the type check.
const getExpenseGiverName = (row) => {
  if (row.expenseGiver?.type === "VENDOR") {
    return typeof row.expenseGiver.vendorId === "object"
      ? row.expenseGiver.vendorId?.name || row.expenseGiver.name || "N/A"
      : row.expenseGiver.name || "N/A";
  }
  return row.expenseGiver?.name || "N/A";
};

// Filter dropdown must cover every value a stored row can carry, including methods retired
// from entry forms (see src/constants/paymentMethods.js) — otherwise a row using a retired
// method (e.g. an old expense with method "card") can never be filtered to.
const PAYMENT_METHODS = Object.keys(METHOD_LABELS);
const TRANSPLANT_PROCEDURES = ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"];
const SERVICE_PROCEDURES    = ["PRP", "GFC", "Alopecia", "Headwash", "Canacot"];
// Categories whose money moves through an account — revenue tabs show this as "Received In",
// EXPENSE shows it as "Paid From" (see furtherMode's model comment in src/models/Transactions.js).
const REVENUE_CATEGORIES = ["TRANSPLANT", "SERVICE", "MEDICINE"];
// Mirrors UNTRACKED_FURTHER_MODE in src/app/api/transactions/get-all/route.js.
const UNTRACKED_FURTHER_MODE = "__UNTRACKED__";
const FILTER_KEYS = ["branch", "dateFrom", "dateTo", "paymentMethod", "procedure", "furtherMode", "expenseCategory", "expenseType"];
const defaultFilters = () => ({
  branch: "", dateFrom: getTodayDate(), dateTo: getTodayDate(), paymentMethod: "", procedure: "",
  furtherMode: "", expenseCategory: "", expenseType: "",
});
const filtersFromParams = (params) => ({
  branch:        params.get("branch") || "",
  dateFrom:      params.get("dateFrom") || getTodayDate(),
  dateTo:        params.get("dateTo") || getTodayDate(),
  paymentMethod: params.get("paymentMethod") || "",
  procedure:     params.get("procedure") || "",
  furtherMode:      params.get("furtherMode") || "",
  expenseCategory:  params.get("expenseCategory") || "",
  expenseType:      params.get("expenseType") || "",
});

const TRANSACTION_CATEGORIES = [
  { value: "TRANSPLANT", label: "Transplant", icon: User, color: "indigo" },
  { value: "SERVICE",    label: "Services",   icon: User, color: "pink"   },
  { value: "MEDICINE",   label: "Medicine",   icon: User, color: "emerald"},
  { value: "EXPENSE",    label: "Expenses",   icon: User, color: "rose"   },
  // Neither of these is a transactionCategory — contra entries and suspense entries each live in
  // their own collection with their own lifecycle, and bring their own manager component. They
  // sit here because this is where someone looks for "all the money movement".
  { value: "CONTRA",     label: "Contra",     icon: ArrowLeftRight, color: "violet" },
  { value: "SUSPENSE",   label: "Suspense",   icon: HelpCircle, color: "amber" },
];

// Tabs backed by their own collection rather than the Transactions query. Used to skip the
// get-all fetch, the search bar and the header export, all of which are Transactions-shaped.
const NON_TRANSACTION_TABS = ["CONTRA", "SUSPENSE"];
const VALID_CATEGORIES = new Set(TRANSACTION_CATEGORIES.map((c) => c.value));

const getCategoryGradientClass = (categoryValue, isActive) => {
  if (!isActive) return "bg-gray-50 text-gray-600 hover:bg-gray-100";
  const gradients = {
    TRANSPLANT: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md",
    SERVICE:    "bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-md",
    MEDICINE:   "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md",
    EXPENSE:    "bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-md",
    SUSPENSE:   "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md",
    CONTRA:     "bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-md",
  };
  return gradients[categoryValue] || "bg-gray-50 text-gray-600";
};

// ========== APPROVAL BADGE (EXPENSE rows) ==========
// Delegates to the shared StatusBadge (same component payables/receivables/close-book use) so
// the color palette can never drift — silent for APPROVED, same as before, since almost every
// row is approved by default and a badge on every row would be noise.
function ApprovalBadge({ status }) {
  if (status !== "PENDING" && status !== "REJECTED") return null;
  return <StatusBadge status={status} />;
}

// ========== STAT CARD ==========
function StatCard({ title, value, icon: Icon, gradient, count, iconBg, iconColor }) {
  return (
    <div className={`bg-linear-to-br ${gradient} p-4 sm:p-6 rounded-2xl shadow-lg text-white relative overflow-hidden transform hover:scale-105 transition-transform duration-300`}>
      <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-white/10 rounded-full -mr-12 -mt-12 sm:-mr-16 sm:-mt-16" />
      <div className="relative">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-xs sm:text-sm font-medium mb-1 truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{value}</h3>
          </div>
          <div className={`${iconBg} p-2 sm:p-3 rounded-xl shrink-0 ml-2`}>
            <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${iconColor}`} />
          </div>
        </div>
        <p className="text-white/80 text-xs sm:text-sm font-medium truncate">{count}</p>
      </div>
    </div>
  );
}

// ========== DELETE CONFIRM MODAL ==========
function DeleteConfirmModal({ transaction, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => { setDeleting(true); await onConfirm(); setDeleting(false); };
  const netAmount  = calculateNetAmount(transaction);
  const hasDiscount = parseFloat(transaction?.discount || 0) > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4">
        <div className="p-6 sm:p-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center mb-2">Delete Transaction?</h2>
          <p className="text-gray-600 text-center mb-4 sm:mb-6 text-sm sm:text-base">
            Are you sure you want to delete this transaction? This action cannot be undone.
          </p>
          <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Category:</span>
              <span className="font-bold text-gray-900 text-sm sm:text-base">{transaction?.transactionCategory || "Uncategorized"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="font-bold text-emerald-600 text-sm sm:text-base">{formatCurrency(netAmount)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Discount:</span>
                <span className="font-bold text-amber-600 text-sm sm:text-base">-{formatCurrency(transaction?.discount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Date:</span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">{formatDateForDisplay(transaction?.date)}</span>
            </div>
          </div>
          <div className="flex flex-col xs:flex-row gap-3">
            <button onClick={onClose} disabled={deleting} className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-semibold text-gray-700 disabled:opacity-50 text-sm sm:text-base">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== HELPER FORM COMPONENTS ==========
function Input({ label, type = "text", value, onChange, icon: Icon, required, placeholder, min, max }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">{label} {required && <span className="text-red-500">*</span>}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />}
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          required={required} placeholder={placeholder} min={min} max={max}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm sm:text-base ${Icon ? "pl-9 sm:pl-11 pr-4" : "px-4"} py-2.5 sm:py-3`}
        />
      </div>
    </label>
  );
}

function Select({ label, value, onChange, options, required, icon: Icon }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 mb-2 block">{label} {required && <span className="text-red-500">*</span>}</span>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />}
        <select
          value={value} onChange={(e) => onChange(e.target.value)} required={required}
          className={`w-full border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white transition-all appearance-none text-sm sm:text-base ${Icon ? "pl-9 sm:pl-11 pr-8 sm:pr-10" : "px-4 pr-8 sm:pr-10"} py-2.5 sm:py-3`}
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronLeft className="absolute right-2 sm:right-3 top-1/2 transform -translate-y-1/2 rotate-90 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
      </div>
    </label>
  );
}

// A removable "Active Filters" chip — clicking the X removes just that one filter and applies
// immediately (the user has already expressed intent by clicking it).
function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-white text-indigo-700 rounded-md text-xs font-medium border border-indigo-200">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-700"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

const UNSETTLED_LABELS = { paid_to_external: "Held by external", paid_by_other: "Paid by other" };

// Compact badge row shown under every transaction row (list view) + the "Details" toggle. Never
// a new column — per §3, prefer badges here and put the real detail behind the toggle.
function TransactionBadges({ row, expanded, onToggle }) {
  const isUnsettled = UNSETTLED_METHODS.includes(row.method);
  const linkedReceivableId = row.receivableId || row.externalParty?.linkedReceivableId;
  const linkedPayableId = row.payableId || row.externalParty?.linkedPayableId;
  const hasLink = !!(linkedReceivableId || linkedPayableId);
  const hasTax = row.taxDetails?.gstAmount || row.taxDetails?.tdsAmount;
  const hasCollab = row.collabSplit?.ourShare || row.collabSplit?.clinicShare || row.collabRef?.caseId;
  const hasReceipts = row.receipts?.length > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 pb-2 pt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Details
      </button>
      {row.furtherMode && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          {row.costType === "Expenses" ? "Paid From" : "Received In"}: {row.furtherMode}
        </span>
      )}
      {isUnsettled && (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
          title="Excluded from totals until settled"
        >
          {UNSETTLED_LABELS[row.method] || "Unsettled"}
        </button>
      )}
      {hasLink && (
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
        >
          <Link2 className="w-3 h-3" /> Linked
        </button>
      )}
      {hasReceipts && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200" title="Receipt attached">
          <Receipt className="w-3 h-3" /> {row.receipts.length}
        </span>
      )}
      {hasTax && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200" title="Tax applied">
          <Percent className="w-3 h-3" /> Tax
        </span>
      )}
      {hasCollab && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200" title="Collab split">
          <Users className="w-3 h-3" /> Collab
        </span>
      )}
    </div>
  );
}

// Expanded detail panel — tax breakdown, collab split, external party, receipts, and the
// linked receivable/payable's LIVE pending figure (fetched on expand, never cached on the row).
function TransactionDetail({ row, linkedInfo, linkedLoading }) {
  const router = useRouter();
  const hasTax = row.taxDetails && (row.taxDetails.gstAmount || row.taxDetails.tdsAmount);
  const hasCollab = row.collabSplit?.ourShare || row.collabSplit?.clinicShare;
  const hasExternalParty = !!row.externalParty?.name;
  const hasReceipts = row.receipts?.length > 0;
  const hasLink = !!(linkedInfo || linkedLoading);

  if (!hasTax && !hasCollab && !hasExternalParty && !hasReceipts && !hasLink) {
    return <div className="px-4 pb-4 pt-1 text-xs text-gray-400">No additional detail for this transaction.</div>;
  }

  return (
    <div className="px-4 pb-4 pt-1 bg-slate-50/70 border-t border-slate-100">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {hasTax && (
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">Tax Breakdown</p>
            <dl className="space-y-1 text-slate-600">
              {row.taxDetails.baseAmount != null && <div className="flex justify-between"><dt>Base</dt><dd>{formatCurrency(row.taxDetails.baseAmount)}</dd></div>}
              {row.taxDetails.gstAmount != null && <div className="flex justify-between"><dt>GST ({row.taxDetails.gstRate || 0}%)</dt><dd>{formatCurrency(row.taxDetails.gstAmount)}</dd></div>}
              {row.taxDetails.invoiceTotal != null && <div className="flex justify-between font-medium text-slate-800"><dt>Invoice Total</dt><dd>{formatCurrency(row.taxDetails.invoiceTotal)}</dd></div>}
              {row.taxDetails.tdsApplied && <div className="flex justify-between text-rose-600"><dt>TDS ({row.taxDetails.tdsRate || 0}%)</dt><dd>-{formatCurrency(row.taxDetails.tdsAmount)}</dd></div>}
              {row.taxDetails.tdsApplied && (
                <div className="flex justify-between font-medium text-slate-800">
                  <dt>Net</dt><dd>{formatCurrency((row.taxDetails.invoiceTotal || 0) - (row.taxDetails.tdsAmount || 0))}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {hasCollab && (
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">Collab Split</p>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between"><dt>Package</dt><dd>{formatCurrency((row.collabSplit.ourShare || 0) + (row.collabSplit.clinicShare || 0))}</dd></div>
              <div className="flex justify-between"><dt>Our Share</dt><dd>{formatCurrency(row.collabSplit.ourShare)}</dd></div>
              <div className="flex justify-between"><dt>Clinic Share</dt><dd>{formatCurrency(row.collabSplit.clinicShare)}</dd></div>
              <div className="flex justify-between"><dt>Received by Us</dt><dd>{formatCurrency(row.collabSplit.ourReceived)}</dd></div>
              <div className="flex justify-between"><dt>Received by Clinic</dt><dd>{formatCurrency(row.collabSplit.clinicReceived)}</dd></div>
            </dl>
          </div>
        )}

        {hasExternalParty && (
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">External Party</p>
            <dl className="space-y-1 text-slate-600">
              <div className="flex justify-between"><dt>Name</dt><dd>{row.externalParty.name}</dd></div>
              <div className="flex justify-between"><dt>Their Method</dt><dd>{row.externalParty.method || "—"}</dd></div>
              <div className="flex justify-between"><dt>Type</dt><dd>{row.externalParty.partyKind || "—"}</dd></div>
            </dl>
          </div>
        )}

        {hasReceipts && (
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">Receipts</p>
            <div className="flex flex-wrap gap-2">
              {row.receipts.map((r) => (
                <a
                  key={r.publicId || r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200 max-w-35"
                >
                  {r.fileType === "pdf" ? <Bill className="w-3.5 h-3.5 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{r.fileName || "File"}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {hasLink && (
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="font-semibold text-slate-700 mb-1.5">
              Linked {linkedInfo?.type === "payable" ? "Payable" : "Receivable"}
            </p>
            {linkedLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : linkedInfo?.data ? (
              <dl className="space-y-1 text-slate-600">
                <div className="flex justify-between"><dt>Total</dt><dd>{formatCurrency(linkedInfo.data.totalAmount)}</dd></div>
                <div className="flex justify-between"><dt>{linkedInfo.type === "payable" ? "Paid" : "Received"}</dt><dd>{formatCurrency(linkedInfo.data.paid ?? linkedInfo.data.received)}</dd></div>
                <div className="flex justify-between font-medium text-rose-600"><dt>Pending</dt><dd>{formatCurrency(linkedInfo.data.pending)}</dd></div>
                <button
                  type="button"
                  onClick={() => router.push(linkedInfo.type === "payable" ? "/admin/payables" : "/admin/receivables")}
                  className="mt-1 text-indigo-600 hover:underline text-xs font-medium"
                >
                  View in {linkedInfo.type === "payable" ? "Payables" : "Receivables"} →
                </button>
              </dl>
            ) : (
              <p className="text-slate-400">Not found</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== DATA TABLE ==========
function DataTable({ category, rows, onDelete, onSort, sortConfig, pagination, onGenerateBill }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState(null);
  const [expandedInfo, setExpandedInfo] = useState(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const toggleExpand = async (row) => {
    if (expandedId === row._id) { setExpandedId(null); return; }
    setExpandedId(row._id);
    setExpandedInfo(null);

    const linkedReceivableId = row.receivableId || row.externalParty?.linkedReceivableId;
    const linkedPayableId = row.payableId || row.externalParty?.linkedPayableId;
    if (!linkedReceivableId && !linkedPayableId) return;

    setExpandedLoading(true);
    try {
      if (linkedReceivableId) {
        const res = await fetch(`/api/receivables/${linkedReceivableId}`);
        const data = await res.json();
        if (res.ok) setExpandedInfo({ type: "receivable", data: data.receivable });
      } else {
        const res = await fetch(`/api/payables/${linkedPayableId}`);
        const data = await res.json();
        if (res.ok) setExpandedInfo({ type: "payable", data: data.payable });
      }
    } catch (error) {
      console.error("Error fetching linked receivable/payable:", error);
    } finally {
      setExpandedLoading(false);
    }
  };

  const getColumns = () => {
    const base = [{ key: "date", label: "Date", sortable: true, width: "110px" }];
    switch (category) {
      case "TRANSPLANT": return [...base,
        { key: "patient",     label: "Patient",      sortable: true,  width: "160px" },
        { key: "procedure",   label: "Procedure",    sortable: true,  width: "130px" },
        { key: "paymentType", label: "Payment Type", sortable: true,  width: "120px" },
        { key: "amount",      label: "Amount",       sortable: true,  width: "130px" },
        { key: "method",      label: "Method",       sortable: true,  width: "110px" },
        { key: "paymentId",   label: "Trans ID",     sortable: true,  width: "150px" },
        { key: "branch",      label: "Branch",       sortable: true,  width: "110px" },
        { key: "actions",     label: "Actions",      sortable: false, width: "120px" },
      ];
      case "SERVICE": return [...base,
        { key: "patient",       label: "Patient/Customer", sortable: true,  width: "160px" },
        { key: "procedure",     label: "Service",          sortable: true,  width: "100px" },
        { key: "quantity",      label: "Sessions",         sortable: true,  width: "90px"  },
        { key: "perSessionCost",label: "Per Session",      sortable: true,  width: "120px" },
        { key: "amount",        label: "Total",            sortable: true,  width: "130px" },
        { key: "method",        label: "Method",           sortable: true,  width: "110px" },
        { key: "paymentId",     label: "Trans ID",         sortable: true,  width: "150px" },
        { key: "batchId",       label: "Batch",            sortable: false, width: "100px" },
        { key: "branch",        label: "Branch",           sortable: true,  width: "110px" },
        { key: "actions",       label: "Actions",          sortable: false, width: "120px" },
      ];
      case "MEDICINE": return [...base,
        { key: "patient",    label: "Patient/Customer", sortable: true,  width: "160px" },
        { key: "medicine",   label: "Medicine",         sortable: true,  width: "160px" },
        { key: "quantity",   label: "Qty",              sortable: true,  width: "80px"  },
        { key: "perUnitCost",label: "Per Unit",         sortable: true,  width: "110px" },
        { key: "amount",     label: "Total",            sortable: true,  width: "130px" },
        { key: "method",     label: "Method",           sortable: true,  width: "110px" },
        { key: "paymentId",  label: "Trans ID",         sortable: true,  width: "150px" },
        { key: "batchId",    label: "Batch",            sortable: false, width: "100px" },
        { key: "branch",     label: "Branch",           sortable: true,  width: "110px" },
        { key: "actions",    label: "Actions",          sortable: false, width: "120px" },
      ];
      case "EXPENSE": return [...base,
        { key: "expense",     label: "Expense",  sortable: true,  width: "160px" },
        { key: "expenseGiver",label: "Paid To",  sortable: false, width: "160px" },
        { key: "amount",      label: "Amount",   sortable: true,  width: "130px" },
        { key: "method",      label: "Method",   sortable: true,  width: "110px" },
        { key: "paymentId",   label: "Trans ID", sortable: true,  width: "150px" },
        { key: "branch",      label: "Branch",   sortable: true,  width: "110px" },
        { key: "approvalStatus", label: "Status", sortable: false, width: "140px" },
        { key: "actions",     label: "Actions",  sortable: false, width: "120px" },
      ];
      default: return base;
    }
  };

  const columns = getColumns();
  const gridTemplateColumns = columns.map((c) => c.width).join(" ");

  const getProcedureColor = (proc) => {
    const colors = {
      "sapphire fue": "bg-indigo-100 text-indigo-700 border-indigo-200",
      dhi:            "bg-purple-100 text-purple-700 border-purple-200",
      "turkish dhi":  "bg-pink-100 text-pink-700 border-pink-200",
      "beard transplant": "bg-amber-100 text-amber-700 border-amber-200",
      prp:     "bg-emerald-100 text-emerald-700 border-emerald-200",
      gfc:     "bg-cyan-100 text-cyan-700 border-cyan-200",
      alopecia:"bg-rose-100 text-rose-700 border-rose-200",
      headwash:"bg-sky-100 text-sky-700 border-sky-200",
      canacot: "bg-lime-100 text-lime-700 border-lime-200",
    };
    return colors[proc?.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getMethodColor = (method) => {
    const colors = {
      cash:    "bg-emerald-100 text-emerald-700 border-emerald-200",
      upi:     "bg-blue-100 text-blue-700 border-blue-200",
      card:    "bg-purple-100 text-purple-700 border-purple-200",
      banking: "bg-indigo-100 text-indigo-700 border-indigo-200",
      bajaj_loan:    "bg-orange-100 text-orange-700 border-orange-200",
      fibe_loan:    "bg-orange-100 text-gray-700 border-orange-200",
      hdfc_skin_bank_transfer: "bg-sky-100 text-sky-700 border-sky-200",
      hdfc_ryan_medihub_bank_transfer: "bg-teal-100 text-teal-700 border-teal-200",
      icici_medihub_bank_transfer: "bg-rose-100 text-rose-700 border-rose-200",
    };
    return colors[method?.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === "asc"
      ? <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-90 text-indigo-600" />
      : <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 rotate-90 text-indigo-600" />;
  };

  const getPatientName  = (row) => row.patient?.personal?.name || row.patientName || "Walk-in Customer";
  const getPatientPhone = (row) => row.patient?.personal?.phone || row.patientPhone || "";
  const getMedicineName = (row) => (typeof row.medicineId === "object" ? row.medicineId?.name : null) || "N/A";

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Desktop header */}
      <div className="hidden md:grid items-center bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 min-h-13 px-2" style={{ gridTemplateColumns }}>
        {columns.map((col) => (
          <div
            key={col.key}
            className={`px-2 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wide truncate ${col.sortable ? "cursor-pointer hover:bg-slate-200/50 transition-colors duration-150 group" : ""}`}
            onClick={() => col.sortable && onSort(col.key)}
          >
            <div className="flex items-center gap-1.5">
              <span className="truncate">{col.label}</span>
              {col.sortable && <SortIcon columnKey={col.key} />}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile header */}
      <div className="md:hidden bg-linear-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{category} Records</h3>
            <p className="text-xs text-slate-600">Showing {rows.length} of {pagination.total}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-700">Sorted by</p>
            <p className="text-sm font-bold text-indigo-700">{sortConfig.key.replace(/([A-Z])/g, " $1").trim()}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No records found</h3>
            <p className="text-sm text-slate-600 text-center max-w-md">Try adjusting your search filters or add a new transaction</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              const netAmount   = calculateNetAmount(row);
              const hasDiscount = parseFloat(row.discount || 0) > 0;
              const rowCategory = row.transactionCategory || row.category || "TRANSPLANT";

              return (
                <div key={row._id || i} className="group transition-all duration-200 hover:bg-indigo-50/30">
                  {/* Desktop row */}
                  <div className="hidden md:grid items-center min-h-16 px-2" style={{ gridTemplateColumns }}>
                    <div className="px-2 py-3 text-sm font-medium text-slate-900">{formatDateForDisplay(row.date)}</div>

                    {rowCategory === "TRANSPLANT" && (<>
                      <div className="px-2 py-3">
                        <div className="text-sm font-semibold text-slate-900 truncate">{getPatientName(row)}</div>
                        <div className="text-xs text-slate-600 font-medium">{getPatientPhone(row) || "No phone"}</div>
                      </div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getProcedureColor(row.procedure)}`}>{row.procedure}</span></div>
                      <div className="px-2 py-3"><span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">{row.paymentType}</span></div>
                      <div className="px-2 py-3 text-right">
                        <div className="text-sm font-bold text-emerald-700">{formatCurrency(netAmount)}</div>
                        {hasDiscount && <div className="flex items-center justify-center gap-1 mt-1"><Tag className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-600 font-medium">-{formatCurrency(row.discount)}</span></div>}
                      </div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>{METHOD_LABELS[row.method] || row.method}</span></div>
                      <div className="px-2 py-3">{row.paymentId ? <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">{row.paymentId}</div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3"><span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">{row.branch}</span></div>
                    </>)}

                    {rowCategory === "SERVICE" && (<>
                      <div className="px-2 py-3">
                        <div className="text-sm font-semibold text-slate-900 truncate">{getPatientName(row)}</div>
                        <div className="text-xs text-slate-600 font-medium">{getPatientPhone(row) || "No phone"}</div>
                      </div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getProcedureColor(row.procedure)}`}>{row.procedure}</span></div>
                      <div className="px-2 py-3 text-right"><div className="text-sm font-bold text-indigo-700">{row.quantity || 1}</div></div>
                      <div className="px-2 py-3 text-right"><div className="text-sm font-medium text-slate-900">{formatCurrency(row.perSessionCost || 0)}</div></div>
                      <div className="px-2 py-3 text-right">
                        <div className="text-sm font-bold text-emerald-700">{formatCurrency(netAmount)}</div>
                        {hasDiscount && <div className="flex items-center justify-center gap-1 mt-1"><Tag className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-600 font-medium">-{formatCurrency(row.discount)}</span></div>}
                      </div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>{METHOD_LABELS[row.method] || row.method}</span></div>
                      <div className="px-2 py-3">{row.paymentId ? <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">{row.paymentId}</div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3">{row.batchId ? <div className="flex items-center gap-1"><Package className="w-3 h-3 text-indigo-600" /><span className="text-xs font-mono text-indigo-700">{row.batchId.slice(-8)}</span></div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3"><span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">{row.branch}</span></div>
                    </>)}

                    {rowCategory === "MEDICINE" && (<>
                      <div className="px-2 py-3">
                        <div className="text-sm font-semibold text-slate-900 truncate">{getPatientName(row)}</div>
                        <div className="text-xs text-slate-600 font-medium">{getPatientPhone(row) || "No phone"}</div>
                      </div>
                      <div className="px-2 py-3"><div className="text-sm font-semibold text-slate-900 truncate">{getMedicineName(row)}</div></div>
                      <div className="px-2 py-3 text-right"><div className="text-sm font-bold text-indigo-700">{row.quantity || 1}</div></div>
                      <div className="px-2 py-3 text-right"><div className="text-sm font-medium text-slate-900">{formatCurrency(row.perUnitCost || 0)}</div></div>
                      <div className="px-2 py-3 text-right">
                        <div className="text-sm font-bold text-emerald-700">{formatCurrency(netAmount)}</div>
                        {hasDiscount && <div className="flex items-center justify-center gap-1 mt-1"><Tag className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-600 font-medium">-{formatCurrency(row.discount)}</span></div>}
                      </div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>{METHOD_LABELS[row.method] || row.method}</span></div>
                      <div className="px-2 py-3">{row.paymentId ? <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">{row.paymentId}</div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3">{row.batchId ? <div className="flex items-center gap-1"><Package className="w-3 h-3 text-indigo-600" /><span className="text-xs font-mono text-indigo-700">{row.batchId.slice(-8)}</span></div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3"><span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">{row.branch}</span></div>
                    </>)}

                    {rowCategory === "EXPENSE" && (<>
                      <div className="px-2 py-3"><div className="text-sm font-semibold text-slate-900 truncate">{row.expense || row.expenseCategory || "N/A"}</div></div>
                      <div className="px-2 py-3"><div className="text-sm text-slate-900 truncate">{getExpenseGiverName(row)}</div></div>
                      <div className="px-2 py-3 text-right"><div className="text-sm font-bold text-rose-600">{formatCurrency(row.amount)}</div></div>
                      <div className="px-2 py-3"><span className={`inline-flex px-2 py-1 rounded-lg text-xs font-semibold border ${getMethodColor(row.method)}`}>{METHOD_LABELS[row.method] || row.method}</span></div>
                      <div className="px-2 py-3">{row.paymentId ? <div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-700 truncate">{row.paymentId}</div> : <span className="text-xs text-slate-400">-</span>}</div>
                      <div className="px-2 py-3"><span className="inline-flex px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">{row.branch}</span></div>
                      <div className="px-2 py-3"><ApprovalBadge status={row.approvalStatus} /></div>
                    </>)}

                    {/* Actions */}
                    <div className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onGenerateBill(row)} className="p-2 hover:bg-emerald-100 rounded-lg transition-colors text-emerald-600 hover:text-emerald-800" title="Generate Bill"><Bill size={18} /></button>
                        <button onClick={() => router.push(`/admin/transactions/edit/${row._id}`)} className="p-2 hover:bg-indigo-100 rounded-lg transition-colors text-indigo-600 hover:text-indigo-800" title="Edit record"><Edit2 size={18} /></button>
                        <button onClick={() => onDelete(row)} className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 hover:text-red-800" title="Delete record"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Badges + expandable detail — shared across desktop and mobile layouts */}
                  <TransactionBadges row={row} expanded={expandedId === row._id} onToggle={() => toggleExpand(row)} />
                  {expandedId === row._id && (
                    <TransactionDetail row={row} linkedInfo={expandedInfo} linkedLoading={expandedLoading} />
                  )}

                  {/* Mobile row */}
                  <div className="md:hidden p-4">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${rowCategory === "EXPENSE" ? "bg-rose-100 text-rose-700 border border-rose-200" : getProcedureColor(row.procedure)}`}>
                              {rowCategory === "MEDICINE" ? getMedicineName(row) : rowCategory === "EXPENSE" ? (row.expense || row.expenseCategory || "Expense") : row.procedure}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getMethodColor(row.method)}`}>{METHOD_LABELS[row.method] || row.method}</span>
                            {rowCategory === "EXPENSE" && <ApprovalBadge status={row.approvalStatus} />}
                          </div>
                          <h4 className="text-base font-bold text-slate-900">{rowCategory !== "EXPENSE" ? getPatientName(row) : getExpenseGiverName(row)}</h4>
                          {rowCategory !== "EXPENSE" && <p className="text-sm text-slate-600 font-medium">{getPatientPhone(row)}</p>}
                          {rowCategory === "EXPENSE" && <p className="text-sm text-slate-600 font-medium">{row.expense || row.expenseCategory || "General Expense"}</p>}
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${rowCategory === "EXPENSE" ? "text-rose-600" : "text-emerald-700"}`}>{formatCurrency(netAmount)}</div>
                          <p className="text-xs text-slate-500">{formatDateForDisplay(row.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end pt-3 border-t border-slate-200 gap-2">
                        <button onClick={() => onGenerateBill(row)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"><Bill size={14} />Bill</button>
                        <button onClick={() => router.push(`/admin/transactions/edit/${row._id}`)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"><Edit2 size={14} />Edit</button>
                        <button onClick={() => onDelete(row)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"><Trash2 size={14} />Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{pagination.total === 0 ? 0 : pagination.startIdx + 1}–{pagination.endIdx}</span>
            <span className="mx-2">of</span>
            <span className="font-medium text-slate-900">{pagination.total.toLocaleString()}</span>
            <span className="ml-2">records</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 hidden sm:inline">Show</span>
              <select
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium transition-all"
                value={pagination.perPage}
                onChange={(e) => { pagination.setPerPage(Number(e.target.value)); pagination.setPage(1); }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-sm text-slate-600 hidden sm:inline">per page</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => pagination.setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1} className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 mx-2">
                {(() => {
                  const pages = [];
                  const totalPages = pagination.pages;
                  const currentPage = pagination.page;
                  if (currentPage > 2) { pages.push(1); if (currentPage > 3) pages.push("..."); }
                  for (let i = Math.max(1, currentPage - 1); i <= Math.min(totalPages, currentPage + 1); i++) pages.push(i);
                  if (currentPage < totalPages - 1) { if (currentPage < totalPages - 2) pages.push("..."); pages.push(totalPages); }
                  return pages.map((p, idx) =>
                    p === "..." ? <span key={idx} className="px-2 text-slate-400">...</span> :
                    <button key={idx} onClick={() => pagination.setPage(p)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === currentPage ? "bg-indigo-600 text-white border border-indigo-600" : "text-slate-700 hover:bg-slate-100 border border-transparent"}`}>{p}</button>
                  );
                })()}
              </div>
              <button onClick={() => pagination.setPage((p) => Math.min(pagination.pages, p + 1))} disabled={pagination.page >= pagination.pages} className="p-2 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all">
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
// Shared by /admin/transactions and /super-admin/transactions — identical behavior in both
// panels, differing only in which sidebar shell wraps them. Create/edit/receivables/payables
// links always point into the /admin/* pages, which are themselves shared the same way.
export default function TransactionsListPage({ Sidebar }) {
  return (
    <Suspense fallback={null}>
      <AllTransactionsPageInner Sidebar={Sidebar} />
    </Suspense>
  );
}

function AllTransactionsPageInner({ Sidebar }) {
  const tenantBranches = ALL_BRANCHES;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast  = useToast();

  const [transactions, setTransactions] = useState([]);
  const [total, setTotal]               = useState(0);
  const [stats, setStats]               = useState({ TRANSPLANT: { count: 0, total: 0 }, SERVICE: { count: 0, total: 0 }, MEDICINE: { count: 0, total: 0 }, EXPENSE: { count: 0, total: 0 } });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [refreshing, setRefreshing]     = useState(false);

  // Restored from the URL (falling back to TRANSPLANT) rather than always defaulting — a
  // category-scoped filter value (expenseCategory, procedure) restored from the URL below but
  // applied against the wrong tab silently zeroes out every result, since e.g. a TRANSPLANT
  // query filtered by expense: "Salary" can never match anything. Reproduced against the live
  // data before this fix: 0 results whenever the tab defaulted to TRANSPLANT while an
  // EXPENSE-only filter survived a refresh in the URL.
  const [activeCategory, setActiveCategory] = useState(() => {
    const fromUrl = searchParams.get("category");
    return VALID_CATEGORIES.has(fromUrl) ? fromUrl : "TRANSPLANT";
  });
  // appliedFilters drives the actual query; draftFilters is what the filter panel's inputs are
  // bound to. They only converge when Apply is clicked (or a chip/quick-filter/reset acts
  // immediately on both at once) — see the §4 spec: pagination/sort/search stay live, filters
  // don't fire a request until applied.
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromParams(searchParams));
  const [draftFilters, setDraftFilters]     = useState(() => filtersFromParams(searchParams));
  const [tableSearch, setTableSearch]   = useState("");
  const [showFilters, setShowFilters]   = useState(false);
  const [pendingOnly, setPendingOnly]   = useState(false);
  const [page, setPage]                 = useState(1);
  const [perPage, setPerPage]           = useState(10);
  const [sortConfig, setSortConfig]     = useState({ key: "date", direction: "desc" });

  const [showDeleteConfirm, setShowDeleteConfirm]   = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [showBillGenerator, setShowBillGenerator]     = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState(null);

  // Debounce search to avoid firing on every keystroke
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const handleSearchChange = (val) => {
    setTableSearch(val);
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 400);
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    // These tabs aren't transactionCategories — each manager loads its own collection. Hitting
    // get-all with one would query for a category that cannot exist.
    if (NON_TRANSACTION_TABS.includes(activeCategory)) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setError(null);

      const p = new URLSearchParams({
        page,
        limit: perPage,
        category:      activeCategory,
        sortKey:       sortConfig.key,
        sortDir:       sortConfig.direction,
      });
      if (appliedFilters.branch)        p.set("branch",         appliedFilters.branch);
      if (appliedFilters.dateFrom)      p.set("dateFrom",       appliedFilters.dateFrom);
      if (appliedFilters.dateTo)        p.set("dateTo",         appliedFilters.dateTo);
      if (appliedFilters.paymentMethod) p.set("paymentMethod",  appliedFilters.paymentMethod);
      if (appliedFilters.procedure)     p.set("procedure",      appliedFilters.procedure);
      if (appliedFilters.furtherMode)     p.set("furtherMode",     appliedFilters.furtherMode);
      if (appliedFilters.expenseCategory) p.set("expenseCategory", appliedFilters.expenseCategory);
      if (appliedFilters.expenseType)     p.set("expenseType",     appliedFilters.expenseType);
      if (debouncedSearch)       p.set("search",         debouncedSearch);
      if (activeCategory === "EXPENSE" && pendingOnly) p.set("approvalStatus", "PENDING");

      const res = await fetch(`/api/transactions/get-all?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || data.error || "Invalid data format");

      setTransactions(data.transactions || []);
      setTotal(data.total || 0);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      setError(e.message);
      toast?.error?.("Error loading data: " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, perPage, activeCategory, sortConfig, appliedFilters, debouncedSearch, pendingOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset to page 1 when filters or category change
  useEffect(() => { setPage(1); }, [appliedFilters, activeCategory, debouncedSearch, sortConfig, pendingOnly]);

  // The Pending Approvals toggle only makes sense on the EXPENSE tab
  useEffect(() => { if (activeCategory !== "EXPENSE") setPendingOnly(false); }, [activeCategory]);

  // Category-scoped filters must not silently carry over into a tab where the field doesn't
  // exist — e.g. a leftover Procedure filter from SERVICE would zero out every EXPENSE result,
  // since EXPENSE rows have no procedure to match. Runs on mount too (not just on tab changes):
  // activeCategory is now itself restored from the URL's `category` param, so a filter that's
  // still valid for the restored tab is left alone, and one that isn't (e.g. an expenseCategory
  // left in a stale/legacy URL that predates `category` being persisted) gets cleared instead of
  // silently zeroing every result.
  useEffect(() => {
    const patch = {};
    if (!(activeCategory === "TRANSPLANT" || activeCategory === "SERVICE")) patch.procedure = "";
    if (activeCategory !== "EXPENSE") { patch.expenseCategory = ""; patch.expenseType = ""; }
    setDraftFilters((f) => ({ ...f, ...patch }));
    setAppliedFilters((f) => ({ ...f, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // Applied filters (and the active tab) persist in the URL — a filtered view survives a
  // refresh and can be shared. Draft edits never touch the URL; only Apply/chip-remove/
  // quick-filter/reset do. Category MUST be included: without it, reloading while on e.g. the
  // Expense tab with an expenseCategory filter set drops back to the Transplant tab default but
  // keeps that filter value in the URL, which then silently zeroes out every result.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== "TRANSPLANT") params.set("category", activeCategory);
    if (appliedFilters.branch)        params.set("branch", appliedFilters.branch);
    if (appliedFilters.dateFrom)      params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo)        params.set("dateTo", appliedFilters.dateTo);
    if (appliedFilters.paymentMethod) params.set("paymentMethod", appliedFilters.paymentMethod);
    if (appliedFilters.procedure)     params.set("procedure", appliedFilters.procedure);
    if (appliedFilters.furtherMode)     params.set("furtherMode", appliedFilters.furtherMode);
    if (appliedFilters.expenseCategory) params.set("expenseCategory", appliedFilters.expenseCategory);
    if (appliedFilters.expenseType)     params.set("expenseType", appliedFilters.expenseType);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, activeCategory]);

  const handleRefresh = () => fetchData(true);

  const handleSort = (key) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  };

  // Reset clears both draft and applied, and fires exactly one fetch (via the appliedFilters
  // change triggering the existing fetch effect).
  const clearFilters = () => {
    const defaults = defaultFilters();
    setDraftFilters(defaults);
    setAppliedFilters(defaults);
    setTableSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  // Quick-filter presets are a single decisive click, not a draft edit — they apply
  // immediately, same as removing a chip.
  const applyQuickFilter = (preset) => {
    const today = getTodayDate();
    const date  = new Date();
    let patch = {};
    switch (preset) {
      case "today":     patch = { dateFrom: today, dateTo: today }; break;
      case "yesterday": { const y = new Date(date.setDate(date.getDate() - 1)).toISOString().split("T")[0]; patch = { dateFrom: y, dateTo: y }; break; }
      case "week":      { const w = new Date(date.setDate(date.getDate() - 7)).toISOString().split("T")[0]; patch = { dateFrom: w, dateTo: today }; break; }
      case "month":     { const m = new Date(date.setMonth(date.getMonth() - 1)).toISOString().split("T")[0]; patch = { dateFrom: m, dateTo: today }; break; }
      case "all":       patch = { dateFrom: "", dateTo: "" }; break;
    }
    setDraftFilters((f) => ({ ...f, ...patch }));
    setAppliedFilters((f) => ({ ...f, ...patch }));
  };

  // The only place a draft filter edit actually reaches the query.
  const applyFilters = () => setAppliedFilters(draftFilters);

  // A chip's X removes just that one filter and applies immediately — the user has already
  // expressed intent by clicking it.
  const removeFilter = (key) => {
    setDraftFilters((f) => ({ ...f, [key]: "" }));
    setAppliedFilters((f) => ({ ...f, [key]: "" }));
  };

  const hasPendingChanges = FILTER_KEYS.some((k) => draftFilters[k] !== appliedFilters[k]);

  const pages    = Math.max(1, Math.ceil(total / perPage));
  const current  = Math.min(page, pages);
  const startIdx = (current - 1) * perPage;
  const endIdx   = Math.min(startIdx + perPage, total);

  const hasActiveFilters = appliedFilters.branch || appliedFilters.paymentMethod || appliedFilters.procedure ||
    appliedFilters.furtherMode || appliedFilters.expenseCategory || appliedFilters.expenseType || tableSearch ||
    appliedFilters.dateFrom !== getTodayDate() || appliedFilters.dateTo !== getTodayDate();

  const exportToExcel = async () => {
    try {
      // Fetch all filtered rows (no pagination) for export
      const p = new URLSearchParams({
        page: 1, limit: 10000,
        category: activeCategory,
        sortKey: sortConfig.key, sortDir: sortConfig.direction,
      });
      if (appliedFilters.branch)        p.set("branch",        appliedFilters.branch);
      if (appliedFilters.dateFrom)      p.set("dateFrom",      appliedFilters.dateFrom);
      if (appliedFilters.dateTo)        p.set("dateTo",        appliedFilters.dateTo);
      if (appliedFilters.paymentMethod) p.set("paymentMethod", appliedFilters.paymentMethod);
      if (appliedFilters.procedure)     p.set("procedure",     appliedFilters.procedure);
      if (appliedFilters.furtherMode)     p.set("furtherMode",     appliedFilters.furtherMode);
      if (appliedFilters.expenseCategory) p.set("expenseCategory", appliedFilters.expenseCategory);
      if (appliedFilters.expenseType)     p.set("expenseType",     appliedFilters.expenseType);
      if (debouncedSearch)       p.set("search",        debouncedSearch);
      // Must mirror fetchData, or exporting while the Pending Approvals toggle is on silently
      // writes the APPROVED rows instead of the pending ones the user is looking at.
      if (activeCategory === "EXPENSE" && pendingOnly) p.set("approvalStatus", "PENDING");

      const res  = await fetch(`/api/transactions/get-all?${p.toString()}`, { credentials: "include" });
      const data = await res.json();
      const all  = data.transactions || [];

      const { utils, writeFile } = await import("xlsx");

      const stamp = (d) =>
        d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "";
      const yesNo = (v) => (v ? "Yes" : "No");

      // Expenses carry an almost entirely different set of fields from revenue rows — payee,
      // category/type, GST/TDS breakdown, approval, the account it was paid from — and share
      // barely half the revenue columns. Forcing both through one shape meant the expense
      // export was mostly blank patient/procedure columns with none of what was actually
      // entered on the create form, so the EXPENSE tab gets its own column set.
      const isExpenseExport = activeCategory === "EXPENSE";

      const expenseRow = (t) => {
        const tax = t.taxDetails || {};
        const invoiceTotal = tax.invoiceTotal ?? null;
        const tdsAmount = tax.tdsAmount ?? null;
        return {
          "Date":                formatDateForDisplay(t.date),
          "Branch":              t.branch || "",
          "Expense Category":    t.expense || t.expenseCategory || "",
          "Expense Type":        t.expenseType || "",
          "Paid To":             getExpenseGiverName(t),
          "Payee Type":          t.expenseGiver?.type || "",
          "Amount":              parseFloat(t.amount) || 0,
          "Payment Method":      METHOD_LABELS[t.method] || t.method || "",
          "Paid From Account":   t.furtherMode || "",
          "Transaction ID":      t.paymentId || "",
          "Approval Status":     t.approvalStatus || "",
          "Approved/Rejected By": t.approvalActionBy?.name || "",
          "GST Included":        yesNo(tax.gstAmount != null),
          "Base Amount":         tax.baseAmount ?? "",
          "GST Rate %":          tax.gstRate ?? "",
          "GST Amount":          tax.gstAmount ?? "",
          "Invoice Total":       invoiceTotal ?? "",
          "TDS Applied":         yesNo(tax.tdsApplied),
          "TDS Category":        tax.tdsCategory || "",
          "TDS Rate %":          tax.tdsRate ?? "",
          "TDS Amount":          tdsAmount ?? "",
          "Net After TDS":       tax.tdsApplied && invoiceTotal != null ? invoiceTotal - (tdsAmount || 0) : "",
          "Commission Receiver": t.commissionReceiver?.name || "",
          "Commission Payee Type": t.commissionReceiver?.type || "",
          "Against Payable":     yesNo(t.payableId),
          "Payable ID":          t.payableId ? String(t.payableId) : "",
          "Paid By (External)":  t.externalParty?.name || "",
          "External Party Type": t.externalParty?.partyKind || "",
          "External Party Method": t.externalParty?.method || "",
          "Linked Patient":      t.patient?.personal?.name || "",
          "Receipts":            t.receipts?.length || 0,
          "Receipt Files":       (t.receipts || []).map((r) => r.fileName).filter(Boolean).join(", "),
          "Receipt URLs":        (t.receipts || []).map((r) => r.url).filter(Boolean).join(", "),
          "Remarks":             t.remarks || "",
          "Created By":          t.createdBy?.name || "",
          "Created By Email":    t.createdBy?.email || "",
          "Created At":          stamp(t.createdAt),
          "Total Edits":         t.editors?.length || 0,
        };
      };

      const revenueRow = (t) => {
        const amount   = parseFloat(t.amount)   || 0;
        const discount = parseFloat(t.discount) || 0;
        const medicineName = t.transactionCategory === "MEDICINE"
          ? (typeof t.medicineId === "object" ? t.medicineId?.name : "") || t.procedure || "" : "";

        return {
          "Date":             formatDateForDisplay(t.date),
          "Patient Name":     t.patient?.personal?.name || t.patientName || "Walk-in Customer",
          "Phone":            t.patient?.personal?.phone || t.patientPhone || "",
          "Branch":           t.branch || "",
          "Category":         t.transactionCategory || "",
          "Procedure":        t.procedure || "",
          "Medicine Name":    medicineName,
          "Quantity":         t.transactionCategory === "MEDICINE" ? (t.quantity || "") : "",
          "Payment Type":     t.paymentType || "",
          "Payment Method":   t.method || "",
          "Received In Account": t.furtherMode || "",
          "Receipt Mode":     t.receiptMode || "",
          "Original Amount":  amount + discount,
          "TransID / CardNo": t.paymentId || "",
          "Discount":         discount,
          "Net Amount":       amount,
          "Pending Amount":   parseFloat(t.patient?.payments?.pendingAmount) || 0,
          "Remarks":          t.remarks || "",
          "Created By":       t.createdBy?.name || "",
          "Date & Time":      stamp(t.createdAt),
          "Total Edits":      t.editors?.length || 0,
        };
      };

      const rows = all.map(isExpenseExport ? expenseRow : revenueRow);

      const ws = utils.json_to_sheet(rows);
      ws["!cols"] = (isExpenseExport
        ? [14,12,22,28,24,13,13,20,20,20,15,20,13,13,11,12,14,12,26,11,12,14,22,20,15,26,22,18,20,22,10,30,40,30,18,26,22,12]
        : [14,24,14,12,12,18,24,10,15,16,20,18,16,20,12,14,16,24,18,22,12]
      ).map((w) => ({ wch: w }));

      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, isExpenseExport ? "Expenses" : "Transactions");

      const historyRows = [];
      all.forEach((t) => {
        if (!t.editors?.length) return;
        // An expense has no patient — identify the row by who was paid, and by what it was for,
        // otherwise every expense edit reads as "Walk-in Customer".
        const subject = isExpenseExport
          ? getExpenseGiverName(t)
          : t.patient?.personal?.name || t.patientName || "Walk-in Customer";
        const txDate = formatDateForDisplay(t.date);
        t.editors.forEach((editor, editIdx) => {
          const editedAt = stamp(editor.date);
          const fields = editor.updatedFields?.length ? editor.updatedFields : [{ name: "(no field details)", previousValue: "", newValue: "" }];
          fields.forEach((field) => historyRows.push({
            "Transaction Date": txDate,
            [isExpenseExport ? "Paid To" : "Patient Name"]: subject,
            ...(isExpenseExport ? { "Expense Category": t.expense || t.expenseCategory || "" } : {}),
            "Branch": t.branch || "",
            "Edit #": editIdx + 1, "Edited By": editor.name || "", "Editor Email": editor.email || "",
            "Editor Branch": editor.branch || "", "Edited At": editedAt,
            "Field Changed": field.name || "", "Previous Value": field.previousValue || "", "New Value": field.newValue || "",
          }));
        });
      });

      if (historyRows.length > 0) {
        const wsHistory = utils.json_to_sheet(historyRows);
        wsHistory["!cols"] = (isExpenseExport
          ? [16,24,22,12,8,20,26,14,22,20,24,24]
          : [16,24,12,8,20,26,14,22,20,24,24]
        ).map((w) => ({ wch: w }));
        utils.book_append_sheet(wb, wsHistory, "Edit History");
      }

      const prefix = isExpenseExport ? "expenses" : `transactions_${activeCategory}`;
      writeFile(wb, `${prefix}_${appliedFilters.dateFrom || "all"}_to_${appliedFilters.dateTo || "all"}.xlsx`);
    } catch (e) {
      toast?.error?.(e.message || "Export failed");
    }
  };

  const openDeleteConfirm  = (t)  => { setDeletingTransaction(t); setShowDeleteConfirm(true); };
  const openBillGenerator  = (data) => {
    const isRevenue   = data.costType === "Revenue";
    const hasCategory = data.transactionCategory && data.transactionCategory !== "undefined" && data.transactionCategory !== "";
    if (isRevenue && (!hasCategory || data.transactionCategory === "TRANSPLANT") && data.patient) {
      const patientId = typeof data.patient === "object" ? data.patient._id : data.patient;
      setSelectedTransactionId(patientId || data._id);
    } else {
      setSelectedTransactionId(data._id);
    }
    setShowBillGenerator(true);
  };
  const closeBillGenerator = () => { setShowBillGenerator(false); setSelectedTransactionId(null); };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    try {
      const cat = deletingTransaction.transactionCategory || deletingTransaction.category || "TRANSPLANT";
      const endpoint = cat === "TRANSPLANT" ? "/api/transactions/transplant/delete"
        : cat === "SERVICE"  ? "/api/transactions/service/delete"
        : cat === "MEDICINE" ? "/api/transactions/medicine/delete"
        : "/api/transactions/expense/delete";
      const res  = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: deletingTransaction._id }), credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Transaction deleted successfully");
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingTransaction(null);
      } else {
        toast.error(data.error || "Failed to delete transaction");
      }
    } catch {
      toast.error("An error occurred while deleting");
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="text-center">
        <Loader2 className="animate-spin h-16 w-16 text-indigo-500 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Loading transactions...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex h-screen items-center justify-center bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="text-center bg-white p-8 rounded-3xl shadow-xl border border-red-100">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={handleRefresh} className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all font-medium">
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Sidebar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto min-w-0">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">All Transactions</h1>
              <p className="text-gray-600 text-sm sm:text-base">View and manage all transaction categories</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button onClick={handleRefresh} disabled={refreshing} className="p-2 sm:p-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 shrink-0" title="Refresh data">
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-600 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              {/* Exports the Transactions query, which these tabs aren't part of — it would
                  write an empty sheet. Each manager carries its own export. */}
              {!NON_TRANSACTION_TABS.includes(activeCategory) && (
                <button onClick={exportToExcel} className="p-2 sm:p-3 bg-white border-2 border-gray-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm shrink-0" title="Download Excel">
                  <FileDown className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                </button>
              )}
              <button onClick={() => router.push("/admin/transactions/create")} className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl flex items-center gap-1 sm:gap-2 transition-all shadow-lg text-sm sm:text-base shrink-0">
                <Plus size={18} strokeWidth={2.5} />
                <span className="font-semibold hidden sm:inline">Add Transaction</span>
                <span className="font-semibold sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6">
          <StatCard title="Transplants" value={formatCurrency(stats.TRANSPLANT.total)} icon={User} gradient="from-indigo-400 to-purple-500" count={`${stats.TRANSPLANT.count} transactions`} iconBg="bg-indigo-100" iconColor="text-indigo-600" />
          <StatCard title="Services"    value={formatCurrency(stats.SERVICE.total)}    icon={User} gradient="from-pink-400 to-rose-500"    count={`${stats.SERVICE.count} transactions`}    iconBg="bg-pink-100"    iconColor="text-pink-600"    />
          <StatCard title="Medicines"   value={formatCurrency(stats.MEDICINE.total)}   icon={User} gradient="from-emerald-400 to-green-500" count={`${stats.MEDICINE.count} transactions`}   iconBg="bg-emerald-100" iconColor="text-emerald-600" />
          <StatCard title="Expenses"    value={formatCurrency(stats.EXPENSE.total)}    icon={User} gradient="from-rose-400 to-red-500"      count={`${stats.EXPENSE.count} transactions`}    iconBg="bg-rose-100"    iconColor="text-rose-600"    />
        </div>

        {/* Table card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 p-4 sm:px-6 sm:py-4">
              {/* Category tabs */}
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
                      {/* Guarded: `stats` is keyed by transactionCategory and comes from
                          /api/transactions/get-all, so SUSPENSE — a separate collection — has no
                          entry there and renders without a count rather than throwing. */}
                      {cat.label}
                      {stats[cat.value] ? ` (${stats[cat.value].count})` : ""}
                    </button>
                  );
                })}
              </div>

              {/* Search + filter toggle. Hidden on the manager tabs — those entries come from
                  different collections with their own filters, so this bar would silently do
                  nothing. */}
              <div className={`flex gap-2 sm:gap-3 w-full lg:w-auto ${NON_TRANSACTION_TABS.includes(activeCategory) ? "hidden" : ""}`}>
                <div className="relative flex-1 lg:flex-initial min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={tableSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 sm:pl-11 pr-4 py-2 sm:py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 text-sm w-full lg:w-64 transition-all"
                  />
                </div>
                {activeCategory === "EXPENSE" && (
                  <button
                    onClick={() => setPendingOnly((v) => !v)}
                    className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 text-sm font-semibold whitespace-nowrap ${pendingOnly ? "bg-amber-500 text-white shadow-md" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
                  >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Pending Approvals</span>
                    <span className="sm:hidden">Pending</span>
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 sm:p-2.5 rounded-xl transition-all shrink-0 flex items-center gap-2 ${showFilters ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200" : "bg-gray-50 hover:bg-gray-100 text-gray-600"}`}
                >
                  <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
                  <ChevronDown className={`w-4 h-4 hidden sm:block transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="px-3 sm:px-4 py-2 sm:py-2.5 text-sm bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all font-medium flex items-center gap-1 sm:gap-2 whitespace-nowrap shrink-0">
                    <X className="w-4 h-4" /><span className="hidden xs:inline">Clear</span>
                  </button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-5 border-t border-gray-100 pt-4 sm:pt-5 bg-linear-to-b from-indigo-50/30 to-white">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quick Filters</label>
                  <div className="flex flex-wrap gap-2">
                    {[{label:"Today",value:"today"},{label:"Yesterday",value:"yesterday"},{label:"Last 7 Days",value:"week"},{label:"Last 30 Days",value:"month"},{label:"All Time",value:"all"}].map((preset) => (
                      <button key={preset.value} onClick={() => applyQuickFilter(preset.value)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border-2 border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all text-xs sm:text-sm font-semibold">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Enter in any field here submits — same as clicking Apply Filters. */}
                <form
                  onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
                  className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4"
                >
                  <Select label="Branch" value={draftFilters.branch} onChange={(v) => setDraftFilters((f) => ({ ...f, branch: v }))} options={[{ value: "", label: "All Branches" }, ...tenantBranches.map((b) => ({ value: b, label: b }))]} icon={Building2} />
                  <Input  label="From Date" type="date" value={draftFilters.dateFrom} onChange={(v) => setDraftFilters((f) => ({ ...f, dateFrom: v }))} icon={Calendar} />
                  <Input  label="To Date"   type="date" value={draftFilters.dateTo}   onChange={(v) => setDraftFilters((f) => ({ ...f, dateTo: v }))}   icon={Calendar} />
                  <Select label="Payment Method" value={draftFilters.paymentMethod} onChange={(v) => setDraftFilters((f) => ({ ...f, paymentMethod: v }))} options={[{ value: "", label: "All Methods" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] || m }))]} icon={CreditCard} />
                  {(activeCategory === "TRANSPLANT" || activeCategory === "SERVICE") && (
                    <Select
                      label="Procedure" value={draftFilters.procedure} onChange={(v) => setDraftFilters((f) => ({ ...f, procedure: v }))}
                      options={[{ value: "", label: "All Procedures" }, ...(activeCategory === "TRANSPLANT" ? TRANSPLANT_PROCEDURES : SERVICE_PROCEDURES).map((p) => ({ value: p, label: p }))]}
                    />
                  )}
                  {(REVENUE_CATEGORIES.includes(activeCategory) || activeCategory === "EXPENSE") && (
                    <Select
                      label={activeCategory === "EXPENSE" ? "Paid From" : "Received In"}
                      value={draftFilters.furtherMode} onChange={(v) => setDraftFilters((f) => ({ ...f, furtherMode: v }))}
                      options={[
                        { value: "", label: "All Accounts" },
                        { value: UNTRACKED_FURTHER_MODE, label: "Untracked (no account recorded)" },
                        ...FURTHER_MODES.map((m) => ({ value: m, label: m })),
                      ]}
                      icon={Landmark}
                    />
                  )}
                  {activeCategory === "EXPENSE" && (
                    <>
                      <Select
                        label="Expense Category" value={draftFilters.expenseCategory}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, expenseCategory: v, expenseType: "" }))}
                        options={[{ value: "", label: "All Categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
                      />
                      <Select
                        label="Expense Type" value={draftFilters.expenseType}
                        onChange={(v) => setDraftFilters((f) => ({ ...f, expenseType: v }))}
                        options={[
                          { value: "", label: "All Types" },
                          ...(draftFilters.expenseCategory
                            ? getExpenseTypes(draftFilters.expenseCategory)
                            : [...new Set(EXPENSE_CATEGORIES.flatMap((c) => getExpenseTypes(c)))]
                          ).map((t) => ({ value: t, label: t })),
                        ]}
                      />
                    </>
                  )}
                  <button
                    type="submit"
                    disabled={!hasPendingChanges}
                    className="relative self-end px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    Apply Filters
                    {hasPendingChanges && (
                      <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white" />
                    )}
                  </button>
                </form>
                {hasActiveFilters && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-indigo-900">Active Filters:</span>
                      <span className="text-xs text-indigo-700">{total} results</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {appliedFilters.branch && (
                        <FilterChip label={`Branch: ${appliedFilters.branch}`} onRemove={() => removeFilter("branch")} />
                      )}
                      {appliedFilters.dateFrom && (
                        <FilterChip label={`From: ${formatDateForDisplay(appliedFilters.dateFrom)}`} onRemove={() => removeFilter("dateFrom")} />
                      )}
                      {appliedFilters.dateTo && (
                        <FilterChip label={`To: ${formatDateForDisplay(appliedFilters.dateTo)}`} onRemove={() => removeFilter("dateTo")} />
                      )}
                      {appliedFilters.paymentMethod && (
                        <FilterChip label={`Method: ${METHOD_LABELS[appliedFilters.paymentMethod] || appliedFilters.paymentMethod}`} onRemove={() => removeFilter("paymentMethod")} />
                      )}
                      {appliedFilters.procedure && (
                        <FilterChip label={`Procedure: ${appliedFilters.procedure}`} onRemove={() => removeFilter("procedure")} />
                      )}
                      {appliedFilters.furtherMode && (
                        <FilterChip
                          label={`${activeCategory === "EXPENSE" ? "Paid From" : "Received In"}: ${appliedFilters.furtherMode === UNTRACKED_FURTHER_MODE ? "Untracked" : appliedFilters.furtherMode}`}
                          onRemove={() => removeFilter("furtherMode")}
                        />
                      )}
                      {appliedFilters.expenseCategory && (
                        <FilterChip label={`Category: ${appliedFilters.expenseCategory}`} onRemove={() => removeFilter("expenseCategory")} />
                      )}
                      {appliedFilters.expenseType && (
                        <FilterChip label={`Type: ${appliedFilters.expenseType}`} onRemove={() => removeFilter("expenseType")} />
                      )}
                      {tableSearch && (
                        <FilterChip label={`Search: "${tableSearch}"`} onRemove={() => { setTableSearch(""); setDebouncedSearch(""); }} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Each of these is its own collection with its own lifecycle, so each brings its own
              table rather than being forced through DataTable, which is built around the
              Transactions shape. */}
          {activeCategory === "SUSPENSE" ? (
            <SuspenseManager />
          ) : activeCategory === "CONTRA" ? (
            <ContraManager />
          ) : refreshing ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin h-10 w-10 text-indigo-400" />
            </div>
          ) : (
            <DataTable
              category={activeCategory}
              rows={transactions}
              onDelete={openDeleteConfirm}
              onGenerateBill={openBillGenerator}
              onSort={handleSort}
              sortConfig={sortConfig}
              pagination={{ page: current, pages, perPage, setPage, setPerPage, startIdx, endIdx, total }}
            />
          )}
        </div>
      </main>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          transaction={deletingTransaction}
          onClose={() => { setShowDeleteConfirm(false); setDeletingTransaction(null); }}
          onConfirm={handleDelete}
        />
      )}

      {showBillGenerator && selectedTransactionId && (
        <BillGenerator transactionId={selectedTransactionId} onClose={closeBillGenerator} />
      )}
    </div>
  );
}
