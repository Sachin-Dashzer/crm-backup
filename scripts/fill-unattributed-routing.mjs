// §6.2 step 3 — bulk-fill furtherMode for the UNAMBIGUOUS unattributed rows only.
//
// Scope is deliberately narrower than backfill-bank-routing.mjs:
//   - BLANK furtherMode only. Never overwrites an existing value. The 803-row incident that
//     revert-cash-backend-furthermode.mjs had to undo was caused entirely by --overwrite
//     rewriting values that were already correct; this script has no overwrite mode at all.
//   - RESOLVABLE groups only, as classified by report-unattributed-routing.mjs. Cash EXPENSE
//     rows are excluded by construction (Cash Book vs "Cash ( backend )" cannot be told apart
//     from method alone — that was the exact cause of the incident).
//
// Writes an undo list (transaction ids + prior blank value) to scripts/ before touching anything,
// matching the discipline of the existing import scripts.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  NON_CASH_METHODS,
  getBankRoutingDefaults,
  getExpenseFurtherModeDefault,
} from "../src/constants/bankRouting.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

function readMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error("MONGODB_URI not found");
}

const inr = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const ACTOR = { name: "Routing Fill Script", email: "system@fill-routing", branch: "All" };
const AMBIGUOUS_EXPENSE_METHODS = new Set(["cash"]);

// Returns an account only when the map gives exactly one answer for this combination.
function resolveAccount(doc) {
  const isExpense = doc.costType === "Expenses" || doc.transactionCategory === "EXPENSE";
  if (isExpense) {
    if (AMBIGUOUS_EXPENSE_METHODS.has(doc.method)) return null;
    return getExpenseFurtherModeDefault(doc.method) || null;
  }
  return getBankRoutingDefaults(doc.branch, doc.transactionCategory, doc.method).furtherMode || null;
}

async function balances(tx) {
  const rows = await tx.aggregate([
    { $match: { furtherMode: { $nin: ["", null] }, method: { $nin: NON_CASH_METHODS } } },
    {
      $group: {
        _id: "$furtherMode",
        net: { $sum: { $cond: [{ $eq: ["$costType", "Revenue"] }, "$amount", { $multiply: ["$amount", -1] }] } },
      },
    },
  ]).toArray();
  return new Map(rows.map((r) => [r._id, r.net]));
}

async function run() {
  await mongoose.connect(readMongoUri());
  const tx = mongoose.connection.db.collection("transactions");

  console.log(`\nMode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  const candidates = await tx
    .find(
      { furtherMode: { $in: ["", null] }, method: { $nin: NON_CASH_METHODS } },
      { projection: { branch: 1, transactionCategory: 1, method: 1, costType: 1, amount: 1 } },
    )
    .toArray();

  const planned = [];
  let skipped = 0;
  for (const d of candidates) {
    const account = resolveAccount(d);
    if (!account) { skipped += 1; continue; }
    planned.push({ _id: d._id, account, amount: d.amount || 0, costType: d.costType });
  }

  console.log(`Unattributed rows examined : ${candidates.length}`);
  console.log(`  Resolvable (will fill)   : ${planned.length}`);
  console.log(`  Left alone (ambiguous/unmapped) : ${skipped}\n`);

  const before = await balances(tx);
  const delta = new Map();
  for (const p of planned) {
    const signed = p.costType === "Revenue" ? p.amount : -p.amount;
    delta.set(p.account, (delta.get(p.account) || 0) + signed);
  }

  console.log("Account balances — before -> after:");
  for (const [acct, d] of [...delta.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))) {
    const b = before.get(acct) || 0;
    console.log(`  ${acct.padEnd(26)} ${inr(b).padStart(20)} -> ${inr(b + d).padStart(20)}   (${d >= 0 ? "+" : "-"}${inr(Math.abs(d))})`);
  }

  if (!planned.length) { console.log("\nNothing to fill.\n"); return mongoose.disconnect(); }
  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply.\n");
    return mongoose.disconnect();
  }

  // Undo list written BEFORE the write, so a crash mid-run still leaves a usable record.
  const undoPath = path.resolve(REPO_ROOT, "scripts", `fill-routing-undo-${Date.now()}.json`);
  fs.writeFileSync(undoPath, JSON.stringify(planned.map((p) => ({ _id: String(p._id), setTo: p.account, priorValue: "" })), null, 2));
  console.log(`\nUndo list written to ${undoPath}`);

  const ops = planned.map((p) => ({
    updateOne: {
      filter: { _id: p._id },
      update: {
        $set: { furtherMode: p.account },
        $push: {
          editors: {
            ...ACTOR,
            date: new Date(),
            updatedFields: [{ name: "furtherMode", previousValue: "(blank)", newValue: p.account, note: "Bulk-filled from the CRM routing map (blank-only, unambiguous combinations)." }],
          },
        },
      },
    },
  }));

  const CHUNK = 500;
  let modified = 0;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const res = await tx.bulkWrite(ops.slice(i, i + CHUNK), { session });
        modified += res.modifiedCount;
      });
    } catch (err) {
      console.error(`\nStopped after ${modified}. ${err.message}\nRe-run to continue — idempotent (blank-only).\n`);
      await session.endSession(); await mongoose.disconnect(); process.exit(1);
    } finally { await session.endSession(); }
    process.stdout.write(`\r  committed ${modified} / ${ops.length}…`);
  }

  const after = await balances(tx);
  console.log(`\n\nFilled ${modified} row(s). Verified account balances:`);
  for (const [acct] of delta) console.log(`  ${acct.padEnd(26)} ${inr(after.get(acct) || 0).padStart(20)}`);
  const stillBlank = await tx.countDocuments({ furtherMode: { $in: ["", null] }, method: { $nin: NON_CASH_METHODS } });
  console.log(`\nStill unattributed (for the §7.3 UI): ${stillBlank}\n`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
