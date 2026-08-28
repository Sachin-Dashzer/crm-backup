
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

const APPLY = process.argv.slice(2).includes("--apply");

const INDEXES = {
  stocks: [
    { keys: { name: 1 }, options: { name: "name_1" },
      why: "/api/stocks/get searches and sorts by name; the model declared no indexes at all" },
    { keys: { location: 1 }, options: { name: "location_1" },
      why: "stock lists filter by location" },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" },
      why: "default recency sort" },
  ],

  vendors: [
    { keys: { name: 1 }, options: { name: "name_1" },
      why: "/api/vendors/get searches and sorts by name; the model declared no indexes at all" },
    { keys: { DealsIn: 1 }, options: { name: "DealsIn_1" },
      why: "the dealsIn filter on the vendors page" },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" },
      why: "default recency sort" },
  ],

  audits: [
    { keys: { date: -1 }, options: { name: "date_-1" },
      why: "/api/audit/get-data (the /admin/deleted-data page) sorts by date over the whole collection" },
    { keys: { costType: 1, date: -1 }, options: { name: "costType_1_date_-1" },
      why: "the same route buckets by costType" },
    { keys: { branch: 1, date: -1 }, options: { name: "branch_1_date_-1" },
      why: "branch-scoped views of the deleted-data log" },
  ],

  payables: [
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" },
      why: "every payables date filter keys on createdAt (the date the obligation was raised); previously unindexed" },
    { keys: { isCancelled: 1, createdAt: -1 }, options: { name: "isCancelled_1_createdAt_-1" },
      why: "the grouped/summary routes match isCancelled then range on createdAt" },
    { keys: { expenseCategory: 1 }, options: { name: "expenseCategory_1" },
      why: "the level-3 drill-down predicate on /admin/liabilities" },
  ],

  receivables: [
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" },
      why: "mirrors payables.createdAt; every receivables date filter keys on it" },
    { keys: { isCancelled: 1, createdAt: -1 }, options: { name: "isCancelled_1_createdAt_-1" },
      why: "the grouped/summary routes match isCancelled then range on createdAt" },
    { keys: { revenueCategory: 1 }, options: { name: "revenueCategory_1" },
      why: "the level-3 drill-down predicate on /admin/assets" },
  ],

  transactions: [
    {
      keys: { "receivableAllocations.receivableId": 1 },
      options: { name: "receivableAllocations.receivableId_1" },
      why: "receivableAggregation.js joins Transactions on this; without it the $lookup scans the whole collection once per receivable",
    },
    { keys: { createdAt: -1 }, options: { name: "createdAt_-1" },
      why: "/api/admin/logs ranges on createdAt" },
    {
      keys: { payableId: 1, approvalStatus: 1, method: 1, date: 1 },
      options: { name: "payableId_1_approvalStatus_1_method_1_date_1", partialFilterExpression: { payableId: { $type: "objectId" } } },
      why: "payableAggregation.js's per-document $lookup joins on payableId+approvalStatus+method; without it, Assets/Liabilities cost O(payables x transactions) — the single biggest fix in this pass",
    },
    {
      keys: { receivableId: 1, approvalStatus: 1, method: 1, date: 1 },
      options: { name: "receivableId_1_approvalStatus_1_method_1_date_1", partialFilterExpression: { receivableId: { $type: "objectId" } } },
      why: "mirrors the payableId index above for receivableAggregation.js's $lookup",
    },
    {
      keys: { "collabRef.caseId": 1 },
      options: { name: "collabRef.caseId_1" },
      why: "collab flows filter transactions per case by this field",
    },
  ],

  borrowings: [
    {
      keys: { settlesReceivableId: 1, isCancelled: 1, direction: 1 },
      options: { name: "settlesReceivableId_1_isCancelled_1_direction_1", partialFilterExpression: { settlesReceivableId: { $type: "objectId" } } },
      why: "receivableAggregation.js's borrowingSettlementAgg $lookup joins on this per receivable document",
    },
  ],

  advances: [
    {
      keys: { settlesPayableId: 1, isCancelled: 1, direction: 1 },
      options: { name: "settlesPayableId_1_isCancelled_1_direction_1", partialFilterExpression: { settlesPayableId: { $type: "objectId" } } },
      why: "payableAggregation.js's advanceSettlementAgg $lookup joins on this per payable document",
    },
  ],
};

async function main() {
  const uri = readMongoUri();
  const redacted = uri.replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${redacted}\n`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existingCollections = new Set(
    (await db.listCollections().toArray()).map((c) => c.name),
  );

  let created = 0;
  let present = 0;
  let skipped = 0;

  for (const [collName, specs] of Object.entries(INDEXES)) {
    console.log(`── ${collName}`);

    if (!existingCollections.has(collName)) {
      console.log(`   ! collection does not exist — skipping ${specs.length} index(es)\n`);
      skipped += specs.length;
      continue;
    }

    const coll = db.collection(collName);
    const existing = new Set((await coll.indexes()).map((i) => i.name));

    for (const { keys, options, why } of specs) {
      if (existing.has(options.name)) {
        console.log(`   = ${options.name} (already present)`);
        present++;
        continue;
      }

      if (!APPLY) {
        console.log(`   + ${options.name}  — ${why}`);
        created++;
        continue;
      }

      const started = Date.now();
      await coll.createIndex(keys, { ...options, background: true });
      console.log(`   + ${options.name}  (${Date.now() - started}ms) — ${why}`);
      created++;
    }
    console.log("");
  }

  console.log(
    APPLY
      ? `Done. ${created} created, ${present} already present, ${skipped} skipped.`
      : `Dry run. ${created} would be created, ${present} already present, ${skipped} skipped.\n` +
        `Re-run with --apply to create them.`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
