// Deletes EVERYTHING under the "Rent" category — every expense Transaction (costType:
// "Expenses", expense: "Rent") AND every Rent Payable (expenseCategory: "Rent"), plus each
// Rent payable's linked TDS payable (tdsLink.role: "TDS" pointing back at one of them) so
// nothing is left dangling on either side.
//
// Also catches transactions linked via payableId to a Rent payable even if the transaction's
// OWN category was since changed to something else (the exact "stale payableId after a
// re-categorize" bug fixed earlier this session in expense/update/route.js) — those are real
// payments against a Rent payable regardless of what the transaction is labelled today, so they
// belong in this deletion too, not left behind pointing at a payable about to disappear.
//
// This erases real reconciliation history — opening balances, createdAt backfills, revised
// amounts, everything this session built up for Rent. There is no undo once --apply runs; the
// JSON report is an audit record, not a restore point.
//
// SAFETY:
//   - Dry run by default. Nothing is deleted until you pass --apply.
//   - Any matched transaction that CREATED a Payable/Receivable of its own (externalParty.
//     linkedPayableId/linkedReceivableId, collabRef.payableId/receivableId) is reported and
//     SKIPPED unless you also pass --force-linked — deleting it would orphan that OTHER
//     document, which is unrelated to Rent.
//
//   node scripts/delete-all-rent-data.js                  (dry run)
//   node scripts/delete-all-rent-data.js --apply          (delete, skip cross-linked)
//   node scripts/delete-all-rent-data.js --apply --force-linked

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

// Mirrors creatorLinks() in src/lib/cascadeIntegrity.js.
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
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  // ── Payables: every Rent payable, plus its linked TDS payable ──
  const rentPayables = await Payable.find({ expenseCategory: "Rent" }).lean();
  const rentPayableIds = rentPayables.map((p) => p._id);
  const tdsPayables = rentPayableIds.length
    ? await Payable.find({ "tdsLink.role": "TDS", "tdsLink.linkedId": { $in: rentPayableIds } }).lean()
    : [];
  const allPayables = [...rentPayables, ...tdsPayables];
  const allPayableIds = allPayables.map((p) => p._id);

  console.log(`\nPayables: ${rentPayables.length} Rent payable(s) + ${tdsPayables.length} linked TDS payable(s) = ${allPayables.length} total.`);
  console.log(`  Total amount: ₹${allPayables.reduce((s, p) => s + (p.totalAmount || 0), 0).toLocaleString("en-IN")}`);

  // ── Transactions: category-matched OR linked via payableId to one of the payables above ──
  const matches = await Transactions.find({
    $or: [
      { costType: "Expenses", expense: "Rent" },
      allPayableIds.length ? { payableId: { $in: allPayableIds } } : { _id: null },
    ],
  }).lean();

  const byBranch = {};
  let totalAmount = 0;
  let staleLinkCount = 0;
  for (const t of matches) {
    byBranch[t.branch || "—"] = (byBranch[t.branch || "—"] || 0) + 1;
    totalAmount += t.amount || 0;
    if (t.expense !== "Rent" && t.payableId) staleLinkCount++;
  }
  console.log(`\nTransactions: ${matches.length} matched (${staleLinkCount} linked via payableId despite a different current category).`);
  console.log(`  By branch: ${Object.entries(byBranch).map(([b, n]) => `${b}: ${n}`).join(", ")}`);
  console.log(`  Total amount: ₹${totalAmount.toLocaleString("en-IN")}`);

  // ── Cascade check ──
  const safe = [];
  const linked = [];
  for (const t of matches) {
    const links = creatorLinks(t);
    if (links.length === 0) {
      safe.push(t);
      continue;
    }
    linked.push({ txn: t, links });
  }

  if (linked.length) {
    console.log(`\n⚠ ${linked.length} transaction(s) created a Payable/Receivable of their own and will be ${FORCE_LINKED ? "DELETED ANYWAY (--force-linked)" : "SKIPPED"}:`);
    for (const l of linked) {
      console.log(`   ${l.txn._id}  ₹${l.txn.amount}  ${l.txn.expense || ""}  ${l.txn.remarks || ""}`.trim());
    }
  }

  const txToDelete = FORCE_LINKED ? matches : safe;
  console.log(`\n${txToDelete.length} transaction(s) and ${allPayables.length} payable(s) will be deleted${FORCE_LINKED ? "" : linked.length ? `; ${linked.length} transaction(s) skipped for being cross-linked` : ""}.`);

  if (!APPLY) {
    console.log("\nSample transactions (up to 10):");
    for (const t of txToDelete.slice(0, 10)) {
      console.log(`   ${t._id}  ${t.date ? new Date(t.date).toISOString().slice(0, 10) : "—"}  ${t.branch || "—"}  ₹${t.amount}  ${t.expenseType || ""}  ${t.remarks || ""}`.trim());
    }
    console.log("\nSample payables (up to 10):");
    for (const p of allPayables.slice(0, 10)) {
      console.log(`   ${p._id}  ${p.expenseSubType || p.expenseCategory}  period ${p.period?.month}/${p.period?.year}  ₹${p.totalAmount}`);
    }
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply to delete (add --force-linked to also delete the cross-linked transactions above).");
    await mongoose.disconnect();
    return;
  }

  const txResult = await Transactions.deleteMany({ _id: { $in: txToDelete.map((t) => t._id) } });
  const payableResult = await Payable.deleteMany({ _id: { $in: allPayableIds } });
  console.log(`\nDeleted ${txResult.deletedCount} transaction(s) and ${payableResult.deletedCount} payable(s).`);

  const reportPath = `delete-all-rent-data-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        deletedTransactionIds: txToDelete.map((t) => String(t._id)),
        deletedPayableIds: allPayableIds.map(String),
        skippedTransactionIds: FORCE_LINKED ? [] : linked.map((l) => String(l.txn._id)),
        totalTransactionAmount: totalAmount,
        totalPayableAmount: allPayables.reduce((s, p) => s + (p.totalAmount || 0), 0),
      },
      null,
      2,
    ),
  );
  console.log(`Report written to ${reportPath} — this is an audit record, not a restore point; the delete cannot be undone.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
