"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "@/../public/logo-2.png";
import Logo2 from "@/../public/logo.png";
import {
  Search,
  User,
  Phone,
  Printer,
  Download,
  ArrowLeft,
  FileText,
  MapPin,
  Calendar,
  CreditCard,
  Receipt,
  IndianRupee,
  Clock,
  Tag,
} from "lucide-react";
import Sidebar from "@/components/Sidebars/Sidebar";
import { useToast } from "@/components/Toast";

export default function ViewBills() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientTransactions, setPatientTransactions] = useState([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const billRef = useRef();

  const CLINIC_BRANCHES = {
    Delhi: {
      img: Logo,
      name: "RYAN CLINIC",
      address: "CD 163, Block CD, Dakshini Pitampura",
      city: "Pitampura, Delhi, 110034",
      phone: "8828202830",
      website: "https://clinicryan.com",
      gstin: "07LYSP2547H2ZI",
    },
    Mumbai: {
      img: Logo2,
      name: "LA DOLCE HAIRTRANSPLANT CLINIC",
      address:
        "Bunglow No 168,S.V.P Nagar,Four Bunglow, Mhada, Andheri West, Mumbai 400053",
      phone: "8828202830",
      website: "https://clinicryan.com",
      gstin: "27ATAS4922Q1Z2",
    },
    Hyderabad: {
      img: Logo,
      name: "RYAN CLINIC",
      address:
        "2nd Floor, 8-2, 316/A/6/A, Road No. 14, above SBI bank, beside Asha hospital",
      city: "GS Nagar, Nandi Nagar, Banjara Hills, Hyderabad, Telangana 500034",
      phone: "8828202830",
      website: "https://clinicryan.com",
      gstin: "07LYSP2547H2ZI",
    },
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch("/api/patients/get-patient");
      const data = await res.json();
      if (data.success) {
        setPatients(data.patients || []);
      }
    } catch (e) {
      toast.error("Failed to fetch patients");
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchPatientTransactions = async (patientId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reception/bill?patientId=${patientId}`);
      const data = await res.json();

      if (data.success) {
        setPatientTransactions(data.transactions || []);
      } else {
        toast.error("Failed to fetch transactions");
        setPatientTransactions([]);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
      setPatientTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (patient) => {
    setSelectedPatient(patient);
    setSearchQuery("");
    await fetchPatientTransactions(patient._id);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchQuery("");
    setShowPrintPreview(false);
    setPatientTransactions([]);
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
        selectedPatient?._id?.slice(-5).toUpperCase() || "29537B";

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `invoice-${invoiceNo}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      html2pdf().set(opt).from(element).save();
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
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

  // Total amount paid (sum of all transaction amounts)
  const totalPaid = patientTransactions.reduce(
    (sum, transaction) => sum + (parseFloat(transaction.amount) || 0),
    0
  );

  // Discount is on total package amount (from patient data)
  const totalDiscount = selectedPatient?.payments?.discount || 0;

  // Total package amount
  const totalAmount = selectedPatient?.payments?.totalAmount || 0;

  // Pending = (Total - Discount) - Amount Received
  const totalPending = selectedPatient?.payments?.pendingAmount || 0;

  const currentClinic = getClinicConfig(
    selectedPatient?.personal?.branch || "Delhi"
  );

  function getClinicConfig(branch) {
    return CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  }

  const getCounsellorName = () => {
    const counsellor = selectedPatient?.counselling?.counsellor;

    if (counsellor && typeof counsellor === "object" && counsellor.name) {
      return counsellor.name;
    }

    if (typeof counsellor === "string") {
      return counsellor;
    }

    const counsellorName = selectedPatient?.counselling?.counsellorName;
    if (
      counsellorName &&
      typeof counsellorName === "object" &&
      counsellorName.name
    ) {
      return counsellorName.name;
    }
    if (typeof counsellorName === "string") {
      return counsellorName;
    }

    const assignedDoctor = selectedPatient?.assignedDoctor;
    if (
      assignedDoctor &&
      typeof assignedDoctor === "object" &&
      assignedDoctor.name
    ) {
      return assignedDoctor.name;
    }
    if (typeof assignedDoctor === "string") {
      return assignedDoctor;
    }

    return "Dr. Ryan";
  };

  const filteredPatients = searchQuery
    ? patients.filter(
        (p) =>
          p.personal?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.personal?.phone?.includes(searchQuery)
      )
    : [];

  const recentPatients = patients
    .filter((p) => p.payments?.pendingAmount > 0)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6);

  return (
    <div className="flex min-h-screen bg-linear-to-br from-gray-50 to-gray-100">
      <Sidebar />

      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-4 no-print">
          <div className="flex items-center gap-4 mb-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Patient Bills & Invoices
              </h1>
              <p className="text-gray-600 mt-1">
                View, print, and download patient transaction history
              </p>
            </div>
          </div>
        </div>

        {initialLoading ? (
          <div className="flex items-center justify-center min-h-125">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium text-lg">
                Loading patients...
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Please wait while we fetch the data
              </p>
            </div>
          </div>
        ) : (
          <>
            {!showPrintPreview ? (
              <div className="space-y-6">
                {/* Patient Search */}
                <div className="">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by patient name or phone number..."
                      className="w-full bg-white pl-12 pr-4 py-4 text-md border-2 border-gray-200 rounded-xl transition-all"
                    />
                  </div>

                  {/* Patients Dropdown List */}
                  {searchQuery && filteredPatients.length > 0 && (
                    <div className="mt-4 max-h-80 overflow-y-auto border-2 border-gray-200 rounded-xl shadow-lg">
                      {filteredPatients.slice(0, 10).map((patient, index) => (
                        <div
                          key={patient._id}
                          onClick={() => handleSelectPatient(patient)}
                          className={`p-5 hover:bg-blue-50 cursor-pointer transition-colors ${
                            index !== filteredPatients.length - 1
                              ? "border-b border-gray-200"
                              : ""
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-lg text-gray-900">
                                  {patient.personal?.name}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {patient.personal?.phone}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {patient.personal?.branch}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2 justify-end mb-2">
                                <IndianRupee className="w-4 h-4 text-gray-500" />
                                <span className="text-lg font-bold text-gray-900">
                                  {formatCurrency(
                                    patient.payments?.totalAmount || 0
                                  )}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {(patient.payments?.discount || 0) > 0 && (
                                  <div className=" items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-1 block">
                                    <Tag className="w-3 h-3" />
                                    <span>
                                      Discount:{" "}
                                      {formatCurrency(
                                        patient.payments?.discount || 0
                                      )}
                                    </span>
                                  </div>
                                )}
                                <div className=" items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium block">
                                  <span>
                                    Pending:{" "}
                                    {formatCurrency(
                                      patient.payments?.pendingAmount || 0
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {searchQuery && filteredPatients.length === 0 && (
                    <div className="mt-4 p-8 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                      <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">
                        No patients found matching "{searchQuery}"
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Try searching with a different name or phone number
                      </p>
                    </div>
                  )}

                  {/* Recent Patients Dashboard */}
                  {!searchQuery &&
                    !selectedPatient &&
                    recentPatients.length > 0 && (
                      <div className="mt-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {recentPatients.map((patient) => (
                            <div
                              key={patient._id}
                              onClick={() => handleSelectPatient(patient)}
                              className="p-5 bg-linear-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-100 rounded-lg">
                                    <User className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">
                                      {patient.personal?.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {patient.personal?.phone}
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                                  {patient.personal?.branch}
                                </span>
                              </div>
                              <div className="space-y-2 pt-3 border-t border-gray-200">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs text-gray-600">
                                    Total Amount
                                  </p>
                                  <p className="text-lg font-bold text-gray-900">
                                    {formatCurrency(
                                      patient.payments?.totalAmount || 0
                                    )}
                                  </p>
                                </div>
                                {(patient.payments?.discount || 0) > 0 && (
                                  <div className="flex justify-between items-center">
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                      <Tag className="w-3 h-3" />
                                      Discount
                                    </p>
                                    <p className="text-sm font-bold text-amber-600">
                                      -
                                      {formatCurrency(
                                        patient.payments?.discount || 0
                                      )}
                                    </p>
                                  </div>
                                )}
                                <div className="flex justify-between items-center">
                                  <p className="text-xs text-red-600">
                                    Pending
                                  </p>
                                  <p className="text-lg font-bold text-red-600">
                                    {formatCurrency(
                                      patient.payments?.pendingAmount || 0
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {!searchQuery &&
                    !selectedPatient &&
                    recentPatients.length === 0 &&
                    patients.length > 0 && (
                      <div className="mt-6 p-8 text-center bg-linear-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                        <div className="p-4 bg-green-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                          <Receipt className="w-10 h-10 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          All Payments Clear! 🎉
                        </h3>
                        <p className="text-gray-600">
                          No patients with pending payments at the moment
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Search for a patient above to view their billing
                          history
                        </p>
                      </div>
                    )}

                  {/* Selected Patient Info Card */}
                  {selectedPatient && (
                    <div className="mt-6 p-6 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-blue-600 rounded-xl">
                            <User className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                              {selectedPatient.personal?.name}
                            </h3>
                            <div className="space-y-1 text-sm text-gray-700">
                              <p className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span className="font-medium">
                                  {selectedPatient.personal?.phone}
                                </span>
                              </p>
                              <p className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span className="font-medium">
                                  {selectedPatient.personal?.branch} Branch
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 items-end">
                          <div className="grid grid-cols-3 gap-4 text-right">
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                              <p className="text-xs text-gray-600 mb-1 flex items-center justify-center gap-1">
                                <Tag className="w-3 h-3" />
                                Discount
                              </p>
                              <p className="text-lg font-bold text-amber-600">
                                {formatCurrency(totalDiscount)}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                              <p className="text-xs text-gray-600 mb-1">
                                Received
                              </p>
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(
                                  selectedPatient.payments?.amountReceived || 0
                                )}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow-sm">
                              <p className="text-xs text-gray-600 mb-1">
                                Pending
                              </p>
                              <p className="text-lg font-bold text-red-600">
                                {formatCurrency(totalPending)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Change Patient
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Transactions Table */}
                {selectedPatient && (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="p-6 bg-linear-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <FileText className="w-6 h-6 text-gray-700" />
                          <h2 className="text-xl font-bold text-gray-900">
                            Transaction History
                          </h2>
                          {patientTransactions.length > 0 && (
                            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-medium">
                              {patientTransactions.length} Transactions
                            </span>
                          )}
                        </div>
                        {patientTransactions.length > 0 && (
                          <button
                            onClick={() => setShowPrintPreview(true)}
                            className="px-6 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
                          >
                            <Printer className="w-5 h-5" />
                            View Printable Bill
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      {loading ? (
                        <div className="text-center py-16">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
                          <p className="text-gray-600 mt-4 font-medium">
                            Loading transactions...
                          </p>
                        </div>
                      ) : patientTransactions.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead>
                              <tr className="bg-gray-50 border-b-2 border-gray-200">
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Date
                                  </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Procedure
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Type
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" />
                                    Method
                                  </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  Remarks
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                                  <div className="flex items-center gap-2 justify-end">
                                    <IndianRupee className="w-4 h-4" />
                                    Amount
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {patientTransactions.map((transaction) => (
                                <tr
                                  key={transaction._id}
                                  className="hover:bg-blue-50 transition-colors"
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-gray-400" />
                                      <span className="text-sm font-medium text-gray-900">
                                        {formatDate(transaction.date)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm font-medium text-gray-900">
                                      {transaction.procedure}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                      {transaction.paymentType}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      {transaction.method}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="text-sm text-gray-600">
                                      {transaction.remarks || "-"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <span className="text-sm font-bold text-green-600">
                                      {formatCurrency(transaction.amount)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-linear-to-r from-gray-50 to-gray-100 border-t-2 border-gray-200">
                              {totalDiscount > 0 && (
                                <tr>
                                  <td
                                    colSpan="5"
                                    className="px-6 py-4 text-right text-sm font-bold text-gray-900"
                                  >
                                    <div className="flex items-center justify-end gap-2">
                                      <Tag className="w-4 h-4 text-amber-600" />
                                      Total Discount (on package):
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <span className="text-lg font-bold text-amber-600">
                                      -{formatCurrency(totalDiscount)}
                                    </span>
                                  </td>
                                </tr>
                              )}
                              <tr>
                                <td
                                  colSpan="5"
                                  className="px-6 py-4 text-right text-sm font-bold text-gray-900"
                                >
                                  Amount Received:
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="text-lg font-bold text-green-600">
                                    {formatCurrency(totalPaid)}
                                  </span>
                                </td>
                              </tr>
                              <tr className="border-t border-gray-200">
                                <td
                                  colSpan="5"
                                  className="px-6 py-4 text-right text-sm font-bold text-gray-900"
                                >
                                  Pending Amount:
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className="text-lg font-bold text-red-600">
                                    {formatCurrency(totalPending)}
                                  </span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-16">
                          <div className="p-4 bg-gray-100 rounded-full w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            No Transactions Found
                          </h3>
                          <p className="text-gray-600">
                            This patient has no transaction history yet
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Print Controls */}
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 no-print">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">
                      Printable Invoice
                    </h2>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPrintPreview(false)}
                        className="px-5 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
                      >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Transactions
                      </button>
                      <button
                        onClick={printBill}
                        className="px-5 py-3 bg-linear-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
                      >
                        <Printer className="w-5 h-5" />
                        Print Bill
                      </button>
                      <button
                        onClick={generatePDF}
                        className="px-5 py-3 bg-linear-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
                      >
                        <Download className="w-5 h-5" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Printable Bill */}
                <div
                  ref={billRef}
                  id="printable-bill"
                  style={{
                    background: "white",
                    padding: "40px",
                    maxWidth: "900px",
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
                        // padding: "10px",
                      }}
                    >
                      <Image
                        src={currentClinic.img}
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
                    </div>
                    <div>
                      <p
                        style={{
                          margin: "5px 0",
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <strong>Phone:</strong>{" "}
                        {selectedPatient?.personal?.phone}
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
                        <strong>Branch:</strong>{" "}
                        {selectedPatient?.personal?.branch}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Date:</strong> {formatDateTime(new Date())}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Invoice No:</strong> #INV
                        {selectedPatient?._id?.slice(-5).toUpperCase() ||
                          "29537B"}
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
                          border: "1px solid #000",
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
                          Package Cost
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
                          After Discount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ border: "1px solid #000" }}>
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
                          Service{" "}
                          {patientTransactions[0]?.procedure ||
                            "Hair Transplant"}
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            fontSize: "13px",
                            borderRight: "1px solid #000",
                          }}
                        >
                          {getCounsellorName()}
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
                          {Number(totalAmount).toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            textAlign: "right",
                            fontSize: "13px",
                            borderRight: "1px solid #000",
                          }}
                        >
                          {Number(totalDiscount).toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: "10px",
                            textAlign: "right",
                            fontSize: "13px",
                            fontWeight: "bold",
                          }}
                        >
                          {Number(totalAmount - totalDiscount).toFixed(2)}
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
                    <table
                      style={{ width: "100%", borderCollapse: "collapse" }}
                    >
                      <thead>
                        <tr
                          style={{
                            border: "1px solid #000",
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
                        {patientTransactions.map((transaction) => (
                          <tr
                            key={transaction._id}
                            style={{ border: "1px solid #000" }}
                          >
                            <td
                              style={{
                                padding: "8px",
                                fontSize: "13px",
                                borderRight: "1px solid #000",
                              }}
                            >
                              {formatDate(transaction.date)}
                            </td>
                            <td
                              style={{
                                padding: "8px",
                                fontSize: "13px",
                                borderRight: "1px solid #000",
                              }}
                            >
                              {transaction.method}
                            </td>
                            <td
                              style={{
                                padding: "8px",
                                textAlign: "right",
                                fontSize: "13px",
                                fontWeight: "bold",
                              }}
                            >
                              {Number(transaction.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
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
                        <strong>Package Total:</strong>{" "}
                        {formatCurrency(totalAmount)}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Discount on Package:</strong> -
                        {formatCurrency(totalDiscount)}
                      </p>
                      <p
                        style={{
                          margin: "5px 0",
                          fontSize: "14px",
                          fontWeight: "bold",
                          paddingTop: "5px",
                          borderTop: "1px solid #ccc",
                        }}
                      >
                        <strong>Amount After Discount:</strong>{" "}
                        {formatCurrency(totalAmount - totalDiscount)}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Amount Received:</strong>{" "}
                        {formatCurrency(totalPaid)}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Pending:</strong> {formatCurrency(totalPending)}
                      </p>
                      <p style={{ margin: "5px 0", fontSize: "14px" }}>
                        <strong>Tax:</strong> 0
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }

            .no-print,
            .no-print * {
              display: none !important;
            }

            #printable-bill,
            #printable-bill * {
              visibility: visible !important;
            }

            #printable-bill {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 20px !important;
              margin: 0 !important;
            }

            body,
            #__next,
            main {
              background: white !important;
            }

            @page {
              margin: 0.5cm;
              size: A4;
            }
          }
        `}</style>
      </main>
    </div>
  );
}
