// Read-only. Never writes to the database and never applies anything (no --apply flag exists
// for this script). Runs the exact aggregation pipelines the Assets/Liabilities endpoints run,
// with .explain("executionStats"), and prints the numbers that prove (or disprove) whether the
// payableId/receivableId/settlesPayableId/settlesReceivableId/collabRef.caseId indexes in
// src/models/Transactions.js, Borrowing.js and Advance.js are actually being used.
//
// Usage:
//   node scripts/profile-finance-pages.mjs            # run once before `ensure-indexes.js
//                                                      # --apply`, once after, diff the two.
//
// This script needs to import real application modules (models, the aggregation-stage builders)
// so it profiles the same code the pages run, not a hand-copied approximation of it — those
// modules use the "@/..." path alias, which only Next.js's own bundler understands natively. We
// register a tiny loader (scripts/lib/alias-loader.mjs) that teaches plain `node` the same
// alias via the stable node:module `register()` API, then dynamic-import everything that needs
// it (static imports of "@/..." at the top of this file would resolve before register() runs).

import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..");

register(pathToFileURL(path.resolve(THIS_DIR, "lib", "alias-loader.mjs")).href, import.meta.url);

const mongoose = (await import("mongoose")).default;
const { default: Payable } = await import("@/models/Payable");
const { default: Receivable } = await import("@/models/Receivable");
const { default: Transactions } = await import("@/models/Transactions");
const { default: Borrowing } = await import("@/models/Borrowing");
const { default: Advance } = await import("@/models/Advance");
const { buildPayableAggregationStages, buildPayableGroupedStages } = await import("@/lib/payableAggregation");
const { buildReceivableAggregationStages, buildReceivableGroupedStages } = await import(
  "@/lib/receivableAggregation"
);

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

// -------------------------------------------------------------------------------------------
// Explain-output helpers. MongoDB 4.4+ puts totalDocsExamined / totalKeysExamined /
// collectionScans / indexesUsed directly on every "$lookup" stage in explain("executionStats")
// output — no need to walk a deeply nested executionStages tree for those. We still walk the
// whole tree for stray COLLSCAN/IXSCAN nodes (e.g. the pipeline's own opening $match/$cursor)
// so nothing is missed on server versions that shape this differently.
// -------------------------------------------------------------------------------------------

function findLookupStages(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) findLookupStages(item, out);
    return out;
  }
  if (node.$lookup && typeof node.$lookup === "object") {
    // MongoDB 4.4+ puts the per-lookup stats (totalDocsExamined, totalKeysExamined,
    // collectionScans, indexesUsed, nReturned) as SIBLINGS of "$lookup" on the same stage
    // object — not nested inside node.$lookup itself, which only carries from/as/let/pipeline.
    out.push({
      from: node.$lookup.from,
      as: node.$lookup.as,
      totalDocsExamined: node.totalDocsExamined,
      totalKeysExamined: node.totalKeysExamined,
      collectionScans: node.collectionScans,
      indexesUsed: node.indexesUsed,
      nReturned: node.nReturned,
      executionTimeMillisEstimate: node.executionTimeMillisEstimate,
    });
  }
  for (const value of Object.values(node)) findLookupStages(value, out);
  return out;
}

function findScanStages(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) findScanStages(item, out);
    return out;
  }
  if (node.stage === "COLLSCAN" || node.stage === "IXSCAN") {
    out.push({
      stage: node.stage,
      indexName: node.indexName,
      docsExamined: node.docsExamined,
      keysExamined: node.keysExamined,
    });
  }
  for (const value of Object.values(node)) findScanStages(value, out);
  return out;
}

function findCursorExecutionStats(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) findCursorExecutionStats(item, out);
    return out;
  }
  if (node.executionStats && typeof node.executionStats === "object" && "nReturned" in node.executionStats) {
    out.push(node.executionStats);
  }
  for (const value of Object.values(node)) findCursorExecutionStats(value, out);
  return out;
}

async function explainAndReport(label, runExplain) {
  console.log(`\n── ${label}`);
  let explainOutput;
  const wallStart = Date.now();
  try {
    explainOutput = await runExplain();
  } catch (err) {
    console.log(`   ! failed: ${err.message}`);
    return;
  }
  const wallMs = Date.now() - wallStart;
  console.log(`   wall time (incl. explain overhead): ${wallMs}ms`);

  const cursorStats = findCursorExecutionStats(explainOutput);
  for (const stats of cursorStats) {
    console.log(
      `   opening scan: nReturned=${stats.nReturned} totalDocsExamined=${stats.totalDocsExamined} ` +
        `totalKeysExamined=${stats.totalKeysExamined} executionTimeMillis=${stats.executionTimeMillis}`,
    );
  }

  const scanStages = findScanStages(explainOutput);
  for (const s of scanStages) {
    console.log(
      `   scan stage: ${s.stage}${s.indexName ? ` (${s.indexName})` : ""} ` +
        `docsExamined=${s.docsExamined} keysExamined=${s.keysExamined ?? "n/a"}`,
    );
  }

  const lookups = findLookupStages(explainOutput);
  if (lookups.length === 0) {
    console.log("   (no $lookup stages in this pipeline)");
  }
  for (const lu of lookups) {
    // collectionScans is a plain integer count (0 = none), not an array.
    const hasCollScan = typeof lu.collectionScans === "number" ? lu.collectionScans > 0 : !!lu.collectionScans;
    const usedIndexes = Array.isArray(lu.indexesUsed) ? lu.indexesUsed : [];
    const verdict = hasCollScan ? "COLLSCAN" : usedIndexes.length > 0 ? "IXSCAN" : "unknown";
    console.log(
      `   $lookup "${lu.as}" from "${lu.from}": ${verdict} — ` +
        `totalDocsExamined=${lu.totalDocsExamined} nReturned=${lu.nReturned} ` +
        `indexesUsed=[${usedIndexes.join(", ")}] collectionScans=${lu.collectionScans}`,
    );
    if (lu.totalDocsExamined != null && lu.nReturned != null && lu.nReturned > 0) {
      const ratio = (lu.totalDocsExamined / lu.nReturned).toFixed(1);
      console.log(`     docsExamined:nReturned ratio = ${ratio}:1 (close to 1:1 is healthy)`);
    }
  }
}

async function main() {
  const uri = readMongoUri();
  const redacted = uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
  console.log(`Connecting — ${redacted}`);
  await mongoose.connect(uri);

  const [payableCount, receivableCount, txCount, borrowingCount, advanceCount] = await Promise.all([
    Payable.countDocuments({}),
    Receivable.countDocuments({}),
    Transactions.countDocuments({}),
    Borrowing.countDocuments({}),
    Advance.countDocuments({}),
  ]);
  console.log(
    `\nScale — payables=${payableCount} receivables=${receivableCount} transactions=${txCount} ` +
      `borrowings=${borrowingCount} advances=${advanceCount}`,
  );
  console.log(
    "If the settlement $lookup is a COLLSCAN, page cost is ~O(documents x transactions) — " +
      `that's up to ${(payableCount + receivableCount) * txCount} document reads per page load today.`,
  );

  const txCollection = Transactions.collection.name;

  // 1) The exact per-document pipelines every payables/receivables endpoint runs.
  await explainAndReport("Payable.aggregate — buildPayableAggregationStages (isCancelled: false)", () =>
    Payable.aggregate([{ $match: { isCancelled: false } }, ...buildPayableAggregationStages(txCollection)]).explain(
      "executionStats",
    ),
  );

  await explainAndReport(
    "Receivable.aggregate — buildReceivableAggregationStages (isCancelled: false)",
    () =>
      Receivable.aggregate([
        { $match: { isCancelled: false } },
        ...buildReceivableAggregationStages(txCollection),
      ]).explain("executionStats"),
  );

  // 2) The grouped (dashboard-level) pipelines — same $lookup shape, smaller result set.
  await explainAndReport("Payable.aggregate — buildPayableGroupedStages (level 1)", () =>
    Payable.aggregate(buildPayableGroupedStages(txCollection, { level: 1 })).explain("executionStats"),
  );

  await explainAndReport("Receivable.aggregate — buildReceivableGroupedStages (level 1)", () =>
    Receivable.aggregate(buildReceivableGroupedStages(txCollection, { level: 1 })).explain("executionStats"),
  );

  // 3) The raw join predicates in isolation — the clearest possible before/after signal, using
  // a real document's _id so the query shape matches production exactly.
  const samplePayable = await Payable.findOne({}, { _id: 1 }).lean();
  if (samplePayable) {
    await explainAndReport(
      `Transactions.find — payableId join predicate (sample payable ${samplePayable._id})`,
      () =>
        Transactions.find({
          payableId: samplePayable._id,
          approvalStatus: "APPROVED",
          method: { $nin: ["paid_to_external", "paid_by_other"] },
        }).explain("executionStats"),
    );
  } else {
    console.log("\n(no payables in this database — skipping the raw payableId predicate check)");
  }

  const sampleReceivable = await Receivable.findOne({}, { _id: 1 }).lean();
  if (sampleReceivable) {
    await explainAndReport(
      `Transactions.find — receivableId join predicate (sample receivable ${sampleReceivable._id})`,
      () =>
        Transactions.find({
          receivableId: sampleReceivable._id,
          approvalStatus: "APPROVED",
          method: { $nin: ["paid_to_external", "paid_by_other"] },
        }).explain("executionStats"),
    );
  } else {
    console.log("\n(no receivables in this database — skipping the raw receivableId predicate check)");
  }

  const sampleAdvanceSettlement = await Advance.findOne(
    { settlesPayableId: { $ne: null } },
    { settlesPayableId: 1 },
  ).lean();
  if (sampleAdvanceSettlement) {
    await explainAndReport(
      `Advance.find — settlesPayableId join predicate (sample payable ${sampleAdvanceSettlement.settlesPayableId})`,
      () =>
        Advance.find({
          settlesPayableId: sampleAdvanceSettlement.settlesPayableId,
          direction: "OUT",
          isCancelled: { $ne: true },
        }).explain("executionStats"),
    );
  } else {
    console.log("\n(no advances settle a payable yet — skipping the settlesPayableId predicate check)");
  }

  const sampleBorrowingSettlement = await Borrowing.findOne(
    { settlesReceivableId: { $ne: null } },
    { settlesReceivableId: 1 },
  ).lean();
  if (sampleBorrowingSettlement) {
    await explainAndReport(
      `Borrowing.find — settlesReceivableId join predicate (sample receivable ${sampleBorrowingSettlement.settlesReceivableId})`,
      () =>
        Borrowing.find({
          settlesReceivableId: sampleBorrowingSettlement.settlesReceivableId,
          direction: "IN",
          isCancelled: { $ne: true },
        }).explain("executionStats"),
    );
  } else {
    console.log(
      "\n(no borrowings settle a receivable yet — skipping the settlesReceivableId predicate check)",
    );
  }

  const sampleCollabCase = await Transactions.findOne(
    { "collabRef.caseId": { $ne: null } },
    { "collabRef.caseId": 1 },
  ).lean();
  if (sampleCollabCase?.collabRef?.caseId) {
    await explainAndReport(
      `Transactions.find — collabRef.caseId predicate (sample case ${sampleCollabCase.collabRef.caseId})`,
      () => Transactions.find({ "collabRef.caseId": sampleCollabCase.collabRef.caseId }).explain("executionStats"),
    );
  } else {
    console.log("\n(no transactions carry a collabRef.caseId yet — skipping that predicate check)");
  }

  console.log(
    "\nDone. Re-run after `node scripts/ensure-indexes.js --apply` and diff the two outputs — " +
      "every $lookup above should flip from COLLSCAN to IXSCAN, and totalDocsExamined should drop " +
      "to within a small multiple of nReturned.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
