"use client";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminSidebar from "@/components/Sidebars/Sidebar";
import SearchableSelect from "@/components/SearchableSelect";
import BankRoutingFields from "@/components/BankRoutingFields";
import ExternalPartyFields from "@/components/ExternalPartyFields";
import TaxBreakdownFields from "@/components/TaxBreakdownFields";
import { computeTaxBreakdown, toTaxDetails } from "@/lib/taxMath";
import { getMethodOptions, withLegacyMethod } from "@/constants/paymentMethods";
import ReceiptUpload from "@/components/ReceiptUpload";
import RevenueSection from "@/components/RevenueSection";
import ContraEntryForm from "@/components/ContraEntryForm";
import SuspenseEntryForm from "@/components/SuspenseEntryForm";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import {
  EXPENSE_CATEGORIES,
  getExpenseTypes,
  PAYABLE_EXPENSE_DROPDOWN_CATEGORIES,
  DIRECT_PAYMENT_CATEGORIES,
} from "@/constants/expenseCategories";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Scissors,
  Heart,
  Pill,
  Receipt,
  Users,
  HeartPulse,
  Home,
  Wallet,
  ArrowLeftRight,
  HelpCircle,
} from "lucide-react";

// Direct Payments tab shows only categories with no payable flow, minus "Patient Related
// Expenses" (owned by the Patient tab's own Expense sub-tab) — so nothing double-enters.
const OTHER_EXPENSE_CATEGORIES = DIRECT_PAYMENT_CATEGORIES.filter(
  (cat) => cat !== "Patient Related Expenses",
);

// Payable Expenses tab: category -> Payable purpose/payee.kind. Rent and Electricity Bill
// keep their existing dedicated kinds; every other payable category uses a generic "OTHER"
// payee (the sub-type itself is the display label — see getPayableContext's "rent" branch).
const PAYABLE_CATEGORY_PURPOSE = {
  "Rent": "RENT",
  "Electricity Bill": "ELECTRICITY",
  "Medical Consumables": "MEDICAL_CONSUMABLES",
  "Medicine Procurement": "MEDICINE_PROCUREMENT",
  "Professional Expenses": "PROFESSIONAL_EXPENSES",
  "Lab Expenses": "LAB_EXPENSES",
  "Interest Expenses": "INTEREST_EXPENSES",
  "Taxes": "TAX",
  "Software Rental Expenses": "SOFTWARE_RENTAL",
  "Hardware Rental Expenses": "HARDWARE_RENTAL",
};
const PAYABLE_CATEGORY_KIND = {
  "Rent": "RENT_UNIT",
  "Electricity Bill": "UTILITY_UNIT",
};
// Categories whose payables are owed to a specific VENDOR document, not a shared category-level
// "OTHER" bucket the way Rent/Electricity's units are. See getPayableContext's "rent" branch —
// picking a vendor for one of these switches payeeKind/payeeRefId from the OTHER/sub-type-label
// bucket to that vendor's own payee, so each vendor's bills (created by
// scripts/vendor-payables-bulk-import.mjs, or by this form) are found and paid individually
// instead of being invisible to this tab (they never matched OTHER + the sub-type label). Not
// merged into PAYABLE_CATEGORY_KIND as a hardcoded "VENDOR" — the kind still depends on whether a
// vendor is actually picked, so any payable already created under the shared-bucket convention
// stays fully visible and payable when no vendor is selected.
const VENDOR_LINKED_PAYABLE_CATEGORIES = ["Medicine Procurement", "Medical Consumables", "Professional Expenses"];
// Patient tab → Expense sub-tab: the 2 patient-linked sub-types under
// "Patient Related Expenses" (Refund claims the 3rd, "Patient Refunds").
const PATIENT_EXPENSE_SUBTYPES = ["Patient Meals", "PATIENT EMI"];

const getPaymentIdConfig = (method) => {
  if (method === "card")
    return { placeholder: "Please enter card last no.", required: true };
  if (method?.toLowerCase() === "bajaj_loan")
    return { placeholder: "Please add the reference id", required: true };
  if (method?.toLowerCase() === "fibe_loan")
    return { placeholder: "Please add the reference id", required: true };
  if (method === "cash")
    return { placeholder: "Please add transaction id", required: false };
  if (method === "including-package")
    return { placeholder: "N/A — included in package", required: false };
  return { placeholder: "Please add transaction id", required: true };
};

const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Admin users have branch="All" and Collab accounts have branch="Collab" —
// neither is a valid transaction branch enum value.
// Fall back to "Delhi" for initial form state; user selects the actual branch via dropdown.
const resolveDefaultBranch = (branch) =>
  branch && branch !== "All" && branch !== "Collab" ? branch : "Delhi";

// Task 4 — every "New Transaction" link (DrillDownTable's header button, the Assets/Liabilities
// drill-down, Task 6's Receipts/Payments) needs useSearchParams to read its prefill, which Next.js
// requires a Suspense boundary around — same pattern admin/assets/page.jsx already uses.
export default function AdminCreateTransactionPage() {
  return (
    <Suspense fallback={null}>
      <AdminCreateTransactionPageInner />
    </Suspense>
  );
}

// Maps a Payable's expenseCategory head back to the expense tab's own sub-navigation, so a
// prefill from DrillDownTable lands on the right sub-tab instead of the default "agent" one.
// Best-effort: Salary/Incentive/Commision are owned by the Agent/Patient tabs' own flows (see
// NO_GIVER_CATEGORIES in expense/create/route.js); every PAYABLE_EXPENSE_DROPDOWN_CATEGORIES
// value goes through the generic "rent" (Payable Expenses) tab; anything else falls to "other"
// (Direct Payment), which is the tab with no extra required fields beyond category/type.
function resolveExpenseSection(expenseHead) {
  if (expenseHead === "Salary" || expenseHead === "Incentive") return "agent";
  if (expenseHead === "Commision") return "patient";
  if (PAYABLE_EXPENSE_DROPDOWN_CATEGORIES.includes(expenseHead)) return "rent";
  return "other";
}

function AdminCreateTransactionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState("transplant");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientCache, setPatientCache] = useState({});
  const patientDebounceRef = useRef(null);
  const [medicines, setMedicines] = useState([]);
  const [vendors, setVendors] = useState([]);
  // Agent tab (Salary/Incentive picker) + Patient tab Commission "Paid To" picker
  const [employees, setEmployees] = useState([]);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const [employeeCache, setEmployeeCache] = useState({});
  const employeeDebounceRef = useRef(null);
  // Payable (owed) tracking — Agent, Patient>Commission, Rent+Electricity,
  // Collab, and Other>Taxes sections. "Create Payable" records an amount as
  // newly owed; "Record Payment" logs a normal expense transaction against
  // an existing payable. Paid/pending is always computed server-side by
  // aggregating Transactions — never stored here.
  const [payableAction, setPayableAction] = useState("none"); // "none" | "create" | "pay"
  const [selectedPayableId, setSelectedPayableId] = useState("");
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [payableDueDate, setPayableDueDate] = useState("");
  const [payablePeriodMonth, setPayablePeriodMonth] = useState("");
  const [payablePeriodYear, setPayablePeriodYear] = useState("");
  const [openPayables, setOpenPayables] = useState([]);
  const [payablesLoading, setPayablesLoading] = useState(false);
  const [payableSummary, setPayableSummary] = useState(null);
  const [secondaryPayableSummary, setSecondaryPayableSummary] = useState(null);
  const [expandedPayableId, setExpandedPayableId] = useState(null);
  const [expandedPayableTx, setExpandedPayableTx] = useState([]);
  const [expandedPayableTxLoading, setExpandedPayableTxLoading] = useState(false);
  const [payableRefreshKey, setPayableRefreshKey] = useState(0);

  const [transplantData, setTransplantData] = useState({
    patient: "",
    procedure: "Sapphire FUE",
    paymentType: "Booking",
    amount: "",
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: resolveDefaultBranch(session?.user?.branch),
    remarks: "",
    receiptMode: "",
    furtherMode: "",
    receipts: [],
    externalParty: { name: "", method: "", partyKind: "MANUAL", partyRefId: "" },
  });

  const [serviceData, setServiceData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: resolveDefaultBranch(session?.user?.branch),
    remarks: "",
    receiptMode: "",
    furtherMode: "",
    receipts: [],
    externalParty: { name: "", method: "", partyKind: "MANUAL", partyRefId: "" },
  });

  const [serviceItems, setServiceItems] = useState([
    {
      id: Date.now(),
      procedure: "PRP",
      quantity: 1,
      perSessionCost: "",
      totalAmount: 0,
    },
  ]);

  const [medicineData, setMedicineData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: resolveDefaultBranch(session?.user?.branch),
    remarks: "",
    receiptMode: "",
    furtherMode: "",
    receipts: [],
    externalParty: { name: "", method: "", partyKind: "MANUAL", partyRefId: "" },
  });

  const [medicineItems, setMedicineItems] = useState([
    {
      id: Date.now(),
      medicineId: "",
      medicineName: "",
      quantity: 1,
      perUnitCost: "",
      totalAmount: 0,
    },
  ]);

  const [expenseData, setExpenseData] = useState({
    // Top-level 4-way switch: "agent" | "patient" | "rent" | "other"
    expenseSection: "agent",
    expenseCategory: "",
    expenseType: "",
    isVendor: true,
    vendorId: "",
    expenseGiverName: "",
    amount: "",
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: resolveDefaultBranch(session?.user?.branch),
    remarks: "",
    furtherMode: "",
    externalParty: { name: "", method: "", partyKind: "MANUAL", partyRefId: "" },

    // Agent tab
    agentSubTab: "salary", // "salary" | "incentive"
    employeeId: "",
    salaryMonth: new Date().getMonth() + 1,
    salaryYear: new Date().getFullYear(),

    // Patient tab
    patientSubTab: "commission", // "commission" | "refund" | "expense"
    patientId: "",
    receiverType: "Patient", // "Patient" | "Employee" | "MANUAL"
    receiverId: "",
    receiverName: "",

    // Payable Expenses tab — category is one of PAYABLE_EXPENSE_DROPDOWN_CATEGORIES
    // (Rent, Electricity Bill, Medical Consumables, Medicine Procurement, Professional
    // Expenses, Lab Expenses, Interest Expenses, Taxes, Software/Hardware Rental Expenses).
    payableCategory: "Rent",
    rentSubType: "",
    // Only meaningful when payableCategory is in VENDOR_LINKED_PAYABLE_CATEGORIES — a distinct
    // field from `vendorId` above (the "other"/Direct Payment tab's own vendor picker) so picking
    // a vendor in one tab never bleeds into the other when switching between them.
    payableVendorId: "",
    includeGST: false,
    gstRate: "",
    gstAmount: "",
    includeTDS: false,
    tdsCategory: "",
    tdsRate: "",
    tdsAmount: "",

    // Collab tab

    receipts: [],
  });

  // Task 4 — prefill from the query string a "New Transaction" link arrives with (DrillDownTable's
  // header button, Task 6's Receipts/Payments pages). A ONE-TIME initial-state read on mount, not
  // a controlled binding — every field it sets stays exactly as editable afterward as if the user
  // had picked it themselves. Runs after every tab's useState above so their setters exist.
  useEffect(() => {
    const category = searchParams.get("category");
    const branch = searchParams.get("branch");
    const furtherMode = searchParams.get("furtherMode");
    const expenseHead = searchParams.get("expense");
    const expenseTypeParam = searchParams.get("expenseType");
    if (!category && !branch && !furtherMode && !expenseHead) return;

    const tabByCategory = { TRANSPLANT: "transplant", SERVICE: "service", MEDICINE: "medicine", EXPENSE: "expense" };
    const tab = tabByCategory[category];
    if (tab) setActiveTab(tab);

    const patch = {};
    if (branch) patch.branch = branch;
    if (furtherMode) patch.furtherMode = furtherMode;

    if (tab === "transplant" && Object.keys(patch).length) {
      setTransplantData((d) => ({ ...d, ...patch }));
    } else if (tab === "service" && Object.keys(patch).length) {
      setServiceData((d) => ({ ...d, ...patch }));
    } else if (tab === "medicine" && Object.keys(patch).length) {
      setMedicineData((d) => ({ ...d, ...patch }));
    } else if (tab === "expense" || (!category && (expenseHead || furtherMode || branch))) {
      const section = expenseHead ? resolveExpenseSection(expenseHead) : undefined;
      setExpenseData((d) => ({
        ...d,
        ...patch,
        ...(section ? { expenseSection: section } : {}),
        ...(section === "rent" ? { payableCategory: expenseHead, rentSubType: expenseTypeParam || "" } : {}),
        ...(section === "other" ? { expenseCategory: expenseHead, expenseType: expenseTypeParam || "" } : {}),
      }));
      if (!category) setActiveTab("expense");
    }
    // Deliberately run once, on mount only — after this, the form is the source of truth and a
    // later change to the URL (there shouldn't be one) must not silently overwrite user input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPatients = async (term = "") => {
    setPatientSearching(true);
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (term) params.set("search", term);
      const res = await fetch(`/api/patients/get-patient?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setPatientSearching(false);
    }
  };

  const handlePatientSearch = (term) => {
    clearTimeout(patientDebounceRef.current);
    patientDebounceRef.current = setTimeout(() => fetchPatients(term), 350);
  };

  const addToPatientCache = (patientObj) => {
    if (patientObj)
      setPatientCache((prev) => ({ ...prev, [patientObj._id]: patientObj }));
  };

  const patientOptions = useMemo(() => {
    const resultIds = new Set(patients.map((p) => p._id));
    const cached = Object.values(patientCache).filter(
      (p) => !resultIds.has(p._id),
    );
    return [...cached, ...patients];
  }, [patients, patientCache]);

  // Wraps the SAME patient search state the expense tab's own pickers use directly (below),
  // shaped for RevenueSection/PatientPicker. Not a separate hook instance — admin's Patient
  // and Incentive expense sub-tabs still search patients through patientOptions/
  // handlePatientSearch/addToPatientCache directly, so this must stay backed by that exact
  // state rather than an independent usePatientPicker() call, or the two would drift apart.
  const patientPicker = {
    options: patientOptions,
    searching: patientSearching,
    onSearch: handlePatientSearch,
    addToCache: addToPatientCache,
  };

  // Agent tab (Salary/Incentive) + Patient tab Commission "Paid To" picker
  const fetchEmployees = async (term = "") => {
    setEmployeeSearching(true);
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (term) params.set("search", term);
      const res = await fetch(`/api/employees/get?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setEmployeeSearching(false);
    }
  };

  const handleEmployeeSearch = (term) => {
    clearTimeout(employeeDebounceRef.current);
    employeeDebounceRef.current = setTimeout(() => fetchEmployees(term), 350);
  };

  const addToEmployeeCache = (empObj) => {
    if (empObj)
      setEmployeeCache((prev) => ({ ...prev, [empObj._id]: empObj }));
  };

  const employeeOptions = useMemo(() => {
    const resultIds = new Set(employees.map((e) => e._id));
    const cached = Object.values(employeeCache).filter(
      (e) => !resultIds.has(e._id),
    );
    return [...cached, ...employees];
  }, [employees, employeeCache]);

  const formatEmployeeOption = (emp) =>
    `${emp.name} — ${emp.role}${emp.phone ? " · " + emp.phone : ""}`;

  useEffect(() => {
    const fetchData = async () => {
      setFetchLoading(true);
      try {
        fetchPatients("");
        try {
          const res = await fetch("/api/stocks/get");
          if (res.ok) {
            const d = await res.json();
            setMedicines(d.data || d.stocks || []);
          }
        } catch {}
        try {
          const res = await fetch("/api/vendors/get");
          if (res.ok) {
            const d = await res.json();
            setVendors(d.data || d.vendors || []);
          }
        } catch {}
        fetchEmployees("");
      } finally {
        setFetchLoading(false);
      }
    };
    fetchData();
  }, []);

  // Resolves the current tab/sub-tab into a Payable "context" — who owes,
  // what purpose, what taxonomy — or null when the active selection isn't
  // pending-able (direct expense, or required picker not yet filled in).
  const getPayableContext = () => {
    const d = expenseData;

    if (d.expenseSection === "agent") {
      if (!d.employeeId) return null;
      const emp = employeeCache[d.employeeId] || employees.find((e) => e._id === d.employeeId);
      const label = emp?.name || "Employee";
      if (d.agentSubTab === "salary") {
        return {
          purpose: "SALARY",
          payeeKind: "EMPLOYEE",
          payeeRefId: d.employeeId,
          payeeLabel: label,
          expenseCategory: "Salary",
          expenseSubType: "Salary",
          period: { month: d.salaryMonth, year: d.salaryYear },
          relatedPatient: null,
          branch: d.branch,
          giver: { type: "EMPLOYEE", refId: d.employeeId, name: label },
        };
      }
      // incentive
      return {
        purpose: "INCENTIVE",
        payeeKind: "EMPLOYEE",
        payeeRefId: d.employeeId,
        payeeLabel: label,
        expenseCategory: "Incentive",
        expenseSubType: d.expenseType,
        period: null,
        relatedPatient: d.patientId || null,
        branch: d.branch,
        giver: { type: "EMPLOYEE", refId: d.employeeId, name: label },
      };
    }

    if (d.expenseSection === "patient" && d.patientSubTab === "commission") {
      if (!d.patientId) return null;
      let receiverLabel = "";
      let receiverKind = "OTHER";
      let receiverRefId = null;
      if (d.receiverType === "MANUAL") {
        receiverLabel = d.receiverName;
      } else if (d.receiverType === "Patient") {
        const pat = patientCache[d.receiverId] || patients.find((p) => p._id === d.receiverId);
        receiverLabel = pat?.personal?.name || "";
        receiverKind = "PATIENT";
        receiverRefId = d.receiverId;
      } else {
        const emp = employeeCache[d.receiverId] || employees.find((e) => e._id === d.receiverId);
        receiverLabel = emp?.name || "";
        receiverKind = "EMPLOYEE";
        receiverRefId = d.receiverId;
      }
      return {
        purpose: "PATIENT_COMMISSION",
        payeeKind: receiverKind,
        payeeRefId: receiverRefId,
        payeeLabel: receiverLabel || "Payee",
        expenseCategory: "Commision",
        expenseSubType: d.expenseType,
        period: null,
        relatedPatient: d.patientId,
        branch: d.branch,
        giver: {
          type: d.receiverType === "MANUAL" ? "MANUAL" : d.receiverType === "Patient" ? "PATIENT" : "EMPLOYEE",
          refId: d.receiverType === "MANUAL" ? null : d.receiverId,
          name: receiverLabel,
        },
      };
    }

    if (d.expenseSection === "rent") {
      if (!d.rentSubType) return null;
      const purpose = PAYABLE_CATEGORY_PURPOSE[d.payableCategory];
      if (!purpose) return null;

      // A vendor-linked category still works in shared-bucket (OTHER + sub-type-label) mode when
      // no vendor is chosen — this keeps any payable genuinely created that way (before a vendor
      // was picked, or intentionally as a category-level bucket) fully visible and payable exactly
      // as before. Vendor mode is additive, never a replacement for the existing behavior.
      const isVendorLinked = VENDOR_LINKED_PAYABLE_CATEGORIES.includes(d.payableCategory);
      const vendor =
        isVendorLinked && d.payableVendorId ? vendors.find((v) => v._id === d.payableVendorId) : null;

      return {
        purpose,
        payeeKind: vendor ? "VENDOR" : PAYABLE_CATEGORY_KIND[d.payableCategory] || "OTHER",
        payeeRefId: vendor ? vendor._id : null,
        payeeLabel: vendor ? vendor.name : d.rentSubType,
        expenseCategory: d.payableCategory,
        expenseSubType: d.rentSubType,
        period: null, // set when creating a payable, from the create-panel's own month/year picker
        relatedPatient: null,
        branch: d.branch,
        giver: vendor ? { type: "VENDOR", refId: vendor._id, name: vendor.name } : null,
      };
    }

    return null;
  };

  const payableContext = getPayableContext();

  // Inline "Paid / Pending" chips + open-payables list for whichever
  // pending-able context is currently active.
  useEffect(() => {
    if (activeTab !== "expense" || !payableContext) {
      setPayableSummary(null);
      setSecondaryPayableSummary(null);
      setOpenPayables([]);
      return;
    }

    const ctx = payableContext;
    setPayablesLoading(true);

    const summaryParams = new URLSearchParams({
      purpose: ctx.purpose,
      payeeKind: ctx.payeeKind,
    });
    if (ctx.payeeRefId) summaryParams.set("payeeRefId", ctx.payeeRefId);
    else summaryParams.set("payeeLabel", ctx.payeeLabel);

    const listParams = new URLSearchParams({
      purpose: ctx.purpose,
      payeeKind: ctx.payeeKind,
      limit: "50",
    });
    if (ctx.payeeRefId) listParams.set("payeeRefId", ctx.payeeRefId);
    else listParams.set("payeeLabel", ctx.payeeLabel);
    // A vendor's bills can span more than one sub-type under the same category (e.g. Professional
    // Expenses: Turkey Technician vs. Legal Consultant Fee) — payeeRefId alone would show every
    // sub-type's bills together once a vendor is picked, silently widening the list past what the
    // sub-type dropdown says. Non-vendor payeeKinds don't need this: their payeeLabel already IS
    // the sub-type, so it's already an exact filter.
    if (ctx.payeeKind === "VENDOR" && ctx.expenseSubType) {
      summaryParams.set("expenseSubType", ctx.expenseSubType);
      listParams.set("expenseSubType", ctx.expenseSubType);
    }

    const requests = [
      fetch(`/api/payables/summary?${summaryParams}`).then((r) => r.json()),
      fetch(`/api/payables/list?${listParams}`).then((r) => r.json()),
    ];

    // Agent tab shows Salary vs Incentive side by side — fetch whichever
    // sub-tab isn't currently active too.
    if (expenseData.expenseSection === "agent") {
      const otherPurpose = ctx.purpose === "SALARY" ? "INCENTIVE" : "SALARY";
      const otherParams = new URLSearchParams({
        purpose: otherPurpose,
        payeeKind: "EMPLOYEE",
        payeeRefId: ctx.payeeRefId,
      });
      requests.push(fetch(`/api/payables/summary?${otherParams}`).then((r) => r.json()));
    }

    Promise.all(requests)
      .then(([summaryData, listData, secondaryData]) => {
        if (summaryData.success) setPayableSummary(summaryData.byPayee || summaryData.overall);
        if (listData.success) setOpenPayables(listData.payables || []);
        if (secondaryData?.success) setSecondaryPayableSummary(secondaryData.byPayee || secondaryData.overall);
        else setSecondaryPayableSummary(null);
      })
      .catch((error) => console.error("Error fetching payable data:", error))
      .finally(() => setPayablesLoading(false));
  }, [
    activeTab,
    expenseData.expenseSection,
    expenseData.agentSubTab,
    expenseData.employeeId,
    expenseData.patientSubTab,
    expenseData.patientId,
    expenseData.receiverType,
    expenseData.receiverId,
    expenseData.payableCategory,
    expenseData.rentSubType,
    expenseData.payableVendorId,
    expenseData.expenseCategory,
    expenseData.expenseType,
    payableRefreshKey,
  ]);

  // Reset the Create/Pay action state whenever the identifying picker changes,
  // so a stale "pay against payable X" selection can't survive a payee switch.
  useEffect(() => {
    setPayableAction("none");
    setSelectedPayableId("");
    setAllowOverpayment(false);
    setExpandedPayableId(null);
  }, [
    expenseData.expenseSection,
    expenseData.agentSubTab,
    expenseData.employeeId,
    expenseData.payableCategory,
    expenseData.rentSubType,
  ]);

  // A picked vendor is scoped to one payableCategory (or leaving the "rent" tab entirely) — NOT
  // to rentSubType, since the same vendor can have bills under several sub-types (e.g. Modern
  // Pharmaceuticals across multiple Medical Consumables sub-types) and switching sub-type should
  // keep filtering to that vendor, not silently fall back to the shared bucket.
  useEffect(() => {
    setExpenseData((d) => (d.payableVendorId ? { ...d, payableVendorId: "" } : d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseData.expenseSection, expenseData.payableCategory]);

  const toggleExpandPayable = async (payableId) => {
    if (expandedPayableId === payableId) {
      setExpandedPayableId(null);
      return;
    }
    setExpandedPayableId(payableId);
    setExpandedPayableTxLoading(true);
    try {
      const params = new URLSearchParams({ payableId, limit: "50" });
      const res = await fetch(`/api/transactions/get-all?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExpandedPayableTx(data.transactions || []);
      }
    } catch (error) {
      console.error("Error fetching payable transactions:", error);
    } finally {
      setExpandedPayableTxLoading(false);
    }
  };

  const handleCreatePayable = async () => {
    const ctx = payableContext;
    if (!ctx) return;
    if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
      alert("Enter the amount owed first");
      return;
    }
    const needsPeriod = ["SALARY", "RENT", "ELECTRICITY", "COLLAB_CLINIC", "TAX"].includes(ctx.purpose);
    const period =
      ctx.purpose === "SALARY"
        ? { month: expenseData.salaryMonth, year: expenseData.salaryYear }
        : payablePeriodMonth && payablePeriodYear
          ? { month: parseInt(payablePeriodMonth), year: parseInt(payablePeriodYear) }
          : null;
    if (needsPeriod && !period) {
      alert("Select the month and year this payable is for");
      return;
    }
    if (["INCENTIVE", "PATIENT_COMMISSION"].includes(ctx.purpose) && !ctx.relatedPatient) {
      alert("Select the related patient first");
      return;
    }
    if (expenseData.includeTDS && !expenseData.tdsCategory) {
      alert("Select the TDS category first");
      return;
    }
    if (expenseData.includeTDS && !expenseData.tdsRate && !expenseData.tdsAmount) {
      alert("Enter a TDS rate or a TDS amount");
      return;
    }
    if (expenseData.includeGST && !expenseData.gstRate && !expenseData.gstAmount) {
      alert("Enter a GST rate or a GST amount");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payee: { kind: ctx.payeeKind, refId: ctx.payeeRefId, label: ctx.payeeLabel },
          purpose: ctx.purpose,
          expenseCategory: ctx.expenseCategory,
          expenseSubType: ctx.expenseSubType,
          period,
          relatedPatient: ctx.relatedPatient,
          totalAmount: expenseData.amount,
          dueDate: payableDueDate || undefined,
          branch: ctx.branch,
          remarks: expenseData.remarks,
          ...(expenseData.includeGST
            ? {
                includeGST: true,
                gstRate: expenseData.gstRate || undefined,
                gstAmount: expenseData.gstAmount || undefined,
              }
            : {}),
          ...(expenseData.includeTDS
            ? {
                includeTDS: true,
                tdsCategory: expenseData.tdsCategory,
                tdsRate: expenseData.tdsRate || undefined,
                tdsAmount: expenseData.tdsAmount || undefined,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          expenseData.includeTDS
            ? `Payable created — vendor ${formatCurrency(data.payable?.totalAmount)} + linked TDS ${formatCurrency(data.tdsPayable?.totalAmount)}.`
            : "Payable created — this amount is now recorded as owed.",
        );
        setPayableAction("none");
        setExpenseData((d) => ({
          ...d,
          amount: "",
          includeGST: false,
          gstRate: "",
          gstAmount: "",
          includeTDS: false,
          tdsCategory: "",
          tdsRate: "",
          tdsAmount: "",
        }));
        setPayableDueDate("");
        setPayablePeriodMonth("");
        setPayablePeriodYear("");
        setPayableRefreshKey((k) => k + 1);
      } else {
        alert(data.error || "Failed to create payable");
      }
    } catch {
      alert("Failed to create payable");
    } finally {
      setLoading(false);
    }
  };

  // Shared "Create Payable / Record Payment" action panel + open-payables
  // history, used by every pending-able section (Agent, Patient>Commission,
  // Rent+Electricity, Collab, Other>Taxes). Defined as a closure so it can
  // read the surrounding state directly instead of prop-drilling ~20 values.
  const renderPayableActions = () => {
    const ctx = payableContext;
    if (!ctx) return null;
    const needsPeriodPicker = ["RENT", "ELECTRICITY", "COLLAB_CLINIC", "TAX"].includes(ctx.purpose);
    const selectedPayable = openPayables.find((p) => p._id === selectedPayableId);
    const overBalance =
      selectedPayable && parseFloat(expenseData.amount || 0) > selectedPayable.pending;

    const payableLabel = (p) =>
      `${p.expenseSubType || p.expenseCategory}${p.period ? ` (${p.period.month}/${p.period.year})` : ""} — Pending ${formatCurrency(p.pending)}`;

    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setPayableAction(payableAction === "create" ? "none" : "create")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              payableAction === "create"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
          >
            + Create Payable
          </button>
          <button
            type="button"
            onClick={() => setPayableAction(payableAction === "pay" ? "none" : "pay")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              payableAction === "pay"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            }`}
          >
            Record Payment
          </button>
        </div>

        {payableAction === "create" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3 mb-4">
            <p className="text-xs text-amber-800">
              Records that this amount is now due — no money moves yet. The Amount field above is
              how much is owed.
            </p>
            {needsPeriodPicker && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={payablePeriodMonth}
                  onChange={(e) => setPayablePeriodMonth(e.target.value)}
                  className="px-2 py-1.5 border border-amber-300 rounded-lg text-sm"
                >
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={payablePeriodYear}
                  onChange={(e) => setPayablePeriodYear(e.target.value)}
                  placeholder="Year"
                  className="px-2 py-1.5 border border-amber-300 rounded-lg text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-amber-800 mb-1">
                Due Date (optional)
              </label>
              <input
                type="date"
                value={payableDueDate}
                onChange={(e) => setPayableDueDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm"
              />
            </div>

            {/* GST is always available; TDS is suppressed on a TAX payable (a TDS payable
                must not itself withhold TDS). The Amount field above is the BASE amount. */}
            <TaxBreakdownFields
              tone="amber"
              allowTDS={ctx.purpose !== "TAX"}
              baseAmount={expenseData.amount}
              value={expenseData}
              onChange={(patch) => setExpenseData((d) => ({ ...d, ...patch }))}
            />

            <button
              type="button"
              onClick={handleCreatePayable}
              disabled={loading}
              className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              Save as Owed
            </button>
          </div>
        )}

        {payableAction === "pay" && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-3 mb-4">
            <p className="text-xs text-indigo-800">
              Logs money actually paid out now, against an existing payable. The Amount field
              above is how much is being paid.
            </p>
            <select
              value={selectedPayableId}
              onChange={(e) => setSelectedPayableId(e.target.value)}
              className="w-full px-2 py-1.5 border border-indigo-300 rounded-lg text-sm"
            >
              <option value="">Select open payable…</option>
              {openPayables
                .filter((p) => p.status !== "Paid")
                .map((p) => (
                  <option key={p._id} value={p._id}>
                    {payableLabel(p)}
                  </option>
                ))}
            </select>
            {overBalance && (
              <label className="flex items-center gap-2 text-xs text-amber-700">
                <input
                  type="checkbox"
                  checked={allowOverpayment}
                  onChange={(e) => setAllowOverpayment(e.target.checked)}
                />
                Amount exceeds pending balance ({formatCurrency(selectedPayable.pending)}) — allow
                overpayment
              </label>
            )}
          </div>
        )}

        {!payablesLoading && openPayables.length === 0 && ctx.payeeKind === "VENDOR" && (
          <p className="text-xs text-gray-400 italic">No open bills for this vendor.</p>
        )}

        {openPayables.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              History
            </p>
            <div className="space-y-1.5">
              {openPayables.map((p) => (
                <div key={p._id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpandPayable(p._id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="text-gray-700 truncate">
                      {p.expenseSubType || p.expenseCategory}
                      {p.period ? ` (${p.period.month}/${p.period.year})` : ""}
                    </span>
                    <span className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${
                          p.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : p.status === "Overdue"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : p.status === "Partially Paid"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="font-semibold text-rose-600">
                        {formatCurrency(p.pending)}
                      </span>
                    </span>
                  </button>
                  {expandedPayableId === p._id && (
                    <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs">
                      {expandedPayableTxLoading ? (
                        <p className="text-gray-400">Loading…</p>
                      ) : expandedPayableTx.length === 0 ? (
                        <p className="text-gray-400">No payments recorded yet.</p>
                      ) : (
                        <ul className="space-y-1">
                          {expandedPayableTx.map((tx) => (
                            <li key={tx._id} className="flex justify-between">
                              <span className="text-gray-600">
                                {new Date(tx.date).toLocaleDateString("en-IN")} ·{" "}
                                {(tx.method || "").replace(/_/g, " ").toUpperCase()} ·{" "}
                                {tx.createdBy?.name || "—"}
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(tx.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // When session loads, sync branch across all form states (admin arrives with branch="All")
  useEffect(() => {
    if (!session?.user) return;
    const b = resolveDefaultBranch(session.user.branch);
    setTransplantData((d) => ({ ...d, branch: b }));
    setServiceData((d) => ({ ...d, branch: b }));
    setMedicineData((d) => ({ ...d, branch: b }));
    setExpenseData((d) => ({ ...d, branch: b }));
  }, [session]);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  const formatPatientOption = (patient) =>
    `${patient.personal?.name || "N/A"} - ${maskPhone(patient.personal?.phone, session?.user?.role) || "N/A"} | Package: ${formatCurrency(patient?.payments?.totalAmount)} | Received: ${formatCurrency(patient?.payments?.amountReceived)} | Pending: ${formatCurrency(patient?.payments?.pendingAmount)}`;

  // TRANSPLANT
  const handleSaveTransplant = async () => {
    if (!transplantData.patient) {
      alert("Please select a patient");
      return;
    }
    if (!transplantData.amount) {
      alert("Please enter amount");
      return;
    }
    if (transplantData.method !== "cash" && !transplantData.paymentId) {
      alert(
        transplantData.method === "card"
          ? "Please enter card last no."
          : transplantData.method?.toLowerCase() === "bajaj_loan" ||
              transplantData.method?.toLowerCase() === "fibe_loan"
            ? "Please add the reference id"
            : "Please add transaction id",
      );
      return;
    }
    if (
      transplantData.method === "paid_to_external" &&
      (!transplantData.externalParty.name || !transplantData.externalParty.method)
    ) {
      alert("Please enter the receiver's name and payment method");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/transplant/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: transplantData.patient,
          procedure: transplantData.procedure,
          paymentType: transplantData.paymentType,
          amount: transplantData.amount,
          discount: transplantData.discount,
          method: transplantData.method,
          paymentId: transplantData.paymentId,
          branch: transplantData.branch,
          date: transplantData.date,
          remarks: transplantData.remarks,
          receiptMode: transplantData.receiptMode,
          furtherMode: transplantData.furtherMode,
          receipts: transplantData.receipts,
          receivableAllocationChoice: transplantData.receivableAllocationChoice,
          externalParty:
            transplantData.method === "paid_to_external" ? transplantData.externalParty : undefined,
        }),
      });
      if (res.ok) {
        alert("Transplant transaction saved!");
        router.push("/admin/transactions");
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create transaction");
      }
    } catch {
      alert("Failed to save transplant transaction");
    } finally {
      setLoading(false);
    }
  };

  // SERVICE
  const handleSaveService = async () => {
    if (!serviceData.isWalkIn && !serviceData.patient) {
      alert("Please select a patient");
      return;
    }
    if (
      serviceData.isWalkIn &&
      (!serviceData.patientName || !serviceData.patientPhone)
    ) {
      alert("Please enter patient name and phone");
      return;
    }
    for (const item of serviceItems) {
      if (!item.perSessionCost || parseFloat(item.perSessionCost) <= 0) {
        alert("Please enter valid per session cost for all services");
        return;
      }
    }
    if (serviceData.method !== "cash" && !serviceData.paymentId) {
      alert(
        serviceData.method === "card"
          ? "Please enter card last no."
          : serviceData.method?.toLowerCase() === "bajaj_loan" ||
              serviceData.method?.toLowerCase() === "fibe_loan"
            ? "Please add the reference id"
            : "Please add transaction id",
      );
      return;
    }
    if (
      serviceData.method === "paid_to_external" &&
      (!serviceData.externalParty.name || !serviceData.externalParty.method)
    ) {
      alert("Please enter the receiver's name and payment method");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/service/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: serviceData.isWalkIn ? null : serviceData.patient,
          patientName: serviceData.patientName,
          patientPhone: serviceData.patientPhone,
          services: serviceItems.map((i) => ({
            procedure: i.procedure,
            quantity: i.quantity,
            perSessionCost: parseFloat(i.perSessionCost),
            totalAmount: parseFloat(i.totalAmount),
          })),
          discount: serviceData.discount,
          method: serviceData.method,
          paymentId: serviceData.paymentId,
          branch: serviceData.branch,
          date: serviceData.date,
          remarks: serviceData.remarks,
          receiptMode: serviceData.receiptMode,
          furtherMode: serviceData.furtherMode,
          receipts: serviceData.receipts,
          receivableAllocationChoice: serviceData.receivableAllocationChoice,
          externalParty: serviceData.method === "paid_to_external" ? serviceData.externalParty : undefined,
        }),
      });
      if (res.ok) {
        alert("Service transactions saved!");
        router.push("/admin/transactions");
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create transactions");
      }
    } catch {
      alert("Failed to save service transactions");
    } finally {
      setLoading(false);
    }
  };

  // MEDICINE
  const handleSaveMedicine = async () => {
    if (!medicineData.isWalkIn && !medicineData.patient) {
      alert("Please select a patient");
      return;
    }
    if (
      medicineData.isWalkIn &&
      (!medicineData.patientName || !medicineData.patientPhone)
    ) {
      alert("Please enter customer name and phone");
      return;
    }
    for (const item of medicineItems) {
      if (!item.medicineId) {
        alert("Please select medicine for all items");
        return;
      }
      if (!item.perUnitCost || parseFloat(item.perUnitCost) <= 0) {
        alert("Please enter valid price for all medicines");
        return;
      }
    }
    if (
      medicineData.method !== "cash" &&
      medicineData.method !== "including-package" &&
      !medicineData.paymentId
    ) {
      alert(
        medicineData.method === "card"
          ? "Please enter card last no."
          : medicineData.method?.toLowerCase() === "bajaj_loan" ||
              medicineData.method?.toLowerCase() === "fibe_loan"
            ? "Please add the reference id"
            : "Please add transaction id",
      );
      return;
    }
    if (
      medicineData.method === "paid_to_external" &&
      (!medicineData.externalParty.name || !medicineData.externalParty.method)
    ) {
      alert("Please enter the receiver's name and payment method");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/medicine/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: medicineData.isWalkIn ? null : medicineData.patient,
          patientName: medicineData.patientName,
          patientPhone: medicineData.patientPhone,
          medicines: medicineItems.map((i) => ({
            medicineId: i.medicineId,
            quantity: i.quantity,
            perUnitCost: parseFloat(i.perUnitCost),
            totalAmount: parseFloat(i.totalAmount),
          })),
          discount: medicineData.discount,
          method: medicineData.method,
          paymentId: medicineData.paymentId,
          branch: medicineData.branch,
          date: medicineData.date,
          remarks: medicineData.remarks,
          receiptMode: medicineData.receiptMode,
          furtherMode: medicineData.furtherMode,
          receipts: medicineData.receipts,
          receivableAllocationChoice: medicineData.receivableAllocationChoice,
          externalParty: medicineData.method === "paid_to_external" ? medicineData.externalParty : undefined,
        }),
      });
      if (res.ok) {
        alert("Medicine sales saved!");
        router.push("/admin/transactions");
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create transactions");
      }
    } catch {
      alert("Failed to save medicine sales");
    } finally {
      setLoading(false);
    }
  };

  // EXPENSE — payload shape depends on which of the 5 tabs is active
  const buildExpensePayload = () => {
    const common = {
      method: expenseData.method,
      paymentId: expenseData.paymentId,
      branch: expenseData.branch,
      date: expenseData.date,
      remarks: expenseData.remarks,
      receipts: expenseData.receipts,
      furtherMode: expenseData.furtherMode,
      externalParty: expenseData.method === "paid_by_other" ? expenseData.externalParty : undefined,
      ...(payableAction === "pay"
        ? { payableId: selectedPayableId, allowOverpayment }
        : {}),
    };

    if (expenseData.expenseSection === "agent") {
      const isSalary = expenseData.agentSubTab === "salary";
      const emp =
        employeeCache[expenseData.employeeId] ||
        employees.find((e) => e._id === expenseData.employeeId);
      return {
        ...common,
        expenseCategory: isSalary ? "Salary" : "Incentive",
        expenseType: isSalary ? "Salary" : expenseData.expenseType,
        patientId: !isSalary ? expenseData.patientId : undefined,
        expenseGiver: {
          type: "EMPLOYEE",
          refId: expenseData.employeeId,
          name: emp?.name || "",
        },
        amount: expenseData.amount,
      };
    }

    if (expenseData.expenseSection === "patient") {
      if (expenseData.patientSubTab === "commission") {
        const receiverName =
          expenseData.receiverType === "MANUAL"
            ? expenseData.receiverName
            : expenseData.receiverType === "Patient"
              ? patientOptions.find((p) => p._id === expenseData.receiverId)
                  ?.personal?.name || ""
              : employeeOptions.find((e) => e._id === expenseData.receiverId)
                  ?.name || "";
        const giverType =
          expenseData.receiverType === "MANUAL"
            ? "MANUAL"
            : expenseData.receiverType === "Patient"
              ? "PATIENT"
              : "EMPLOYEE";

        return {
          ...common,
          expenseCategory: "Commision",
          expenseType: expenseData.expenseType,
          patientId: expenseData.patientId,
          amount: expenseData.amount,
          expenseGiver: {
            type: giverType,
            refId:
              expenseData.receiverType === "MANUAL"
                ? undefined
                : expenseData.receiverId,
            name: receiverName,
          },
          commissionReceiver: {
            type: giverType,
            refId:
              expenseData.receiverType === "MANUAL"
                ? undefined
                : expenseData.receiverId,
            name: receiverName,
          },
        };
      }

      const pat =
        patientCache[expenseData.patientId] ||
        patients.find((p) => p._id === expenseData.patientId);
      const patientGiver = {
        type: "PATIENT",
        refId: expenseData.patientId,
        name: pat?.personal?.name || "",
      };

      if (expenseData.patientSubTab === "refund") {
        return {
          ...common,
          expenseCategory: "Patient Related Expenses",
          expenseType: "Patient Refunds",
          patientId: expenseData.patientId,
          amount: expenseData.amount,
          expenseGiver: patientGiver,
        };
      }
      return {
        ...common,
        expenseCategory: "Patient Related Expenses",
        expenseType: expenseData.expenseType,
        patientId: expenseData.patientId,
        amount: expenseData.amount,
        expenseGiver: patientGiver,
      };
    }

    if (expenseData.expenseSection === "rent") {
      return {
        ...common,
        expenseCategory: expenseData.payableCategory,
        expenseType: expenseData.rentSubType,
        amount: expenseData.amount,
      };
    }


    // "other" — Direct Payments. With GST ticked the Amount field is the BASE amount, so
    // the transaction records the invoice total and keeps the breakdown in taxDetails.
    // GST never becomes a payable and never gets its own transaction.
    const vendor = vendors.find((v) => v._id === expenseData.vendorId);
    const directTax = computeTaxBreakdown({
      baseAmount: expenseData.amount,
      includeGST: expenseData.includeGST,
      gstRate: expenseData.gstRate,
      gstAmount: expenseData.gstAmount,
    });
    return {
      ...common,
      expenseCategory: expenseData.expenseCategory,
      expenseType: expenseData.expenseType,
      expenseGiver: {
        type: expenseData.isVendor ? "VENDOR" : "MANUAL",
        vendorId: expenseData.isVendor ? expenseData.vendorId : "",
        name: expenseData.isVendor
          ? vendor?.name
          : expenseData.expenseGiverName,
      },
      amount: expenseData.includeGST ? directTax.invoiceTotal : expenseData.amount,
      ...(expenseData.includeGST ? { taxDetails: toTaxDetails(directTax) } : {}),
    };
  };

  const validateExpenseSection = () => {
    if (payableAction === "create") {
      return "Use the Create Payable button to record this as owed.";
    }
    if (payableAction === "pay" && !selectedPayableId) {
      return "Select which payable this payment is against";
    }

    if (expenseData.expenseSection === "agent") {
      if (!expenseData.employeeId) return "Please select an employee";
      if (expenseData.agentSubTab === "incentive") {
        if (!expenseData.expenseType) return "Please select an incentive type";
        if (!expenseData.patientId) return "Please select the related patient";
      }
      if (!expenseData.amount) return "Please enter amount";
      return null;
    }
    if (expenseData.expenseSection === "patient") {
      if (!expenseData.patientId) return "Please select a patient";
      if (expenseData.patientSubTab === "commission") {
        if (!expenseData.expenseType) return "Please select a commission type";
        if (
          expenseData.receiverType === "MANUAL" &&
          !expenseData.receiverName
        )
          return "Please enter the payee's name";
        if (
          expenseData.receiverType !== "MANUAL" &&
          !expenseData.receiverId
        )
          return "Please select the commission recipient";
      }
      if (expenseData.patientSubTab === "expense" && !expenseData.expenseType)
        return "Please select an expense type";
      if (!expenseData.amount) return "Please enter amount";
      return null;
    }
    if (expenseData.expenseSection === "rent") {
      if (!expenseData.rentSubType) return "Please select a sub-type";
      if (!expenseData.amount) return "Please enter amount";
      return null;
    }
    // other
    if (!expenseData.expenseCategory) return "Please select expense category";
    if (
      getExpenseTypes(expenseData.expenseCategory).length > 0 &&
      !expenseData.expenseType
    )
      return "Please select expense type";
    if (expenseData.isVendor && !expenseData.vendorId)
      return "Please select a vendor";
    if (!expenseData.isVendor && !expenseData.expenseGiverName)
      return "Please enter payee name";
    if (!expenseData.amount) return "Please enter amount";
    return null;
  };

  const handleSaveExpense = async () => {
    const sectionError = validateExpenseSection();
    if (sectionError) {
      alert(sectionError);
      return;
    }
    if (expenseData.method !== "cash" && !expenseData.paymentId) {
      alert(
        expenseData.method === "card"
          ? "Please enter card last no."
          : expenseData.method?.toLowerCase() === "bajaj_loan" ||
              expenseData.method?.toLowerCase() === "fibe_loan"
            ? "Please add the reference id"
            : "Please add transaction id",
      );
      return;
    }
    if (
      expenseData.method === "paid_by_other" &&
      (!expenseData.externalParty.name || !expenseData.externalParty.method)
    ) {
      alert("Please enter the sender's name and payment method");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/transactions/expense/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExpensePayload()),
      });
      if (res.ok) {
        alert("Expense transaction created successfully!");
        router.push("/admin/transactions");
      } else {
        const d = await res.json();
        alert(d.error || "Failed to create transaction");
      }
    } catch {
      alert("Failed to save expense transaction");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Create Transaction
                </h1>
                <p className="text-gray-600 mt-1">
                  Create new transaction record
                </p>
              </div>
              <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <div className="flex gap-4 flex-wrap">
                {[
                  { id: "transplant", label: "Transplant", icon: Scissors },
                  { id: "service", label: "Service (PRP/GFC)", icon: Heart },
                  { id: "medicine", label: "Medicine Sale", icon: Pill },
                  { id: "expense", label: "Expense", icon: Receipt },
                  // Contra entries move money between our own accounts — neither revenue nor
                  // expense. Admin-only by design; the API enforces it independently.
                  { id: "contra", label: "Contra Entry", icon: ArrowLeftRight },
                  // Bank movement with no known source. Sits alongside Contra rather than
                  // inside the revenue tabs because, like a transfer, it has no P&L impact —
                  // it reconciles an account balance without booking income.
                  { id: "suspense", label: "Suspense", icon: HelpCircle },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── TRANSPLANT ── */}
            {activeTab === "transplant" && (
              <RevenueSection
                category="TRANSPLANT"
                data={transplantData}
                onChange={setTransplantData}
                picker={patientPicker}
                patientLabel={patientOptions.find((p) => p._id === transplantData.patient)?.personal?.name}
                onSave={handleSaveTransplant}
                saving={loading}
                saveLabel="Save Transaction"
              />
            )}

            {/* ── SERVICE ── */}
            {activeTab === "service" && (
              <RevenueSection
                category="SERVICE"
                data={serviceData}
                onChange={setServiceData}
                picker={patientPicker}
                items={serviceItems}
                onItemsChange={setServiceItems}
                patientLabel={
                  serviceData.isWalkIn
                    ? serviceData.patientName
                    : patientOptions.find((p) => p._id === serviceData.patient)?.personal?.name
                }
                onSave={handleSaveService}
                saving={loading}
                saveLabel="Save Services"
              />
            )}

            {/* ── MEDICINE ── */}
            {activeTab === "medicine" && (
              <RevenueSection
                category="MEDICINE"
                data={medicineData}
                onChange={setMedicineData}
                picker={patientPicker}
                items={medicineItems}
                onItemsChange={setMedicineItems}
                medicines={medicines}
                patientLabel={
                  medicineData.isWalkIn
                    ? medicineData.patientName
                    : patientOptions.find((p) => p._id === medicineData.patient)?.personal?.name
                }
                onSave={handleSaveMedicine}
                saving={loading}
                saveLabel="Save Medicines"
              />
            )}

            {/* ── CONTRA ENTRY ── */}
            {activeTab === "contra" && <ContraEntryForm />}

            {/* ── SUSPENSE ── */}
            {activeTab === "suspense" && <SuspenseEntryForm />}

            {/* ── EXPENSE ── */}
            {activeTab === "expense" && (
              <div className="space-y-6">
                {/* Top-level 4-way switch. Collab is deliberately absent: collab case
                    entry happens only through the collab panel, with admin emergency
                    entry via the modal on /admin/collab-settlement. */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex flex-wrap gap-2">
                  {[
                    { id: "agent", label: "Employees", icon: Users },
                    { id: "patient", label: "Patient", icon: HeartPulse },
                    { id: "rent", label: "Journal Vouncher", icon: Home },
                    { id: "other", label: "Direct Payments", icon: Wallet },
                  ].map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() =>
                        setExpenseData({
                          ...expenseData,
                          expenseSection: section.id,
                          expenseType: "",
                          amount: "",
                          employeeId: "",
                          patientId: "",
                          receiverId: "",
                          receiverName: "",
                          rentSubType: "",
                                              })
                      }
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        expenseData.expenseSection === section.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <section.icon className="w-4 h-4" />
                      {section.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    {/* ===== AGENT TAB ===== */}
                    {expenseData.expenseSection === "agent" && (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex gap-2 mb-4">
                          {["salary", "incentive"].map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() =>
                                setExpenseData({
                                  ...expenseData,
                                  agentSubTab: sub,
                                  expenseType: "",
                                })
                              }
                              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                                expenseData.agentSubTab === sub
                                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                  : "bg-gray-50 text-gray-600 border border-transparent"
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Employee <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={employeeOptions}
                          value={expenseData.employeeId}
                          onChange={(v, obj) => {
                            addToEmployeeCache(obj);
                            setExpenseData((d) => ({
                              ...d,
                              employeeId: v,
                              ...(d.agentSubTab === "salary" &&
                              obj?.salaryStructure?.baseSalary
                                ? { amount: String(obj.salaryStructure.baseSalary) }
                                : d.agentSubTab === "incentive" && obj?.incentiveRate
                                  ? { amount: String(obj.incentiveRate) }
                                  : {}),
                            }));
                          }}
                          placeholder="Search and select an employee..."
                          valueKey="_id"
                          formatOption={formatEmployeeOption}
                          onSearch={handleEmployeeSearch}
                          searching={employeeSearching}
                        />

                        {expenseData.employeeId && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                {expenseData.agentSubTab === "salary" ? "Salary" : "Incentive"}
                              </p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Owed</span>
                                <span className="font-semibold text-gray-900">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalOwed)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Paid</span>
                                <span className="font-semibold text-emerald-700">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPaid)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Pending</span>
                                <span className="font-bold text-rose-600">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPending)}
                                </span>
                              </div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                {expenseData.agentSubTab === "salary" ? "Incentive" : "Salary"}
                              </p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Owed</span>
                                <span className="font-semibold text-gray-900">
                                  {payablesLoading
                                    ? "…"
                                    : formatCurrency(secondaryPayableSummary?.totalOwed)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Paid</span>
                                <span className="font-semibold text-emerald-700">
                                  {payablesLoading
                                    ? "…"
                                    : formatCurrency(secondaryPayableSummary?.totalPaid)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Pending</span>
                                <span className="font-bold text-rose-600">
                                  {payablesLoading
                                    ? "…"
                                    : formatCurrency(secondaryPayableSummary?.totalPending)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {expenseData.agentSubTab === "incentive" && (
                          <>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Incentive Type{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={expenseData.expenseType}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    expenseType: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                <option value="">Select Type</option>
                                {getExpenseTypes("Incentive").map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Related Patient{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <SearchableSelect
                                options={patientOptions}
                                value={expenseData.patientId}
                                onChange={(v, obj) => {
                                  addToPatientCache(obj);
                                  setExpenseData({ ...expenseData, patientId: v });
                                }}
                                placeholder="Search and select a patient..."
                                valueKey="_id"
                                formatOption={formatPatientOption}
                                onSearch={handlePatientSearch}
                                searching={patientSearching}
                              />
                            </div>
                          </>
                        )}

                        {expenseData.agentSubTab === "salary" && (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Salary Month
                              </label>
                              <select
                                value={expenseData.salaryMonth}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    salaryMonth: parseInt(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(
                                  (m) => (
                                    <option key={m} value={m}>
                                      {new Date(2000, m - 1).toLocaleString(
                                        "en",
                                        { month: "long" },
                                      )}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Salary Year
                              </label>
                              <input
                                type="number"
                                value={expenseData.salaryYear}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    salaryYear: parseInt(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={expenseData.amount}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                amount: e.target.value,
                              })
                            }
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0"
                          />
                        </div>
                        {expenseData.agentSubTab === "incentive" && (
                          <p className="text-xs text-gray-500 mt-2">
                            Optional note on what the incentive is for can go
                            in Remarks below.
                          </p>
                        )}
                        {renderPayableActions()}
                      </div>
                    )}

                    {/* ===== PATIENT TAB ===== */}
                    {expenseData.expenseSection === "patient" && (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex gap-2 mb-4">
                          {["commission", "refund", "expense"].map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() =>
                                setExpenseData({
                                  ...expenseData,
                                  patientSubTab: sub,
                                  expenseType: "",
                                })
                              }
                              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                                expenseData.patientSubTab === sub
                                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                  : "bg-gray-50 text-gray-600 border border-transparent"
                              }`}
                            >
                              {sub}
                            </button>
                          ))}
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Patient <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={patientOptions}
                          value={expenseData.patientId}
                          onChange={(v, obj) => {
                            addToPatientCache(obj);
                            setExpenseData({ ...expenseData, patientId: v });
                          }}
                          placeholder="Search and select a patient..."
                          valueKey="_id"
                          formatOption={formatPatientOption}
                          onSearch={handlePatientSearch}
                          searching={patientSearching}
                        />

                        {expenseData.patientSubTab === "commission" && (
                          <>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Commission Type{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={expenseData.expenseType}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    expenseType: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                <option value="">Select Type</option>
                                {getExpenseTypes("Commision").map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Paid To
                              </label>
                              <div className="flex gap-2 mb-2">
                                {["Patient", "Employee", "MANUAL"].map(
                                  (type) => (
                                    <button
                                      key={type}
                                      type="button"
                                      onClick={() =>
                                        setExpenseData({
                                          ...expenseData,
                                          receiverType: type,
                                          receiverId: "",
                                          receiverName: "",
                                        })
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                        expenseData.receiverType === type
                                          ? "bg-indigo-600 text-white"
                                          : "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      {type === "MANUAL" ? "Manual" : type}
                                    </button>
                                  ),
                                )}
                              </div>
                              {expenseData.receiverType === "Patient" && (
                                <SearchableSelect
                                  options={patientOptions}
                                  value={expenseData.receiverId}
                                  onChange={(v, obj) => {
                                    addToPatientCache(obj);
                                    setExpenseData({
                                      ...expenseData,
                                      receiverId: v,
                                    });
                                  }}
                                  placeholder="Search and select a patient..."
                                  valueKey="_id"
                                  formatOption={formatPatientOption}
                                  onSearch={handlePatientSearch}
                                  searching={patientSearching}
                                />
                              )}
                              {expenseData.receiverType === "Employee" && (
                                <SearchableSelect
                                  options={employeeOptions}
                                  value={expenseData.receiverId}
                                  onChange={(v, obj) => {
                                    addToEmployeeCache(obj);
                                    setExpenseData({
                                      ...expenseData,
                                      receiverId: v,
                                    });
                                  }}
                                  placeholder="Search and select an employee..."
                                  valueKey="_id"
                                  formatOption={formatEmployeeOption}
                                  onSearch={handleEmployeeSearch}
                                  searching={employeeSearching}
                                />
                              )}
                              {expenseData.receiverType === "MANUAL" && (
                                <input
                                  type="text"
                                  value={expenseData.receiverName}
                                  onChange={(e) =>
                                    setExpenseData({
                                      ...expenseData,
                                      receiverName: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                  placeholder="Enter payee name"
                                />
                              )}
                            </div>
                          </>
                        )}

                        {expenseData.patientSubTab === "expense" && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Expense Type{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={expenseData.expenseType}
                              onChange={(e) =>
                                setExpenseData({
                                  ...expenseData,
                                  expenseType: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="">Select Type</option>
                              {PATIENT_EXPENSE_SUBTYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {expenseData.patientSubTab === "commission" &&
                          expenseData.receiverId && (
                            <div className="mt-4 bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Owed</span>
                                <span className="font-semibold text-gray-900">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalOwed)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Paid</span>
                                <span className="font-semibold text-emerald-700">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPaid)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Pending</span>
                                <span className="font-bold text-rose-600">
                                  {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPending)}
                                </span>
                              </div>
                            </div>
                          )}

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={expenseData.amount}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                amount: e.target.value,
                              })
                            }
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0"
                          />
                        </div>
                        {expenseData.patientSubTab === "commission" && renderPayableActions()}
                      </div>
                    )}

                    {/* ===== RENT TAB (also covers Electricity Bill) ===== */}
                    {expenseData.expenseSection === "rent" && (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={expenseData.payableCategory}
                          onChange={(e) =>
                            setExpenseData({
                              ...expenseData,
                              payableCategory: e.target.value,
                              rentSubType: "",
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                        >
                          {PAYABLE_EXPENSE_DROPDOWN_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>

                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {expenseData.payableCategory} Sub-type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={expenseData.rentSubType}
                          onChange={(e) =>
                            setExpenseData({
                              ...expenseData,
                              rentSubType: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Select</option>
                          {getExpenseTypes(expenseData.payableCategory).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>

                        {VENDOR_LINKED_PAYABLE_CATEGORIES.includes(expenseData.payableCategory) && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Vendor <span className="text-gray-400 font-normal">(optional — leave blank for the shared bucket)</span>
                            </label>
                            <SearchableSelect
                              options={vendors}
                              value={expenseData.payableVendorId}
                              onChange={(v) => setExpenseData({ ...expenseData, payableVendorId: v })}
                              placeholder="Search a vendor to see their individual bills…"
                              valueKey="_id"
                              formatOption={(v) => `${v.name} - ${v.contact}`}
                            />
                            {expenseData.payableVendorId && (
                              <p className="text-xs text-gray-400 mt-1">
                                Showing only this vendor's own bills under "{expenseData.payableCategory}" — clear the
                                vendor to go back to the shared bucket.
                              </p>
                            )}
                          </div>
                        )}

                        {expenseData.rentSubType && (
                          <div className="mt-4 bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Owed</span>
                              <span className="font-semibold text-gray-900">
                                {payablesLoading ? "…" : formatCurrency(payableSummary?.totalOwed)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Paid</span>
                              <span className="font-semibold text-emerald-700">
                                {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPaid)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Pending</span>
                              <span className="font-bold text-rose-600">
                                {payablesLoading ? "…" : formatCurrency(payableSummary?.totalPending)}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={expenseData.amount}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                amount: e.target.value,
                              })
                            }
                            min="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="0"
                          />
                        </div>
                        {renderPayableActions()}
                      </div>
                    )}

                    {/* ===== OTHER EXPENSE TAB (existing flow) ===== */}
                    {expenseData.expenseSection === "other" && (
                      <>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Vendor Information
                          </h3>
                          <div className="mb-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!expenseData.isVendor}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    isVendor: !e.target.checked,
                                  })
                                }
                                className="rounded border-gray-300 text-indigo-600"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Enter Manually
                              </span>
                            </label>
                          </div>
                          {expenseData.isVendor ? (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Vendor{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <SearchableSelect
                                options={vendors}
                                value={expenseData.vendorId}
                                onChange={(v) =>
                                  setExpenseData({ ...expenseData, vendorId: v })
                                }
                                placeholder="Choose a vendor"
                                valueKey="_id"
                                formatOption={(v) => `${v.name} - ${v.contact}`}
                              />
                            </div>
                          ) : (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payee Name{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={expenseData.expenseGiverName}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    expenseGiverName: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder="Enter payee name"
                              />
                            </div>
                          )}
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Expense Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expense Category{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={expenseData.expenseCategory}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    expenseCategory: e.target.value,
                                    expenseType: "",
                                  })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                <option value="">Select Category</option>
                                {OTHER_EXPENSE_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expense Type{" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={expenseData.expenseType}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    expenseType: e.target.value,
                                  })
                                }
                                disabled={!expenseData.expenseCategory}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                              >
                                <option value="">Select Type</option>
                                {getExpenseTypes(
                                  expenseData.expenseCategory,
                                ).map((type) => (
                                  <option key={type} value={type}>
                                    {type}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Amount (₹){" "}
                                <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                value={expenseData.amount}
                                onChange={(e) =>
                                  setExpenseData({
                                    ...expenseData,
                                    amount: e.target.value,
                                  })
                                }
                                min="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                placeholder={
                                  expenseData.includeGST ? "Base amount (excl. GST)" : "Enter amount"
                                }
                              />
                            </div>
                          </div>

                          {/* Direct Payments are paid in full when logged and create no
                              payables, so GST only — TDS necessarily creates a "Taxes"
                              payable and therefore belongs to the Payable Expenses flow. */}
                          <div className="mt-4">
                            <TaxBreakdownFields
                              tone="plain"
                              allowTDS={false}
                              baseAmount={expenseData.amount}
                              value={expenseData}
                              onChange={(patch) => setExpenseData((d) => ({ ...d, ...patch }))}
                            />
                          </div>

                          {expenseData.expenseCategory === "Taxes" &&
                            expenseData.expenseType && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Owed</span>
                                    <span className="font-semibold text-gray-900">
                                      {payablesLoading
                                        ? "…"
                                        : formatCurrency(payableSummary?.totalOwed)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Paid</span>
                                    <span className="font-semibold text-emerald-700">
                                      {payablesLoading
                                        ? "…"
                                        : formatCurrency(payableSummary?.totalPaid)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Pending</span>
                                    <span className="font-bold text-rose-600">
                                      {payablesLoading
                                        ? "…"
                                        : formatCurrency(payableSummary?.totalPending)}
                                    </span>
                                  </div>
                                </div>
                                {renderPayableActions()}
                              </div>
                            )}
                        </div>
                      </>
                    )}

                    {/* ===== SHARED: Payment / Branch / Date / Remarks ===== */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Transaction Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payment Method
                          </label>
                          <select
                            value={expenseData.method}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                method: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {withLegacyMethod(
                              getMethodOptions("EXPENSE"),
                              expenseData.method,
                            ).map((o) => (
                              <option key={o.value} value={o.value} disabled={o.disabled}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {expenseData.method === "offset_settlement" && (
                            <p className="text-xs text-amber-600 mt-1">
                              No cash movement; settles against an existing balance
                            </p>
                          )}
                        </div>
                        {expenseData.method === "paid_by_other" && (
                          <ExternalPartyFields
                            direction="PAID_BY"
                            value={expenseData.externalParty}
                            onChange={(externalParty) =>
                              setExpenseData((prev) => ({ ...prev, externalParty }))
                            }
                          />
                        )}
                        <BankRoutingFields
                          costType="Expenses"
                          method={expenseData.method}
                          furtherMode={expenseData.furtherMode}
                          onChange={({ furtherMode }) =>
                            setExpenseData((prev) => ({ ...prev, furtherMode }))
                          }
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Transaction ID
                            {getPaymentIdConfig(expenseData.method)
                              .required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={expenseData.paymentId}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                paymentId: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder={
                              getPaymentIdConfig(expenseData.method)
                                .placeholder
                            }
                          />
                        </div>
                        {(
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Branch
                            </label>
                            <select
                              value={expenseData.branch}
                              onChange={(e) =>
                                setExpenseData({
                                  ...expenseData,
                                  branch: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              <option value="Delhi">Delhi</option>
                              <option value="Mumbai">Mumbai</option>
                              <option value="Hyderabad">Hyderabad</option>
                              <option value="Noida">Noida</option>
                              <option value="Patna">Patna</option>
                              <option value="Kolkata">Kolkata</option>
                              <option value="Ahmedabad">Ahmedabad</option>
                              <option value="Jaipur">Jaipur</option>
                              <option value="Bengaluru">Bengaluru</option>
                              <option value="Pune">Pune</option>
                              <option value="Lucknow">Lucknow</option>
                              <option value="Chennai">Chennai</option>
                              <option value="Jammu">Jammu</option>
                              <option value="Kashmir">Kashmir</option>
                              <option value="Ranchi">Ranchi</option>
                              <option value="Prayagraj">Prayagraj</option>
                              <option value="Chandigarh">Chandigarh</option>
                              <option value="Jalandhar">Jalandhar</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date
                          </label>
                          <input
                            type="date"
                            value={expenseData.date}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                date: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Remarks
                          </label>
                          <textarea
                            value={expenseData.remarks}
                            onChange={(e) =>
                              setExpenseData({
                                ...expenseData,
                                remarks: e.target.value,
                              })
                            }
                            rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="Additional notes"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <ReceiptUpload
                            receipts={expenseData.receipts || []}
                            onChange={(receipts) =>
                              setExpenseData((prev) => ({ ...prev, receipts }))
                            }
                            section="expense"
                            patientId={expenseData.patientId || undefined}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Expense Summary
                      </h3>
                      <div className="space-y-3">
                        <div className="border-t border-gray-200 pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">
                              Total Amount:
                            </span>
                            <span className="text-2xl font-bold text-indigo-600">
                              {formatCurrency(expenseData.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {payableAction === "create" ? (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-6">
                          Use the <strong>Save as Owed</strong> button above to record this payable
                          — this button is for direct payments only.
                        </p>
                      ) : (
                        <button
                          onClick={handleSaveExpense}
                          disabled={loading}
                          className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                          {loading ? (
                            "Saving..."
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Save className="w-4 h-4" />
                              {payableAction === "pay" ? "Record Payment" : "Save Expense"}
                            </div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
