"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Logo from "@/../public/logo-2.png";
import Logo2 from "@/../public/logo.png";
import {
  Loader2,
  Printer,
  Download,
  X as CloseIcon,
  FileText as Bill,
} from "lucide-react";

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
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// ========== STANDARD INVOICE COMPONENT ==========
function StandardInvoice({
  transactions,
  patient,
  category,
  branch,
  isBatch = false,
  packageAmount = 0,
  packageDiscount = 0,
}) {
  const currentClinic = CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  const mainTransaction = Array.isArray(transactions)
    ? transactions[0]
    : transactions;
  const allTransactions = Array.isArray(transactions)
    ? transactions
    : [transactions];

  // Calculate totals based on transaction type
  let grossAmount = 0;
  let totalDiscount = 0;

  if (category === "TRANSPLANT") {
    // Use package amounts for transplant
    grossAmount = packageAmount || parseFloat(mainTransaction.amount) || 0;
    totalDiscount =
      packageDiscount || parseFloat(mainTransaction.discount) || 0;
  } else if (isBatch) {
    // Sum all batch transactions
    allTransactions.forEach((t) => {
      grossAmount += parseFloat(t.amount) || 0;
      totalDiscount += parseFloat(t.discount) || 0;
    });
  } else {
    // Single transaction
    grossAmount = parseFloat(mainTransaction.amount) || 0;
    totalDiscount = parseFloat(mainTransaction.discount) || 0;
  }

  const totalAfterDiscount = grossAmount - totalDiscount;
  const totalPaid = allTransactions.reduce(
    (sum, t) => sum + (parseFloat(t.amount) || 0),
    0,
  );
  const balance = totalAfterDiscount - totalPaid;
  const isTransplant = category === "TRANSPLANT";
  const consultant =
    mainTransaction.patient?.counselling?.counsellor?.name ||
    mainTransaction.patient?.counselling?.counsellorName?.name ||
    patient.counsellor ||
    "Dr. Ryan";

 
}

// ========== MAIN BILL GENERATOR COMPONENT ==========
export default function BillGenerator({ transactionId, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isBatch, setIsBatch] = useState(false);
  const [packageAmount, setPackageAmount] = useState(0);
  const [packageDiscount, setPackageDiscount] = useState(0);
  const [category, setCategory] = useState("GENERAL");
  const [branch, setBranch] = useState("Delhi");

  useEffect(() => {
    if (transactionId) {
      fetchTransactionData();
    }
  }, [transactionId]);

  const fetchTransactionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch invoice-specific data from optimized endpoint
      const res = await fetch(
        `/api/transactions/invoice-data?id=${transactionId}`,
      );
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch invoice data");
      }

      const { data } = result;

      setCategory(data.category);
      setBranch(data.branch);
      setTransactions(data.transactions);
      setIsBatch(data.isBatch);

      // For TRANSPLANT, set package details
      if (data.category === "TRANSPLANT") {
        setPackageAmount(data.packageAmount);
        setPackageDiscount(data.packageDiscount);
      }
    } catch (error) {
      console.error("Error fetching transaction:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  const getPatientDetails = () => {
    const firstTransaction = transactions[0];
    if (!firstTransaction)
      return {
        name: "N/A",
        phone: "N/A",
        email: "N/A",
        counsellor: "Dr. Ryan",
      };

    if (
      firstTransaction.patient &&
      typeof firstTransaction.patient === "object"
    ) {
      return {
        name: firstTransaction.patient.personal?.name || "Walk-in Customer",
        phone: firstTransaction.patient.personal?.phone || "N/A",
        email: firstTransaction.patient.personal?.email || "N/A",
        counsellor:
          firstTransaction.patient.counselling?.counsellor?.name ||
          firstTransaction.patient.counselling?.counsellorName?.name ||
          "Dr. Ryan",
      };
    }

    return {
      name: firstTransaction.patientName || "Walk-in Customer",
      phone: firstTransaction.patientPhone || "N/A",
      email: "N/A",
      counsellor: "Dr. Ryan",
    };
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setGenerating(true);
      const element = document.getElementById("bill-content");
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Invoice_${transactionId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF. Please try printing instead.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading invoice data...</p>
        </div>
      </div>
    );
  }

  if (error || transactions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CloseIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Error Loading Invoice
            </h3>
            <p className="text-gray-600 mb-4">
              {error || "Transaction not found"}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition-all font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const patient = getPatientDetails();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="bg-linear-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-2xl flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Bill className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Generate Invoice</h2>
              <p className="text-white/80 text-sm">
                {isBatch
                  ? `Batch Invoice (${transactions.length} items)`
                  : category === "TRANSPLANT"
                    ? `Complete Payment History (${transactions.length} payments)`
                    : "Print or download invoice"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <CloseIcon className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Bill Preview */}
        <div className="p-6 max-h-[600px] overflow-y-auto">
          <div id="bill-content" className="bg-white">
            <StandardInvoice
              transactions={transactions}
              patient={patient}
              category={category}
              branch={branch}
              isBatch={isBatch}
              packageAmount={packageAmount}
              packageDiscount={packageDiscount}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 px-6 py-3 bg-linear-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all font-semibold flex items-center justify-center gap-2"
          >
            <Printer className="w-5 h-5" />
            Print Invoice
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={generating}
            className="flex-1 px-6 py-3 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download PDF
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-semibold"
          >
            Close
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print,
          .no-print * {
            display: none !important;
          }
          #bill-content,
          #bill-content * {
            visibility: visible !important;
          }
          #bill-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            margin: 0 !important;
          }
          @page {
            margin: 0.5cm;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
