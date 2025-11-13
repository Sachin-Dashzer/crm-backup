"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "@/../public/logo-2.png"
import {
  DollarSign,
  Save,
  Search,
  X,
  User,
  Phone,
  Calendar,
  FileText,
  Printer,
  Download,
  ChevronDown,
} from "lucide-react";
import ReceptionSidebar from "@/components/ReceptionSidebar";
import { useToast } from "@/components/Toast";

export default function CreateBill() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const billRef = useRef();
  const dropdownRef = useRef();

  const [billData, setBillData] = useState({
    costType: "Revenue",
    method: "cash",
    procedure: "hair transplant",
    paymentType: "Booking",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    remarks: "",
    branch: "",
  });

  const CLINIC_BRANCHES = {
    Delhi: {
      name: "RYAN CLINIC",
      address: "CD 163, Block CD, Dakshini Pitampura",
      city: "Pitampura, Delhi, 110034",
      phone: "8828202830",
      website: "https://clinicryan.com/",
      gstin: "07LYSP2547H2ZI",
    },
    Mumbai: {
      name: "RYAN CLINIC",
      address:
        "Office No.1 & 2, 1st floor, Owala Naka, OM SAI PLAZA, w)-400615",
      city: "Kasarvadavali, Thane West, Thane, Mumbai, Maharashtra 400615",
      phone: "8828202830",
      website: "https://clinicryan.com/",
      gstin: "07LYSP2547H2ZI",
    },
    Hyderabad: {
      name: "RYAN CLINIC",
      address:
        "2nd Floor, 8-2, 316/A/6/A, Road No. 14, above SBI bank, beside Asha hospital",
      city: "GS Nagar, Nandi Nagar, Banjara Hills, Hyderabad, Telangana 500034",
      phone: "8828202830",
      website: "https://clinicryan.com/",
      gstin: "07LYSP2547H2ZI",
    },
  };

  const getClinicConfig = (branch) => {
    return CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  };

  useEffect(() => {
    const userBranch = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userBranch="))
      ?.split("=")[1];

    if (userBranch) {
      setBillData((prev) => ({ ...prev, branch: userBranch }));
    }

    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/admin/get-patient");
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
      }
    } catch (e) {
      toast.error("Failed to fetch patients");
      console.error("Error fetching patients:", e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return [];

    return patients
      .filter(
        (p) =>
          p.personal?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.personal?.phone?.includes(searchQuery)
      )
      .slice(0, 10);
  }, [patients, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [searchQuery]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    setShowDropdown(false);
    setBillData((prev) => ({
      ...prev,
      branch: patient.personal?.branch || prev.branch,
    }));
  };

  const handleChange = (field, value) => {
    setBillData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error("Please select a patient");
      return;
    }

    if (!billData.amount || billData.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...billData,
        patient: selectedPatient._id,
        amount: Number(billData.amount),
      };

      const res = await fetch("/api/transactions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Bill created successfully!");
        setCreatedTransaction(data.data);
        setShowPrintPreview(true);
      } else {
        toast.error(data.error || "Failed to create bill");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create bill");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchQuery("");
    setShowPrintPreview(false);
    setCreatedTransaction(null);
    setShowDropdown(false);
    const userBranch = document.cookie
      .split("; ")
      .find((row) => row.startsWith("userBranch="))
      ?.split("=")[1];
    setBillData({
      costType: "Revenue",
      method: "cash",
      procedure: "hair transplant",
      paymentType: "Booking",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      remarks: "",
      branch: userBranch || "",
    });
  };

  const generatePDF = async () => {
    if (!billRef.current) {
      toast.error("Bill preview not available");
      return;
    }

    try {
      const html2pdf = (await import("html2pdf.js")).default;

      const element = billRef.current;
      const invoiceNo =
        createdTransaction?._id?.slice(-6).toUpperCase() || "INV001";

      const opt = {
        margin: [5, 5, 5, 5],
        filename: `invoice-${invoiceNo}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          logging: false,
          letterRendering: true,
          scrollY: 0,
          scrollX: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      html2pdf()
        .set(opt)
        .from(element)
        .save()
        .then(() => {
          toast.success("PDF downloaded successfully!");
        })
        .catch((error) => {
          console.error("Error generating PDF:", error);
          toast.error("Failed to generate PDF");
        });
    } catch (error) {
      console.error("Error loading html2pdf:", error);
      toast.error("Failed to load PDF library");
    }
  };

  const printBill = () => {
    window.print();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const currentClinic = getClinicConfig(billData.branch);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ReceptionSidebar />

      <main className="flex-1 p-4 lg:p-8">
        <div className="mb-6 no-print">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Create Bill</h1>
          </div>
          <p className="text-gray-600 ml-13">
            Generate a new transaction/bill for a patient
          </p>
        </div>

        {!showPrintPreview ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                Select Patient <span className="text-red-500">*</span>
              </label>

              {selectedPatient ? (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {selectedPatient.personal?.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {selectedPatient.personal?.phone}
                          </span>
                          <span className="text-sm text-gray-600">
                            {selectedPatient.personal?.branch}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          Total: {selectedPatient.payments?.totalAmount || 0} ||
                          Received:{" "}
                          {selectedPatient.payments?.amountReceived || 0} ||
                          Pending:{" "}
                          {selectedPatient.payments?.pendingAmount || 0} ||
                          Medicine:{" "}
                          {selectedPatient.payments?.medicineAmount || 0}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedPatient(null)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patient by name or phone..."
                      className="w-full pl-12 pr-4 py-4 text-base border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                    />
                  </div>

                  {showDropdown && filteredPatients.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-80 overflow-y-auto">
                      {filteredPatients.map((patient) => (
                        <div
                          key={patient._id}
                          onClick={() => handleSelectPatient(patient)}
                          className="p-4 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 text-base mb-1">
                                {patient.personal?.name} -{" "}
                                {patient.personal?.phone}
                              </p>
                              <div className="text-sm text-gray-600 space-y-0.5">
                                <p>
                                  Total -: {patient.payments?.totalAmount || 0}
                                  <span className="mx-2">||</span>
                                  Received -:{" "}
                                  {patient.payments?.amountReceived || 0}
                                  <span className="mx-2">||</span>
                                  Pending -:{" "}
                                  {patient.payments?.pendingAmount || 0}
                                  <span className="mx-2">||</span>
                                  Medicine -:{" "}
                                  {patient.payments?.medicineAmount || 0}
                                </p>
                              </div>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showDropdown &&
                    searchQuery &&
                    filteredPatients.length === 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-4">
                        <p className="text-center text-gray-500">
                          No patients found
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Transaction Details
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={billData.method}
                      onChange={(e) => handleChange("method", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="cash">Cash</option>
                      <option value="Gpay">Gpay</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="banking">Net Banking</option>
                      <option value="Loan">Loan</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Procedure <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={billData.procedure}
                      onChange={(e) =>
                        handleChange("procedure", e.target.value)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="TURKEY,S DHI SURGERY">
                        TURKEY,S DHI SURGERY
                      </option>
                      <option value="hair transplant">Hair Transplant</option>
                      <option value="prp">PRP</option>
                      <option value="beard transplant">Beard Transplant</option>
                      <option value="medicine">Medicine</option>
                      <option value="gfc">GFC</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={billData.paymentType}
                      onChange={(e) =>
                        handleChange("paymentType", e.target.value)
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="Booking">Booking</option>
                      <option value="Pending">Pending Payment</option>
                      <option value="Full-payment">Full Payment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={billData.amount}
                      onChange={(e) => handleChange("amount", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={billData.date}
                      onChange={(e) => handleChange("date", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Branch
                    </label>
                    <input
                      type="text"
                      value={billData.branch}
                      readOnly
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remarks
                    </label>
                    <textarea
                      value={billData.remarks}
                      onChange={(e) => handleChange("remarks", e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedPatient}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Creating..." : "Create Bill"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 no-print">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Bill Created Successfully!
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Create New
                  </button>
                  <button
                    onClick={printBill}
                    className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={generatePDF}
                    className="px-6 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={billRef}
              style={{
                background: "white",
                padding: "40px",
                maxWidth: "800px",
                margin: "0 auto",
                fontFamily: "Arial, sans-serif",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "30px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h1
                    style={{
                      fontSize: "32px",
                      fontWeight: "bold",
                      margin: "0 0 10px 0",
                    }}
                  >
                    {currentClinic.name}
                  </h1>
                  <p
                    style={{
                      margin: "3px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    {currentClinic.address}
                  </p>
                  <p
                    style={{
                      margin: "3px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    {currentClinic.city}
                  </p>
                  <p
                    style={{
                      margin: "3px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>Phone:</strong> {currentClinic.phone}
                  </p>
                  <p
                    style={{
                      margin: "3px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>Website:</strong> {currentClinic.website}
                  </p>
                  <p
                    style={{
                      margin: "3px 0",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    <strong>GST No:</strong> {currentClinic.gstin}
                  </p>
                </div>
                <div
                  style={{
                    width: "150px",
                    height: "100px",
                    backgroundColor: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "14px",
                    textAlign: "center",
                    flexShrink: 0,
                    padding: "10px",
                  }}
                >
                  <Image
                    src={Logo}
                    alt="Ryan Clinic Logo"
                    width={450}
                    height={450}
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Patient & Invoice Info */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <p style={{ margin: "5px 0", fontSize: "16px" }}>
                    <strong>{selectedPatient?.personal?.name}</strong>
                  </p>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    {selectedPatient?.personal?.gender || "Male"},
                  </p>
                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    📞 {selectedPatient?.personal?.phone}
                  </p>
                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    📍 {billData.branch}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Date:</strong> {formatDateTime(new Date())}
                  </p>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Invoice No:</strong> #INV
                    {createdTransaction?._id?.slice(-4).toUpperCase() || "0638"}
                  </p>
                </div>
              </div>

              {/* Invoice Title */}
              <h2
                style={{
                  textAlign: "center",
                  fontSize: "24px",
                  fontWeight: "bold",
                  margin: "30px 0 20px",
                }}
              >
                Invoice
              </h2>

              {/* Services Table */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: "20px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderTop: "1px solid #000",
                      borderBottom: "1px solid #000",
                    }}
                  >
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      S<br />
                      No.
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Services & Products
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Consultant
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Qty
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Unit Cost
                      <br />
                      (INR)
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "bold",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Discount
                      <br />
                      (INR)
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "bold",
                      }}
                    >
                      Total
                      <br />
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #000" }}>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      1
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Service {billData.procedure}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      Dr amar deepak
                      <br />
                      shinde
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      1
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      {Number(billData.amount).toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        borderRight: "1px solid #000",
                      }}
                    >
                      0
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        fontSize: "13px",
                        fontWeight: "bold",
                      }}
                    >
                      {Number(billData.amount).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Paid Amounts */}
              <div style={{ marginBottom: "30px" }}>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                  }}
                >
                  Paid Amounts:
                </h3>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        borderTop: "1px solid #000",
                        borderBottom: "1px solid #000",
                      }}
                    >
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          fontSize: "13px",
                          borderRight: "1px solid #000",
                        }}
                      >
                        Date
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "left",
                          fontSize: "13px",
                          borderRight: "1px solid #000",
                        }}
                      >
                        Payment Mode
                      </th>
                      <th
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          fontSize: "13px",
                        }}
                      >
                        Amount Paid (INR)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #000" }}>
                      <td
                        style={{
                          padding: "8px",
                          fontSize: "13px",
                          borderRight: "1px solid #000",
                        }}
                      >
                        {formatDate(billData.date)}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          fontSize: "13px",
                          borderRight: "1px solid #000",
                        }}
                      >
                        {billData.method}
                      </td>
                      <td
                        style={{
                          padding: "8px",
                          textAlign: "right",
                          fontSize: "13px",
                        }}
                      >
                        {Number(billData.amount).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginTop: "40px",
                }}
              >
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "bold" }}>
                    Authorized Signatory
                  </p>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Total:</strong>{" "}
                    {formatCurrency(selectedPatient.payments?.totalAmount)}
                  </p>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Received:</strong>{" "}
                    {formatCurrency(selectedPatient.payments?.amountReceived)}
                  </p>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Pending:</strong>{" "}
                    {formatCurrency(selectedPatient.payments?.pendingAmount)}
                  </p>
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    <strong>Tax :</strong> 0
                  </p>
                  <p
                    style={{
                      margin: "5px 0",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                  >
                    <strong>Amount Paid:</strong>{" "}
                    {formatCurrency(billData.amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #__next,
          main {
            background: white !important;
          }
          div[ref] {
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
          div[ref] * {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
