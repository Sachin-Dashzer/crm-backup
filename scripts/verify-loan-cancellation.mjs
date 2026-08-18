import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { encode } from "next-auth/jwt";

// Verifies loan cancellation end to end against a REAL RUNNING dev server (`npm run dev`),
// through the actual HTTP routes — src/app/api/transactions/[id]/cancel-loan, which shares its
// reversal guards with the proven .../reverse route via src/lib/reverseTransaction.js. Nothing
// here re-implements the reversal or the transfer-reversal logic; it only sets up scenarios (raw
// collection writes, mirroring verify-pillar-rules.mjs's convention) and asserts on the state the
// real server produced.
//
// WRITES TEST DATA to whatever MONGODB_URI is configured. Every row this script creates itself,
// and every row the server creates in response, is deleted again in a `finally` block — success
// or failure — so nothing durable is left behind. Still, do not point this at a database you are
// not willing to see temporary rows appear in briefly; confirm MONGODB_URI first.
//
// Preconditions:
//   1. The dev server is running (`npm run dev`) and reachable at BASE_URL.
//   2. At least one admin/super-admin user exists in the `users` collection — this script signs
//      a session token for that real user rather than creating one, so a fake user can't leave
//      a login-worthy account behind.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.VERIFY_BASE_URL || "http://localhost:3000";

function readEnv(name) {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)\\s*$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (process.env[name]) return process.env[name];
  return null;
}

const MONGODB_URI = readEnv("MONGODB_URI");
const NEXTAUTH_SECRET = readEnv("NEXTAUTH_SECRET");
if (!MONGODB_URI) throw new Error("MONGODB_URI not found in .env.local, .env, or the environment");
if (!NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET not found in .env.local, .env, or the environment");

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

let failures = 0;
function pass(label) {
  console.log(`  ✅ ${label}`);
}
function fail(label, detail) {
  failures++;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
}

// Tracks every document THIS SCRIPT or the SERVER created, across all cases, for teardown.
const created = { transactions: [], transfers: [] };

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const users = db.collection("users");
  const tx = db.collection("transactions");
  const transfers = db.collection("accounttransfers");

  console.log("\nVerify Loan Cancellation");
  console.log(`Server: ${BASE_URL}\n`);

  // ── Sign in as a real admin/super-admin user ──────────────────────────────────────────
  const adminUser = await users.findOne({ role: { $in: ["admin", "super-admin"] } });
  if (!adminUser) {
    throw new Error("No admin/super-admin user found — cannot sign a session token to test with.");
  }
  const cookieValue = await encode({
    token: {
      id: String(adminUser._id),
      role: adminUser.role,
      branch: adminUser.branch || "All",
      sessionVersion: adminUser.sessionVersion || 0,
      name: adminUser.name,
      email: adminUser.email,
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 9 * 60 * 60,
  });
  const cookieHeader = `next-auth.session-token=${cookieValue}`;
  const authedFetch = (url, opts = {}) =>
    fetch(`${BASE_URL}${url}`, {
      ...opts,
      headers: { "Content-Type": "application/json", Cookie: cookieHeader, ...(opts.headers || {}) },
    });

  console.log(`Signed in as ${adminUser.email} (${adminUser.role})\n`);

  // ── Case 1 — Case A: not yet settled ───────────────────────────────────────────────────
  console.log("1) Case A — cancel a loan transaction that was never settled");
  {
    const amount = 10000;
    const doc = {
      amount,
      date: new Date(),
      costType: "Revenue",
      transactionCategory: "TRANSPLANT",
      method: "bajaj_loan",
      furtherMode: "Bajaj Loan",
      receiptMode: "Bajaj Statement",
      branch: "Delhi",
      approvalStatus: "APPROVED",
      patientName: "QA Verify Loan Cancellation A",
      isSettlement: false,
      isReversed: false,
      reversalOf: null,
      remarks: "verify-loan-cancellation.mjs — Case A fixture",
      createdBy: { name: "verify-script", email: "verify-script@local", date: new Date() },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await tx.insertOne(doc);
    created.transactions.push(insertedId);
    console.log(`  Created loan transaction ${insertedId} (${fmt(amount)}, Bajaj Loan)`);

    const before = await sumRevenue(tx, "QA Verify Loan Cancellation A");
    if (before === amount) pass(`Revenue before cancellation = ${fmt(amount)}`);
    else fail("Revenue before cancellation", `expected ${fmt(amount)}, got ${fmt(before)}`);

    const res = await authedFetch(`/api/transactions/${insertedId}/cancel-loan`, {
      method: "POST",
      body: JSON.stringify({ reason: "QA verify — Case A" }),
    });
    const body = await res.json();
    if (res.status !== 201) {
      fail("POST /cancel-loan (Case A) returned 201", `status ${res.status}: ${body.error}`);
    } else {
      pass("POST /cancel-loan (Case A) returned 201");
      if (body.case === "A") pass('Response reports case "A"');
      else fail('Response reports case "A"', `got "${body.case}"`);
      if (body.reversal?._id) created.transactions.push(body.reversal._id);
      if (body.reversalTransfer) fail("No reversal transfer expected in Case A", "one was created");
      else pass("No reversal transfer created (Case A never settled)");
    }

    const after = await sumRevenue(tx, "QA Verify Loan Cancellation A");
    if (after === 0) pass(`Revenue after cancellation = ${fmt(0)} (back to pre-loan figure)`);
    else fail("Revenue after cancellation", `expected ${fmt(0)}, got ${fmt(after)}`);

    const bajajBalance = await accountNet(tx, transfers, "Bajaj Loan", "QA Verify Loan Cancellation A");
    if (bajajBalance === 0) pass("Bajaj Loan balance for this fixture = 0");
    else fail("Bajaj Loan balance for this fixture", `expected 0, got ${fmt(bajajBalance)}`);

    const rows = await tx.countDocuments({
      $or: [{ patientName: "QA Verify Loan Cancellation A" }, { _id: { $in: created.transactions } }],
    });
    if (rows === 2) pass(`Two transaction rows visible (original + reversal): ${rows}`);
    else fail("Two transaction rows visible", `found ${rows}`);
  }

  // ── Case 2 — Case B: already settled ───────────────────────────────────────────────────
  console.log("\n2) Case B — cancel a loan transaction that was already settled");
  {
    const amount = 15000;
    const doc = {
      amount,
      date: new Date(),
      costType: "Revenue",
      transactionCategory: "TRANSPLANT",
      method: "bajaj_loan",
      furtherMode: "Bajaj Loan",
      receiptMode: "Bajaj Statement",
      branch: "Delhi",
      approvalStatus: "APPROVED",
      patientName: "QA Verify Loan Cancellation B",
      isSettlement: false,
      isReversed: false,
      reversalOf: null,
      remarks: "verify-loan-cancellation.mjs — Case B fixture",
      createdBy: { name: "verify-script", email: "verify-script@local", date: new Date() },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { insertedId } = await tx.insertOne(doc);
    created.transactions.push(insertedId);
    console.log(`  Created loan transaction ${insertedId} (${fmt(amount)}, Bajaj Loan)`);

    // Settle it through the REAL settlement endpoint — the same one LoanSettlementModal calls.
    const settleRes = await authedFetch("/api/account-transfers/create", {
      method: "POST",
      body: JSON.stringify({
        fromAccount: "Bajaj Loan",
        toAccount: "HDFC Skin",
        amount,
        reference: "QA-SETTLE-B",
        remarks: "verify-loan-cancellation.mjs — Case B settlement",
        sourceTransactionId: String(insertedId),
      }),
    });
    const settleBody = await settleRes.json();
    if (settleRes.status !== 201) {
      fail("Settlement transfer created", `status ${settleRes.status}: ${settleBody.error}`);
    } else {
      pass(`Settlement transfer created (Bajaj Loan → HDFC Skin, ${fmt(amount)})`);
      created.transfers.push(settleBody.transfer._id);
    }

    const bajajBeforeCancel = await accountNet(tx, transfers, "Bajaj Loan", "QA Verify Loan Cancellation B");
    const bankBeforeCancel = await accountNet(tx, transfers, "HDFC Skin", "QA Verify Loan Cancellation B", settleBody.transfer?._id);
    console.log(`  Before cancellation — Bajaj Loan: ${fmt(bajajBeforeCancel)}, HDFC Skin: ${fmt(bankBeforeCancel)}`);

    const res = await authedFetch(`/api/transactions/${insertedId}/cancel-loan`, {
      method: "POST",
      body: JSON.stringify({ reason: "QA verify — Case B" }),
    });
    const body = await res.json();
    if (res.status !== 201) {
      fail("POST /cancel-loan (Case B) returned 201", `status ${res.status}: ${body.error}`);
    } else {
      pass("POST /cancel-loan (Case B) returned 201");
      if (body.case === "B") pass('Response reports case "B"');
      else fail('Response reports case "B"', `got "${body.case}"`);
      if (body.reversal?._id) created.transactions.push(body.reversal._id);
      if (body.reversalTransfer?._id) {
        created.transfers.push(body.reversalTransfer._id);
        pass(`Reversal transfer created (${body.reversalTransfer.fromAccount} → ${body.reversalTransfer.toAccount})`);
      } else {
        fail("Reversal transfer created", "none in response");
      }
    }

    const revenueAfter = await sumRevenue(tx, "QA Verify Loan Cancellation B");
    if (revenueAfter === 0) pass(`Revenue after cancellation = ${fmt(0)} (back to pre-loan figure)`);
    else fail("Revenue after cancellation", `expected ${fmt(0)}, got ${fmt(revenueAfter)}`);

    const bajajAfter = await accountNet(tx, transfers, "Bajaj Loan", "QA Verify Loan Cancellation B");
    if (bajajAfter === 0) pass("Bajaj Loan balance for this fixture back to 0");
    else fail("Bajaj Loan balance for this fixture", `expected 0, got ${fmt(bajajAfter)}`);

    const bankAfter = await accountNet(tx, transfers, "HDFC Skin", "QA Verify Loan Cancellation B", settleBody.transfer?._id, body.reversalTransfer?._id);
    if (bankAfter === 0) pass("HDFC Skin balance for this fixture back to its pre-settlement figure (0)");
    else fail("HDFC Skin balance for this fixture", `expected 0, got ${fmt(bankAfter)}`);

    const txRows = await tx.countDocuments({
      $or: [{ patientName: "QA Verify Loan Cancellation B" }, { _id: { $in: created.transactions.slice(-2) } }],
    });
    const transferRows = await transfers.countDocuments({
      _id: { $in: created.transfers.slice(-2) },
      isCancelled: { $ne: true },
    });
    if (txRows === 2 && transferRows === 2) {
      pass(`Four rows visible total: ${txRows} transactions + ${transferRows} transfers, none hidden or netted away`);
    } else {
      fail("Four rows visible total", `${txRows} transactions, ${transferRows} transfers`);
    }
  }

  // ── Case 3 — cancelling an already-cancelled loan is rejected ─────────────────────────
  console.log("\n3) Attempt to cancel an already-cancelled loan");
  {
    const firstId = created.transactions[0]; // Case A's original, already fully reversed
    const res = await authedFetch(`/api/transactions/${firstId}/cancel-loan`, {
      method: "POST",
      body: JSON.stringify({ reason: "QA verify — double cancel" }),
    });
    const body = await res.json();
    if (res.status === 400 && /already.*reversed/i.test(body.error || "")) {
      pass(`Rejected with the "already reversed" guard: "${body.error}"`);
    } else {
      fail("Rejected with the already-reversed guard", `status ${res.status}: ${body.error}`);
    }
  }

  console.log(`\n${failures === 0 ? "✅ All checks passed" : `❌ ${failures} check(s) failed`}\n`);
}

// Sum of positive (non-reversal-net) revenue for a fixture, by patientName — reads what the real
// aggregations would report: original + reversal should always net correctly since both carry
// the same patientName.
async function sumRevenue(tx, patientName) {
  const [agg] = await tx
    .aggregate([
      { $match: { patientName, costType: "Revenue" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();
  return Math.round((agg?.total || 0) * 100) / 100;
}

// Net movement into `account` attributable to this fixture's transactions and transfers —
// transactions by furtherMode, transfers by fromAccount/toAccount, restricted to the transfer
// ids passed in (so we don't pick up unrelated activity in a live account like HDFC Skin).
async function accountNet(tx, transfers, account, patientName, ...transferIds) {
  const [txAgg] = await tx
    .aggregate([
      { $match: { patientName, furtherMode: account } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray();

  const ids = transferIds.filter(Boolean);
  let transferNet = 0;
  if (ids.length) {
    const rows = await transfers.find({ _id: { $in: ids }, isCancelled: { $ne: true } }).toArray();
    for (const r of rows) {
      if (r.toAccount === account) transferNet += r.amount;
      if (r.fromAccount === account) transferNet -= r.amount;
    }
  }
  return Math.round(((txAgg?.total || 0) + transferNet) * 100) / 100;
}

main()
  .catch((err) => {
    failures++;
    console.error("\n❌ Script error:", err);
  })
  .finally(async () => {
    // Teardown — every row this run touched, success or failure, so nothing durable is left in
    // whatever database MONGODB_URI points at.
    const db = mongoose.connection.db;
    if (created.transactions.length) {
      await db.collection("transactions").deleteMany({ _id: { $in: created.transactions } });
      console.log(`Cleaned up ${created.transactions.length} test transaction(s).`);
    }
    if (created.transfers.length) {
      await db.collection("accounttransfers").deleteMany({ _id: { $in: created.transfers } });
      console.log(`Cleaned up ${created.transfers.length} test transfer(s).`);
    }
    await mongoose.disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
