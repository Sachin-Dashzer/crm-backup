// READ-ONLY orphan report (§2.5). Reports only — never writes, never fixes.
//
// Finds the four ways the transaction <-> linked-document graph can rot, which it can today
// because the delete/update routes carry no cascade logic at all (§2.1):
//
//   1. Receivables/Payables whose CREATING transaction no longer exists
//   2. Transactions whose receivableId / payableId points at a missing document
//   3. Transactions whose collabRef points at a missing case/settlement
//   4. CollabCases with no linked transaction
//
// Also reports the §7 Q5 backfill impact: how many rows a settlement backfill would touch and
// what revenue/expense totals look like before and after, so the decision is made on numbers.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

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

const UNSETTLED_METHODS = ["paid_to_external", "paid_by_other"];
const inr = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const head = (s) => console.log(`\n${"=".repeat(74)}\n${s}\n${"=".repeat(74)}`);

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");
  const receivables = db.collection("receivables");
  const payables = db.collection("payables");
  const collabcases = db.collection("collabcases");
  const collabsettlements = db.collection("collabsettlements");

  // ── §2.4: is a replica set actually available? ──
  head("REPLICA SET / TRANSACTION SUPPORT (§2.4)");
  let replicaSet = null;
  try {
    const status = await db.admin().command({ hello: 1 });
    replicaSet = status.setName || null;
    console.log(`  hello.setName        : ${replicaSet || "(none — standalone)"}`);
    console.log(`  Sessions supported   : ${status.logicalSessionTimeoutMinutes != null ? "yes" : "no"}`);
    console.log(`  Multi-doc txns usable: ${replicaSet ? "YES — use a session" : "NO — use compensating writes"}`);
  } catch (e) {
    console.log(`  Could not determine: ${e.message}`);
  }

  const ids = (arr) => arr.map((d) => d._id);
  const existing = async (coll, idList) => {
    if (!idList.length) return new Set();
    const found = await coll.find({ _id: { $in: idList } }, { projection: { _id: 1 } }).toArray();
    return new Set(found.map((d) => String(d._id)));
  };

  // ── 1. Receivables / Payables whose creating transaction is gone ──
  head("1. RECEIVABLES / PAYABLES WHOSE CREATING TRANSACTION IS MISSING");

  // A receivable is "created by" a transaction that points at it via externalParty.linkedReceivableId
  // or collabRef.receivableId. A receivable raised directly (receivables/create) has no creating
  // transaction by design — those are NOT orphans and are counted separately.
  const allRecv = await receivables.find({}, { projection: { _id: 1, totalAmount: 1, purpose: 1, isCancelled: 1 } }).toArray();
  const allPay = await payables.find({}, { projection: { _id: 1, totalAmount: 1, purpose: 1, isCancelled: 1 } }).toArray();

  const creatorRecvIds = new Set(
    (await tx.find(
      { $or: [{ "externalParty.linkedReceivableId": { $ne: null } }, { "collabRef.receivableId": { $ne: null } }] },
      { projection: { "externalParty.linkedReceivableId": 1, "collabRef.receivableId": 1 } },
    ).toArray()).flatMap((t) =>
      [t.externalParty?.linkedReceivableId, t.collabRef?.receivableId].filter(Boolean).map(String),
    ),
  );
  const creatorPayIds = new Set(
    (await tx.find(
      { $or: [{ "externalParty.linkedPayableId": { $ne: null } }, { "collabRef.payableId": { $ne: null } }] },
      { projection: { "externalParty.linkedPayableId": 1, "collabRef.payableId": 1 } },
    ).toArray()).flatMap((t) =>
      [t.externalParty?.linkedPayableId, t.collabRef?.payableId].filter(Boolean).map(String),
    ),
  );

  // Only a doc that WAS linked from a transaction can be orphaned by that transaction's deletion.
  // We can't see a deleted transaction, so the detectable signal is: the doc records a creating
  // link in its own remarks/log provenance but no transaction points at it any more. Practical
  // proxy used here: collab-provenance docs (purpose COLLAB_SETTLEMENT / COLLAB_CLINIC) and
  // external-party docs (purpose OTHER + expenseCategory External Payment) with no pointer.
  const collabRecv = allRecv.filter((r) => r.purpose === "COLLAB_SETTLEMENT");
  const collabPay = allPay.filter((p) => p.purpose === "COLLAB_CLINIC");
  const orphanRecv = collabRecv.filter((r) => !creatorRecvIds.has(String(r._id)));
  const orphanPay = collabPay.filter((p) => !creatorPayIds.has(String(p._id)));

  console.log(`  Receivables total                       : ${allRecv.length}`);
  console.log(`    of which collab-provenance            : ${collabRecv.length}`);
  console.log(`    ORPHANED (no transaction points at it): ${orphanRecv.length}  ${inr(orphanRecv.reduce((s, r) => s + (r.totalAmount || 0), 0))}`);
  console.log(`  Payables total                          : ${allPay.length}`);
  console.log(`    of which collab-provenance            : ${collabPay.length}`);
  console.log(`    ORPHANED (no transaction points at it): ${orphanPay.length}  ${inr(orphanPay.reduce((s, p) => s + (p.totalAmount || 0), 0))}`);
  for (const r of orphanRecv.slice(0, 10)) console.log(`      receivable ${r._id}  ${inr(r.totalAmount)}${r.isCancelled ? " (cancelled)" : ""}`);
  for (const p of orphanPay.slice(0, 10)) console.log(`      payable    ${p._id}  ${inr(p.totalAmount)}${p.isCancelled ? " (cancelled)" : ""}`);

  // ── 2. Transactions pointing at a missing receivable/payable ──
  head("2. TRANSACTIONS POINTING AT A MISSING RECEIVABLE / PAYABLE");

  const txWithRecv = await tx.find({ receivableId: { $ne: null } }, { projection: { receivableId: 1, amount: 1, date: 1, costType: 1 } }).toArray();
  const txWithPay = await tx.find({ payableId: { $ne: null } }, { projection: { payableId: 1, amount: 1, date: 1, costType: 1 } }).toArray();
  const liveRecv = await existing(receivables, [...new Set(txWithRecv.map((t) => t.receivableId))]);
  const livePay = await existing(payables, [...new Set(txWithPay.map((t) => t.payableId))]);
  const danglingRecv = txWithRecv.filter((t) => !liveRecv.has(String(t.receivableId)));
  const danglingPay = txWithPay.filter((t) => !livePay.has(String(t.payableId)));

  console.log(`  Transactions with receivableId : ${txWithRecv.length}`);
  console.log(`    DANGLING (target missing)    : ${danglingRecv.length}  ${inr(danglingRecv.reduce((s, t) => s + (t.amount || 0), 0))}`);
  console.log(`  Transactions with payableId    : ${txWithPay.length}`);
  console.log(`    DANGLING (target missing)    : ${danglingPay.length}  ${inr(danglingPay.reduce((s, t) => s + (t.amount || 0), 0))}`);
  for (const t of [...danglingRecv, ...danglingPay].slice(0, 10)) {
    console.log(`      txn ${t._id}  ${inr(t.amount)}  ${t.costType}  -> ${t.receivableId || t.payableId}`);
  }

  // ── 3. Transactions whose collabRef points at a missing document ──
  head("3. TRANSACTIONS WHOSE collabRef POINTS AT A MISSING DOCUMENT");

  const txCollab = await tx.find(
    { $or: [{ "collabRef.caseId": { $ne: null } }, { "collabRef.settlementId": { $ne: null } }] },
    { projection: { collabRef: 1, amount: 1, costType: 1 } },
  ).toArray();
  const liveCases = await existing(collabcases, [...new Set(txCollab.map((t) => t.collabRef?.caseId).filter(Boolean))]);
  const liveSettles = await existing(collabsettlements, [...new Set(txCollab.map((t) => t.collabRef?.settlementId).filter(Boolean))]);
  const danglingCase = txCollab.filter((t) => t.collabRef?.caseId && !liveCases.has(String(t.collabRef.caseId)));
  const danglingSettle = txCollab.filter((t) => t.collabRef?.settlementId && !liveSettles.has(String(t.collabRef.settlementId)));

  console.log(`  Transactions with collabRef.caseId       : ${txCollab.filter((t) => t.collabRef?.caseId).length}`);
  console.log(`    DANGLING                               : ${danglingCase.length}  ${inr(danglingCase.reduce((s, t) => s + (t.amount || 0), 0))}`);
  console.log(`  Transactions with collabRef.settlementId : ${txCollab.filter((t) => t.collabRef?.settlementId).length}`);
  console.log(`    DANGLING                               : ${danglingSettle.length}  ${inr(danglingSettle.reduce((s, t) => s + (t.amount || 0), 0))}`);

  // ── 4. CollabCases with no linked transaction ──
  head("4. COLLAB CASES WITH NO LINKED TRANSACTION");

  const cases = await collabcases.find({}, { projection: { _id: 1, clinic: 1, packageAmount: 1, status: 1 } }).toArray();
  const casesWithTx = new Set(
    (await tx.find({ "collabRef.caseId": { $ne: null } }, { projection: { "collabRef.caseId": 1 } }).toArray())
      .map((t) => String(t.collabRef.caseId)),
  );
  const caseOrphans = cases.filter((c) => !casesWithTx.has(String(c._id)));
  console.log(`  Collab cases total                : ${cases.length}`);
  console.log(`    WITHOUT any linked transaction  : ${caseOrphans.length}  ${inr(caseOrphans.reduce((s, c) => s + (c.packageAmount || 0), 0))}`);
  for (const c of caseOrphans.slice(0, 10)) console.log(`      case ${c._id}  ${c.clinic}  ${inr(c.packageAmount)}  ${c.status}`);

  // ── §7 Q5: backfill impact ──
  head("§7 Q5 — isSettlement BACKFILL IMPACT (nothing written)");

  // Candidate = a transaction that MOVES CASH for a sale/cost booked elsewhere, i.e. it is
  // linked to a receivable/payable and is not itself the originating unsettled-method row.
  const candidateMatch = {
    $or: [{ receivableId: { $ne: null } }, { payableId: { $ne: null } }],
    method: { $nin: UNSETTLED_METHODS },
    isSettlement: { $ne: true },
  };
  const candidates = await tx.find(candidateMatch, { projection: { costType: 1, amount: 1, method: 1, receivableId: 1, payableId: 1 } }).toArray();
  const revCand = candidates.filter((t) => t.costType === "Revenue");
  const expCand = candidates.filter((t) => t.costType === "Expenses");

  const totalRevenue = (await tx.aggregate([
    { $match: { costType: "Revenue", method: { $nin: UNSETTLED_METHODS }, approvalStatus: { $nin: ["PENDING", "REJECTED"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).toArray())[0]?.total || 0;
  const totalExpense = (await tx.aggregate([
    { $match: { costType: "Expenses", method: { $nin: UNSETTLED_METHODS }, approvalStatus: { $nin: ["PENDING", "REJECTED"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).toArray())[0]?.total || 0;

  const revDrop = revCand.reduce((s, t) => s + (t.amount || 0), 0);
  const expDrop = expCand.reduce((s, t) => s + (t.amount || 0), 0);

  console.log(`  Rows the backfill would set isSettlement=true : ${candidates.length}`);
  console.log(`    revenue-side : ${revCand.length}  ${inr(revDrop)}`);
  console.log(`    expense-side : ${expCand.length}  ${inr(expDrop)}`);
  console.log("");
  console.log(`  TOTAL REVENUE  before: ${inr(totalRevenue)}   after: ${inr(totalRevenue - revDrop)}   (-${inr(revDrop)})`);
  console.log(`  TOTAL EXPENSE  before: ${inr(totalExpense)}   after: ${inr(totalExpense - expDrop)}   (-${inr(expDrop)})`);
  console.log(`  NET (rev-exp)  before: ${inr(totalRevenue - totalExpense)}   after: ${inr((totalRevenue - revDrop) - (totalExpense - expDrop))}`);

  const byMethod = new Map();
  for (const t of candidates) byMethod.set(t.method, (byMethod.get(t.method) || 0) + 1);
  if (byMethod.size) {
    console.log("\n  Candidates by method:");
    for (const [m, n] of [...byMethod.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(m).padEnd(34)} x${n}`);
  }

  console.log("\nRead-only report complete — nothing was written.\n");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
