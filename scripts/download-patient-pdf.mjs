// Downloads one patient's full record — personal/medical/counselling/surgery/
// payments/products fields plus every uploaded document (images, consent
// form, surgery form, consult form) — into a single PDF file.
//
// Follows the same "minimal local schema, raw db.collection() reads" approach
// as the other one-off scripts in this folder: the real model files use
// extension-less relative imports and "@/..." path aliases that only Next.js's
// bundler resolves, so importing them under plain Node ESM would fail.
//
// Usage:
//   node --env-file=.env scripts/download-patient-pdf.mjs [phone] [outputPath]
//
// Examples:
//   node --env-file=.env scripts/download-patient-pdf.mjs
//   node --env-file=.env scripts/download-patient-pdf.mjs 7252052898
//   node --env-file=.env scripts/download-patient-pdf.mjs 7252052898 ./downloads/report.pdf

import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PHONE       = process.argv[2] || "7252052898";
const OUTPUT_ARG  = process.argv[3] || null;

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set. Run with: node --env-file=.env scripts/download-patient-pdf.mjs");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");
const db = mongoose.connection.db;

const patient = await db.collection("patients").findOne({ "personal.phone": PHONE });
if (!patient) {
  console.error(`No patient found with phone "${PHONE}"`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`Found patient: ${patient.personal?.name || "(no name)"} — ${PHONE}`);

/* ── Resolve Employee refs (counsellor, reference, surgery team) ───────── */
const employeeIds = [
  patient.counselling?.counsellor,
  patient.personal?.reference,
  ...(patient.surgery?.doctor || []),
  ...(patient.surgery?.seniorTech || []),
  ...(patient.surgery?.implanterRight || []),
  ...(patient.surgery?.implanterLeft || []),
  ...(patient.surgery?.graftingPerson || []),
  ...(patient.surgery?.helper || []),
].filter(Boolean);

const employees = employeeIds.length
  ? await db.collection("employees").find({ _id: { $in: employeeIds } }).toArray()
  : [];
const empName = (id) => employees.find((e) => String(e._id) === String(id))?.name || String(id);
const empNames = (ids) => (ids || []).map(empName).join(", ") || null;

/* ── Resolve transactions ───────────────────────────────────────────────── */
const txIds = patient.payments?.transactions || [];
const transactions = txIds.length
  ? await db.collection("transactions").find({ _id: { $in: txIds } }).sort({ date: 1 }).toArray()
  : [];

/* ── Resolve stock/product names ────────────────────────────────────────── */
const stockIds = (patient.products || []).map((p) => p.stocks).filter(Boolean);
const stocks = stockIds.length
  ? await db.collection("stocks").find({ _id: { $in: stockIds } }).toArray()
  : [];
const stockName = (id) => stocks.find((s) => String(s._id) === String(id))?.name || String(id);

/* ── PDF setup ───────────────────────────────────────────────────────────── */
const pdfDoc   = await PDFDocument.create();
const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

const PAGE_W = 595.28, PAGE_H = 841.89; // A4
const MARGIN = 50;
const LINE_H = 16;

let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
let y = PAGE_H - MARGIN;

function newPage() {
  page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  y = PAGE_H - MARGIN;
}

function ensureSpace(needed) {
  if (y - needed < MARGIN) newPage();
}

function wrapText(text, useFont, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (useFont.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function sectionTitle(title) {
  ensureSpace(LINE_H * 2 + 10);
  y -= 10;
  page.drawText(title, { x: MARGIN, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
    thickness: 1, color: rgb(0.7, 0.7, 0.8),
  });
  y -= LINE_H;
}

function kv(label, value) {
  if (value === undefined || value === null || value === "") return;
  const text = `${label}: ${formatValue(value)}`;
  const lines = wrapText(text, font, 11, PAGE_W - MARGIN * 2);
  for (const line of lines) {
    ensureSpace(LINE_H);
    page.drawText(line, { x: MARGIN, y, size: 11, font });
    y -= LINE_H;
  }
}

function formatValue(v) {
  if (v instanceof Date) return v.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

/* ── Title page ──────────────────────────────────────────────────────────── */
page.drawText("Patient Report", { x: MARGIN, y, size: 22, font: boldFont });
y -= 30;
page.drawText(`Generated: ${new Date().toLocaleString("en-IN")}`, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
y -= LINE_H * 2;

/* ── Personal ────────────────────────────────────────────────────────────── */
sectionTitle("Personal Information");
const p = patient.personal || {};
kv("Name", p.name);
kv("Phone", p.phone);
kv("Email", p.email);
kv("Age", p.age);
kv("Gender", p.gender);
kv("Branch", p.branch);
kv("Address", p.address);
kv("Profession", p.profession);
kv("Visit Date", p.visitDate);
kv("Reference", p.reference ? empName(p.reference) : null);
kv("Purpose", p.purpose);
kv("Package Quoted", p.packageQuoted != null ? `Rs. ${Number(p.packageQuoted).toLocaleString("en-IN")}` : null);
kv("Technique Quoted", p.techniqueQuoted);
kv("Remarks", p.remarks);
kv("Status", patient.ops?.status);

/* ── Counselling ─────────────────────────────────────────────────────────── */
const c = patient.counselling || {};
if (Object.keys(c).length) {
  sectionTitle("Counselling");
  kv("Counsellor", c.counsellor ? empName(c.counsellor) : null);
  kv("Technique Suggested", c.techniqueSuggested);
  kv("Final Package", c.finlpackage != null ? `Rs. ${Number(c.finlpackage).toLocaleString("en-IN")}` : null);
  kv("Grafts Suggested", c.graftsSuggested);
  kv("Ready For Surgery", c.readyForSurgery);
  kv("Hair Loss Type", c.hairlossType);
  kv("Area of Concern", c.areaofConcern);
  kv("Hair Loss Reason", c.hairlossreason);
  kv("Hair Loss Duration", c.hairlossduration);
  kv("Additional Benefits", c.additionalbenefits);
  kv("Medicines", c.medicines);
  kv("Notes", c.notes);
}

/* ── Medical ─────────────────────────────────────────────────────────────── */
const m = patient.medical || {};
if (Object.keys(m).length) {
  sectionTitle("Medical");
  kv("Blood Group", m.bloodGroup);
  kv("Allergies", m.allergies);
  kv("Medical History", m.medicalHistory);
  kv("Sugar", m.sugar);
  kv("BP", m.bp);
  kv("Pulse", m.pulse);
  kv("Weight", m.weight);
  kv("HIV", m.hiv);
  kv("HCV", m.hcv);
}

/* ── Surgery ─────────────────────────────────────────────────────────────── */
const s = patient.surgery || {};
if (Object.keys(s).length) {
  sectionTitle("Surgery");
  kv("Surgery Date", s.surgeryDate);
  kv("Location", s.location);
  kv("OT", s.OT);
  kv("Technique", s.technique);
  kv("Grafts Needed", s.graftsneed);
  kv("Grafts Implanted", s.graftsImplanted);
  kv("Donor Condition", s.donorCondition);
  kv("Doctor(s)", empNames(s.doctor));
  kv("Senior Tech(s)", empNames(s.seniorTech));
  kv("Implanter Right", empNames(s.implanterRight));
  kv("Implanter Left", empNames(s.implanterLeft));
  kv("Grafting Person(s)", empNames(s.graftingPerson));
  kv("Helper(s)", empNames(s.helper));
}

/* ── After Surgery ───────────────────────────────────────────────────────── */
const as = patient.afterSurgery || {};
if (as.headwashDate || as.bandageRemovalDate || (as.prp || []).length) {
  sectionTitle("After Surgery");
  kv("Headwash Date", as.headwashDate);
  kv("Bandage Removal Date", as.bandageRemovalDate);
  for (const session of as.prp || []) {
    kv(`Session #${session.prpNumber ?? "-"} (${session.type || "PRP"})`, session.date);
  }
}

/* ── Payments ────────────────────────────────────────────────────────────── */
const pay = patient.payments || {};
sectionTitle("Payments Summary");
kv("Total Amount", pay.totalAmount != null ? `Rs. ${Number(pay.totalAmount).toLocaleString("en-IN")}` : null);
kv("Amount Received", pay.amountReceived != null ? `Rs. ${Number(pay.amountReceived).toLocaleString("en-IN")}` : null);
kv("Pending Amount", pay.pendingAmount != null ? `Rs. ${Number(pay.pendingAmount).toLocaleString("en-IN")}` : null);
kv("Medicine Amount", pay.medicineAmount != null ? `Rs. ${Number(pay.medicineAmount).toLocaleString("en-IN")}` : null);
kv("Discount", pay.discount != null ? `Rs. ${Number(pay.discount).toLocaleString("en-IN")}` : null);

if (transactions.length) {
  y -= 6;
  ensureSpace(LINE_H);
  page.drawText(`Transactions (${transactions.length})`, { x: MARGIN, y, size: 11, font: boldFont });
  y -= LINE_H;
  for (const t of transactions) {
    const line = `${formatValue(t.date)} | ${t.procedure || t.expense || t.transactionCategory || "-"} | ${t.method || "-"} | Rs. ${Number(t.amount || 0).toLocaleString("en-IN")} | ${t.paymentType || "-"}`;
    for (const wrapped of wrapText(line, font, 10, PAGE_W - MARGIN * 2 - 10)) {
      ensureSpace(LINE_H - 2);
      page.drawText(wrapped, { x: MARGIN + 10, y, size: 10, font });
      y -= LINE_H - 2;
    }
  }
}

/* ── Products ────────────────────────────────────────────────────────────── */
if ((patient.products || []).length) {
  sectionTitle("Products / Medicines Used");
  for (const prod of patient.products) {
    kv(stockName(prod.stocks), `Qty ${prod.quantity ?? "-"}, Rs. ${Number(prod.amount || 0).toLocaleString("en-IN")}`);
  }
}

/* ── Documents & Images appendix ─────────────────────────────────────────── */
const docBuckets = [
  ["Photos", patient.documents?.images || []],
  ["Consent Form", patient.documents?.consentForm || []],
  ["Surgery Form", patient.documents?.suregeryForm || []],
  ["Consult Form", patient.documents?.consultForm || []],
];
const totalDocs = docBuckets.reduce((n, [, urls]) => n + urls.length, 0);

if (totalDocs) {
  sectionTitle(`Documents & Images (${totalDocs})`);
  const failed = [];
  let done = 0;
  for (const [label, urls] of docBuckets) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      done++;
      const caption = `${label} ${urls.length > 1 ? `#${i + 1}` : ""}`.trim();
      process.stdout.write(`  embedding ${done}/${totalDocs} — ${caption}... `);
      const ok = await embedDocument(pdfDoc, font, boldFont, url, caption);
      console.log(ok ? "ok" : "FAILED");
      if (!ok) failed.push({ caption, url });
    }
  }
  if (failed.length) {
    newPage();
    sectionTitle("Documents that could not be embedded");
    for (const f of failed) kv(f.caption, f.url);
  }
}

async function embedDocument(doc, plainFont, headingFont, url, caption) {
  let buf;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn(`\n    fetch failed for ${url}: ${err.message}`);
    return false;
  }

  // Try image first (jpg, then png), then fall back to treating it as a PDF.
  let img = null;
  try {
    img = await doc.embedJpg(buf);
  } catch {
    try {
      img = await doc.embedPng(buf);
    } catch {
      img = null;
    }
  }

  if (img) {
    const docPage = doc.addPage([PAGE_W, PAGE_H]);
    const maxW = PAGE_W - MARGIN * 2;
    const maxH = PAGE_H - MARGIN * 2 - 30;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale, h = img.height * scale;
    docPage.drawText(caption, { x: MARGIN, y: PAGE_H - MARGIN, size: 12, font: headingFont });
    docPage.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2 - 10, width: w, height: h });
    return true;
  }

  try {
    const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const copied = await doc.copyPages(srcDoc, srcDoc.getPageIndices());
    copied.forEach((cp) => doc.addPage(cp));
    return true;
  } catch (err) {
    console.warn(`\n    could not embed as image or PDF (${url}): ${err.message}`);
    return false;
  }
}

/* ── Save ────────────────────────────────────────────────────────────────── */
const safeName = (p.name || "patient").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
const outputPath = OUTPUT_ARG
  ? path.resolve(OUTPUT_ARG)
  : path.resolve(`downloads/patient-${PHONE}-${safeName}.pdf`);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, await pdfDoc.save());

console.log(`\nSaved: ${outputPath}`);

await mongoose.disconnect();
