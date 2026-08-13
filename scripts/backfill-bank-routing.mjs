

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import {
  ACCOUNTS,
  RECEIPT_MODES,
  getBankRoutingDefaults,
  getExpenseFurtherModeDefault,
} from "../src/constants/bankRouting.js";

// Repo root, not process.cwd() - this script lives in scripts/, and .env/.env.local live one
// level up, regardless of which directory it's invoked from (e.g. `cd scripts && node ...`).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const OVERRIDES = [
  // (empty — using the CRM's own rules)
];

  
const DEFAULT_FROM = "2026-08-01";
const DEFAULT_TO = "2026-08-12";

// ─────────────────────────────────────────────────────────────────────────────
// Below here is machinery — you shouldn't need to edit it.
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = { _: [] };
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
const APPLY = args.apply === true;
const OVERWRITE = args.overwrite === true;
const ALL_DATES = args["all-dates"] === true;
const REMAP = typeof args.remap === "string" ? args.remap : null;

const list = (v) =>
  typeof v === "string"
    ? v.split(",").map((s) => s.trim()).filter(Boolean)
    : null;
const FILTER_BRANCH = list(args.branch);
const FILTER_CATEGORY = list(args.category);
const FILTER_METHOD = list(args.method);

const dayStart = (d) => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d) => new Date(`${d}T23:59:59.999Z`);
const DATE_FROM = args.date ? dayStart(args.date) : dayStart(args.from || DEFAULT_FROM);
const DATE_TO = args.date ? dayEnd(args.date) : dayEnd(args.to || DEFAULT_TO);

const ACTOR = { name: "Backfill Script", email: "system@backfill", branch: "All" };

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const isBlank = (v) => v === undefined || v === null || v === "";
const show = (v) => (isBlank(v) ? "(blank)" : String(v));

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

const keyMatches = (ruleValue, docValue) =>
  ruleValue === undefined
    ? true
    : Array.isArray(ruleValue)
      ? ruleValue.includes(docValue)
      : ruleValue === docValue;

// An override, if one matches; otherwise the CRM's own routing rule for this row.
function resolveRouting(doc) {
  const override = OVERRIDES.find(
    (r) =>
      keyMatches(r.branch, doc.branch) &&
      keyMatches(r.transactionCategory, doc.transactionCategory) &&
      keyMatches(r.method, doc.method) &&
      keyMatches(r.costType, doc.costType),
  );
  if (override) return { ...override.set, source: "override" };

  // Expense side routes on method alone and has no receipt mode — see bankRouting.js.
  if (doc.costType === "Expenses" || doc.transactionCategory === "EXPENSE") {
    return { furtherMode: getExpenseFurtherModeDefault(doc.method), source: "crm:expense" };
  }

  const { receiptMode, furtherMode } = getBankRoutingDefaults(
    doc.branch,
    doc.transactionCategory,
    doc.method,
  );
  return { receiptMode, furtherMode, source: "crm:revenue" };
}

function validateOverrides() {
  const errors = [];
  OVERRIDES.forEach((r, i) => {
    const at = `OVERRIDES[${i}]`;
    if (!r.set || typeof r.set !== "object") return errors.push(`${at}: missing a "set" object`);
    if (r.set.receiptMode === undefined && r.set.furtherMode === undefined) {
      errors.push(`${at}.set: sets neither receiptMode nor furtherMode`);
    }
    const { receiptMode: rm, furtherMode: fm } = r.set;
    if (rm !== undefined && rm !== "" && !RECEIPT_MODES.includes(rm)) {
      errors.push(`${at}.set.receiptMode ${JSON.stringify(rm)} invalid. Valid: ${RECEIPT_MODES.join(", ")}`);
    }
    if (fm !== undefined && fm !== "" && !ACCOUNTS.includes(fm)) {
      errors.push(`${at}.set.furtherMode ${JSON.stringify(fm)} invalid. Valid: ${ACCOUNTS.join(", ")}`);
    }
  });
  return errors;
}

// Mirrors src/lib/periodLock.js: a row attributed to an account is locked when that account's
// period is closed; an unattributed row is locked only when every account is closed.
async function buildPeriodLockChecker(db, targetAccountOf) {
  const periods = await db
    .collection("accountperiods")
    .find({ isClosed: true })
    .toArray();

  // Opening seeds are zero-length periods and never lock anything.
  const real = periods.filter(
    (p) => new Date(p.periodStart).getTime() !== new Date(p.periodEnd).getTime(),
  );

  const covering = (account, date) =>
    real.find(
      (p) =>
        p.account === account &&
        new Date(p.periodStart) <= new Date(date) &&
        new Date(p.periodEnd) >= new Date(date),
    );

  return (doc) => {
    // Check the TARGET account too — writing an account onto a row inside that account's closed
    // period is exactly the "moved into a closed period" case periodLock guards against.
    const toCheck = new Set();
    if (!isBlank(doc.furtherMode)) toCheck.add(doc.furtherMode);
    const target = targetAccountOf(doc);
    if (!isBlank(target)) toCheck.add(target);

    if (toCheck.size > 0) {
      for (const a of toCheck) if (covering(a, doc.date)) return `${a} closed for this date`;
      return null;
    }
    if (ACCOUNTS.every((a) => covering(a, doc.date))) return "all accounts closed for this date";
    return null;
  };
}

function buildQuery() {
  const q = {};
  if (!ALL_DATES) q.date = { $gte: DATE_FROM, $lte: DATE_TO };
  if (FILTER_BRANCH) q.branch = { $in: FILTER_BRANCH };
  if (FILTER_CATEGORY) q.transactionCategory = { $in: FILTER_CATEGORY };
  if (FILTER_METHOD) q.method = { $in: FILTER_METHOD };
  return q;
}

function printHeader() {
  console.log(`\nMode        : ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  console.log(`Operation   : ${REMAP ? `REMAP ${REMAP}` : "route from src/constants/bankRouting.js"}`);
  if (!REMAP) {
    console.log(`Existing    : ${OVERWRITE ? "OVERWRITE — re-align rows that disagree with the map" : "fill blanks only"}`);
  }
  console.log(`Window      : ${ALL_DATES ? "ALL DATES" : `${DATE_FROM.toISOString()} .. ${DATE_TO.toISOString()}`}`);
  const scope = [
    FILTER_BRANCH && `branch=${FILTER_BRANCH.join("|")}`,
    FILTER_CATEGORY && `category=${FILTER_CATEGORY.join("|")}`,
    FILTER_METHOD && `method=${FILTER_METHOD.join("|")}`,
  ].filter(Boolean);
  console.log(`Scope       : ${scope.length ? scope.join("  ") : "all rows in window"}\n`);
}

// Groups planned changes so hundreds of rows read as a handful of lines.
function printPlan(planned, title) {
  if (!planned.length) return;
  const groups = new Map();
  for (const p of planned) {
    const k = `${p.doc.transactionCategory}|${p.doc.branch}|${p.doc.method}|${p.changes.map((c) => `${c.name}:${c.previousValue}>${c.newValue}`).join(",")}`;
    const g = groups.get(k) || { ...p, n: 0, amt: 0 };
    g.n += 1;
    g.amt += p.doc.amount || 0;
    groups.set(k, g);
  }
  console.log(`${title}:`);
  for (const g of [...groups.values()].sort((a, b) => b.n - a.n)) {
    const what = g.changes
      .map((c) => `${c.name === "furtherMode" ? "bank" : "receipt"}  ${c.previousValue} -> ${c.newValue}`)
      .join("   |   ");
    console.log(
      `  ${String(g.doc.transactionCategory || "—").padEnd(11)}` +
        `${String(g.doc.branch || "—").padEnd(11)}` +
        `${String(g.doc.method || "—").padEnd(12)}` +
        `${String(g.n).padStart(4)} rows  ${fmtMoney(g.amt).padStart(14)}   ${what}`,
    );
  }
  console.log("");
}

function printCombos(title, docs, note) {
  if (!docs.length) return;
  console.log(`${title} (${docs.length} row(s)):`);
  const byCombo = new Map();
  for (const d of docs) {
    const k = `${d.transactionCategory || "—"} / ${d.branch || "—"} / ${d.method || "—"}`;
    byCombo.set(k, (byCombo.get(k) || 0) + 1);
  }
  for (const [k, n] of [...byCombo.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}  ×${n}`);
  }
  if (note) console.log(`  ${note}`);
  console.log("");
}

// Any stored value that is no longer in the constants — orphaned by a rename. These drop out of
// every balance query (buildBalanceMatch uses `$in: ACCOUNTS`), so they go silently missing from
// the books rather than erroring. Always reported, whatever mode we are in.
async function reportOrphans(tx) {
  const [fm, rm] = await Promise.all([
    tx.aggregate([
      { $match: { furtherMode: { $nin: ["", null] } } },
      { $group: { _id: "$furtherMode", n: { $sum: 1 } } },
    ]).toArray(),
    tx.aggregate([
      { $match: { receiptMode: { $nin: ["", null] } } },
      { $group: { _id: "$receiptMode", n: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const bad = [
    ...fm.filter((r) => !ACCOUNTS.includes(r._id)).map((r) => ({ ...r, field: "furtherMode" })),
    ...rm.filter((r) => !RECEIPT_MODES.includes(r._id)).map((r) => ({ ...r, field: "receiptMode" })),
  ];
  if (!bad.length) return;

  console.log("ORPHANED VALUES — stored but no longer in the constants (whole collection):");
  for (const b of bad) {
    console.log(`  ${b.field.padEnd(12)} ${JSON.stringify(b._id).padEnd(20)} ×${b.n}`);
  }
  console.log(
    `  These are invisible to the balance sheet and ledger. Fix with:\n` +
      `    --all-dates --remap "${bad[0]._id}=<current name>"\n`,
  );
}

async function run() {
  const errors = validateOverrides();
  if (errors.length) {
    console.error("\nOVERRIDES table is not valid:\n");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  let remapFrom = null;
  let remapTo = null;
  if (REMAP) {
    const parts = REMAP.split("=");
    if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
      console.error(`\n--remap must look like "Old Name=New Name" (got ${JSON.stringify(REMAP)})\n`);
      process.exit(1);
    }
    remapFrom = parts[0].trim();
    remapTo = parts[1].trim();
    if (!ACCOUNTS.includes(remapTo) && !RECEIPT_MODES.includes(remapTo)) {
      console.error(
        `\n--remap target ${JSON.stringify(remapTo)} is not a known account or receipt mode.\n` +
          `  Accounts     : ${ACCOUNTS.join(", ")}\n` +
          `  Receipt modes: ${RECEIPT_MODES.join(", ")}\n`,
      );
      process.exit(1);
    }
  }

  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");

  printHeader();
  await reportOrphans(tx);

  const query = REMAP
    ? { ...buildQuery(), $or: [{ furtherMode: remapFrom }, { receiptMode: remapFrom }] }
    : buildQuery();

  const docs = await tx.find(query).toArray();
  console.log(`Matched ${docs.length} transaction(s).\n`);

  const targetAccountOf = REMAP
    ? (doc) => (doc.furtherMode === remapFrom ? remapTo : doc.furtherMode)
    : (doc) => resolveRouting(doc).furtherMode;
  const isLocked = await buildPeriodLockChecker(db, targetAccountOf);

  const planned = [];
  const drift = [];
  const unmapped = [];
  const noChange = [];
  const locked = [];

  for (const doc of docs) {
    const lockReason = isLocked(doc);
    if (lockReason) {
      locked.push({ doc, lockReason });
      continue;
    }

    const changes = [];

    if (REMAP) {
      for (const field of ["furtherMode", "receiptMode"]) {
        if (doc[field] === remapFrom) {
          changes.push({ name: field, previousValue: remapFrom, newValue: remapTo });
        }
      }
    } else {
      const routed = resolveRouting(doc);
      if (isBlank(routed.receiptMode) && isBlank(routed.furtherMode)) {
        unmapped.push(doc);
        continue;
      }
      for (const field of ["receiptMode", "furtherMode"]) {
        const value = routed[field];
        // Blank means the map deliberately says nothing — never write "" over a real value.
        if (isBlank(value)) continue;
        const current = doc[field];
        if (current === value) continue;
        if (!isBlank(current)) {
          // Stored value disagrees with the map. Only --overwrite may re-align it.
          drift.push({ doc, field, current, value });
          if (!OVERWRITE) continue;
        }
        changes.push({ name: field, previousValue: show(current), newValue: value });
      }
    }

    if (changes.length === 0) {
      noChange.push(doc);
      continue;
    }
    const set = Object.fromEntries(changes.map((c) => [c.name, c.newValue]));
    planned.push({ doc, set, changes });
  }

  printPlan(planned, REMAP ? "Planned renames" : "Planned changes");

  if (!OVERWRITE && drift.length) {
    const groups = new Map();
    for (const d of drift) {
      const k = `${d.doc.transactionCategory} / ${d.doc.branch} / ${d.doc.method} — ${d.field}: ${show(d.current)} -> ${d.value}`;
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    console.log(`DRIFT — stored value disagrees with the current map (${drift.length} row(s)):`);
    for (const [k, n] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}  ×${n}`);
    }
    console.log("  Left alone. Re-run with --overwrite (scope it with --branch/--method) to re-align.\n");
  }

  if (!REMAP) {
    printCombos(
      "Not in the CRM routing map — left untouched",
      unmapped,
      "Collab branches have no routing entries by design. Use OVERRIDES to fill.",
    );
  }

  if (noChange.length) console.log(`Already correct — skipped (${noChange.length} row(s)).\n`);

  if (locked.length) {
    console.log(`BLOCKED by a closed period (${locked.length} row(s)):`);
    const byReason = new Map();
    for (const s of locked) byReason.set(s.lockReason, (byReason.get(s.lockReason) || 0) + 1);
    for (const [reason, n] of byReason) console.log(`  ${reason}  ×${n}`);
    console.log("  Reopen the period to change these.\n");
  }

  console.log(
    `Summary: ${planned.length} to update, ${unmapped.length} unmapped, ` +
      `${noChange.length} unchanged, ${locked.length} locked` +
      `${!OVERWRITE && drift.length ? `, ${drift.length} drifted (needs --overwrite)` : ""}.\n`,
  );

  if (!APPLY) {
    console.log("Dry run — nothing written. Re-run with --apply to perform the update.\n");
    return mongoose.disconnect();
  }
  if (!planned.length) {
    console.log("Nothing to write.\n");
    return mongoose.disconnect();
  }

  const ops = planned.map(({ doc, set, changes }) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: set,
        $push: { editors: { ...ACTOR, date: new Date(), updatedFields: changes } },
      },
    },
  }));

  // BATCHED, one transaction per chunk — not one transaction for the whole run.
  //
  // A single session across every row was the original design, back when a run was a couple of
  // hundred rows. It does not scale: a 7,580-row run (each update also pushing an editors[]
  // entry) blows past the server's transaction lifetime and aborts, and because it is
  // all-or-nothing the whole thing rolls back — the operation silently achieves nothing no
  // matter how many times you run it.
  //
  // Each chunk is still atomic, so no individual row is half-written. What is given up is
  // atomicity ACROSS chunks, and for this script that is the right trade: every operation here
  // is idempotent (fill-blanks skips what is already filled; --overwrite and --remap both
  // converge on the same target value), so a run that dies midway can simply be re-run and it
  // continues from where it stopped. Progress is printed for exactly that reason.
  const CHUNK = 500;
  const totalChunks = Math.ceil(ops.length / CHUNK);
  let modified = 0;

  for (let i = 0; i < ops.length; i += CHUNK) {
    const slice = ops.slice(i, i + CHUNK);
    const session = await mongoose.startSession();
    let chunkModified = 0;
    try {
      await session.withTransaction(async () => {
        // Reset inside the callback: withTransaction re-runs it on a transient error, and a
        // running total accumulated here would double-count the retried attempt.
        chunkModified = 0;
        const res = await tx.bulkWrite(slice, { session });
        chunkModified = res.modifiedCount;
      });
      modified += chunkModified;
    } catch (err) {
      console.error(
        `\n\nStopped at batch ${Math.floor(i / CHUNK) + 1} of ${totalChunks}.\n` +
          `  ${err.message}\n\n` +
          `  ${modified} row(s) WERE committed and are safe. Re-run the same command to\n` +
          `  continue with the rest — the operation is idempotent.\n`,
      );
      await session.endSession();
      await mongoose.disconnect();
      process.exit(1);
    } finally {
      await session.endSession();
    }

    if (totalChunks > 1) {
      process.stdout.write(`\r  committed ${modified} / ${ops.length} row(s)…`);
    }
  }
  if (totalChunks > 1) process.stdout.write("\r" + " ".repeat(46) + "\r");

  console.log(`Updated ${modified} transaction(s).\n`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
