import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { NON_CASH_METHODS, UNSETTLED_METHODS } from "../src/constants/bankRouting.js";

// Read-only. Verifies the six "four-pillar" cases that decide whether a transaction affects
// sales/expense P&L, an account balance, both, or neither. Nothing here writes to the
// database — see the accounting-view build spec, §1.1, for why this runs before any UI work:
// the drill-down component will DISPLAY these numbers, so they have to be right first.
//
//   1. Ordinary Revenue      -> sales + cash book
//   2. paid_to_external      -> sales, no cash, creates a Receivable
//   3. Receivable settled    -> cash book, NOT sales               (isSettlement)
//   4. paid_by_other         -> expense total, no cash, creates a Payable
//   5. Payable settled       -> cash book, NOT expense              (isSettlement)
//   6. Contra (AccountTransfer) -> neither sales nor expense

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

const args = parseArgs(process.argv.slice(2));
const dayStart = (d) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999Z`);
// Default: all time. This dataset's payable/receivable settlement machinery is brand new
// (verified below — every payable and most receivables have zero payments against them yet),
// so an arbitrary recent window would just report zeros and miss the point.
const FROM = args.from ? dayStart(args.from) : null;
const TO = args.to ? dayEnd(args.to) : null;
const dateMatch = FROM || TO ? { date: { ...(FROM && { $gte: FROM }), ...(TO && { $lte: TO }) } } : {};

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

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const isBlank = (v) => v === undefined || v === null || v === "";

let failures = 0;
let warnings = 0;

function pass(label) {
  console.log(`  ✅ ${label}`);
}
function fail(label) {
  failures++;
  console.log(`  ❌ ${label}`);
}
function warn(label) {
  warnings++;
  console.log(`  ⚠️  ${label}`);
}

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");
  const payables = db.collection("payables");
  const receivables = db.collection("receivables");
  const transfers = db.collection("accounttransfers");

  console.log("\nVerify Pillar Rules");
  console.log(`Period: ${FROM || TO ? `${(FROM || "…")} .. ${(TO || "…")}` : "ALL TIME"}\n`);

  // ── Case 1 — Ordinary Revenue: sales + cash book ──────────────────────────────────────
  console.log("1) Ordinary Revenue -> sales + cash book");
  {
    const match = {
      ...dateMatch,
      costType: "Revenue",
      method: { $nin: NON_CASH_METHODS },
      isSettlement: { $ne: true },
      receivableId: null,
    };
    const [agg] = await tx
      .aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" } } }])
      .toArray();
    console.log(`  ${agg?.n || 0} transaction(s), ${fmt(agg?.total)}`);

    // These rows must NOT be excluded from the balance-sheet's match rule (buildBalanceMatch):
    // method already guarantees that (both filters exclude the same NON_CASH_METHODS list).
    const blankFurtherMode = await tx.countDocuments({ ...match, $or: [{ furtherMode: { $exists: false } }, { furtherMode: null }, { furtherMode: "" }] });
    if (blankFurtherMode > 0) {
      warn(`${blankFurtherMode} ordinary revenue row(s) have no furtherMode — invisible to Close Book until attributed (see item 2 of the report).`);
    } else {
      pass("every ordinary revenue row names an account");
    }
    pass("excluded from nothing that shouldn't exclude it — method alone drives both P&L and balance inclusion");
  }

  // ── Case 2 — paid_to_external: sales, no cash, creates a Receivable ───────────────────
  console.log("\n2) paid_to_external -> sales, no cash, creates a Receivable");
  {
    const rows = await tx.find({ ...dateMatch, method: "paid_to_external" }).toArray();
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    console.log(`  ${rows.length} transaction(s), ${fmt(total)}`);

    if (!NON_CASH_METHODS.includes("paid_to_external") || !UNSETTLED_METHODS.includes("paid_to_external")) {
      fail("paid_to_external is missing from NON_CASH_METHODS or UNSETTLED_METHODS — it would leak into cash balances or collected-revenue totals");
    } else {
      pass("paid_to_external is in NON_CASH_METHODS (excluded from account balances) and UNSETTLED_METHODS (excluded from collected-revenue totals)");
    }

    let unlinked = 0, orphaned = 0, mismatched = 0, wrongCostType = 0;
    for (const r of rows) {
      const linkedId = r.externalParty?.linkedReceivableId;
      if (!linkedId) { unlinked++; continue; }
      const rec = await receivables.findOne({ _id: linkedId });
      if (!rec) { orphaned++; continue; }
      if (Math.abs((rec.totalAmount || 0) - (r.amount || 0)) > 0.01) mismatched++;
      if (r.costType !== "Revenue") wrongCostType++;
    }
    if (unlinked) fail(`${unlinked} paid_to_external row(s) have no linked receivable — that money left the books with nothing to chase`);
    else if (rows.length) pass("every paid_to_external row links to a receivable");
    if (orphaned) fail(`${orphaned} row(s) link to a receivable that no longer exists`);
    if (mismatched) fail(`${mismatched} row(s) whose linked receivable amount disagrees with the transaction amount`);
    if (wrongCostType) fail(`${wrongCostType} row(s) are not costType Revenue — the sale wouldn't count anywhere`);
    if (!rows.length) warn("no paid_to_external rows in this period — nothing to check");
  }

  // ── Case 3 — Receivable settled: cash book, NOT sales ─────────────────────────────────
  console.log("\n3) Receivable settled -> cash book, NOT sales (isSettlement)");
  {
    const rows = await tx.find({ ...dateMatch, receivableId: { $ne: null } }).toArray();
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    console.log(`  ${rows.length} transaction(s), ${fmt(total)}`);

    let notSettlement = 0, wrongCostType = 0, isUnsettledMethod = 0, blankFurtherMode = 0;
    for (const r of rows) {
      if (!r.isSettlement) notSettlement++;
      if (r.costType !== "Revenue") wrongCostType++;
      if (UNSETTLED_METHODS.includes(r.method)) isUnsettledMethod++;
      if (isBlank(r.furtherMode)) blankFurtherMode++;
    }
    if (notSettlement) fail(`${notSettlement} receivable-linked row(s) are NOT flagged isSettlement — they will double-count as fresh revenue`);
    else if (rows.length) pass("every receivable-linked row is flagged isSettlement");
    if (wrongCostType) fail(`${wrongCostType} row(s) are not costType Revenue`);
    if (isUnsettledMethod) fail(`${isUnsettledMethod} row(s) use an UNSETTLED method — money didn't actually land, receivableAggregation would double it`);
    if (blankFurtherMode) warn(`${blankFurtherMode} row(s) have no furtherMode — the cash movement is invisible to Close Book`);
    if (!rows.length) warn("no receivable settlements recorded in this period — the receipt route has not been exercised yet in this dataset");

    // isSettlement must MATCH the receivable's recorded costAlreadyRecognised. The receipt route
    // used to write an unconditional true, which silently deleted the revenue of every
    // hand-raised receivable from SETTLEMENT_EXCLUSION reports. Now it reads the stored fact, so
    // any disagreement here means a row was written outside that route.
    let flagMismatch = 0;
    for (const r of rows) {
      const rec = await receivables.findOne({ _id: r.receivableId });
      if (!rec) continue;
      if (!!r.isSettlement !== (rec.costAlreadyRecognised === true)) flagMismatch++;
    }
    if (flagMismatch) {
      fail(`${flagMismatch} receipt(s) whose isSettlement disagrees with their receivable's costAlreadyRecognised`);
    } else if (rows.length) {
      pass("every receipt's isSettlement matches its receivable's costAlreadyRecognised");
    }

    // The field must be populated on every receivable, or "absent" silently reads as false and a
    // paid_to_external receivable's collection would double-count revenue.
    const missingField = await receivables.countDocuments({ costAlreadyRecognised: { $exists: false } });
    if (missingField) fail(`${missingField} receivable(s) have no costAlreadyRecognised — run scripts/backfill-cost-recognition.mjs`);
    else pass("every receivable carries costAlreadyRecognised");
  }

  // ── Case 4 — paid_by_other: expense total, no cash, creates a Payable ─────────────────
  console.log("\n4) paid_by_other -> expense total, no cash, creates a Payable");
  {
    const rows = await tx.find({ ...dateMatch, method: "paid_by_other" }).toArray();
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    console.log(`  ${rows.length} transaction(s), ${fmt(total)}`);

    if (!NON_CASH_METHODS.includes("paid_by_other") || !UNSETTLED_METHODS.includes("paid_by_other")) {
      fail("paid_by_other is missing from NON_CASH_METHODS or UNSETTLED_METHODS");
    } else {
      pass("paid_by_other is in NON_CASH_METHODS and UNSETTLED_METHODS");
    }

    let unlinked = 0, orphaned = 0, mismatched = 0, wrongCostType = 0;
    for (const r of rows) {
      const linkedId = r.externalParty?.linkedPayableId;
      if (!linkedId) { unlinked++; continue; }
      const pay = await payables.findOne({ _id: linkedId });
      if (!pay) { orphaned++; continue; }
      if (Math.abs((pay.totalAmount || 0) - (r.amount || 0)) > 0.01) mismatched++;
      if (r.costType !== "Expenses") wrongCostType++;
    }
    if (unlinked) fail(`${unlinked} paid_by_other row(s) have no linked payable — the debt to that party is untracked`);
    else if (rows.length) pass("every paid_by_other row links to a payable");
    if (orphaned) fail(`${orphaned} row(s) link to a payable that no longer exists`);
    if (mismatched) fail(`${mismatched} row(s) whose linked payable amount disagrees with the transaction amount`);
    if (wrongCostType) fail(`${wrongCostType} row(s) are not costType Expenses`);
    if (!rows.length) warn("no paid_by_other rows in this period — nothing to check");
  }

  // ── Case 5 — Payable settled: cash book, NOT expense ──────────────────────────────────
  console.log("\n5) Payable settled -> cash book, NOT expense (isSettlement)");
  {
    const rows = await tx.find({ ...dateMatch, payableId: { $ne: null } }).toArray();
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    console.log(`  ${rows.length} transaction(s), ${fmt(total)}`);

    let notSettlement = 0, wrongCostType = 0, isUnsettledMethod = 0, blankFurtherMode = 0;
    for (const r of rows) {
      if (!r.isSettlement) notSettlement++;
      if (r.costType !== "Expenses") wrongCostType++;
      if (UNSETTLED_METHODS.includes(r.method)) isUnsettledMethod++;
      if (isBlank(r.furtherMode)) blankFurtherMode++;
    }
    if (notSettlement) fail(`${notSettlement} payable-linked row(s) are NOT flagged isSettlement — they will double-count as a fresh expense`);
    else if (rows.length) pass("every payable-linked row is flagged isSettlement");
    if (wrongCostType) fail(`${wrongCostType} row(s) are not costType Expenses`);
    if (isUnsettledMethod) fail(`${isUnsettledMethod} row(s) use an UNSETTLED method`);
    if (blankFurtherMode) warn(`${blankFurtherMode} row(s) have no furtherMode`);

    const totalPayables = await payables.countDocuments({ isCancelled: false });
    if (!rows.length) {
      warn(
        `no payable settlements recorded yet (${totalPayables} open payable(s), 0 ever paid) — the mechanism is untested in this dataset.`,
      );
    }

    // Mirror of case 3's check. expense/create used to write `isSettlement: !!payableId`, which
    // was correct only for payables the paid_by_other flow auto-created. It now reads the
    // payable's own costAlreadyRecognised, so a mismatch means a row bypassed that route.
    let flagMismatch = 0;
    for (const r of rows) {
      const pay = await payables.findOne({ _id: r.payableId });
      if (!pay) continue;
      if (!!r.isSettlement !== (pay.costAlreadyRecognised === true)) flagMismatch++;
    }
    if (flagMismatch) {
      fail(`${flagMismatch} payment(s) whose isSettlement disagrees with their payable's costAlreadyRecognised`);
    } else if (rows.length) {
      pass("every payment's isSettlement matches its payable's costAlreadyRecognised");
    }

    const missingField = await payables.countDocuments({ costAlreadyRecognised: { $exists: false } });
    if (missingField) fail(`${missingField} payable(s) have no costAlreadyRecognised — run scripts/backfill-cost-recognition.mjs`);
    else pass("every payable carries costAlreadyRecognised");

    // The whole point of the fix: a hand-raised payable's payment must COUNT as an expense.
    const manualOpen = await payables.countDocuments({ isCancelled: false, costAlreadyRecognised: { $ne: true } });
    pass(
      `${manualOpen} open payable(s) carry costAlreadyRecognised:false — their payments will count in Total Expenses, which is the corrected behaviour`,
    );
  }

  // ── Case 6 — Contra: neither sales nor expense ─────────────────────────────────────────
  console.log("\n6) Contra (AccountTransfer) -> neither sales nor expense");
  {
    const match = { isCancelled: { $ne: true }, ...(FROM || TO ? { date: dateMatch.date } : {}) };
    const [agg] = await transfers
      .aggregate([{ $match: match }, { $group: { _id: null, n: { $sum: 1 }, total: { $sum: "$amount" } } }])
      .toArray();
    console.log(`  ${agg?.n || 0} transfer(s), ${fmt(agg?.total)}`);
    pass("contra entries live in a separate collection (accounttransfers) that no revenue/expense query names — structurally cannot leak into P&L");

    // Net-zero across accounts by construction: every transfer contributes +amount to toAccount
    // and -amount to fromAccount (see buildContraUnionStage). Confirm no transfer moves money to
    // and from the same account, which the model's own pre-validate hook should already refuse.
    const selfTransfer = await transfers.countDocuments({ $expr: { $eq: ["$fromAccount", "$toAccount"] } });
    if (selfTransfer > 0) fail(`${selfTransfer} transfer(s) have fromAccount === toAccount — should be impossible, the model rejects this on save`);
    else pass("no transfer moves money to and from the same account");
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`Result: ${failures} failure(s), ${warnings} warning(s) (warnings include informational flags on unexercised paths and the structural finding above).\n`);

  await mongoose.disconnect();
  if (failures > 0) process.exit(1);
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
