// Generates one PDF report — same format as download-patient-pdf.mjs — for
// every patient whose ops.status is "CLOSED". One file per patient, written
// into an output folder.
//
// Follows the same "minimal local schema, raw db.collection() reads" approach
// as the other one-off scripts in this folder: the real model files use
// extension-less relative imports and "@/..." path aliases that only Next.js's
// bundler resolves, so importing them under plain Node ESM would fail.
//
// All employee / transaction / stock references used across every closed
// patient are resolved with three batched queries up front (not one query
// per patient per reference), so this stays fast no matter how many closed
// cases there are.
//
// Usage:
//   node --env-file=.env scripts/download-closed-cases-pdf.mjs [outputDir] [limit]
//
// Examples:
//   node --env-file=.env scripts/download-closed-cases-pdf.mjs
//   node --env-file=.env scripts/download-closed-cases-pdf.mjs ./downloads/closed-cases
//   node --env-file=.env scripts/download-closed-cases-pdf.mjs ./downloads/closed-cases 10   (test run — first 10 only)

import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUTPUT_DIR = process.argv[2] || "downloads/closed-cases";
const LIMIT      = process.argv[3] ? parseInt(process.argv[3], 10) : null;

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not set. Run with: node --env-file=.env scripts/download-closed-cases-pdf.mjs");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");
const db = mongoose.connection.db;

let cursor = db.collection("patients").find({ "ops.status": "CLOSED" }).sort({ "personal.visitDate": -1 });
if (LIMIT) cursor = cursor.limit(LIMIT);
const patients = await cursor.toArray();

if (!patients.length) {
  console.log('No patients with ops.status "CLOSED" found.');
  await mongoose.disconnect();
  process.exit(0);
}
console.log(`Found ${patients.length} closed case(s). Generating PDFs into "${OUTPUT_DIR}"...\n`);

/* ── Batch-resolve every reference used by any closed patient, up front ──── */
const employeeIdSet = new Set();
const txIdSet        = new Set();
const stockIdSet      = new Set();
for (const patient of patients) {
  [
    patient.counselling?.counsellor,
    patient.personal?.reference,
    ...(patient.surgery?.doctor || []),
    ...(patient.surgery?.seniorTech || []),
    ...(patient.surgery?.implanterRight || []),
    ...(patient.surgery?.implanterLeft || []),
    ...(patient.surgery?.graftingPerson || []),
    ...(patient.surgery?.helper || []),
  ].filter(Boolean).forEach((id) => employeeIdSet.add(String(id)));
  (patient.payments?.transactions || []).forEach((id) => txIdSet.add(String(id)));
  (patient.products || []).forEach((prod) => prod.stocks && stockIdSet.add(String(prod.stocks)));
}
const toObjectIds = (set) => [...set].map((id) => new mongoose.Types.ObjectId(id));

const [employees, transactions, stocks] = await Promise.all([
  employeeIdSet.size ? db.collection("employees").find({ _id: { $in: toObjectIds(employeeIdSet) } }).toArray() : [],
  txIdSet.size       ? db.collection("transactions").find({ _id: { $in: toObjectIds(txIdSet) } }).toArray()     : [],
  stockIdSet.size    ? db.collection("stocks").find({ _id: { $in: toObjectIds(stockIdSet) } }).toArray()        : [],
]);
console.log(`Resolved ${employees.length} employee(s), ${transactions.length} transaction(s), ${stocks.length} stock(s) across all closed cases.\n`);

const empName    = (id) => employees.find((e) => String(e._id) === String(id))?.name || String(id);
const empNames   = (ids) => (ids || []).map(empName).join(", ") || null;
const txById     = new Map(transactions.map((t) => [String(t._id), t]));
const stockName  = (id) => stocks.find((s) => String(s._id) === String(id))?.name || String(id);

/* ── Shared, patient-independent helpers ────────────────────────────────── */
const PAGE_W = 595.28, PAGE_H = 841.89; // A4
const MARGIN = 54; // a touch more breathing room than a bare-bones report
const LINE_H = 17; // a touch more line spacing for readability

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

function formatValue(v) {
  if (v instanceof Date) return v.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

/* ── Build one PDF for one patient (mirrors download-patient-pdf.mjs) ────── */
async function buildPdfForPatient(patient) {
  const pdfDoc   = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }

  function ensureSpace(needed) {
    if (y - needed < MARGIN) newPage();
  }

  function sectionTitle(title) {
    // Reserve room for the title plus at least one content line, so a
    // heading never gets stranded alone at the bottom of a page.
    ensureSpace(LINE_H * 2 + 10 + 60);
    y -= 12; // padding above each section
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

  /* ── Title page ──────────────────────────────────────────────────────── */
  page.drawText("Patient Report", { x: MARGIN, y, size: 22, font: boldFont });
  y -= 30;
  page.drawText(`Generated: ${new Date().toLocaleString("en-IN")}`, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= LINE_H * 2;

  /* ── Personal ────────────────────────────────────────────────────────── */
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

  /* ── Counselling ─────────────────────────────────────────────────────── */
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

  /* ── Medical ─────────────────────────────────────────────────────────── */
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

  /* ── Surgery ─────────────────────────────────────────────────────────── */
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

  /* ── After Surgery ───────────────────────────────────────────────────── */
  const as = patient.afterSurgery || {};
  if (as.headwashDate || as.bandageRemovalDate || (as.prp || []).length) {
    sectionTitle("After Surgery");
    kv("Headwash Date", as.headwashDate);
    kv("Bandage Removal Date", as.bandageRemovalDate);
    for (const session of as.prp || []) {
      kv(`Session #${session.prpNumber ?? "-"} (${session.type || "PRP"})`, session.date);
    }
  }

  /* ── Payments ────────────────────────────────────────────────────────── */
  const pay = patient.payments || {};
  sectionTitle("Payments Summary");
  kv("Total Amount", pay.totalAmount != null ? `Rs. ${Number(pay.totalAmount).toLocaleString("en-IN")}` : null);
  kv("Amount Received", pay.amountReceived != null ? `Rs. ${Number(pay.amountReceived).toLocaleString("en-IN")}` : null);
  kv("Pending Amount", pay.pendingAmount != null ? `Rs. ${Number(pay.pendingAmount).toLocaleString("en-IN")}` : null);
  kv("Medicine Amount", pay.medicineAmount != null ? `Rs. ${Number(pay.medicineAmount).toLocaleString("en-IN")}` : null);
  kv("Discount", pay.discount != null ? `Rs. ${Number(pay.discount).toLocaleString("en-IN")}` : null);

  const patientTx = (patient.payments?.transactions || [])
    .map((id) => txById.get(String(id)))
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (patientTx.length) {
    y -= 6;
    ensureSpace(LINE_H);
    page.drawText(`Transactions (${patientTx.length})`, { x: MARGIN, y, size: 11, font: boldFont });
    y -= LINE_H;
    for (const t of patientTx) {
      const line = `${formatValue(t.date)} | ${t.procedure || t.expense || t.transactionCategory || "-"} | ${t.method || "-"} | Rs. ${Number(t.amount || 0).toLocaleString("en-IN")} | ${t.paymentType || "-"}`;
      for (const wrapped of wrapText(line, font, 10, PAGE_W - MARGIN * 2 - 10)) {
        ensureSpace(LINE_H - 2);
        page.drawText(wrapped, { x: MARGIN + 10, y, size: 10, font });
        y -= LINE_H - 2;
      }
    }
  }

  /* ── Products ────────────────────────────────────────────────────────── */
  if ((patient.products || []).length) {
    sectionTitle("Products / Medicines Used");
    for (const prod of patient.products) {
      kv(stockName(prod.stocks), `Qty ${prod.quantity ?? "-"}, Rs. ${Number(prod.amount || 0).toLocaleString("en-IN")}`);
    }
  }

  /* ── Documents & Images appendix ─────────────────────────────────────── */
  const docBuckets = [
    ["Photos", patient.documents?.images || []],
    ["Consent Form", patient.documents?.consentForm || []],
    ["Surgery Form", patient.documents?.suregeryForm || []],
    ["Consult Form", patient.documents?.consultForm || []],
  ];
  const totalDocs = docBuckets.reduce((n, [, urls]) => n + urls.length, 0);

  async function embedDocument(url, caption) {
    let buf;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      return { ok: false, reason: `fetch failed: ${err.message}` };
    }

    let img = null;
    try { img = await pdfDoc.embedJpg(buf); }
    catch { try { img = await pdfDoc.embedPng(buf); } catch { img = null; } }

    if (img) {
      const docPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
      const maxW = PAGE_W - MARGIN * 2;
      const maxH = PAGE_H - MARGIN * 2 - 30;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      docPage.drawText(caption, { x: MARGIN, y: PAGE_H - MARGIN, size: 12, font: boldFont });
      docPage.drawImage(img, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2 - 10, width: w, height: h });
      return { ok: true };
    }

    try {
      const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const copied = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copied.forEach((cp) => pdfDoc.addPage(cp));
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: `not an image or PDF: ${err.message}` };
    }
  }

  if (totalDocs) {
    sectionTitle(`Documents & Images (${totalDocs})`);
    const failed = [];
    for (const [label, urls] of docBuckets) {
      for (let i = 0; i < urls.length; i++) {
        const caption = `${label} ${urls.length > 1 ? `#${i + 1}` : ""}`.trim();
        const result = await embedDocument(urls[i], caption);
        if (!result.ok) failed.push({ caption, url: urls[i], reason: result.reason });
      }
    }
    if (failed.length) {
      newPage();
      sectionTitle("Documents that could not be embedded");
      for (const f of failed) kv(f.caption, `${f.url} (${f.reason})`);
    }
  }

  /* ── Footer: page numbers on every page ─────────────────────────────── */
  const allPages = pdfDoc.getPages();
  allPages.forEach((pg, i) => {
    const label = `Page ${i + 1} of ${allPages.length}`;
    pg.drawText(label, {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8), y: MARGIN - 22, size: 8, font, color: rgb(0.6, 0.6, 0.6),
    });
    pg.drawText(p.name || p.phone || "Patient", { x: MARGIN, y: MARGIN - 22, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
  });

  return pdfDoc.save();
}

/* ── Generate one PDF per closed patient ──────────────────────────────── */
await fs.mkdir(OUTPUT_DIR, { recursive: true });
const failures = [];

for (let i = 0; i < patients.length; i++) {
  const patient = patients[i];
  const name  = patient.personal?.name || "unknown";
  const phone = patient.personal?.phone || "no-phone";
  process.stdout.write(`[${i + 1}/${patients.length}] ${name} (${phone})... `);
  try {
    const bytes = await buildPdfForPatient(patient);
    const safeName = String(name).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "patient";
    const outPath = path.join(OUTPUT_DIR, `patient-${phone}-${safeName}.pdf`);
    await fs.writeFile(outPath, bytes);
    console.log("ok");
  } catch (err) {
    console.log(`FAILED (${err.message})`);
    failures.push({ name, phone, error: err.message });
  }
}

console.log(`\nDone. ${patients.length - failures.length}/${patients.length} PDF(s) saved to ${path.resolve(OUTPUT_DIR)}`);
if (failures.length) {
  console.log(`${failures.length} failure(s):`);
  failures.forEach((f) => console.log(`  - ${f.name} (${f.phone}): ${f.error}`));
}

await mongoose.disconnect();
