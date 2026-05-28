/**
 * seed.js — status migration script
 *
 * Recalculates ops.status for every patient using the new rules:
 *   surgeryDate set              → CLOSED
 *   totalAmount > 0 & pending ≤ 0 → SURGERY_BOOKED
 *   amountReceived > 0           → BOOKING_DONE
 *   counsellor set               → CONSULTED
 *   visitDate < now              → NOT_VISITED
 *   otherwise                    → NEW
 *
 * Run: node seed.js
 */

import { readFileSync } from "fs";
import { resolve }      from "path";
import mongoose         from "mongoose";

/* ── Load .env ── */
try {
  const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
} catch {
  console.error("Could not read .env — make sure it exists in the project root.");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const patientSchema = new mongoose.Schema({}, { strict: false });
const Patient = mongoose.models.Patient || mongoose.model("Patient", patientSchema);

const now = new Date();

/* ── Status conditions (applied low → high priority so later ones override) ── */
const STEPS = [
  {
    status: "NEW",
    label:  "NEW (baseline — all patients not matched by any rule below)",
    query:  {
      "personal.visitDate":       { $gte: now },
      "counselling.counsellor":   { $in: [null, undefined] },
      "payments.amountReceived":  { $in: [null, 0] },
      "surgery.surgeryDate":      { $in: [null, undefined] },
    },
  },
  {
    status: "NOT_VISITED",
    label:  "NOT_VISITED (visitDate is in the past, nothing else filled)",
    query:  {
      "personal.visitDate":      { $lt: now },
      "counselling.counsellor":  { $in: [null, undefined] },
      "payments.amountReceived": { $in: [null, 0] },
      "surgery.surgeryDate":     { $in: [null, undefined] },
    },
  },
  {
    status: "NOT_CONVERTED",
    label:  "NOT_CONVERTED (counsellor assigned, amountReceived = 0, no surgery date)",
    query:  {
      "counselling.counsellor":  { $exists: true, $ne: null },
      "payments.amountReceived": { $in: [null, 0] },
      "surgery.surgeryDate":     { $in: [null, undefined] },
    },
  },
  {
    status: "BOOKING_DONE",
    label:  "BOOKING_DONE (amountReceived > 0, pending still > 0 or not set)",
    query:  {
      "payments.amountReceived": { $gt: 0 },
      "surgery.surgeryDate":     { $in: [null, undefined] },
      $or: [
        { "payments.pendingAmount": { $gt: 0 } },
        { "payments.pendingAmount": { $exists: false } },
        { "payments.totalAmount":   { $in: [null, 0] } },
      ],
    },
  },
  {
    status: "SURGERY_BOOKED",
    label:  "SURGERY_BOOKED (totalAmount > 0 and pendingAmount ≤ 0)",
    query:  {
      "payments.totalAmount":   { $gt: 0 },
      "payments.pendingAmount": { $lte: 0 },
      "surgery.surgeryDate":    { $in: [null, undefined] },
    },
  },
  {
    status: "CLOSED",
    label:  "CLOSED (surgery date is set)",
    query:  {
      "surgery.surgeryDate": { $exists: true, $ne: null },
    },
  },
];

async function printCurrentCounts() {
  const statuses = ["NEW", "NOT_VISITED", "NOT_CONVERTED", "BOOKING_DONE", "SURGERY_BOOKED", "CLOSED", "CONSULTED"];
  console.log("  Current status counts:");
  for (const s of statuses) {
    const n = await Patient.countDocuments({ "ops.status": s });
    if (n > 0) console.log(`    ${s.padEnd(16)} : ${n}`);
  }
  const total = await Patient.countDocuments({});
  console.log(`    ${"TOTAL".padEnd(16)} : ${total}`);
}

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected.\n");

  const total = await Patient.countDocuments({});
  console.log(`Total patients in DB: ${total}\n`);

  console.log("── Before migration ─────────────────────────────");
  await printCurrentCounts();
  console.log("");

  /* ── First pass: reset every patient to NEW ── */
  console.log("── Step 0: Reset all patients to NEW ...");
  const reset = await Patient.updateMany({}, { $set: { "ops.status": "NEW" } });
  console.log(`   ${reset.modifiedCount} patient(s) reset to NEW.\n`);

  /* ── Apply each rule in priority order (low → high, so later ones win) ── */
  for (const step of STEPS) {
    if (step.status === "NEW") continue; // already set in reset
    console.log(`── ${step.label}`);
    const preview = await Patient.countDocuments(step.query);
    console.log(`   Matching: ${preview}`);
    if (preview > 0) {
      const r = await Patient.updateMany(step.query, { $set: { "ops.status": step.status } });
      console.log(`   Updated:  ${r.modifiedCount}`);
    }
    console.log("");
  }

  console.log("── After migration ──────────────────────────────");
  await printCurrentCounts();

  await mongoose.disconnect();
  console.log("\nDisconnected. Migration complete.");
}

run().catch((err) => {
  console.error("Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
