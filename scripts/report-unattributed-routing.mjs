// §6.2 step 1-2 — READ-ONLY. Groups every transaction that is invisible to account balances
// (blank furtherMode + a real cash method) by (branch, transactionCategory, method), applies the
// CRM's own routing map to each group, and classifies it:
//
//   RESOLVABLE - the map gives exactly one account for this combination -> safe to bulk-fill
//   AMBIGUOUS  - more than one account is legitimately possible         -> must NOT be guessed
//   UNMAPPED   - the map has no entry at all                            -> manual, or an override
//
// §6.1 context — why AMBIGUOUS is a real category and not caution theatre:
// backfill-bank-routing.mjs --overwrite once rewrote 803 EXPENSE/cash rows that already said
// "Cash ( backend )" to "Cash Book", and revert-cash-backend-furthermode.mjs had to undo it. The
// cause: the expense-side map (getExpenseFurtherModeDefault) keys on METHOD ALONE, with no
// branch/category split, so it cannot tell those two cash accounts apart. Both are real entries
// in ACCOUNTS. That map is a fallback for blanks, never an authority on what is correct.
//
// The revenue-side map (BANK_ROUTING_MAP) keys on branch + category + method, so where it has an
// entry that entry is unambiguous. That asymmetry is the whole classification below.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  ACCOUNTS,
  NON_CASH_METHODS,
  getBankRoutingDefaults,
  getExpenseFurtherModeDefault,
} from "../src/constants/bankRouting.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
const pad = (s, n) => String(s ?? "—").padEnd(n).slice(0, n);

// Cash expenses are the exact combination the revert proved ambiguous: the method-only map says
// "Cash Book", but "Cash ( backend )" is equally valid and 803 rows genuinely used it.
const AMBIGUOUS_EXPENSE_METHODS = new Set(["cash"]);

function classify({ costType, branch, transactionCategory, method }) {
  if (costType === "Expenses" || transactionCategory === "EXPENSE") {
    if (AMBIGUOUS_EXPENSE_METHODS.has(method)) {
      return { kind: "AMBIGUOUS", account: null, why: "cash expense — Cash Book vs Cash ( backend ) indistinguishable (see revert)" };
    }
    const acct = getExpenseFurtherModeDefault(method);
    return acct
      ? { kind: "RESOLVABLE", account: acct, why: "expense method maps to exactly one account" }
      : { kind: "UNMAPPED", account: null, why: "no expense mapping for this method" };
  }
  const { furtherMode } = getBankRoutingDefaults(branch, transactionCategory, method);
  return furtherMode
    ? { kind: "RESOLVABLE", account: furtherMode, why: "branch+category+method has a single mapped account" }
    : { kind: "UNMAPPED", account: null, why: "no routing entry (collab branch, or unmapped method)" };
}

async function run() {
  await mongoose.connect(readMongoUri());
  const tx = mongoose.connection.db.collection("transactions");

  const match = { furtherMode: { $in: ["", null] }, method: { $nin: NON_CASH_METHODS } };
  const groups = await tx.aggregate([
    { $match: match },
    {
      $group: {
        _id: { branch: "$branch", cat: "$transactionCategory", method: "$method", costType: "$costType" },
        n: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
    { $sort: { n: -1 } },
  ]).toArray();

  const totalRows = groups.reduce((s, g) => s + g.n, 0);
  console.log(`\nUnattributed transactions (blank furtherMode, real cash method): ${totalRows}`);
  console.log(`Distinct (branch, category, method) groups: ${groups.length}\n`);

  const buckets = { RESOLVABLE: [], AMBIGUOUS: [], UNMAPPED: [] };
  for (const g of groups) {
    const c = classify({
      costType: g._id.costType,
      branch: g._id.branch,
      transactionCategory: g._id.cat,
      method: g._id.method,
    });
    buckets[c.kind].push({ ...g, ...c });
  }

  for (const kind of ["RESOLVABLE", "AMBIGUOUS", "UNMAPPED"]) {
    const list = buckets[kind];
    const rows = list.reduce((s, g) => s + g.n, 0);
    const amt = list.reduce((s, g) => s + (g.amount || 0), 0);
    console.log("=".repeat(104));
    console.log(`${kind}  —  ${rows} row(s) across ${list.length} group(s)  ${inr(amt)}`);
    console.log("=".repeat(104));
    if (!list.length) { console.log("  (none)\n"); continue; }
    console.log(`  ${pad("BRANCH", 13)}${pad("CATEGORY", 12)}${pad("METHOD", 34)}${"ROWS".padStart(6)}${"AMOUNT".padStart(18)}  -> ACCOUNT`);
    for (const g of list) {
      console.log(
        `  ${pad(g._id.branch, 13)}${pad(g._id.cat, 12)}${pad(g._id.method, 34)}${String(g.n).padStart(6)}${inr(g.amount).padStart(18)}  -> ${g.account || "(none) " + g.why}`,
      );
    }
    console.log("");
  }

  const resolvable = buckets.RESOLVABLE.reduce((s, g) => s + g.n, 0);
  console.log("=".repeat(104));
  console.log("SUMMARY");
  console.log("=".repeat(104));
  for (const kind of ["RESOLVABLE", "AMBIGUOUS", "UNMAPPED"]) {
    const rows = buckets[kind].reduce((s, g) => s + g.n, 0);
    console.log(`  ${pad(kind, 12)} ${String(rows).padStart(6)} rows  ${((rows / totalRows) * 100).toFixed(1).padStart(5)}%  ${inr(buckets[kind].reduce((s, g) => s + (g.amount || 0), 0))}`);
  }
  console.log(`\n  Bulk-fillable now : ${resolvable}`);
  console.log(`  Left for §7.3 UI  : ${totalRows - resolvable}`);

  // Projected balance impact, per account, if only the RESOLVABLE rows were filled.
  const perAccount = new Map();
  for (const g of buckets.RESOLVABLE) {
    const signed = g._id.costType === "Revenue" ? g.amount : -g.amount;
    perAccount.set(g.account, (perAccount.get(g.account) || 0) + signed);
  }
  if (perAccount.size) {
    console.log("\n  Projected account-balance movement if the RESOLVABLE set is filled:");
    for (const [a, v] of [...perAccount.entries()].sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))) {
      console.log(`    ${pad(a, 26)} ${v >= 0 ? "+" : "-"}${inr(Math.abs(v))}`);
    }
    const unknown = [...perAccount.keys()].filter((a) => !ACCOUNTS.includes(a));
    if (unknown.length) console.log(`    !! not in ACCOUNTS: ${unknown.join(", ")}`);
  }

  console.log("\nRead-only report — nothing written.\n");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
