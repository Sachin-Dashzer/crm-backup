/**
 * seed.js — one-time migration script
 *
 * Finds all NOT_CONVERTED patients whose amountReceived > 499
 * and sets their ops.status to CONSULTED.
 *
 * Run: node seed.js
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";

/* ── Load .env.local without requiring dotenv ── */
try {
  const envPath = resolve(process.cwd(), ".env");
  const lines   = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {
  console.error("Could not read .env.local — make sure it exists in the project root.");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set in .env.local");
  process.exit(1);
}

/* ── Inline Patient schema (avoids Next.js path aliases) ── */
const patientSchema = new mongoose.Schema({}, { strict: false });
const Patient =
  mongoose.models.Patient || mongoose.model("Patient", patientSchema);

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("Connected.\n");

  /* ── Preview: find matching patients first ── */
  const candidates = await Patient.find(
    {
      "ops.status":              "NOT_CONVERTED",
      "payments.amountReceived": { $gt: 499 },
    },
    { "personal.name": 1, "personal.phone": 1, "payments.amountReceived": 1 }
  ).lean();

  if (candidates.length === 0) {
    console.log("No NOT_CONVERTED patients with amountReceived > 499 found. Nothing to update.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${candidates.length} patient(s) to update:\n`);
  candidates.forEach((p, i) => {
    const name   = p.personal?.name  || "-";
    const phone  = p.personal?.phone || "-";
    const amount = p.payments?.amountReceived ?? 0;
    console.log(`  ${i + 1}. ${name} (${phone}) -- received Rs.${amount}`);
  });

  /* ── Perform the bulk update (bypasses pre-save hook intentionally) ── */
  console.log("\nUpdating ops.status -> CONSULTED ...");
  const result = await Patient.updateMany(
    {
      "ops.status":              "NOT_CONVERTED",
      "payments.amountReceived": { $gt: 499 },
    },
    { $set: { "ops.status": "CONSULTED" } }
  );

  console.log(`\nDone. ${result.modifiedCount} patient(s) updated to CONSULTED.`);

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch((err) => {
  console.error("Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
