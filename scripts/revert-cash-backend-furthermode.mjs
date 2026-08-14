// Undo a bad correction: backfill-bank-routing.mjs's --overwrite run today treated every
// EXPENSE/cash row whose furtherMode disagreed with getExpenseFurtherModeDefault("cash")
// ("Cash Book") as drift and rewrote it — but that map is only a fallback default for BLANK
// entries (see its comment in src/constants/bankRouting.js: "Methods absent here have no
// obvious single account — the field stays blank"), not a rule that a deliberately-entered
// "Cash ( backend )" is wrong. "Cash ( backend )" is itself a real, distinct account in
// ACCOUNTS — the backfill run stamped over 803 rows that had it correctly.
//
// This script reverts exactly those 803 rows, identified from the audit trail written by that
// run (scripts/transaction-changes-2026-08-14.json, itself sourced from each transaction's own
// editors[] — the same data, just already extracted). It does NOT touch any row that was
// blank-filled to "Cash Book" (that default is legitimate), only rows where the prior value was
// specifically overwritten away from "Cash ( backend )".

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = path.resolve(REPO_ROOT, "scripts", "transaction-changes-2026-08-14.json");

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

const ACTOR = { name: "Revert Script", email: "system@revert-cash-backend", branch: "All" };

async function run() {
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  const bad = report.filter(
    (e) =>
      e.actor?.email === "system@backfill" &&
      e.fields.some(
        (f) => f.name === "furtherMode" && f.previousValue === "Cash ( backend )" && f.newValue === "Cash Book",
      ),
  );
  const ids = [...new Set(bad.map((e) => e.transactionId))];

  console.log(`\nMode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}`);
  console.log(`Source report: ${REPORT_PATH}`);
  console.log(`Rows to revert (furtherMode: Cash Book -> Cash ( backend )): ${ids.length}\n`);

  if (!ids.length) {
    console.log("Nothing to revert.\n");
    return;
  }

  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");

  // Sanity check: only revert docs that still carry the value the bad run set. If something
  // else has touched furtherMode on one of these since, skip it rather than clobber a newer edit.
  const current = await tx
    .find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ furtherMode: 1 })
    .toArray();
  const stillWrong = current.filter((d) => d.furtherMode === "Cash Book");
  const alreadyChanged = current.length - stillWrong.length;
  if (alreadyChanged > 0) {
    console.log(`Note: ${alreadyChanged} row(s) no longer have furtherMode "Cash Book" (edited again since) — left untouched.\n`);
  }

  if (!APPLY) {
    console.log('Dry run — nothing written. Re-run with --apply to revert these rows to "Cash ( backend )".\n');
    await mongoose.disconnect();
    return;
  }

  const ops = stillWrong.map((d) => ({
    updateOne: {
      filter: { _id: d._id },
      update: {
        $set: { furtherMode: "Cash ( backend )" },
        $push: {
          editors: {
            ...ACTOR,
            date: new Date(),
            updatedFields: [
              {
                name: "furtherMode",
                previousValue: "Cash Book",
                newValue: "Cash ( backend )",
                note: "Reverting backfill-bank-routing.mjs --overwrite run of 2026-08-14, which incorrectly treated a deliberately-entered Cash ( backend ) as drift.",
              },
            ],
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
      console.error(`\nStopped after ${modified} row(s). ${err.message}\nRe-run the same command to continue.\n`);
      await session.endSession();
      await mongoose.disconnect();
      process.exit(1);
    } finally {
      await session.endSession();
    }
    process.stdout.write(`\r  committed ${modified} / ${ops.length} row(s)…`);
  }
  console.log(`\nReverted ${modified} transaction(s).\n`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
