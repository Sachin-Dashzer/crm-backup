// One-time backfill: sets createdAt on every existing Rent Payable (expenseCategory: "Rent",
// plus its linked TDS payable if any) to the 1st of its period.month/period.year.
//
// Why: the Liabilities page's date-range filter (/api/payables/list) and its opening/closing
// rollups (buildPayableGroupedStages' raisedInRange/raisedBeforeRange, src/lib/payableAggregation.js)
// both key off createdAt — the literal DB-insert timestamp — not dueDate or period. Every Rent
// payable-creating script found so far (scripts/april-rent-payables.mjs before its own fix,
// scripts/rent-opening-payables-march-2026.mjs, scripts/rent-payables-apr-jul-2026.mjs) used a
// bare `{ strict: false }` Mongoose schema with no `timestamps: true`, so createdAt was never
// written at all — not merely wrong. Without it, "Opening due" on the Liabilities page can only
// ever show 0 (nothing has a date to compare "before" a filter's `from`), and once a `from` date
// IS set, every payable with a missing createdAt evaluates as "before" it (BSON: missing sorts
// below a real Date), so opening would then wrongly include every regular month's payable too,
// not just the true pre-period opening balance.
//
// Only touches documents that HAVE period.month/period.year and whose createdAt doesn't already
// fall on the 1st of that month. A linked TDS payable (tdsLink.role === "TDS") is included when
// its parent is a Rent payable, so the two stay dated together.
//
// Dry run by default. Re-run with --apply to write.
//
//   node scripts/backfill-rent-payable-created-date.js
//   node scripts/backfill-rent-payable-created-date.js --apply

import mongoose from "mongoose";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error("MONGODB_URI not found in .env.local, .env, or the environment");
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false }), "payables");

// UTC-anchored, not a local-timezone constructor — matches how dueDate strings ("2026-04-01")
// parse elsewhere in this codebase, and stays correct regardless of which timezone the
// migration happens to run in vs. wherever the app server itself runs.
const firstOfMonth = (year, month) => new Date(Date.UTC(year, month - 1, 1));
const sameDay = (a, b) => a && b && new Date(a).toDateString() === new Date(b).toDateString();

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  const rentPayables = await Payable.find({
    expenseCategory: "Rent",
    "period.month": { $exists: true },
    "period.year": { $exists: true },
  }).lean();

  const rentIds = rentPayables.map((p) => p._id);
  const linkedTds = rentIds.length
    ? await Payable.find({
        "tdsLink.role": "TDS",
        "tdsLink.linkedId": { $in: rentIds },
      }).lean()
    : [];

  const all = [...rentPayables, ...linkedTds];
  console.log(`\nFound ${rentPayables.length} Rent payable(s) and ${linkedTds.length} linked TDS payable(s) — ${all.length} total.`);

  const changes = all
    .map((doc) => ({ doc, target: firstOfMonth(doc.period.year, doc.period.month) }))
    .filter(({ doc, target }) => !sameDay(doc.createdAt, target));

  console.log(`${changes.length} document(s) need createdAt corrected.`);
  if (changes.length === 0) {
    await mongoose.disconnect();
    return;
  }

  console.log("\nSample (up to 15):");
  for (const { doc, target } of changes.slice(0, 15)) {
    console.log(
      `   ${doc._id}  ${doc.payee?.label || doc.expenseSubType || "—"}  ${doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : "(unset)"} -> ${target.toISOString().slice(0, 10)}`,
    );
  }
  if (changes.length > 15) console.log(`   ... and ${changes.length - 15} more`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nApplying...");
  for (const { doc, target } of changes) {
    await Payable.updateOne({ _id: doc._id }, { $set: { createdAt: target } });
  }
  console.log(`Updated ${changes.length} document(s).`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
