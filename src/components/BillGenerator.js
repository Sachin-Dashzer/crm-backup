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
    month: "2-digit",
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

// ========== SERVICE INVOICE (Image 1) ==========
function ServiceInvoice({ transaction, patient, consultant, branch }) {
  const clinic = CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  const grossAmount = parseFloat(transaction.amount) || 0;
  const discount = parseFloat(transaction.discount) || 0;
  const netAmount = grossAmount - discount;
  const invoiceNo = `#INV${transaction._id.slice(-5).toUpperCase()}`;

  // console.log(patient);


  return (
    <div className="max-w-4xl mx-auto bg-white p-8" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
        <div>
          <h1 className="text-2xl font-bold mb-2">{clinic.name}</h1>
          <p className="text-sm text-gray-700">{clinic.address}</p>
          {clinic.city && <p className="text-sm text-gray-700">{clinic.city}</p>}
          <p className="text-sm"><strong>Phone:</strong> {clinic.phone}</p>
          <p className="text-sm"><strong>Website:</strong> {clinic.website}</p>
          <p className="text-sm"><strong>GST No:</strong> {clinic.gstin}</p>
        </div>
        <div className="text-right bg-black scale-125">
          <Image src={clinic.img} alt="Logo" width={120} height={120} />
        </div>
      </div>

      {/* Customer & Invoice Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg mb-2">{patient.name}</h2>
          <p className="text-sm">{patient.gender}, {patient.age} Years</p>
          <p className="text-sm">📞 {patient.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-sm"><strong>Date:</strong> {formatDateTime(transaction.date)}</p>
          <p className="text-sm"><strong>Invoice No:</strong> {invoiceNo}</p>
        </div>
      </div>

      {/* Invoice Title */}
      <h3 className="text-center text-xl font-bold mb-4">Invoice</h3>

      {/* Services Table */}
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">S No.</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Services & Products</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Consultant</th>
            <th className="border border-gray-400 px-4 py-2 text-center">Qty</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Unit Cost (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Discount (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-4 py-2">1</td>
            <td className="border border-gray-400 px-4 py-2">Service {transaction.procedure}</td>
            <td className="border border-gray-400 px-4 py-2">{consultant}</td>
            <td className="border border-gray-400 px-4 py-2 text-center">{transaction.quantity || 1}</td>
            <td className="border border-gray-400 px-4 py-2 text-right">{grossAmount.toFixed(2)}</td>
            <td className="border border-gray-400 px-4 py-2 text-right">{discount.toFixed(2)}</td>
            <td className="border border-gray-400 px-4 py-2 text-right font-bold">{netAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment History */}
      <h4 className="font-bold text-lg mb-2">Paid Amounts:</h4>
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">Date</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Payment Mode</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Amount Paid (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-4 py-2">{formatDateForDisplay(transaction.date)}</td>
            <td className="border border-gray-400 px-4 py-2 capitalize">{transaction.method}</td>
            <td className="border border-gray-400 px-4 py-2 text-right font-bold">{netAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-bold mb-2">Authorized Signatory</p>
          <div className="mt-8 text-sm text-gray-500">Print &nbsp; Back</div>
        </div>
        <div className="text-right">
          <p className="mb-1"><strong>Total:</strong> <span className="ml-4">{formatCurrency(netAmount)}</span></p>
          <p className="mb-1"><strong>Tax:</strong> <span className="ml-4">0</span></p>
          <p className="mb-1"><strong>Amount Paid:</strong> <span className="ml-4">{formatCurrency(netAmount)}</span></p>
          <p className="mb-1 font-bold"><strong>Balance:</strong> <span className="ml-4">₹0.00</span></p>
        </div>
      </div>
    </div>
  );
}

// ========== MEDICINE INVOICE (Image 2) ==========
function MedicineInvoice({ transactions, patient, consultant, branch }) {
  const clinic = CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  const firstTransaction = transactions[0];
  const invoiceNo = `#INV${firstTransaction._id.slice(-5).toUpperCase()}`;

  // Calculate totals
  let grossTotal = 0;
  let discountTotal = 0;
  transactions.forEach((t) => {
    grossTotal += parseFloat(t.amount) || 0;
    discountTotal += parseFloat(t.discount) || 0;
  });
  const netTotal = grossTotal - discountTotal;

  return (
    <div className="max-w-4xl mx-auto bg-white p-8" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
        <div>
          <h1 className="text-2xl font-bold mb-2">{clinic.name}</h1>
          <p className="text-sm text-gray-700">{clinic.address}</p>
          {clinic.city && <p className="text-sm text-gray-700">{clinic.city}</p>}
          <p className="text-sm"><strong>Phone:</strong> {clinic.phone}</p>
          <p className="text-sm"><strong>Website:</strong> {clinic.website}</p>
          <p className="text-sm"><strong>GST No:</strong> {clinic.gstin}</p>
        </div>
        <div className="text-right bg-black scale-125">
          <Image src={clinic.img} alt="Logo" width={120} height={120} />
        </div>
      </div>

      {/* Customer & Invoice Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg mb-2">{patient.name}</h2>
          <p className="text-sm">{patient.gender},</p>
          <p className="text-sm">📞 {patient.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-sm"><strong>Date:</strong> {formatDateTime(firstTransaction.date)}</p>
          <p className="text-sm"><strong>Invoice No:</strong> {invoiceNo}</p>
        </div>
      </div>

      {/* Invoice Title */}
      <h3 className="text-center text-xl font-bold mb-4">Invoice</h3>

      {/* Products Table */}
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">S No.</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Services & Products</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Consultant</th>
            <th className="border border-gray-400 px-4 py-2 text-center">Qty</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Unit Cost (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Discount (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => {
            const gross = parseFloat(t.amount) || 0;
            const disc = parseFloat(t.discount) || 0;
            const net = gross - disc;
            return (
              <tr key={idx}>
                <td className="border border-gray-400 px-4 py-2">{idx + 1}</td>
                <td className="border border-gray-400 px-4 py-2">Product {t.medicineName}</td>
                <td className="border border-gray-400 px-4 py-2">{consultant}</td>
                <td className="border border-gray-400 px-4 py-2 text-center">{t.quantity || 1}</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{gross.toFixed(2)}</td>
                <td className="border border-gray-400 px-4 py-2 text-right">{disc.toFixed(2)}</td>
                <td className="border border-gray-400 px-4 py-2 text-right font-bold">{net.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Payment History */}
      <h4 className="font-bold text-lg mb-2">Paid Amounts:</h4>
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">Date</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Payment Mode</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Amount Paid (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-4 py-2">{formatDateForDisplay(firstTransaction.date)}</td>
            <td className="border border-gray-400 px-4 py-2 capitalize">{firstTransaction.method}</td>
            <td className="border border-gray-400 px-4 py-2 text-right font-bold">{netTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-bold mb-2">Authorized Signatory</p>
          <div className="mt-8 text-sm text-gray-500">Print &nbsp; Back</div>
        </div>
        <div className="text-right">
          <p className="mb-1"><strong>Total:</strong> <span className="ml-4">{formatCurrency(netTotal)}</span></p>
          <p className="mb-1"><strong>Tax:</strong> <span className="ml-4">0</span></p>
          <p className="mb-1"><strong>Amount Paid:</strong> <span className="ml-4">{formatCurrency(netTotal)}</span></p>
          <p className="mb-1 font-bold"><strong>Balance:</strong> <span className="ml-4">₹0.00</span></p>
        </div>
      </div>
    </div>
  );
}

// ========== TRANSPLANT INVOICE (Image 3) ==========
function TransplantInvoice({
  transactions,
  patient,
  consultant,
  branch,
  packageAmount,
  packageDiscount,
}) {
  const clinic = CLINIC_BRANCHES[branch] || CLINIC_BRANCHES.Delhi;
  const firstTransaction = transactions[0] || {};
  const invoiceNo = `#INV${firstTransaction._id?.slice(-5).toUpperCase() || "00000"}`;

  const packageTotal = parseFloat(packageAmount) || 0;
  const discountOnPackage = parseFloat(packageDiscount) || 0;
  const amountAfterDiscount = packageTotal - discountOnPackage;
  
  const totalPaid = transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const pending = amountAfterDiscount - totalPaid;


  return (
    <div className="max-w-4xl mx-auto bg-white p-8" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-gray-300">
        <div>
          <h1 className="text-2xl font-bold mb-2">{clinic.name}</h1>
          <p className="text-sm text-gray-700">{clinic.address}</p>
          {clinic.city && <p className="text-sm text-gray-700">{clinic.city}</p>}
          <p className="text-sm"><strong>Phone:</strong> {clinic.phone}</p>
          <p className="text-sm"><strong>Website:</strong> {clinic.website}</p>
          <p className="text-sm"><strong>GST No:</strong> {clinic.gstin}</p>
        </div>
        <div className="text-right bg-black scale-125">
          <Image src={clinic.img} alt="Logo" width={120} height={120} />
        </div>
      </div>

      {/* Customer & Invoice Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <h2 className="font-bold text-lg mb-2">{patient.name}</h2>
          <p className="text-sm">{patient.gender},</p>
          <p className="text-sm"><strong>Phone:</strong> {patient.phone}</p>
          <p className="text-sm"><strong>Branch:</strong> {branch}</p>
        </div>
        <div className="text-right">
          <p className="text-sm"><strong>Date:</strong> {formatDateTime(firstTransaction.date)}</p>
          <p className="text-sm"><strong>Invoice No:</strong> {invoiceNo}</p>
        </div>
      </div>

      {/* Invoice Title */}
      <h3 className="text-center text-xl font-bold mb-4">Invoice</h3>

      {/* Package Table */}
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">S No.</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Services & Products</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Consultant</th>
            <th className="border border-gray-400 px-4 py-2 text-center">Qty</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Package Cost (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Discount (INR)</th>
            <th className="border border-gray-400 px-4 py-2 text-right">After Discount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-400 px-4 py-2">1</td>
            <td className="border border-gray-400 px-4 py-2">Service {firstTransaction.procedure || "Hair Transplant"}</td>
            <td className="border border-gray-400 px-4 py-2">{consultant}</td>
            <td className="border border-gray-400 px-4 py-2 text-center">1</td>
            <td className="border border-gray-400 px-4 py-2 text-right">{packageTotal.toFixed(2)}</td>
            <td className="border border-gray-400 px-4 py-2 text-right">{discountOnPackage.toFixed(2)}</td>
            <td className="border border-gray-400 px-4 py-2 text-right font-bold">{amountAfterDiscount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment History */}
      <h4 className="font-bold text-lg mb-2">Paid Amounts:</h4>
      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-4 py-2 text-left">Date</th>
            <th className="border border-gray-400 px-4 py-2 text-left">Payment Mode</th>
            <th className="border border-gray-400 px-4 py-2 text-right">Amount Paid (INR)</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t, idx) => (
            <tr key={idx}>
              <td className="border border-gray-400 px-4 py-2">{formatDateForDisplay(t.date)}</td>
              <td className="border border-gray-400 px-4 py-2 capitalize">{t.method}</td>
              <td className="border border-gray-400 px-4 py-2 text-right">{parseFloat(t.amount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex justify-between items-end">
        <div>
          <p className="font-bold mb-2">Authorized Signatory</p>
        </div>
        <div className="text-right">
          <p className="mb-1 font-bold"><strong>Total Amount:</strong> <span className="ml-4">{formatCurrency(amountAfterDiscount)}</span></p>
          <p className="mb-1"><strong>Received:</strong> <span className="ml-4">{formatCurrency(totalPaid)}</span></p>
          <p className="mb-1 font-bold text-red-600"><strong>Pending:</strong> <span className="ml-4">{formatCurrency(pending)}</span></p>
          <p className="mb-1"><strong>Tax:</strong> <span className="ml-4">0</span></p>
        </div>
      </div>
    </div>
  );
}

// ========== MAIN BILL GENERATOR COMPONENT ==========
export default function BillGenerator({ transactionId, onClose }) {
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);

  useEffect(() => {
    if (transactionId) {
      fetchTransactionData();
    }
  }, [transactionId]);

  const fetchTransactionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `/api/transactions/invoice-data?id=${transactionId}`,
      );
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch invoice data");
      }


      setInvoiceData(result.data);
    } catch (error) {
      console.error("Error fetching transaction:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
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

  if (error || !invoiceData) {
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

  const { category, branch, transactions, patient, consultant, isBatch, packageAmount, packageDiscount } = invoiceData;

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
              <h2 className="text-xl font-bold text-white">
                {category === "TRANSPLANT"
                  ? "Transplant Invoice"
                  : category === "SERVICE"
                    ? "Service Invoice"
                    : category === "MEDICINE"
                      ? "Medicine Invoice"
                      : "Invoice"}
              </h2>
              <p className="text-white/80 text-sm">
                {isBatch && category === "MEDICINE"
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
        <div className="p-6 max-h-150 overflow-y-auto">
          <div id="bill-content" className="bg-white">
            {category === "TRANSPLANT" ? (
              <TransplantInvoice
                transactions={transactions}
                patient={patient}
                consultant={consultant}
                branch={branch}
                packageAmount={packageAmount}
                packageDiscount={packageDiscount}
              />
            ) : category === "SERVICE" ? (
              <ServiceInvoice
                transaction={transactions[0]}
                patient={patient}
                consultant={consultant}
                branch={branch}
              />
            ) : category === "MEDICINE" ? (
              <MedicineInvoice
                transactions={transactions}
                patient={patient}
                consultant={consultant}
                branch={branch}
              />
            ) : (
              <ServiceInvoice
                transaction={transactions[0]}
                patient={patient}
                consultant={consultant}
                branch={branch}
              />
            )}
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