"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { maskPhone } from "@/utils/phoneUtils";
import SalesSidebar from "@/components/Sidebars/SalesSidebar";
import {
  ArrowLeft,
  Download,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export default function SalesPatientProfile() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role || "sales";

  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchPatientData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/patient-data?id=${id}`, {
          method: "GET",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to load patient data`);
        }

        const data = await res.json();

        if (data.success && data.patient) {
          setPatientData(data.patient);
        } else {
          throw new Error(data.error || "Patient record not found");
        }
      } catch (err) {
        console.error("Error fetching patient record:", err);
        setError(err.message || "Failed to load patient medical record");
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [id]);

  const formatDate = (date) => {
    if (!date) return "Not scheduled";
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) return "Invalid date";
      return dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "NEW":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "POST_OP":
      case "SURGERY_BOOKED":
      case "BOOKING_DONE":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "CONSULTED":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "NOT_CONVERTED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "NOT_VISITED":
      case "CLOSED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // ---------------------------------------------------------------------------
  // PDF-SAFE EXPORT
  // ---------------------------------------------------------------------------
  // Strategy: build a completely self-contained HTML string using ONLY inline
  // HEX/RGB styles — zero <style> tags, zero oklch / oklab / color-mix, zero
  // CSS variables, zero global styles.
  // Inject into a dedicated off-screen #pdf-export-root container, run html2pdf.js
  // strictly on that container, then cleanly remove it in finally.
  // The visible #medical-record-document DOM is NEVER touched or passed to html2pdf.
  // ---------------------------------------------------------------------------

  const buildPdfSafeHTML = (data, maskedPhone) => {
    const fmt = (date) => {
      if (!date) return "Not scheduled";
      try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return "Invalid date";
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      } catch { return "Invalid date"; }
    };

    const cur = (amount) => {
      if (amount === undefined || amount === null) return "\u20B90";
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
    };

    const esc = (v) =>
      String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const statusMap = {
      NEW:            { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
      POST_OP:        { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
      SURGERY_BOOKED: { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
      BOOKING_DONE:   { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
      CONSULTED:      { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
      NOT_CONVERTED:  { bg: "#fff1f2", color: "#be123c", border: "#fca5a5" },
      NOT_VISITED:    { bg: "#f8fafc", color: "#334155", border: "#cbd5e1" },
      CLOSED:         { bg: "#f8fafc", color: "#334155", border: "#cbd5e1" },
    };
    const sc = statusMap[data.ops?.status] || statusMap.CLOSED;
    const statusLabel = (data.ops?.status || "UNKNOWN").replace(/_/g, " ");

    const SH =
      "font-size:11px;font-weight:700;color:#0f172a;text-transform:uppercase;" +
      "letter-spacing:0.07em;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 16px 0;" +
      "page-break-after:avoid;break-after:avoid;display:block;";

    const field = (label, value, valueColor = "#0f172a") =>
      `<div style="margin-bottom:14px;">` +
      `<span style="display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:3px;">${esc(label)}</span>` +
      `<span style="font-size:13px;font-weight:600;color:${valueColor};">${esc(String(value ?? "N/A"))}</span>` +
      `</div>`;

    const medTags = (data.counselling?.medicines || [])
      .map((m) =>
        `<span style="background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;` +
        `padding:3px 10px;border-radius:12px;font-size:11px;margin:2px;display:inline-block;">${esc(m)}</span>`
      ).join(" ");

    const benefitTags = (data.counselling?.additionalbenefits || [])
      .map((b) =>
        `<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;` +
        `padding:3px 10px;border-radius:12px;font-size:11px;margin:2px;display:inline-block;">${esc(b)}</span>`
      ).join(" ");

    const txnRows = (data.payments?.transactions || [])
      .map((txn, i) =>
        `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"};break-inside:avoid;page-break-inside:avoid;"><td style="padding:8px 11px;border:1px solid #e2e8f0;font-size:12px;color:#334155;">${fmt(txn.date)}</td><td style="padding:8px 11px;border:1px solid #e2e8f0;font-size:12px;color:#334155;text-transform:capitalize;">${esc(txn.paymentType || txn.method || "N/A")}</td><td style="padding:8px 11px;border:1px solid #e2e8f0;font-size:12px;color:#334155;">${esc(txn.branch || "N/A")}</td><td style="padding:8px 11px;border:1px solid #e2e8f0;font-size:12px;color:#0f172a;font-weight:700;text-align:right;">${cur(txn.amount)}</td></tr>`
      ).join("");

    const txnSection = txnRows
      ? `<div style="margin-top:18px;"><p style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;">Transaction History</p><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Date</th><th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Payment Type</th><th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Branch</th><th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:right;">Amount</th></tr></thead><tbody>${txnRows}</tbody></table></div>`
      : `<p style="font-size:12px;color:#94a3b8;font-style:italic;margin-top:10px;">No transactions recorded yet.</p>`;

    const nowDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const nowTime = new Date().toLocaleTimeString("en-IN");

    const docStyle =
      "box-sizing:border-box;width:794px;background:#ffffff;padding:32px 36px;" +
      "font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;line-height:1.4;";
    const secStyle = "margin-bottom:22px;break-inside:avoid;page-break-inside:avoid;";
    const g3Style = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 18px;";
    const g2Style = "display:grid;grid-template-columns:1fr 1fr;gap:0 18px;";
    const g5Style = "display:grid;grid-template-columns:repeat(5,1fr);gap:10px;";
    const cardBase = "border-radius:7px;padding:12px 8px;text-align:center;box-sizing:border-box;";

    return `<div class="pdf-document" style="${docStyle}">
  <!-- Header -->
  <div class="pdf-section pdf-header" style="text-align:center;border-bottom:2px solid #cbd5e1;padding-bottom:16px;margin-bottom:22px;break-inside:avoid;page-break-inside:avoid;">
    <h1 style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:0.04em;margin-bottom:10px;margin-top:0;">MEDICAL RECORD</h1>
    <div style="display:flex;justify-content:center;gap:28px;font-size:12px;color:#475569;">
      <span>Patient ID:&nbsp;<strong style="color:#0f172a;font-family:monospace;">${esc(String(data._id || "N/A"))}</strong></span>
      <span>Date:&nbsp;<strong style="color:#0f172a;">${nowDate}</strong></span>
    </div>
    <div style="margin-top:10px;">
      <span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;">${esc(statusLabel)}</span>
    </div>
  </div>

  <!-- Patient Information -->
  <div class="pdf-section pdf-patient-info" style="${secStyle}">
    <p style="${SH}">Patient Information</p>
    <div style="${g3Style}">
      ${field("Full Name", data.personal?.name || "N/A")}
      ${field("Age & Gender", (data.personal?.age || "N/A") + " yrs, " + (data.personal?.gender || "N/A"))}
      ${field("Blood Group", data.medical?.bloodGroup || "N/A")}
      ${field("Phone", maskedPhone)}
      ${field("Email", data.personal?.email || "N/A")}
      ${field("Profession", data.personal?.profession || "N/A")}
      ${field("Branch", data.personal?.branch || "N/A")}
      ${field("Visit Date", fmt(data.personal?.visitDate))}
      ${field("Package Quoted", cur(data.personal?.packageQuoted), "#2563eb")}
    </div>
    ${data.personal?.address ? '<div style="border-top:1px solid #f1f5f9;padding-top:10px;margin-top:2px;">' + field("Address", data.personal.address) + '</div>' : ""}
    ${data.personal?.reference?.name ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:11px;margin-top:8px;">' + field("Reference Source", data.personal.reference.name) + '</div>' : ""}
    ${data.personal?.remarks ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:11px;margin-top:8px;">' + field("Remarks", data.personal.remarks) + '</div>' : ""}
  </div>

  <!-- Counselling Details -->
  <div class="pdf-section pdf-counselling" style="${secStyle}">
    <p style="${SH}">Counselling Details</p>
    <div style="${g3Style}">
      ${field("Counsellor", data.counselling?.counsellor?.name || "N/A")}
      ${field("Technique Suggested", data.counselling?.techniqueSuggested || "N/A")}
      ${field("Grafts Suggested", data.counselling?.graftsSuggested || "N/A")}
      ${field("Final Package", cur(data.counselling?.finlpackage), "#2563eb")}
      ${field("Ready for Surgery", data.counselling?.readyForSurgery ? "\u2713 Yes" : "\u2717 No", data.counselling?.readyForSurgery ? "#16a34a" : "#dc2626")}
      ${field("Hair Loss Type", data.counselling?.hairlossType || "N/A")}
      ${field("Area of Concern", data.counselling?.areaofConcern || "N/A")}
      ${field("Hair Loss Reason", data.counselling?.hairlossreason || "N/A")}
      ${field("Hair Loss Duration", data.counselling?.hairlossduration || "N/A")}
    </div>
    ${medTags ? '<div style="margin-top:12px;border-top:1px solid #f1f5f9;padding-top:10px;"><span style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:6px;">Prescribed Medicines</span><div>' + medTags + '</div></div>' : ""}
    ${benefitTags ? '<div style="margin-top:10px;"><span style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:6px;">Additional Benefits</span><div>' + benefitTags + '</div></div>' : ""}
    ${data.counselling?.notes ? '<div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:11px;"><span style="font-size:11px;font-weight:700;color:#475569;display:block;margin-bottom:4px;">Counsellor Notes</span><span style="font-size:12px;color:#334155;white-space:pre-wrap;">' + esc(data.counselling.notes) + '</span></div>' : ""}
  </div>

  <!-- Medical Information -->
  <div class="pdf-section pdf-medical" style="${secStyle}">
    <p style="${SH}">Medical Information</p>
    <div style="${g2Style}">
      <div class="pdf-card" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px;break-inside:avoid;page-break-inside:avoid;">
        <p style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:0;margin-bottom:12px;">Vital Signs</p>
        <div style="${g2Style}">
          ${field("Blood Pressure", data.medical?.bp || "N/A")}
          ${field("Sugar Level", data.medical?.sugar || "N/A")}
          ${field("Pulse Rate", data.medical?.pulse || "N/A")}
          ${field("Weight", data.medical?.weight || "N/A")}
        </div>
      </div>
      <div class="pdf-card" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:7px;padding:13px;break-inside:avoid;page-break-inside:avoid;">
        <p style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;margin-top:0;margin-bottom:12px;">Medical Background</p>
        ${field("Allergies", data.medical?.allergies || "None")}
        ${field("Medical History", data.medical?.medicalHistory || "None")}
        <div style="${g2Style}">
          ${field("HIV Status", data.medical?.hiv || "Not tested")}
          ${field("HCV Status", data.medical?.hcv || "Not tested")}
        </div>
      </div>
    </div>
  </div>

  <!-- Payment Information (Heading + 5 Cards strictly together) -->
  <div class="pdf-section pdf-payment" style="${secStyle}">
    <p style="${SH}">Payment Information</p>
    <div style="${g5Style}">
      <div class="pdf-card" style="${cardBase}background:#f8fafc;border:1px solid #cbd5e1;break-inside:avoid;page-break-inside:avoid;"><span style="display:block;font-size:10px;font-weight:600;color:#64748b;margin-bottom:5px;">Total Amount</span><span style="font-size:14px;font-weight:700;color:#0f172a;">${cur(data.payments?.totalAmount)}</span></div>
      <div class="pdf-card" style="${cardBase}background:#f0fdf4;border:1px solid #86efac;break-inside:avoid;page-break-inside:avoid;"><span style="display:block;font-size:10px;font-weight:600;color:#16a34a;margin-bottom:5px;">Amount Received</span><span style="font-size:14px;font-weight:700;color:#16a34a;">${cur(data.payments?.amountReceived)}</span></div>
      <div class="pdf-card" style="${cardBase}background:#eff6ff;border:1px solid #93c5fd;break-inside:avoid;page-break-inside:avoid;"><span style="display:block;font-size:10px;font-weight:600;color:#2563eb;margin-bottom:5px;">Total Discount</span><span style="font-size:14px;font-weight:700;color:#2563eb;">${cur(data.payments?.discount)}</span></div>
      <div class="pdf-card" style="${cardBase}background:#fff1f2;border:1px solid #fca5a5;break-inside:avoid;page-break-inside:avoid;"><span style="display:block;font-size:10px;font-weight:600;color:#dc2626;margin-bottom:5px;">Pending Amount</span><span style="font-size:14px;font-weight:700;color:#dc2626;">${cur(data.payments?.pendingAmount)}</span></div>
      <div class="pdf-card" style="${cardBase}background:#faf5ff;border:1px solid #c4b5fd;break-inside:avoid;page-break-inside:avoid;"><span style="display:block;font-size:10px;font-weight:600;color:#7c3aed;margin-bottom:5px;">Medicine Amount</span><span style="font-size:14px;font-weight:700;color:#7c3aed;">${cur(data.payments?.medicineAmount)}</span></div>
    </div>
  </div>

  <!-- Transaction History: heading kept adjacent to table; table can flow across pages -->
  <div class="pdf-transactions" style="margin-bottom:22px;break-inside:auto;page-break-inside:auto;">
    <p style="${SH}">Transaction History</p>
    ${
      txnRows
        ? `<table style="width:100%;border-collapse:collapse;margin-top:2px;">
            <thead style="display:table-header-group;">
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Date</th>
                <th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Payment Type</th>
                <th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:left;">Branch</th>
                <th style="padding:8px 11px;border:1px solid #e2e8f0;font-size:11px;color:#475569;font-weight:700;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${txnRows}
            </tbody>
          </table>`
        : `<p style="font-size:12px;color:#94a3b8;font-style:italic;margin-top:4px;">No transactions recorded yet.</p>`
    }
  </div>

  <!-- Footer -->
  <div class="pdf-section pdf-footer" style="margin-top:24px;padding-top:16px;border-top:2px solid #cbd5e1;text-align:center;break-inside:avoid;page-break-inside:avoid;">
    <p style="font-size:12px;font-weight:700;color:#334155;margin:0 0 5px 0;">This is an electronically generated medical record. No signature required.</p>
    <p style="font-size:11px;color:#94a3b8;margin:0;">Generated on ${nowDate} at ${nowTime}</p>
  </div>
</div>`;
  };

  const handleDownloadPDF = async () => {
    if (!patientData) return;
    setGeneratingPDF(true);

    let exportRoot = null;

    try {
      const html2pdfLib = (await import("html2pdf.js")).default;

      const safeName = (patientData.personal?.name || "Patient")
        .trim()
        .replace(/[^a-zA-Z0-9_\-\s]/g, "")
        .replace(/\s+/g, "_");
      const filename = `Medical_Record_${safeName}_${patientData._id || id}.pdf`;

      const maskedPhone = maskPhone(patientData.personal?.phone, userRole) || "N/A";
      const htmlStr = buildPdfSafeHTML(patientData, maskedPhone);

      // Create dedicated off-screen export container.
      // Explicit fixed 794px width (A4 @ 96 DPI), HEX colors only, zero global styles.
      // The visible #medical-record-document DOM is untouched and never passed to html2pdf.
      exportRoot = document.createElement("div");
      exportRoot.id = "pdf-export-root";
      exportRoot.setAttribute("data-pdf-export", "true");
      exportRoot.style.cssText =
        "position:fixed;left:-100000px;top:0;width:794px;" +
        "background:#ffffff;visibility:visible;opacity:1;z-index:-1;pointer-events:none;";
      exportRoot.innerHTML = htmlStr;
      document.body.appendChild(exportRoot);

      // ── Conditional page-break pre-calculation ─────────────────────────────
      // html2pdf pagebreaks.js detects break-inside:avoid on blocks, but does not
      // tie a table heading to its table rows. If the remaining space on the current
      // page is insufficient for the Transaction History starting block:
      //   - heading + table header + all rows (for short tables <= 2 rows)
      //   - heading + table header + at least first 2 rows (for longer tables)
      // then we move the entire Transaction History section to the next page as a
      // complete unit using page-break-before:always.
      //
      // pxPageHeight matches html2pdf inner A4 with margin:[0,0,0,0]:
      //   toPx(297mm, k=2.8346) = floor(297 * 2.8346/72 * 96) = 1122px.
      // ────────────────────────────────────────────────────────────────────────
      const _pagePx = Math.floor(297 / 25.4 * 96); // 1122px — A4 page height at 96dpi
      const _txnDiv = exportRoot.querySelector(".pdf-transactions");
      let _needsTxnPageBreak = false;

      if (_txnDiv) {
        // Force reflow so layout metrics are accurate
        void _txnDiv.getBoundingClientRect();
        const _docTop = exportRoot.getBoundingClientRect().top;
        const _hdg = _txnDiv.querySelector("p");
        const _rows = Array.from(_txnDiv.querySelectorAll("tbody tr"));
        const _startTop = (_hdg ? _hdg.getBoundingClientRect().top : _txnDiv.getBoundingClientRect().top) - _docTop;
        const _startPage = Math.floor(_startTop / _pagePx);
        // Printable page bottom with safety margin for bottom padding (32px padding on .pdf-document)
        const _safeBottom = (_startPage + 1) * _pagePx - 28;

        if (_rows.length === 0) {
          // No data rows (empty message): keep heading + message together
          const _endBottom = _txnDiv.getBoundingClientRect().bottom - _docTop;
          if (_endBottom > _safeBottom) {
            _needsTxnPageBreak = true;
          }
        } else if (_rows.length <= 2) {
          // Short transaction history (1–2 rows like Mohit Yadav):
          // Heading + table header + all rows must stay together as a single block
          const _lastRow = _rows[_rows.length - 1];
          const _endBottom = _lastRow.getBoundingClientRect().bottom - _docTop;
          if (_endBottom > _safeBottom) {
            _needsTxnPageBreak = true;
          }
        } else {
          // Medium or long transaction history (3+ rows):
          // Heading + table header + at least first 2 rows must fit on the current page;
          // otherwise, move the entire section to start cleanly on the next page.
          const _minBlockRow = _rows[Math.min(1, _rows.length - 1)];
          const _endBottom = _minBlockRow.getBoundingClientRect().bottom - _docTop;
          if (_endBottom > _safeBottom) {
            _needsTxnPageBreak = true;
          }
        }

        if (_needsTxnPageBreak) {
          _txnDiv.style.cssText += ";page-break-before:always;break-before:page;";
          _txnDiv.classList.add("pdf-break-before");
        }
      }
      // ── End conditional page-break ──────────────────────────────────────────

      const pdfTarget = exportRoot.querySelector(".pdf-document") || exportRoot;

      const opt = {
        // margin:0 so inner page dims = full A4 (210x297mm = ~794x1122px).
        // This aligns pagebreaks.js pxPageHeight with toPdf canvas slicing.
        // Visual margins are provided by .pdf-document's own padding:32px 36px.
        margin: [0, 0, 0, 0],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: 794,
          onclone: (clonedDoc) => {
            // Strip external stylesheets/style tags to prevent oklch parsing errors
            clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
            clonedDoc.querySelectorAll("style").forEach((el) => el.remove());

            // Inject only HEX/RGB-safe print styles
            const printStyle = clonedDoc.createElement("style");
            printStyle.textContent = `
              * { box-sizing: border-box; }
              .pdf-document { width: 794px !important; }
              .pdf-section { break-inside: avoid; page-break-inside: avoid; }
              .pdf-transactions { break-inside: auto; page-break-inside: auto; }
              .pdf-break-before { page-break-before: always; break-before: page; }
              .pdf-card { break-inside: avoid; page-break-inside: avoid; }
              thead { display: table-header-group; }
              tr { break-inside: avoid; page-break-inside: avoid; }
            `;
            clonedDoc.head.appendChild(printStyle);
          },
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: {
          mode: ["css", "legacy"],
          before: _needsTxnPageBreak ? [".pdf-break-before"] : [],
          avoid: [
            ".pdf-header",
            ".pdf-patient-info",
            ".pdf-counselling",
            ".pdf-medical",
            ".pdf-payment",
            ".pdf-footer",
            ".pdf-card",
            "tr",
          ],
        },
      };

      await html2pdfLib().set(opt).from(pdfTarget).save();
    } catch (err) {
      console.error("PDF generation failed:", err);
      try {
        const maskedPhone = maskPhone(patientData.personal?.phone, userRole) || "N/A";
        const htmlStr = buildPdfSafeHTML(patientData, maskedPhone);
        const printWin = window.open("", "_blank");
        if (printWin) {
          printWin.document.write(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Medical Record</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{background:#fff;padding:20px;font-family:Arial,sans-serif;}.pdf-section{break-inside:avoid;page-break-inside:avoid;}.pdf-section.pdf-transactions{break-inside:auto;page-break-inside:auto;}.pdf-card{break-inside:avoid;page-break-inside:avoid;}thead{display:table-header-group;}tr{break-inside:avoid;page-break-inside:avoid;}@page{size:A4 portrait;margin:10mm 8mm;}</style></head><body>${htmlStr}</body></html>`
          );
          printWin.document.close();
          printWin.focus();
          setTimeout(() => printWin.print(), 600);
        }
      } catch (printErr) {
        console.error("Print fallback also failed:", printErr);
      }
    } finally {
      if (exportRoot && document.body.contains(exportRoot)) {
        document.body.removeChild(exportRoot);
      }
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
        <SalesSidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">
              Loading patient medical record...
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !patientData) {
    return (
      <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
        <SalesSidebar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-2xl p-6 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Patient Not Found
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {error || "The requested patient record could not be loaded."}
              </p>
            </div>
            <button
              onClick={() => router.push("/sales/patients")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patients
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-800">
      <SalesSidebar />

      <main className="flex-1 px-4 sm:px-8 lg:px-12 py-8 bg-[#f8fafc] overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto space-y-6">
          {/* Top Page Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Patient Medical Record
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  View-Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Patient ID:{" "}
                <span className="font-mono text-slate-700 font-semibold">
                  {patientData._id}
                </span>{" "}
                &nbsp;|&nbsp; Status:{" "}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeStyle(
                    patientData.ops?.status
                  )}`}
                >
                  {(patientData.ops?.status || "UNKNOWN").replace("_", " ")}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => router.push("/sales/patients")}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-semibold transition-colors shadow-sm bg-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={generatingPDF}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {generatingPDF ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* A4 Document Container */}
          <div
            id="medical-record-document"
            className="bg-white shadow-md rounded-xl border border-slate-200 overflow-hidden text-slate-800"
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="p-8 sm:p-12 space-y-8">
              {/* Document Header */}
              <div className="text-center border-b-2 border-slate-300 pb-6">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
                  MEDICAL RECORD
                </h1>
                <div className="flex flex-wrap justify-between items-center text-xs text-slate-600 font-medium max-w-xl mx-auto pt-2">
                  <span>
                    Patient ID:{" "}
                    <strong className="text-slate-900 font-mono">
                      {patientData._id}
                    </strong>
                  </span>
                  <span>
                    Date:{" "}
                    <strong className="text-slate-900">
                      {new Date().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
                <div className="mt-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeStyle(
                      patientData.ops?.status
                    )}`}
                  >
                    {(patientData.ops?.status || "UNKNOWN").replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Patient Information */}
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                  PATIENT INFORMATION
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Full Name
                    </span>
                    <p className="text-sm text-slate-900 font-semibold">
                      {patientData.personal?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Age & Gender
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal?.age || "N/A"} years,{" "}
                      {patientData.personal?.gender || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Blood Group
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.medical?.bloodGroup || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Phone
                    </span>
                    <p className="text-sm text-slate-900 font-mono font-medium">
                      {maskPhone(patientData.personal?.phone, userRole) || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Email
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal?.email || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Profession
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal?.profession || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Branch
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal?.branch || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Visit Date
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {formatDate(patientData.personal?.visitDate)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Package Quoted
                    </span>
                    <p className="text-sm text-blue-600 font-semibold">
                      {formatCurrency(patientData.personal?.packageQuoted)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="block text-xs font-medium text-slate-500 mb-0.5">
                    Address
                  </span>
                  <p className="text-sm text-slate-900 font-medium">
                    {patientData.personal?.address || "N/A"}
                  </p>
                </div>

                {patientData.personal?.reference && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-600 mb-1">
                      Reference Source
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal.reference.name || "N/A"}
                    </p>
                  </div>
                )}

                {patientData.personal?.remarks && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-600 mb-1">
                      Remarks
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.personal.remarks}
                    </p>
                  </div>
                )}
              </div>

              {/* Counselling Details */}
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                  COUNSELLING DETAILS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Counsellor
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.counsellor?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Technique Suggested
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.techniqueSuggested || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Grafts Suggested
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.graftsSuggested || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Final Package
                    </span>
                    <p className="text-sm font-bold text-blue-600">
                      {formatCurrency(patientData.counselling?.finlpackage)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Ready for Surgery
                    </span>
                    <p className="text-sm font-semibold">
                      <span
                        className={
                          patientData.counselling?.readyForSurgery
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }
                      >
                        {patientData.counselling?.readyForSurgery
                          ? "✓ Yes"
                          : "✗ No"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Hair Loss Type
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.hairlossType || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Area of Concern
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.areaofConcern || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Hair Loss Reason
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.hairlossreason || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">
                      Hair Loss Duration
                    </span>
                    <p className="text-sm text-slate-900 font-medium">
                      {patientData.counselling?.hairlossduration || "N/A"}
                    </p>
                  </div>
                </div>

                {patientData.counselling?.medicines &&
                  patientData.counselling.medicines.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="block text-xs font-medium text-slate-500 mb-1.5">
                        Prescribed Medicines
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {patientData.counselling.medicines.map((med, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-medium"
                          >
                            {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {patientData.counselling?.additionalbenefits &&
                  patientData.counselling.additionalbenefits.length > 0 && (
                    <div className="mt-3">
                      <span className="block text-xs font-medium text-slate-500 mb-1.5">
                        Additional Benefits
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {patientData.counselling.additionalbenefits.map(
                          (benefit, idx) => (
                            <span
                              key={idx}
                              className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-medium"
                            >
                              {benefit}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {patientData.counselling?.notes && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="block text-xs font-semibold text-slate-600 mb-1">
                      Counsellor Notes
                    </span>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                      {patientData.counselling.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Medical Information */}
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                  MEDICAL INFORMATION
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                      Vital Signs
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs text-slate-500">
                          Blood Pressure
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.bp || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500">
                          Sugar Level
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.sugar || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500">
                          Pulse Rate
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.pulse || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500">
                          Weight
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.weight || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-lg border border-slate-200 space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Medical Background
                    </h3>
                    <div>
                      <span className="block text-xs text-slate-500">
                        Allergies
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {patientData.medical?.allergies || "None"}
                      </p>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">
                        Medical History
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {patientData.medical?.medicalHistory || "None"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="block text-xs text-slate-500">
                          HIV Status
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.hiv || "Not tested"}
                        </p>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500">
                          HCV Status
                        </span>
                        <p className="text-sm font-semibold text-slate-900">
                          {patientData.medical?.hcv || "Not tested"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">
                  PAYMENT INFORMATION
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center">
                    <span className="block text-xs text-slate-500 font-medium mb-1">
                      Total Amount
                    </span>
                    <p className="text-base font-bold text-slate-900">
                      {formatCurrency(patientData.payments?.totalAmount)}
                    </p>
                  </div>
                  <div className="bg-emerald-50/60 p-3.5 rounded-lg border border-emerald-200 text-center">
                    <span className="block text-xs text-emerald-700 font-medium mb-1">
                      Amount Received
                    </span>
                    <p className="text-base font-bold text-emerald-700">
                      {formatCurrency(patientData.payments?.amountReceived)}
                    </p>
                  </div>
                  <div className="bg-blue-50/60 p-3.5 rounded-lg border border-blue-200 text-center">
                    <span className="block text-xs text-blue-700 font-medium mb-1">
                      Total Discount
                    </span>
                    <p className="text-base font-bold text-blue-700">
                      {formatCurrency(patientData.payments?.discount)}
                    </p>
                  </div>
                  <div className="bg-rose-50/60 p-3.5 rounded-lg border border-rose-200 text-center">
                    <span className="block text-xs text-rose-700 font-medium mb-1">
                      Pending Amount
                    </span>
                    <p className="text-base font-bold text-rose-700">
                      {formatCurrency(patientData.payments?.pendingAmount)}
                    </p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 bg-purple-50/60 p-3.5 rounded-lg border border-purple-200 text-center">
                    <span className="block text-xs text-purple-700 font-medium mb-1">
                      Medicine Amount
                    </span>
                    <p className="text-base font-bold text-purple-700">
                      {formatCurrency(patientData.payments?.medicineAmount)}
                    </p>
                  </div>
                </div>

                {/* Transaction History */}
                {patientData.payments?.transactions &&
                patientData.payments.transactions.length > 0 ? (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Transaction History
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Date</th>
                            <th className="px-4 py-2.5">Payment Type</th>
                            <th className="px-4 py-2.5">Branch</th>
                            <th className="px-4 py-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {patientData.payments.transactions.map((txn, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50/80 transition-colors"
                            >
                              <td className="px-4 py-2 text-slate-700">
                                {formatDate(txn.date)}
                              </td>
                              <td className="px-4 py-2 text-slate-700 capitalize">
                                {txn.paymentType || txn.method || "N/A"}
                              </td>
                              <td className="px-4 py-2 text-slate-600">
                                {txn.branch || "N/A"}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-slate-900">
                                {formatCurrency(txn.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    No transactions recorded yet.
                  </p>
                )}
              </div>

              {/* Electronic Record Footer */}
              <div className="mt-8 pt-6 border-t border-slate-300 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">
                  This is an electronically generated medical record. No
                  signature required.
                </p>
                <p className="mt-1 text-slate-400">
                  Generated on{" "}
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  at {new Date().toLocaleTimeString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-center items-center gap-3 pt-2 pb-8">
            <button
              onClick={() => router.push("/sales/patients")}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-sm bg-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patients
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              {generatingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF Report
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}