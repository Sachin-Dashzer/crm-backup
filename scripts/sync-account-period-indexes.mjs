/**
 * One-time index migration for AccountPeriod, needed when branch-wise opening balances were
 * added.
 *
 *   node scripts/sync-account-period-indexes.mjs            # dry run — shows the plan
 *   node scripts/sync-account-period-indexes.mjs --apply
 *
 * WHY THIS IS REQUIRED, not optional
 * AccountPeriod used to carry a unique index on {account, periodStart, periodEnd}. Branch seeds
 * deliberately share an account and date with the company row they sit beside, so that old index
 * rejects the very pair the feature exists to allow — you'd get a duplicate-key error the first
 * time you saved a branch opening balance for an account that already had a company one.
 *
 * Mongoose creates new indexes automatically but never drops superseded ones, so the old index
 * has to be removed explicitly. This script drops it and builds the replacement,
 * {account, branch, periodStart, periodEnd}, which still prevents a period being closed twice.
 *
 * Documents with no `branch` field index as null, so existing rows become the company-level rows
 * with no data migration.
 */

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const OLD_KEY = { account: 1, periodStart: 1, periodEnd: 1 };
const NEW_KEY = { account: 1, branch: 1, periodStart: 1, periodEnd: 1 };
const NEW_LOOKUP_KEY = { account: 1, branch: 1, isClosed: 1, periodEnd: -1 };

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function readMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error("MONGODB_URI not found in .env.local, .env, or the environment");
}

async function main() {
  await mongoose.connect(readMongoUri());
  const coll = mongoose.connection.db.collection("accountperiods");

  console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN (no changes)"}\n`);

  const existing = await coll.indexes();
  console.log("Current indexes:");
  for (const ix of existing) {
    console.log(`  ${ix.name.padEnd(46)} ${JSON.stringify(ix.key)}${ix.unique ? "  UNIQUE" : ""}`);
  }
  console.log("");

  const stale = existing.find((ix) => sameKey(ix.key, OLD_KEY));
  const hasNew = existing.some((ix) => sameKey(ix.key, NEW_KEY));
  const hasLookup = existing.some((ix) => sameKey(ix.key, NEW_LOOKUP_KEY));

  const plan = [];
  if (stale) plan.push(`DROP   ${stale.name}  ${JSON.stringify(OLD_KEY)}`);
  if (!hasNew) plan.push(`CREATE unique  ${JSON.stringify(NEW_KEY)}`);
  if (!hasLookup) plan.push(`CREATE         ${JSON.stringify(NEW_LOOKUP_KEY)}`);

  if (plan.length === 0) {
    console.log("Indexes already correct — nothing to do.\n");
    return mongoose.disconnect();
  }

  console.log("Plan:");
  plan.forEach((p) => console.log(`  ${p}`));
  console.log("");

  // A duplicate on the new key would mean two rows already claim the same account+branch+period,
  // which the old index could not have allowed. Check anyway — creating a unique index fails
  // outright on a duplicate, and finding out here is clearer than a driver error mid-build.
  const dupes = await coll
    .aggregate([
      {
        $group: {
          _id: {
            account: "$account",
            branch: { $ifNull: ["$branch", null] },
            periodStart: "$periodStart",
            periodEnd: "$periodEnd",
          },
          n: { $sum: 1 },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (dupes.length) {
    console.error("Cannot create the unique index — these combinations already appear twice:");
    for (const d of dupes) console.error(`  ${JSON.stringify(d._id)}  ×${d.n}`);
    console.error("\nResolve the duplicates first.\n");
    process.exitCode = 1;
    return mongoose.disconnect();
  }
  console.log("Duplicate check: none — safe to build the unique index.\n");

  if (!APPLY) {
    console.log("Dry run — nothing changed. Re-run with --apply.\n");
    return mongoose.disconnect();
  }

  if (stale) {
    await coll.dropIndex(stale.name);
    console.log(`Dropped ${stale.name}`);
  }
  if (!hasNew) {
    await coll.createIndex(NEW_KEY, { unique: true });
    console.log(`Created unique ${JSON.stringify(NEW_KEY)}`);
  }
  if (!hasLookup) {
    await coll.createIndex(NEW_LOOKUP_KEY);
    console.log(`Created ${JSON.stringify(NEW_LOOKUP_KEY)}`);
  }

  console.log("\nFinal indexes:");
  for (const ix of await coll.indexes()) {
    console.log(`  ${ix.name.padEnd(46)} ${JSON.stringify(ix.key)}${ix.unique ? "  UNIQUE" : ""}`);
  }
  console.log("");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\nIndex sync failed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
