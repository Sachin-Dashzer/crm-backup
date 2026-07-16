"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebars/Sidebar";
import SearchableSelect from "@/components/SearchableSelect";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import {
  ArrowLeft,
  Save,
  Scissors,
  Heart,
  Pill,
  Receipt,
  Loader2,
  CheckCircle,
} from "lucide-react";

const getPaymentIdConfig = (method) => {
  if (method === "card") return { placeholder: "Please enter card last no.", required: true };
  if (method?.toLowerCase() === "bajaj_loan" || method?.toLowerCase() === "fibe_loan") return { placeholder: "Please add the reference id", required: true };
  if (method === "cash") return { placeholder: "Please add transaction id", required: false };
  return { placeholder: "Please add transaction id", required: true };
};

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id;
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
  const [transaction, setTransaction] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  // TRANSPLANT DATA
  const [transplantData, setTransplantData] = useState({
    patient: "",
    procedure: "Sapphire FUE",
    paymentType: "Booking",
    amount: "",
    discount: 0,
    method: "cash",
    paymentId: "",
    date: new Date().toISOString().split("T")[0],
    branch: session?.user?.branch || "Delhi",
    remarks: "",
  });

  // SERVICE DATA
  const [serviceData, setServiceData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    procedure: "PRP",
    quantity: 1,
    perSessionCost: "",
    discount: 0,
    method: "cash",
    paymentId: "",
    date: new Date().toISOString().split("T")[0],
    branch: session?.user?.branch || "Delhi",
    remarks: "",
  });

  // MEDICINE DATA
  const [medicineData, setMedicineData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    medicineId: "",
    medicineName: "",
    quantity: 1,
    perUnitCost: "",
    discount: 0,
    method: "cash",
    paymentId: "",
    date: new Date().toISOString().split("T")[0],
    branch: session?.user?.branch || "Delhi",
    remarks: "",
  });

  // EXPENSE DATA
  const [expenseData, setExpenseData] = useState({
    expenseCategory: "",
    isVendor: true,
    vendorId: "",
    expenseGiverName: "",
    amount: "",
    method: "cash",
    paymentId: "",
    date: new Date().toISOString().split("T")[0],
    branch: session?.user?.branch || "Delhi",
    remarks: "",
  });

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
    if (patientObj) setPatientCache((prev) => ({ ...prev, [patientObj._id]: patientObj }));
  };

  const patientOptions = useMemo(() => {
    const resultIds = new Set(patients.map((p) => p._id));
    const cached = Object.values(patientCache).filter((p) => !resultIds.has(p._id));
    return [...cached, ...patients];
  }, [patients, patientCache]);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  };

  useEffect(() => {
    if (transactionId) {
      fetchData();
    }
  }, [transactionId]);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Fetch transaction details
      const transRes = await fetch(
        `/api/transactions/get-by-id?id=${transactionId}`
      );
      if (transRes.ok) {
        const data = await transRes.json();

        if (data.success && data.transaction) {
          setTransaction(data.transaction);
          prefillFormData(data.transaction);
        } else {
          showToast("Transaction not found", "error");
          setTimeout(() => router.back(), 2000);
          return;
        }
      } else {
        showToast("Transaction not found", "error");
        setTimeout(() => router.back(), 2000);
        return;
      }

      // Fetch initial patients
      fetchPatients("");

      // Fetch medicines
      try {
        const medicinesRes = await fetch("/api/stocks/get");
        if (medicinesRes.ok) {
          const medicinesData = await medicinesRes.json();
          const stocksArray = medicinesData.data || medicinesData.stocks || [];
          setMedicines(stocksArray);
        }
      } catch (error) {
        console.error("Error fetching medicines:", error);
      }

      // Fetch vendors
      try {
        const vendorsRes = await fetch("/api/vendors/get");
        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData.data || vendorsData.vendors || []);
        }
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    } catch (error) {
      console.error("Error in fetchData:", error);
      showToast("Failed to load transaction data", "error");
    } finally {
      setFetchLoading(false);
    }
  };

  const prefillFormData = (trans) => {
    console.log("Transaction data:", trans); // Debug log

    // Determine transaction category
    let category = trans.transactionCategory;
    
    if (!category) {
      if (trans.costType === "Revenue") {
        if (["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"].includes(trans.procedure)) {
          category = "TRANSPLANT";
        } else if (["PRP", "GFC"].includes(trans.procedure)) {
          category = "SERVICE";
        } else if (trans.procedure === "Medicine" || trans.medicineId) {
          category = "MEDICINE";
        }
      } else if (trans.costType === "Expense" || trans.costType === "Expenses") {
        category = "EXPENSE";
      }
    }

    const formattedDate = trans.date
      ? new Date(trans.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    // Extract patient ID and seed cache so the selected patient stays visible
    const patientId =
      typeof trans.patient === "object" && trans.patient !== null
        ? trans.patient._id
        : trans.patient || "";
    if (typeof trans.patient === "object" && trans.patient !== null && patientId) {
      addToPatientCache(trans.patient);
    }

    console.log("Category:", category); // Debug log
    console.log("Patient ID:", patientId); // Debug log

    switch (category) {
      case "TRANSPLANT":
        setActiveTab("transplant");
        setTransplantData({
          patient: patientId,
          procedure: trans.procedure || "Sapphire FUE",
          paymentType: trans.paymentType || "Booking",
          amount: trans.amount?.toString() || "",
          discount: trans.discount || 0,
          method: trans.method || "cash",
          paymentId: trans.paymentId || "",
          date: formattedDate,
          branch: trans.branch || "Delhi",
          remarks: trans.remarks || "",
        });
        break;

      case "SERVICE":
        setActiveTab("service");
        const isServiceWalkIn = !patientId;

        setServiceData({
          patient: patientId,
          patientName: trans.patientName || "",
          patientPhone: trans.patientPhone || "",
          isWalkIn: isServiceWalkIn,
          procedure: trans.procedure || "PRP",
          quantity: trans.quantity || 1,
          perSessionCost: trans.perSessionCost?.toString() || "",
          discount: trans.discount || 0,
          method: trans.method || "cash",
          paymentId: trans.paymentId || "",
          date: formattedDate,
          branch: trans.branch || "Delhi",
          remarks: trans.remarks || "",
        });

        console.log("Service Data Set:", {
          patient: patientId,
          patientName: trans.patientName,
          patientPhone: trans.patientPhone,
          isWalkIn: isServiceWalkIn,
          procedure: trans.procedure,
          quantity: trans.quantity,
          perSessionCost: trans.perSessionCost,
        }); // Debug log
        break;

      case "MEDICINE":
        setActiveTab("medicine");
        const isMedicineWalkIn = !patientId;

        // Extract medicine ID
        const medicineIdValue =
          typeof trans.medicineId === "object" && trans.medicineId !== null
            ? trans.medicineId._id
            : trans.medicineId || "";

        // Extract medicine name
        const medicineName =
          typeof trans.medicineId === "object" && trans.medicineId !== null
            ? trans.medicineId.name
            : "";

        setMedicineData({
          patient: patientId,
          patientName: trans.patientName || "",
          patientPhone: trans.patientPhone || "",
          isWalkIn: isMedicineWalkIn,
          medicineId: medicineIdValue,
          medicineName: medicineName,
          quantity: trans.quantity || 1,
          perUnitCost: trans.perUnitCost?.toString() || "",
          discount: trans.discount || 0,
          method: trans.method || "cash",
          paymentId: trans.paymentId || "",
          date: formattedDate,
          branch: trans.branch || "Delhi",
          remarks: trans.remarks || "",
        });

        console.log("Medicine Data Set:", {
          patient: patientId,
          patientName: trans.patientName,
          patientPhone: trans.patientPhone,
          isWalkIn: isMedicineWalkIn,
          medicineId: medicineIdValue,
          medicineName: medicineName,
          quantity: trans.quantity,
          perUnitCost: trans.perUnitCost,
        }); // Debug log
        break;

      case "EXPENSE":
        setActiveTab("expense");
        const isVendor = trans.expenseGiver?.type === "VENDOR";

        const vendorIdValue =
          typeof trans.expenseGiver?.vendorId === "object" &&
          trans.expenseGiver?.vendorId !== null
            ? trans.expenseGiver.vendorId._id
            : trans.expenseGiver?.vendorId || "";

        setExpenseData({
          expenseCategory: trans.expense || trans.expenseCategory || "",
          isVendor: isVendor,
          vendorId: vendorIdValue,
          expenseGiverName: !isVendor ? trans.expenseGiver?.name || "" : "",
          amount: trans.amount?.toString() || "",
          method: trans.method || "cash",
          paymentId: trans.paymentId || "",
          date: formattedDate,
          branch: trans.branch || "Delhi",
          remarks: trans.remarks || "",
        });
        break;

      default:
        console.warn("Could not determine transaction category", trans);
        setActiveTab("transplant");
        break;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatPatientOption = (patient) => {
    return `${patient.personal?.name || "N/A"} - ${maskPhone(patient.personal?.phone, session?.user?.role) || "N/A"} | Package: ${formatCurrency(patient?.payments?.totalAmount)} | Received: ${formatCurrency(patient?.payments?.amountReceived)} | Pending: ${formatCurrency(patient?.payments?.pendingAmount)}`;
  };

  const formatMedicineOption = (medicine) => {
    return `${medicine.name} (Stock: ${medicine.totalQuantity}) - MRP: ${formatCurrency(medicine.mrp)}`;
  };

  const formatVendorOption = (vendor) => {
    return `${vendor.name} - ${vendor.contact || vendor.email || "No contact"}`;
  };

  // TRANSPLANT HANDLERS
  const calculateTransplantTotal = () => {
    const amount = parseFloat(transplantData.amount) || 0;
    return amount - transplantData.discount;
  };

  const handleUpdateTransplant = async () => {
    if (!transplantData.patient) {
      showToast("Please select a patient", "error");
      return;
    }
    if (!transplantData.amount) {
      showToast("Please enter amount", "error");
      return;
    }
    if (transplantData.method !== "cash" && !transplantData.paymentId) {
      showToast(transplantData.method === "card" ? "Please enter card last no." : transplantData.method?.toLowerCase() === "bajaj_loan" || transplantData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/transplant/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId,
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
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Transplant transaction updated successfully!", "success");
        setTimeout(() => router.back(), 1500);
      } else {
        showToast(data.error || "Failed to update transaction", "error");
      }
    } catch (error) {
      console.error("Error updating transplant:", error);
      showToast("Failed to update transplant transaction", "error");
    } finally {
      setLoading(false);
    }
  };

  // SERVICE HANDLERS
  const calculateServiceTotal = () => {
    const subtotal =
      serviceData.quantity * (parseFloat(serviceData.perSessionCost) || 0);
    return subtotal - serviceData.discount;
  };

  const handleUpdateService = async () => {
    if (!serviceData.isWalkIn && !serviceData.patient) {
      showToast("Please select a patient", "error");
      return;
    }
    if (
      serviceData.isWalkIn &&
      (!serviceData.patientName || !serviceData.patientPhone)
    ) {
      showToast("Please enter patient name and phone", "error");
      return;
    }
    if (!serviceData.perSessionCost) {
      showToast("Please enter per session cost", "error");
      return;
    }
    if (serviceData.method !== "cash" && !serviceData.paymentId) {
      showToast(serviceData.method === "card" ? "Please enter card last no." : serviceData.method?.toLowerCase() === "bajaj_loan" || serviceData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/service/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId,
          patientId: serviceData.isWalkIn ? null : serviceData.patient,
          patientName: serviceData.patientName,
          patientPhone: serviceData.patientPhone,
          procedure: serviceData.procedure,
          quantity: serviceData.quantity,
          perSessionCost: serviceData.perSessionCost,
          discount: serviceData.discount,
          method: serviceData.method,
          paymentId: serviceData.paymentId,
          branch: serviceData.branch,
          date: serviceData.date,
          remarks: serviceData.remarks,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Service transaction updated successfully!", "success");
        setTimeout(() => router.back(), 1500);
      } else {
        showToast(data.error || "Failed to update transaction", "error");
      }
    } catch (error) {
      console.error("Error updating service:", error);
      showToast("Failed to update service transaction", "error");
    } finally {
      setLoading(false);
    }
  };

  // MEDICINE HANDLERS
  const handleMedicineSelect = (medicineId) => {
    const medicine = medicines.find((m) => m._id === medicineId);
    if (medicine) {
      setMedicineData({
        ...medicineData,
        medicineId,
        medicineName: medicine.name,
        perUnitCost: medicine.soldAmt || medicine.mrp || "",
      });
    }
  };

  const calculateMedicineTotal = () => {
    const subtotal =
      medicineData.quantity * (parseFloat(medicineData.perUnitCost) || 0);
    return subtotal - medicineData.discount;
  };

  const handleUpdateMedicine = async () => {
    if (!medicineData.medicineId) {
      showToast("Please select a medicine", "error");
      return;
    }
    if (!medicineData.isWalkIn && !medicineData.patient) {
      showToast("Please select a patient", "error");
      return;
    }
    if (
      medicineData.isWalkIn &&
      (!medicineData.patientName || !medicineData.patientPhone)
    ) {
      showToast("Please enter customer name and phone", "error");
      return;
    }
    if (medicineData.method !== "cash" && !medicineData.paymentId) {
      showToast(medicineData.method === "card" ? "Please enter card last no." : medicineData.method?.toLowerCase() === "bajaj_loan" || medicineData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/medicine/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId,
          patientId: medicineData.isWalkIn ? null : medicineData.patient,
          patientName: medicineData.patientName,
          patientPhone: medicineData.patientPhone,
          medicineId: medicineData.medicineId,
          quantity: medicineData.quantity,
          perUnitCost: medicineData.perUnitCost,
          discount: medicineData.discount,
          method: medicineData.method,
          paymentId: medicineData.paymentId,
          branch: medicineData.branch,
          date: medicineData.date,
          remarks: medicineData.remarks,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Medicine sale updated successfully!", "success");
        setTimeout(() => router.back(), 1500);
      } else {
        showToast(data.error || "Failed to update transaction", "error");
      }
    } catch (error) {
      console.error("Error updating medicine:", error);
      showToast("Failed to update medicine sale", "error");
    } finally {
      setLoading(false);
    }
  };

  // EXPENSE HANDLERS
  const calculateExpenseTotal = () => {
    return parseFloat(expenseData.amount) || 0;
  };

  const handleUpdateExpense = async () => {
    if (!expenseData.expenseCategory) {
      showToast("Please select expense category", "error");
      return;
    }
    if (expenseData.isVendor && !expenseData.vendorId) {
      showToast("Please select a vendor", "error");
      return;
    }
    if (!expenseData.isVendor && !expenseData.expenseGiverName) {
      showToast("Please enter payee name", "error");
      return;
    }
    if (!expenseData.amount) {
      showToast("Please enter amount", "error");
      return;
    }
    if (expenseData.method !== "cash" && !expenseData.paymentId) {
      showToast(expenseData.method === "card" ? "Please enter card last no." : expenseData.method?.toLowerCase() === "bajaj_loan" || expenseData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id", "error");
      return;
    }

    setLoading(true);
    try {
      const vendor = vendors.find((v) => v._id === expenseData.vendorId);
      const res = await fetch("/api/transactions/expense/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId,
          expenseCategory: expenseData.expenseCategory,
          expenseGiver: {
            type: expenseData.isVendor ? "VENDOR" : "MANUAL",
            vendorId: expenseData.isVendor ? expenseData.vendorId : "",
            name: expenseData.isVendor
              ? vendor?.name
              : expenseData.expenseGiverName,
          },
          amount: expenseData.amount,
          method: expenseData.method,
          paymentId: expenseData.paymentId,
          branch: expenseData.branch,
          date: expenseData.date,
          remarks: expenseData.remarks,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Expense transaction updated successfully!", "success");
        setTimeout(() => router.back(), 1500);
      } else {
        showToast(data.error || "Failed to update transaction", "error");
      }
    } catch (error) {
      console.error("Error updating expense:", error);
      showToast("Failed to update expense transaction", "error");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading transaction data...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Transaction not found</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div
            className={`px-6 py-4 rounded-xl shadow-lg border-2 flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="w-5 h-5" />}
            {toast.type === "error" && (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Edit Transaction
                </h1>
                <p className="text-gray-600 mt-1">
                  Update transaction details
                  {transaction?.batchId && (
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                      Batch: {transaction.batchId.slice(-8)}
                    </span>
                  )}
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
              <div className="flex gap-4">
                <button
                  disabled={true}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "transplant"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Transplant
                  </div>
                </button>
                <button
                  disabled={true}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "service"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Service (PRP/GFC)
                  </div>
                </button>
                <button
                  disabled={true}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "medicine"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Medicine Sale
                  </div>
                </button>
                <button
                  disabled={true}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "expense"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Expense
                  </div>
                </button>
              </div>
            </div>

            {/* DEBUG INFO - Remove after testing */}
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-mono">
                <strong>Debug:</strong> Active Tab: {activeTab} | Transaction Category: {transaction?.transactionCategory} | 
                Service Data: Qty={serviceData.quantity}, Cost={serviceData.perSessionCost}, Procedure={serviceData.procedure} |
                Medicine Data: MedID={medicineData.medicineId}, Qty={medicineData.quantity}, Cost={medicineData.perUnitCost}
              </p>
            </div>

            {/* TRANSPLANT TAB */}
            {activeTab === "transplant" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ... Transplant form - keeping existing code ... */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Patient Information
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Patient <span className="text-red-500">*</span>
                      </label>
                      <SearchableSelect
                        options={patientOptions}
                        value={transplantData.patient}
                        onChange={(value, obj) => {
                          addToPatientCache(obj);
                          setTransplantData({ ...transplantData, patient: value });
                        }}
                        placeholder="Search and select a patient..."
                        valueKey="_id"
                        formatOption={formatPatientOption}
                        onSearch={handlePatientSearch}
                        searching={patientSearching}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Procedure Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Procedure <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={transplantData.procedure}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              procedure: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Sapphire FUE">Sapphire FUE</option>
                          <option value="DHI">DHI</option>
                          <option value="Turkish DHI">Turkish DHI</option>
                          <option value="Beard Transplant">
                            Beard Transplant
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={transplantData.paymentType}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              paymentType: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Booking">Booking</option>
                          <option value="Pending">Pending</option>
                          <option value="Full-payment">Full Payment</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={transplantData.amount}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              amount: e.target.value,
                            })
                          }
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Enter amount"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          value={transplantData.discount}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              discount: Number(e.target.value),
                            })
                          }
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method
                        </label>
                        <select
                          value={transplantData.method}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              method: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                          <option value="bajaj_loan">Bajaj Loan</option>
                          <option value="fibe_loan">Fibe Loan</option>
                          <option value="banking">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID{getPaymentIdConfig(transplantData.method).required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={transplantData.paymentId}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              paymentId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder={getPaymentIdConfig(transplantData.method).placeholder}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <select
                          value={transplantData.branch}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              branch: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Delhi">Delhi</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Hyderabad">Hyderabad</option>
                          <option value="Noida">Noida</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={transplantData.date}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
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
                          value={transplantData.remarks}
                          onChange={(e) =>
                            setTransplantData({
                              ...transplantData,
                              remarks: e.target.value,
                            })
                          }
                          rows="2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Additional notes"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Summary
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Amount:</span>
                        <span className="font-semibold">
                          {formatCurrency(transplantData.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(transplantData.discount)}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Amount:
                          </span>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(calculateTransplantTotal())}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleUpdateTransplant}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Update Transaction
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SERVICE TAB */}
            {activeTab === "service" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Patient Information
                    </h3>

                    <div className="mb-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={serviceData.isWalkIn}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              isWalkIn: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Walk-in Patient
                        </span>
                      </label>
                    </div>

                    {serviceData.isWalkIn ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Patient Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={serviceData.patientName}
                            onChange={(e) =>
                              setServiceData({
                                ...serviceData,
                                patientName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={serviceData.patientPhone}
                            onChange={(e) =>
                              setServiceData({
                                ...serviceData,
                                patientPhone: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Patient <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={patientOptions}
                          value={serviceData.patient}
                          onChange={(value, obj) => {
                            addToPatientCache(obj);
                            setServiceData({ ...serviceData, patient: value });
                          }}
                          placeholder="Search and select a patient..."
                          valueKey="_id"
                          formatOption={formatPatientOption}
                          onSearch={handlePatientSearch}
                          searching={patientSearching}
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Service Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Service Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={serviceData.procedure}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              procedure: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="PRP">PRP</option>
                          <option value="GFC">GFC</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity (Sessions)
                        </label>
                        <input
                          type="number"
                          value={serviceData.quantity}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              quantity: Number(e.target.value),
                            })
                          }
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Per Session Cost (₹)
                        </label>
                        <input
                          type="number"
                          value={serviceData.perSessionCost}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              perSessionCost: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          value={serviceData.discount}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              discount: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method
                        </label>
                        <select
                          value={serviceData.method}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              method: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                          <option value="banking">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID{getPaymentIdConfig(serviceData.method).required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={serviceData.paymentId}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              paymentId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder={getPaymentIdConfig(serviceData.method).placeholder}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <select
                          value={serviceData.branch}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              branch: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Delhi">Delhi</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Hyderabad">Hyderabad</option>
                          <option value="Noida">Noida</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={serviceData.date}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
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
                          value={serviceData.remarks}
                          onChange={(e) =>
                            setServiceData({
                              ...serviceData,
                              remarks: e.target.value,
                            })
                          }
                          rows="2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Service Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            serviceData.quantity *
                              (parseFloat(serviceData.perSessionCost) || 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(serviceData.discount)}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Amount:
                          </span>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(calculateServiceTotal())}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdateService}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Update Service
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MEDICINE TAB */}
            {activeTab === "medicine" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Customer Information
                    </h3>

                    <div className="mb-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={medicineData.isWalkIn}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              isWalkIn: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Walk-in Customer
                        </span>
                      </label>
                    </div>

                    {medicineData.isWalkIn ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer Name{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={medicineData.patientName}
                            onChange={(e) =>
                              setMedicineData({
                                ...medicineData,
                                patientName: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={medicineData.patientPhone}
                            onChange={(e) =>
                              setMedicineData({
                                ...medicineData,
                                patientPhone: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Patient <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={patientOptions}
                          value={medicineData.patient}
                          onChange={(value, obj) => {
                            addToPatientCache(obj);
                            setMedicineData({ ...medicineData, patient: value });
                          }}
                          placeholder="Search and select a patient..."
                          valueKey="_id"
                          formatOption={formatPatientOption}
                          onSearch={handlePatientSearch}
                          searching={patientSearching}
                        />
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Medicine Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Medicine <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                          options={medicines}
                          value={medicineData.medicineId}
                          onChange={handleMedicineSelect}
                          placeholder="Search and select medicine..."
                          valueKey="_id"
                          formatOption={formatMedicineOption}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={medicineData.quantity}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              quantity: Number(e.target.value),
                            })
                          }
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Per Unit Cost (₹)
                        </label>
                        <input
                          type="number"
                          value={medicineData.perUnitCost}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              perUnitCost: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discount (₹)
                        </label>
                        <input
                          type="number"
                          value={medicineData.discount}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              discount: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method
                        </label>
                        <select
                          value={medicineData.method}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              method: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                          <option value="banking">Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID{getPaymentIdConfig(medicineData.method).required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={medicineData.paymentId}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              paymentId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder={getPaymentIdConfig(medicineData.method).placeholder}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <select
                          value={medicineData.branch}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              branch: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="Delhi">Delhi</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Hyderabad">Hyderabad</option>
                          <option value="Noida">Noida</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date
                        </label>
                        <input
                          type="date"
                          value={medicineData.date}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
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
                          value={medicineData.remarks}
                          onChange={(e) =>
                            setMedicineData({
                              ...medicineData,
                              remarks: e.target.value,
                            })
                          }
                          rows="2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Medicine Sale Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            medicineData.quantity *
                              (parseFloat(medicineData.perUnitCost) || 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-semibold text-red-600">
                          -{formatCurrency(medicineData.discount)}
                        </span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Amount:
                          </span>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(calculateMedicineTotal())}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdateMedicine}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Update Medicine Sale
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EXPENSE TAB */}
            {activeTab === "expense" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">

                  {/* Expense Category & Payee */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expense Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={expenseData.expenseCategory}
                          onChange={(e) => setExpenseData({ ...expenseData, expenseCategory: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        >
                          <option value="">Select category…</option>
                          <option>Salary</option>
                          <option>Rent</option>
                          <option>Utilities</option>
                          <option>Marketing</option>
                          <option>Equipment</option>
                          <option>Medical Supplies</option>
                          <option>Transportation</option>
                          <option>Maintenance</option>
                          <option>Other</option>
                        </select>
                      </div>

                      {/* Payee type toggle */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payee Type</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setExpenseData({ ...expenseData, isVendor: true, expenseGiverName: "" })}
                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                              expenseData.isVendor
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            Vendor
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpenseData({ ...expenseData, isVendor: false, vendorId: "" })}
                            className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                              !expenseData.isVendor
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            Manual / Individual
                          </button>
                        </div>
                      </div>

                      {/* Vendor selector or manual name */}
                      {expenseData.isVendor ? (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Vendor <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={expenseData.vendorId}
                            onChange={(e) => setExpenseData({ ...expenseData, vendorId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                          >
                            <option value="">Select a vendor…</option>
                            {vendors.map((v) => (
                              <option key={v._id} value={v._id}>{v.name}</option>
                            ))}
                          </select>
                          {vendors.length === 0 && (
                            <p className="text-xs text-gray-400 mt-1">No vendors found. Add vendors from the Vendors section.</p>
                          )}
                        </div>
                      ) : (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Payee Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={expenseData.expenseGiverName}
                            onChange={(e) => setExpenseData({ ...expenseData, expenseGiverName: e.target.value })}
                            placeholder="Enter payee name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount (₹) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={expenseData.amount}
                          onChange={(e) => setExpenseData({ ...expenseData, amount: e.target.value })}
                          min="0"
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                        <select
                          value={expenseData.method}
                          onChange={(e) => setExpenseData({ ...expenseData, method: e.target.value, paymentId: "" })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="card">Card</option>
                          <option value="banking">Bank Transfer</option>
                          <option value="bajaj_loan">Bajaj Loan</option>
                          <option value="fibe_loan">Fibe Loan</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID
                          {getPaymentIdConfig(expenseData.method).required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={expenseData.paymentId}
                          onChange={(e) => setExpenseData({ ...expenseData, paymentId: e.target.value })}
                          placeholder={getPaymentIdConfig(expenseData.method).placeholder}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                        <select
                          value={expenseData.branch}
                          onChange={(e) => setExpenseData({ ...expenseData, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        >
                          <option value="Delhi">Delhi</option>
                          <option value="Mumbai">Mumbai</option>
                          <option value="Hyderabad">Hyderabad</option>
                          <option value="Noida">Noida</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                        <input
                          type="date"
                          value={expenseData.date}
                          onChange={(e) => setExpenseData({ ...expenseData, date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                        <textarea
                          value={expenseData.remarks}
                          onChange={(e) => setExpenseData({ ...expenseData, remarks: e.target.value })}
                          rows="2"
                          placeholder="Optional notes…"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary sidebar */}
                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Category:</span>
                        <span className="font-semibold text-gray-900">{expenseData.expenseCategory || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Payee:</span>
                        <span className="font-semibold text-gray-900 text-right max-w-37.5 truncate">
                          {expenseData.isVendor
                            ? (vendors.find((v) => v._id === expenseData.vendorId)?.name || "—")
                            : (expenseData.expenseGiverName || "—")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Method:</span>
                        <span className="font-semibold text-gray-900 capitalize">{expenseData.method || "—"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Branch:</span>
                        <span className="font-semibold text-gray-900">{expenseData.branch || "—"}</span>
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">Total:</span>
                          <span className="text-2xl font-bold text-red-600">
                            {formatCurrency(calculateExpenseTotal())}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleUpdateExpense}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating…
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Update Expense
                        </div>
                      )}
                    </button>
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