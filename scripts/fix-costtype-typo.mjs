// One-off data fix: scripts/import-expenses-april-full.js wrote costType: "Expense" (singular)
// on every row it inserted — its ad-hoc `new mongoose.Schema({}, { strict: false })` model has
// no enum validation, so nothing caught it at write time. The real Transactions schema's enum is
// ["Revenue", "Expenses"], so these rows:
//   - fail full-document validation the moment anything calls .save() on them (the 400 seen when
//     editing an expense from that import), and
//   - are silently excluded from every report/dashboard aggregation that matches
//     costType: "Expenses" exactly — expense totals have been understated by however many of
//     these rows fall in a given query's window.
//
// Fix is a straight rename: "Expense" -> "Expenses". No other costType values exist besides
// these two and the correct "Revenue" (verified by direct aggregation before writing this).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

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

const ACTOR = { name: "Fix Script", email: "system@fix-costtype", branch: "All" };

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");

  console.log(`\nMode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  const docs = await tx
    .find({ costType: "Expense" })
    .project({ _id: 1, branch: 1, transactionCategory: 1, date: 1, amount: 1 })
    .toArray();

  console.log(`Matched ${docs.length} row(s) with costType: "Expense".`);
  const byBranch = new Map();
  let total = 0;
  for (const d of docs) {
    byBranch.set(d.branch, (byBranch.get(d.branch) || 0) + 1);
    total += d.amount || 0;
  }
  for (const [b, n] of [...byBranch.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(b).padEnd(12)} ×${n}`);
  }
  console.log(`Total amount affected: Rs ${total.toLocaleString("en-IN")}\n`);

  if (!docs.length) {
    console.log("Nothing to fix.\n");
    return mongoose.disconnect();
  }

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to set costType: "Expenses" on these rows.\n');
    return mongoose.disconnect();
  }

  const ops = docs.map((d) => ({
    updateOne: {
      filter: { _id: d._id },
      update: {
        $set: { costType: "Expenses" },
        $push: {
          editors: {
            ...ACTOR,
            date: new Date(),
            updatedFields: [{ name: "costType", previousValue: "Expense", newValue: "Expenses" }],
          },
        },
      },
    },
  }));

  const CHUNK = 500;
  let modified = 0;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const res = await tx.bulkWrite(slice, { session });
        modified += res.modifiedCount;
      });
    } catch (err) {
      console.error(`\nStopped after ${modified} row(s). ${err.message}\nRe-run the same command to continue — this operation is idempotent.\n`);
      await session.endSession();
      await mongoose.disconnect();
      process.exit(1);
    } finally {
      await session.endSession();
    }
    process.stdout.write(`\r  committed ${modified} / ${ops.length} row(s)…`);
  }
  console.log(`\nUpdated ${modified} transaction(s).\n`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
