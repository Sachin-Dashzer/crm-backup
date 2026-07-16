// One-off data migration: rewrite legacy method: "Loan" transactions to "bajaj_loan".
//
// Background: the payment method "Loan" was split into two specific lenders,
// "bajaj_loan" and "fibe_loan". The Transactions/Audit schema enums no longer
// accept "Loan", so any old document still holding that value needs to be
// reassigned before it can be edited/re-saved. This script defaults every
// existing "Loan" record to "bajaj_loan" (per instruction) — if some of those
// were actually Fibe loans, re-run the "fibe_loan" cases through your admin
// panel afterward and pick the correct one by hand.
//
// Usage (dry run by default — shows what would change, writes nothing):
//   node --env-file=.env scripts/migrate-loan-to-bajaj.js
//
// Usage (apply the update for real):
//   node --env-file=.env scripts/migrate-loan-to-bajaj.js --apply

import mongoose from "mongoose";

// Minimal local schemas instead of importing the real model files: the real
// files use extension-less relative imports (fine under Next.js's bundler,
// but not under plain Node ESM) and pull in unrelated models transitively.
// `strict: false` lets .lean() reads still return every field actually
// stored on the document; we only need `method` for the update itself.
const Transactions = mongoose.model("Transactions", new mongoose.Schema({ method: String }, { strict: false }));
const Audit = mongoose.model("Audit", new mongoose.Schema({ method: String }, { strict: false }));

const APPLY = process.argv.includes("--apply");
const LEGACY_METHOD_MATCH = /^loan$/i;
const NEW_METHOD = "bajaj_loan";

async function migrateCollection(Model, label) {
  const filter = { method: LEGACY_METHOD_MATCH };
  const matches = await Model.find(filter, { _id: 1, date: 1, amount: 1, branch: 1 }).lean();

  console.log(`\n${label}: found ${matches.length} record(s) with method "Loan".`);
  if (matches.length === 0) return { label, matched: 0, modified: 0 };

  const preview = matches.slice(0, 5);
  for (const doc of preview) {
    console.log(`  - ${doc._id}  date=${doc.date?.toISOString?.().slice(0, 10) ?? doc.date}  amount=${doc.amount}  branch=${doc.branch}`);
  }
  if (matches.length > preview.length) {
    console.log(`  ...and ${matches.length - preview.length} more`);
  }

  if (!APPLY) {
    return { label, matched: matches.length, modified: 0 };
  }

  const result = await Model.updateMany(filter, { $set: { method: NEW_METHOD } });
  console.log(`  -> updated ${result.modifiedCount} record(s) to method "${NEW_METHOD}".`);
  return { label, matched: matches.length, modified: result.modifiedCount };
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/migrate-loan-to-bajaj.js");
  }

  console.log(APPLY ? "Running in APPLY mode — changes will be written." : "Running in DRY-RUN mode — no changes will be written. Pass --apply to write them.");

  await mongoose.connect(uri);

  const results = [];
  results.push(await migrateCollection(Transactions, "Transactions"));
  results.push(await migrateCollection(Audit, "Audit"));

  await mongoose.disconnect();

  const totalMatched = results.reduce((sum, r) => sum + r.matched, 0);
  const totalModified = results.reduce((sum, r) => sum + r.modified, 0);
  console.log(`\nDone. ${totalMatched} total record(s) matched, ${totalModified} updated.`);
  if (!APPLY && totalMatched > 0) {
    console.log("Re-run with --apply to write these changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
