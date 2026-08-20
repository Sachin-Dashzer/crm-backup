// Deletes every EXPENSE transaction in the "Rent" category (costType: "Expenses",
// expense: "Rent") — every branch, every date, no other filter.
//
// This is Transactions (actual money paid out and booked), NOT Payables (the "owed" documents
// on the Liabilities page — expenseCategory: "Rent" there is a different collection entirely;
// see scripts/backfill-rent-payable-created-date.js for that one).
//
// SAFETY:
//   - Dry run by default. Nothing is deleted until you pass --apply.
//   - Any matched row that CREATED a Payable/Receivable (externalParty.linkedPayableId/
//     linkedReceivableId, or collabRef.payableId/receivableId — see src/lib/cascadeIntegrity.js)
//     is reported and SKIPPED, exactly like the app's own delete routes would block it, unless
//     you also pass --force-linked.
//   - HARD delete. This codebase's own convention (see reverseTransaction.js,
//     cascadeIntegrity.js) is to reverse a financial row rather than hard-delete it, to keep the
//     audit trail intact. Only use this for rows that should never have existed — not to "undo"
//     a real rent payment that actually happened.
//
//   node scripts/delete-rent-expense-transactions.js                  (dry run)
//   node scripts/delete-rent-expense-transactions.js --apply          (delete, skip linked)
//   node scripts/delete-rent-expense-transactions.js --apply --force-linked

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
const FORCE_LINKED = args.includes("--force-linked");

const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false }), "transactions");
const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false }), "payables");
const Receivable = mongoose.models.Receivable || mongoose.model("Receivable", new mongoose.Schema({}, { strict: false }), "receivables");

// Mirrors creatorLinks() in src/lib/cascadeIntegrity.js — the two link shapes a transaction can
// carry that mean it CREATED a Payable/Receivable, not merely paid one.
function creatorLinks(txn) {
  const links = [];
  const ep = txn.externalParty || {};
  const cr = txn.collabRef || {};
  if (ep.linkedReceivableId) links.push({ kind: "receivable", id: ep.linkedReceivableId });
  if (ep.linkedPayableId) links.push({ kind: "payable", id: ep.linkedPayableId });
  if (cr.receivableId) links.push({ kind: "receivable", id: cr.receivableId });
  if (cr.payableId) links.push({ kind: "payable", id: cr.payableId });
  return links;
}

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will delete from the database" : "MODE: DRY RUN  <- nothing will be deleted");
  console.log("Filter: costType=\"Expenses\", expense=\"Rent\" — no branch/date restriction\n");

  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  const matches = await Transactions.find({
    costType: "Expenses",
    expense: "Rent",
  }).lean();

  console.log(`Found ${matches.length} Rent expense transaction(s).`);
  if (matches.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const byBranch = {};
  let totalAmount = 0;
  for (const t of matches) {
    byBranch[t.branch || "—"] = (byBranch[t.branch || "—"] || 0) + 1;
    totalAmount += t.amount || 0;
  }
  console.log(`  By branch: ${Object.entries(byBranch).map(([b, n]) => `${b}: ${n}`).join(", ")}`);
  console.log(`  Total amount: ₹${totalAmount.toLocaleString("en-IN")}\n`);

  // Cascade check — skip (or, with --force-linked, delete anyway) any row that created a
  // Payable/Receivable, same guard the app's own delete routes apply.
  const safe = [];
  const linked = [];
  for (const t of matches) {
    const links = creatorLinks(t);
    if (links.length === 0) {
      safe.push(t);
      continue;
    }
    const details = [];
    for (const link of links) {
      const Model = link.kind === "payable" ? Payable : Receivable;
      const doc = await Model.findById(link.id).lean();
      if (!doc) continue; // already gone — nothing to protect
      const others = await Transactions.countDocuments({
        [link.kind === "payable" ? "payableId" : "receivableId"]: link.id,
        _id: { $ne: t._id },
      });
      details.push({ kind: link.kind, id: String(link.id), otherPayments: others });
    }
    if (details.length) linked.push({ txn: t, details });
    else safe.push(t);
  }

  if (linked.length) {
    console.log(`⚠ ${linked.length} row(s) created a Payable/Receivable and will be ${FORCE_LINKED ? "DELETED ANYWAY (--force-linked)" : "SKIPPED"}:`);
    for (const l of linked) {
      console.log(`   ${l.txn._id}  ₹${l.txn.amount}  ${l.txn.branch || ""}  ${l.txn.remarks || ""}`.trim());
      for (const d of l.details) {
        console.log(`     -> ${d.kind} ${d.id}${d.otherPayments ? ` (${d.otherPayments} other payment(s) recorded against it — orphaning risk)` : ""}`);
      }
    }
    console.log("");
  }

  const toDelete = FORCE_LINKED ? matches : safe;
  console.log(`${toDelete.length} row(s) will be deleted${FORCE_LINKED ? "" : `; ${linked.length} skipped for being linked`}.\n`);

  if (!APPLY) {
    console.log("Sample rows (up to 15):");
    for (const t of toDelete.slice(0, 15)) {
      console.log(
        `   ${t._id}  ${t.date ? new Date(t.date).toISOString().slice(0, 10) : "—"}  ${t.branch || "—"}  ₹${t.amount}  ${t.expenseType || ""}  ${t.remarks || ""}`.trim(),
      );
    }
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply to delete (add --force-linked to also delete the linked rows above).");
    await mongoose.disconnect();
    return;
  }

  const ids = toDelete.map((t) => t._id);
  const result = await Transactions.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${result.deletedCount} transaction(s).`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
