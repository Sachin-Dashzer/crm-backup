import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

// Backfills Payable.costAlreadyRecognised / Receivable.costAlreadyRecognised on documents that
// predate the field. See src/models/Payable.js for what it means and why it is stored.
//
// The rule is origin, not purpose: a document whose amount was ALREADY booked as revenue/expense
// by an earlier transaction gets true; one raised by hand, where the eventual payment IS the
// P&L event, keeps the schema default of false.
//
// Origin is detected structurally rather than by guessing from purpose:
//   receivable  <- a transaction whose externalParty.linkedReceivableId points at it
//                  (the paid_to_external flow), or a collabRef link (gross revenue booked)
//   payable     <- a transaction whose externalParty.linkedPayableId points at it
//                  (the paid_by_other flow)
// Anything with no such origin transaction is manual and is listed as LEAVE AS FALSE.
//
// DRY RUN BY DEFAULT. Pass --apply to write.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.slice(2).includes("--apply");

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
const pad = (s, n) => String(s ?? "").padEnd(n).slice(0, n);

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");
  const payables = db.collection("payables");
  const receivables = db.collection("receivables");

  console.log(`\nBackfill costAlreadyRecognised`);
  console.log(`Mode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  // Every id referenced as an auto-created document by a source transaction. Built from the
  // transactions side so a document is only ever marked recognised when a real booking row
  // actually points at it — a purpose-based guess would mislabel hand-raised documents that
  // happen to share a purpose with an automated one.
  const recFromExternal = (await tx.distinct("externalParty.linkedReceivableId", {
    "externalParty.linkedReceivableId": { $ne: null },
  })).map(String);
  const recFromCollab = (await tx.distinct("collabRef.receivableId", {
    "collabRef.receivableId": { $ne: null },
  })).map(String);
  const payFromExternal = (await tx.distinct("externalParty.linkedPayableId", {
    "externalParty.linkedPayableId": { $ne: null },
  })).map(String);
  // Collab payables are deliberately NOT included: the collab flow expenses only what the clinic
  // already kept, and this payable is the remainder, expensed when paid. See collabDerivation.js.

  const recRecognised = new Set([...recFromExternal, ...recFromCollab]);
  const payRecognised = new Set(payFromExternal);

  const report = async (label, coll, recognisedIds) => {
    const docs = await coll.find({}).toArray();
    const toTrue = [];
    const leaveFalse = [];
    for (const d of docs) {
      const shouldBeTrue = recognisedIds.has(String(d._id));
      const current = d.costAlreadyRecognised === true;
      if (shouldBeTrue && !current) toTrue.push(d);
      else if (!shouldBeTrue) leaveFalse.push(d);
    }

    console.log(`${label} — ${docs.length} document(s)`);
    console.log(`  ${"-".repeat(88)}`);

    if (toTrue.length) {
      console.log(`  SET costAlreadyRecognised = true  (${toTrue.length}):`);
      for (const d of toTrue) {
        const party = d.payee || d.payer;
        console.log(
          `    ${pad(d.purpose, 20)} ${pad(party?.kind, 14)} ${pad(party?.label, 26)} ${fmt(d.totalAmount).padStart(14)}`,
        );
      }
    } else {
      console.log(`  SET costAlreadyRecognised = true  (0): nothing to change`);
    }

    console.log(`  LEAVE AS false (manually raised) (${leaveFalse.length}):`);
    for (const d of leaveFalse) {
      const party = d.payee || d.payer;
      console.log(
        `    ${pad(d.purpose, 20)} ${pad(party?.kind, 14)} ${pad(party?.label, 26)} ${fmt(d.totalAmount).padStart(14)}`,
      );
    }
    console.log("");
    return toTrue;
  };

  const recToTrue = await report("RECEIVABLES", receivables, recRecognised);
  const payToTrue = await report("PAYABLES", payables, payRecognised);

  // A document already carrying true that this script would NOT set is a contradiction worth
  // shouting about — it means something wrote the flag outside this rule.
  const staleTrue = [
    ...(await receivables.find({ costAlreadyRecognised: true }).toArray())
      .filter((d) => !recRecognised.has(String(d._id)))
      .map((d) => ["receivable", d]),
    ...(await payables.find({ costAlreadyRecognised: true }).toArray())
      .filter((d) => !payRecognised.has(String(d._id)))
      .map((d) => ["payable", d]),
  ];
  if (staleTrue.length) {
    console.log(`WARNING — ${staleTrue.length} document(s) are already flagged true but have no origin transaction:`);
    for (const [kind, d] of staleTrue) {
      console.log(`  ${kind} ${d._id} ${d.purpose} ${(d.payee || d.payer)?.label}`);
    }
    console.log("  Left untouched. Investigate before trusting their payments' isSettlement.\n");
  }

  console.log(
    `Summary: ${recToTrue.length} receivable(s) and ${payToTrue.length} payable(s) would be set to true.`,
  );

  if (!APPLY) {
    console.log(`\nDry run — nothing written. Re-run with --apply once the lists above look right.\n`);
    return mongoose.disconnect();
  }

  if (recToTrue.length) {
    const r = await receivables.updateMany(
      { _id: { $in: recToTrue.map((d) => d._id) } },
      { $set: { costAlreadyRecognised: true } },
    );
    console.log(`  receivables updated: ${r.modifiedCount}`);
  }
  if (payToTrue.length) {
    const r = await payables.updateMany(
      { _id: { $in: payToTrue.map((d) => d._id) } },
      { $set: { costAlreadyRecognised: true } },
    );
    console.log(`  payables updated: ${r.modifiedCount}`);
  }
  // Documents that should stay false need the field present so queries can rely on it rather
  // than on "absent means false" — an explicit false is also visible in the shell.
  const recFalse = await receivables.updateMany(
    { costAlreadyRecognised: { $exists: false } },
    { $set: { costAlreadyRecognised: false } },
  );
  const payFalse = await payables.updateMany(
    { costAlreadyRecognised: { $exists: false } },
    { $set: { costAlreadyRecognised: false } },
  );
  console.log(`  receivables defaulted to false: ${recFalse.modifiedCount}`);
  console.log(`  payables defaulted to false: ${payFalse.modifiedCount}\n`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
