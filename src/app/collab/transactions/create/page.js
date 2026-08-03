"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebars/CollabSidebar";
import SearchableSelect from "@/components/SearchableSelect";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import { EXPENSE_CATEGORIES, getExpenseTypes } from "@/constants/expenseCategories";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Scissors,
  Heart,
  Pill,
  Receipt,
} from "lucide-react";

const getPaymentIdConfig = (method) => {
  if (method === "card") return { placeholder: "Please enter card last no.", required: true };
  if (method?.toLowerCase() === "bajaj_loan" || method?.toLowerCase() === "fibe_loan") return { placeholder: "Please add the reference id", required: true };
  if (method === "cash") return { placeholder: "Please add transaction id", required: false };
  if (method === "including-package") return { placeholder: "N/A — included in package", required: false };
  return { placeholder: "Please add transaction id", required: true };
};

// Returns today's date in IST (Asia/Kolkata) as YYYY-MM-DD
const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function AllTransactionsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [activeTab, setActiveTab] = useState("transplant");
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientCache, setPatientCache] = useState({}); // _id → patient obj (persists selected patients across searches)
  const patientDebounceRef = useRef(null);
  const [medicines, setMedicines] = useState([]);
  const [vendors, setVendors] = useState([]);

  // TRANSPLANT DATA
  const [transplantData, setTransplantData] = useState({
    patient: "",
    procedure: "Sapphire FUE",
    paymentType: "Booking",
    amount: "",
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: "",
    remarks: "",
  });

  // SERVICE DATA - Now supports multiple services
  const [serviceData, setServiceData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: "",
    remarks: "",
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

  // MEDICINE DATA - Now supports multiple medicines
  const [medicineData, setMedicineData] = useState({
    patient: "",
    patientName: "",
    patientPhone: "",
    isWalkIn: false,
    discount: 0,
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: "",
    remarks: "",
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

  // EXPENSE DATA
  const [expenseData, setExpenseData] = useState({
    expenseCategory: "",
    expenseType: "",
    isVendor: true,
    vendorId: "",
    expenseGiverName: "",
    amount: "",
    method: "cash",
    paymentId: "",
    date: getTodayIST(),
    branch: "",
    remarks: "",
  });

  // Fetch patients from server (used for both initial load and live search)
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

  // Debounced handler wired to SearchableSelect onSearch
  const handlePatientSearch = (term) => {
    clearTimeout(patientDebounceRef.current);
    patientDebounceRef.current = setTimeout(() => fetchPatients(term), 350);
  };

  // Cache selected patient so it stays visible even when search results change
  const addToPatientCache = (patientObj) => {
    if (patientObj) setPatientCache((prev) => ({ ...prev, [patientObj._id]: patientObj }));
  };

  // Merge cache + current search results (cache entries not in current results come first)
  const patientOptions = useMemo(() => {
    const resultIds = new Set(patients.map((p) => p._id));
    const cached = Object.values(patientCache).filter((p) => !resultIds.has(p._id));
    return [...cached, ...patients];
  }, [patients, patientCache]);

  useEffect(() => {
    fetchData();
  }, []);

  // useSession() resolves asynchronously, so session?.user?.branch is still
  // undefined when the branch fields above are initialized. Sync it in once
  // the session loads, unless the user already picked a branch manually.
  // Collab accounts carry the "Collab" sentinel (not a real city), so it's
  // excluded — the collab receptionist must always pick the specific city.
  const branchTouchedRef = useRef({
    transplant: false,
    service: false,
    medicine: false,
    expense: false,
  });

  useEffect(() => {
    const userBranch = session?.user?.branch;
    if (!userBranch || userBranch === "All" || userBranch === "Collab") return;
    const touched = branchTouchedRef.current;
    if (!touched.transplant) setTransplantData((d) => ({ ...d, branch: userBranch }));
    if (!touched.service) setServiceData((d) => ({ ...d, branch: userBranch }));
    if (!touched.medicine) setMedicineData((d) => ({ ...d, branch: userBranch }));
    if (!touched.expense) setExpenseData((d) => ({ ...d, branch: userBranch }));
  }, [session?.user?.branch]);

  const fetchData = async () => {
    setFetchLoading(true);
    try {
      // Fetch initial patient list
      fetchPatients("");

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
    } finally {
      setFetchLoading(false);
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
      alert(transplantData.method === "card" ? "Please enter card last no." : transplantData.method?.toLowerCase() === "bajaj_loan" || transplantData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id");
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
        }),
      });

      if (res.ok) {
        alert("Transplant transaction saved successfully!");
        router.push("/collab/transactions");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create transaction");
      }
    } catch (error) {
      console.error("Error saving transplant:", error);
      alert("Failed to save transplant transaction");
    } finally {
      setLoading(false);
    }
  };

  // SERVICE HANDLERS (Multiple Items)
  const addServiceItem = () => {
    setServiceItems([
      ...serviceItems,
      {
        id: Date.now(),
        procedure: "PRP",
        quantity: 1,
        perSessionCost: "",
        totalAmount: 0,
      },
    ]);
  };

  const removeServiceItem = (id) => {
    if (serviceItems.length === 1) {
      alert("At least one service is required");
      return;
    }
    setServiceItems(serviceItems.filter((item) => item.id !== id));
  };

  const updateServiceItem = (id, field, value) => {
    setServiceItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "quantity" || field === "perSessionCost") {
            const qty = parseFloat(
              field === "quantity" ? value : updated.quantity,
            );
            const price = parseFloat(
              field === "perSessionCost" ? value : updated.perSessionCost,
            );
            updated.totalAmount =
              !isNaN(qty) && !isNaN(price) ? qty * price : 0;
          }

          return updated;
        }
        return item;
      }),
    );
  };

  const calculateServiceTotal = () => {
    const subtotal = serviceItems.reduce(
      (sum, item) => sum + (parseFloat(item.totalAmount) || 0),
      0,
    );
    return subtotal - serviceData.discount;
  };

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
      alert(serviceData.method === "card" ? "Please enter card last no." : serviceData.method?.toLowerCase() === "bajaj_loan" || serviceData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id");
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
          services: serviceItems.map((item) => ({
            procedure: item.procedure,
            quantity: item.quantity,
            perSessionCost: parseFloat(item.perSessionCost),
            totalAmount: parseFloat(item.totalAmount),
          })),
          discount: serviceData.discount,
          method: serviceData.method,
          paymentId: serviceData.paymentId,
          branch: serviceData.branch,
          date: serviceData.date,
          remarks: serviceData.remarks,
        }),
      });

      if (res.ok) {
        alert("Service transactions saved successfully!");
        router.push("/collab/transactions");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create transactions");
      }
    } catch (error) {
      console.error("Error saving services:", error);
      alert("Failed to save service transactions");
    } finally {
      setLoading(false);
    }
  };

  // MEDICINE HANDLERS (Multiple Items)
  const addMedicineItem = () => {
    setMedicineItems([
      ...medicineItems,
      {
        id: Date.now(),
        medicineId: "",
        medicineName: "",
        quantity: 1,
        perUnitCost: "",
        totalAmount: 0,
      },
    ]);
  };

  const removeMedicineItem = (id) => {
    if (medicineItems.length === 1) {
      alert("At least one medicine is required");
      return;
    }
    setMedicineItems(medicineItems.filter((item) => item.id !== id));
  };

  const updateMedicineItem = (id, field, value) => {
    setMedicineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };

          if (field === "medicineId" && value) {
            const medicine = medicines.find((m) => m._id === value);
            if (medicine) {
              updated.medicineName = medicine.name;
              updated.perUnitCost = medicine.soldAmt || medicine.mrp || "";
            }
          }

          if (field === "quantity" || field === "perUnitCost") {
            const qty = parseFloat(
              field === "quantity" ? value : updated.quantity,
            );
            const price = parseFloat(
              field === "perUnitCost" ? value : updated.perUnitCost,
            );
            updated.totalAmount =
              !isNaN(qty) && !isNaN(price) ? qty * price : 0;
          }

          return updated;
        }
        return item;
      }),
    );
  };

  const calculateMedicineTotal = () => {
    const subtotal = medicineItems.reduce(
      (sum, item) => sum + (parseFloat(item.totalAmount) || 0),
      0,
    );
    return subtotal - medicineData.discount;
  };

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
    if (medicineData.method !== "cash" && medicineData.method !== "including-package" && !medicineData.paymentId) {
      alert(medicineData.method === "card" ? "Please enter card last no." : medicineData.method?.toLowerCase() === "bajaj_loan" || medicineData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id");
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
          medicines: medicineItems.map((item) => ({
            medicineId: item.medicineId,
            quantity: item.quantity,
            perUnitCost: parseFloat(item.perUnitCost),
            totalAmount: parseFloat(item.totalAmount),
          })),
          discount: medicineData.discount,
          method: medicineData.method,
          paymentId: medicineData.paymentId,
          branch: medicineData.branch,
          date: medicineData.date,
          remarks: medicineData.remarks,
        }),
      });

      if (res.ok) {
        alert("Medicine sales saved successfully!");
        router.push("/collab/transactions");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create transactions");
      }
    } catch (error) {
      console.error("Error saving medicines:", error);
      alert("Failed to save medicine sales");
    } finally {
      setLoading(false);
    }
  };

  // EXPENSE HANDLERS
  const calculateExpenseTotal = () => {
    return parseFloat(expenseData.amount) || 0;
  };

  const handleSaveExpense = async () => {
    if (!expenseData.expenseCategory) {
      alert("Please select expense category");
      return;
    }
    if (
      getExpenseTypes(expenseData.expenseCategory).length > 0 &&
      !expenseData.expenseType
    ) {
      alert("Please select expense type");
      return;
    }
    if (expenseData.isVendor && !expenseData.vendorId) {
      alert("Please select a vendor");
      return;
    }
    if (!expenseData.isVendor && !expenseData.expenseGiverName) {
      alert("Please enter payee name");
      return;
    }
    if (!expenseData.amount) {
      alert("Please enter amount");
      return;
    }
    if (expenseData.method !== "cash" && !expenseData.paymentId) {
      alert(expenseData.method === "card" ? "Please enter card last no." : expenseData.method?.toLowerCase() === "bajaj_loan" || expenseData.method?.toLowerCase() === "fibe_loan" ? "Please add the reference id" : "Please add transaction id");
      return;
    }

    setLoading(true);
    try {
      const vendor = vendors.find((v) => v._id === expenseData.vendorId);
      const res = await fetch("/api/transactions/expense/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseCategory: expenseData.expenseCategory,
          expenseType: expenseData.expenseType,
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

      if (res.ok) {
        alert("Expense transaction created successfully!");
        router.push("/collab/transactions");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create transaction");
      }
    } catch (error) {
      console.error("Error saving expense:", error);
      alert("Failed to save expense transaction");
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

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

            <div className="mb-6 border-b border-gray-200">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("transplant")}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "transplant"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4" />
                    Transplant
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("service")}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "service"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Service (PRP/GFC)
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("medicine")}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "medicine"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    Medicine Sale
                  </div>
                </button>
                {/* {session?.user?.role === "admin" && ( */}
                <button
                  onClick={() => setActiveTab("expense")}
                  className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                    activeTab === "expense"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Expense
                  </div>
                </button>
                {/* )} */}
              </div>
            </div>

            {/* TRANSPLANT TAB - Keep existing code */}
            {activeTab === "transplant" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ... existing transplant form ... */}
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
                          onChange={(e) => {
                            branchTouchedRef.current.transplant = true;
                            setTransplantData({
                              ...transplantData,
                              branch: e.target.value,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Choose a branch</option>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date <span className="text-xs text-gray-400">(auto-set to today)</span>
                        </label>
                        <input
                          type="date"
                          value={transplantData.date}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600"
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
                      onClick={handleSaveTransplant}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        "Saving..."
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Save Transaction
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SERVICE TAB - UPDATED WITH MULTIPLE ITEMS */}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                            placeholder="Enter patient name"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                            placeholder="Enter phone number"
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

                  {/* Service Items Table */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Service Items
                      </h3>
                      <button
                        type="button"
                        onClick={addServiceItem}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Plus size={18} />
                        Add Service
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              #
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Service Type
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Quantity
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Per Session Cost
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Total
                            </th>
                            <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {serviceItems.map((item, index) => (
                            <tr
                              key={item.id}
                              className="border-b border-gray-100"
                            >
                              <td className="py-3 px-2 text-sm text-gray-600">
                                {index + 1}
                              </td>
                              <td className="py-3 px-2">
                                <select
                                  value={item.procedure}
                                  onChange={(e) =>
                                    updateServiceItem(
                                      item.id,
                                      "procedure",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                  <option value="PRP">PRP</option>
                                  <option value="GFC">GFC</option>
                                  <option value="Alopecia">ALOPECIA</option>
                                  <option value="Canacot">CANACOT</option>
                                  <option value="Headwash">HEADWASH</option>
                                  <option value="Other">OTHER</option>
                                </select>
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateServiceItem(
                                      item.id,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  min="1"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  value={item.perSessionCost}
                                  onChange={(e) =>
                                    updateServiceItem(
                                      item.id,
                                      "perSessionCost",
                                      e.target.value,
                                    )
                                  }
                                  min="0"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder="₹"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-semibold text-indigo-600">
                                  {formatCurrency(item.totalAmount)}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeServiceItem(item.id)}
                                  disabled={serviceItems.length === 1}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transaction Details */}
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
                          min="0"
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
                          <option value="bajaj_loan">Bajaj Loan</option>
                          <option value="fibe_loan">Fibe Loan</option>
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
                          onChange={(e) => {
                            branchTouchedRef.current.service = true;
                            setServiceData({
                              ...serviceData,
                              branch: e.target.value,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Choose a branch</option>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date <span className="text-xs text-gray-400">(auto-set to today)</span>
                        </label>
                        <input
                          type="date"
                          value={serviceData.date}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600"
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
                          placeholder="Additional notes"
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
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-semibold">
                          {serviceItems.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            serviceItems.reduce(
                              (sum, item) =>
                                sum + (parseFloat(item.totalAmount) || 0),
                              0,
                            ),
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
                      onClick={handleSaveService}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        "Saving..."
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Save Services
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MEDICINE TAB - UPDATED WITH MULTIPLE ITEMS */}
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                            placeholder="Enter customer name"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                            placeholder="Enter phone number"
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

                  {/* Medicine Items Table */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Medicine Items
                      </h3>
                      <button
                        type="button"
                        onClick={addMedicineItem}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Plus size={18} />
                        Add Medicine
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              #
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 min-w-50">
                              Medicine
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Quantity
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Per Unit Cost
                            </th>
                            <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">
                              Total
                            </th>
                            <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {medicineItems.map((item, index) => (
                            <tr
                              key={item.id}
                              className="border-b border-gray-100"
                            >
                              <td className="py-3 px-2 text-sm text-gray-600">
                                {index + 1}
                              </td>
                              <td className="py-3 px-2">
                                <SearchableSelect
                                  options={medicines}
                                  value={item.medicineId}
                                  onChange={(value) =>
                                    updateMedicineItem(
                                      item.id,
                                      "medicineId",
                                      value,
                                    )
                                  }
                                  placeholder="Select medicine"
                                  valueKey="_id"
                                  formatOption={formatMedicineOption}
                                  className="w-full"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateMedicineItem(
                                      item.id,
                                      "quantity",
                                      e.target.value,
                                    )
                                  }
                                  min="1"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <input
                                  type="number"
                                  value={item.perUnitCost}
                                  onChange={(e) =>
                                    updateMedicineItem(
                                      item.id,
                                      "perUnitCost",
                                      e.target.value,
                                    )
                                  }
                                  min="0"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder="₹"
                                />
                              </td>
                              <td className="py-3 px-2">
                                <div className="font-semibold text-indigo-600">
                                  {formatCurrency(item.totalAmount)}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeMedicineItem(item.id)}
                                  disabled={medicineItems.length === 1}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Transaction Details */}
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
                          min="0"
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
                          <option value="bajaj_loan">Bajaj Loan</option>
                          <option value="fibe_loan">Fibe Loan</option>
                          <option value="banking">Bank Transfer</option>
                          <option value="including-package">Including Package</option>
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
                          disabled={medicineData.method === "including-package"}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${medicineData.method === "including-package" ? "bg-gray-50 cursor-not-allowed text-gray-400" : ""}`}
                          placeholder={getPaymentIdConfig(medicineData.method).placeholder}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <select
                          value={medicineData.branch}
                          onChange={(e) => {
                            branchTouchedRef.current.medicine = true;
                            setMedicineData({
                              ...medicineData,
                              branch: e.target.value,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Choose a branch</option>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date <span className="text-xs text-gray-400">(auto-set to today)</span>
                        </label>
                        <input
                          type="date"
                          value={medicineData.date}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600"
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
                          placeholder="Additional notes"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Medicine Summary
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Items:</span>
                        <span className="font-semibold">
                          {medicineItems.length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">
                          {formatCurrency(
                            medicineItems.reduce(
                              (sum, item) =>
                                sum + (parseFloat(item.totalAmount) || 0),
                              0,
                            ),
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
                      onClick={handleSaveMedicine}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        "Saving..."
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Save Medicines
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
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Enter Manually
                        </span>
                      </label>
                    </div>

                    {expenseData.isVendor ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Vendor <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={expenseData.vendorId}
                          onChange={(e) =>
                            setExpenseData({
                              ...expenseData,
                              vendorId: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="">Choose a vendor</option>
                          {vendors.map((vendor) => (
                            <option key={vendor._id} value={vendor._id}>
                              {vendor.name} - {vendor.contact}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payee Name <span className="text-red-500">*</span>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200"
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
                          {EXPENSE_CATEGORIES.map((cat) => (
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
                          {getExpenseTypes(expenseData.expenseCategory).map(
                            (type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
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
                          placeholder="Enter amount"
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
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                          <option value="bajaj_loan">Bajaj Loan</option>
                          <option value="fibe_loan">Fibe Loan</option>
                          <option value="banking">Bank Transfer</option>
                          <option value="hdfc_skin_bank_transfer">HDFC Skin Bank Transfer</option>
                          <option value="hdfc_ryan_medihub_bank_transfer">HDFC Ryan Medihub Bank Transfer</option>
                          <option value="icici_medihub_bank_transfer">ICICI Medihub Bank Transfer</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Transaction ID{getPaymentIdConfig(expenseData.method).required && <span className="text-red-500 ml-1">*</span>}
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
                          placeholder={getPaymentIdConfig(expenseData.method).placeholder}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch
                        </label>
                        <select
                          value={expenseData.branch}
                          onChange={(e) => {
                            branchTouchedRef.current.expense = true;
                            setExpenseData({
                              ...expenseData,
                              branch: e.target.value,
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="">Choose a branch</option>
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date <span className="text-xs text-gray-400">(auto-set to today)</span>
                        </label>
                        <input
                          type="date"
                          value={expenseData.date}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed text-gray-600"
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
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Expense Summary
                    </h3>

                    <div className="space-y-3">
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-900">
                            Total Amount:
                          </span>
                          <span className="text-2xl font-bold text-indigo-600">
                            {formatCurrency(calculateExpenseTotal())}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveExpense}
                      disabled={loading}
                      className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium"
                    >
                      {loading ? (
                        "Saving..."
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Save className="w-4 h-4" />
                          Save Expense
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
