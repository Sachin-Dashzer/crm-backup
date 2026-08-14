// Read-only report: every change made to Transactions on a given day (default: today, IST) —
// both new transactions created and edits to existing ones, pulled from the same
// createdBy/editors[] audit trail the app itself writes on every save (see e.g.
// src/app/api/transactions/expense/update/route.js, and the ACTOR blocks in
// backfill-bank-routing.mjs / fix-costtype-typo.mjs).
//
// Usage:
//   node scripts/show-transaction-changes.mjs                 today (IST), grouped summary
//   node scripts/show-transaction-changes.mjs --date=2026-08-14
//   node scripts/show-transaction-changes.mjs --actor=backfill  filter by name/email substring
//   node scripts/show-transaction-changes.mjs --full            print every change, not grouped
//
// Always writes the full per-change detail to a JSON report file alongside the console summary
// — the grouped view is for reading, the file is for anyone who needs the exact rows.

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

function parseArgs(argv) {
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    const [key, ...rest] = a.slice(2).split("=");
    flags[key] = rest.length ? rest.join("=") : true;
  }
  return flags;
}

const args = parseArgs(process.argv.slice(2));
const FULL = args.full === true;
const ACTOR_FILTER = typeof args.actor === "string" ? args.actor.toLowerCase() : null;

// India has no DST — a fixed +05:30 offset always gives the correct IST midnight-to-midnight
// window, regardless of what timezone the machine running this script is in.
function istDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00.000+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { start, end };
}
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
const DATE_STR = typeof args.date === "string" ? args.date : todayIST();
const { start: DAY_START, end: DAY_END } = istDayBounds(DATE_STR);

const fmtMoney = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN")}`;
const fmtTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
const actorLabel = (a) => `${a?.name || "Unknown"} <${a?.email || "no-email"}>`;
const inRange = (d) => d && new Date(d) >= DAY_START && new Date(d) <= DAY_END;
const matchesActorFilter = (a) =>
  !ACTOR_FILTER || `${a?.name || ""} ${a?.email || ""}`.toLowerCase().includes(ACTOR_FILTER);

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");

  console.log(`\nTransaction changes — ${DATE_STR} (IST)`);
  if (ACTOR_FILTER) console.log(`Filtered to actor containing: "${ACTOR_FILTER}"`);
  console.log(`Window: ${DAY_START.toISOString()} .. ${DAY_END.toISOString()}\n`);

  // Narrow at the DB level to docs touched at all today; which specific createdBy/editors
  // entries actually fall in range is re-checked per-doc below.
  const docs = await tx
    .find({
      $or: [
        { "createdBy.date": { $gte: DAY_START, $lte: DAY_END } },
        { editors: { $elemMatch: { date: { $gte: DAY_START, $lte: DAY_END } } } },
      ],
    })
    .project({
      transactionCategory: 1, category: 1, procedure: 1, expense: 1, costType: 1,
      amount: 1, branch: 1, date: 1, patientName: 1, paymentId: 1,
      createdBy: 1, editors: 1,
    })
    .toArray();

  const events = []; // { kind: "Created"|"Updated", actor, at, doc, fields }

  for (const doc of docs) {
    const label = doc.patientName || doc.procedure || doc.expense || doc.transactionCategory || doc.category || "Transaction";

    if (inRange(doc.createdBy?.date) && matchesActorFilter(doc.createdBy)) {
      events.push({ kind: "Created", actor: doc.createdBy, at: doc.createdBy.date, doc, label, fields: [] });
    }

    for (const editor of doc.editors || []) {
      if (!inRange(editor.date) || !matchesActorFilter(editor)) continue;
      events.push({
        kind: "Updated",
        actor: editor,
        at: editor.date,
        doc,
        label,
        fields: editor.updatedFields?.length
          ? editor.updatedFields
          : [{ name: "(unspecified)", previousValue: "", newValue: "" }],
      });
    }
  }

  events.sort((a, b) => new Date(a.at) - new Date(b.at));

  if (!events.length) {
    console.log("No transaction changes found for this window.\n");
    return mongoose.disconnect();
  }

  // ── By actor ──
  const byActor = new Map();
  for (const e of events) {
    const k = actorLabel(e.actor);
    const g = byActor.get(k) || { created: 0, updated: 0, fieldChanges: 0 };
    if (e.kind === "Created") g.created += 1;
    else { g.updated += 1; g.fieldChanges += e.fields.length; }
    byActor.set(k, g);
  }
  console.log("By actor:");
  for (const [actor, g] of [...byActor.entries()].sort((a, b) => (b[1].created + b[1].updated) - (a[1].created + a[1].updated))) {
    console.log(`  ${actor.padEnd(40)} ${String(g.created).padStart(5)} created   ${String(g.updated).padStart(5)} transaction(s) edited   ${g.fieldChanges} field change(s)`);
  }
  console.log("");

  // ── Created, grouped ──
  const created = events.filter((e) => e.kind === "Created");
  if (created.length) {
    const groups = new Map();
    for (const e of created) {
      const k = `${actorLabel(e.actor)} | ${e.doc.transactionCategory || e.doc.category || "—"} | ${e.doc.branch || "—"}`;
      const g = groups.get(k) || { n: 0, amt: 0 };
      g.n += 1;
      g.amt += e.doc.amount || 0;
      groups.set(k, g);
    }
    console.log(`Created (${created.length}):`);
    for (const [k, g] of [...groups.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ${k}  ×${g.n}  ${fmtMoney(g.amt)}`);
    }
    console.log("");
  }

  // ── Field changes, grouped ──
  const updated = events.filter((e) => e.kind === "Updated");
  if (updated.length) {
    const groups = new Map();
    for (const e of updated) {
      for (const f of e.fields) {
        const k = `${actorLabel(e.actor)} | ${f.name}: ${f.previousValue || "(blank)"} -> ${f.newValue || "(blank)"}`;
        groups.set(k, (groups.get(k) || 0) + 1);
      }
    }
    console.log(`Field changes across ${updated.length} transaction edit(s):`);
    for (const [k, n] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}  ×${n}`);
    }
    console.log("");
  }

  // ── Full chronological detail, optional on console ──
  if (FULL) {
    console.log("Full detail:");
    for (const e of events) {
      const who = actorLabel(e.actor);
      const what = e.kind === "Created"
        ? "created"
        : e.fields.map((f) => `${f.name}: ${f.previousValue || "(blank)"} -> ${f.newValue || "(blank)"}`).join(", ");
      console.log(`  ${fmtTime(e.at)}  ${who.padEnd(38)} ${String(e.doc._id).padEnd(26)} ${e.label.padEnd(22)} ${e.kind.padEnd(8)} ${what}`);
    }
    console.log("");
  }

  // ── Always write full detail to a JSON report file — the grouped view above is for
  // reading, this is the exact record for anyone who needs it. ──
  const reportPath = path.resolve(REPO_ROOT, "scripts", `transaction-changes-${DATE_STR}.json`);
  const detail = events.map((e) => ({
    at: e.at,
    kind: e.kind,
    actor: { name: e.actor?.name, email: e.actor?.email, branch: e.actor?.branch },
    transactionId: String(e.doc._id),
    label: e.label,
    category: e.doc.transactionCategory || e.doc.category || "",
    branch: e.doc.branch || "",
    amount: e.doc.amount || 0,
    paymentId: e.doc.paymentId || "",
    fields: e.fields,
  }));
  fs.writeFileSync(reportPath, JSON.stringify(detail, null, 2));
  console.log(`Summary: ${created.length} created, ${updated.length} transaction(s) edited, ${events.length} total event(s).`);
  console.log(`Full detail (${detail.length} entries) written to ${reportPath}\n`);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
