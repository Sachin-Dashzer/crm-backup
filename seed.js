/**
 * seed.js — patient status migration script
 *
 * Recalculates ops.status for every patient using the current rules
 * (applied low → high priority; each later step overwrites earlier ones):
 *
 *   visitDate < now                          → NOT_VISITED
 *   counsellor set  AND  amountReceived = 0  → NOT_CONVERTED
 *   amountReceived > 0                       → BOOKING_DONE
 *   totalAmount > 0  AND  pendingAmount ≤ 0  → SURGERY_BOOKED
 *   surgeryDate set                          → CLOSED  (highest priority)
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

/* ──────────────────────────────────────────────────────────────
   Step definitions — applied in order, later steps overwrite.
   Queries are intentionally simple (no exclusions needed).
────────────────────────────────────────────────────────────── */
const STEPS = [
  {
    status: "NOT_VISITED",
    label:  "visitDate is in the past",
    query:  { "personal.visitDate": { $exists: true, $ne: null, $lt: now } },
  },
  {
    status: "NOT_CONVERTED",
    label:  "counsellor assigned AND amountReceived = 0 / not set",
    query:  {
      "counselling.counsellor":  { $exists: true, $ne: null },
      "payments.amountReceived": { $not: { $gt: 0 } },   // matches null, missing, 0
    },
  },
  {
    status: "BOOKING_DONE",
    label:  "amountReceived > 0  (SURGERY_BOOKED overwrites if fully paid)",
    query:  { "payments.amountReceived": { $gt: 0 } },
  },
  {
    status: "SURGERY_BOOKED",
    label:  "totalAmount > 0  AND  pendingAmount ≤ 0",
    query:  {
      "payments.totalAmount":   { $gt: 0 },
      "payments.pendingAmount": { $lte: 0 },
    },
  },
  {
    status: "CLOSED",
    label:  "surgery date is confirmed  (highest priority — overwrites all above)",
    query:  { "surgery.surgeryDate": { $exists: true, $ne: null } },
  },
];

const ALL_STATUSES = [
  "NEW", "NOT_VISITED", "NOT_CONVERTED",
  "BOOKING_DONE", "SURGERY_BOOKED", "CLOSED", "CONSULTED",
];

async function printCounts(heading) {
  console.log(`── ${heading}`);
  let total = 0;
  for (const s of ALL_STATUSES) {
    const n = await Patient.countDocuments({ "ops.status": s });
    if (n > 0) {
      console.log(`   ${s.padEnd(16)} : ${n}`);
      total += n;
    }
  }
  // catch any unlisted / legacy status values
  const grand = await Patient.countDocuments({});
  const other = grand - total;
  if (other > 0) console.log(`   ${"(other)".padEnd(16)} : ${other}`);
  console.log(`   ${"TOTAL".padEnd(16)} : ${grand}\n`);
}

async function connectWithRetry(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Connecting to MongoDB (attempt ${attempt}/${retries})...`);
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS:         15000,
        maxPoolSize:              1,   // use only 1 connection — avoids Atlas M0 limits
        minPoolSize:              0,
      });
      console.log("Connected.\n");
      return;
    } catch (err) {
      console.error(`  Connection failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`  Retrying in ${delayMs / 1000}s...\n`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        console.error("\n  All connection attempts failed.");
        console.error("  Tip: stop the Next.js dev server (Ctrl+C) before running this script,");
        console.error("  then run: node seed.js\n");
        process.exit(1);
      }
    }
  }
}

async function run() {
  await connectWithRetry();

  await printCounts("Before migration");

  /* ── Step 0: baseline reset — every patient starts as NEW ── */
  console.log("── Step 0 · Reset all → NEW");
  const reset = await Patient.updateMany({}, { $set: { "ops.status": "NEW" } });
  console.log(`   ${reset.modifiedCount} patient(s) set to NEW\n`);

  /* ── Steps 1-5: apply rules low → high priority ── */
  for (let i = 0; i < STEPS.length; i++) {
    const { status, label, query } = STEPS[i];
    console.log(`── Step ${i + 1} · ${status}  —  ${label}`);
    const matching = await Patient.countDocuments(query);
    console.log(`   Matching : ${matching}`);
    if (matching > 0) {
      const r = await Patient.updateMany(query, { $set: { "ops.status": status } });
      console.log(`   Updated  : ${r.modifiedCount}`);
    }
    console.log("");
  }

  await printCounts("After migration");

  await mongoose.disconnect();
  console.log("Disconnected. Done.");
}

run().catch((err) => {
  console.error("Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
