import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { normalizePhone } from "../src/lib/phone.js";

// Repo root, not process.cwd() — this script lives in scripts/, and .env/.env.local
// live one level up regardless of where it is invoked from.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COLLISIONS_CSV = path.resolve(REPO_ROOT, "phone-collisions.csv");

const BATCH = 500;
const DRY_RUN = process.argv.slice(2).includes("--dry-run");

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

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCollisionsCsv(groups) {
  const rows = [
    ["normalizedPhone", "_id", "name", "branch", "rawPhone", "createdAt"].join(","),
  ];
  for (const [normalized, docs] of groups) {
    for (const d of docs) {
      rows.push(
        [
          normalized,
          d._id,
          d.name,
          d.branch,
          d.phone,
          d.createdAt ? new Date(d.createdAt).toISOString() : "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }
  fs.writeFileSync(COLLISIONS_CSV, rows.join("\n") + "\n", "utf8");
}

async function run() {
  await mongoose.connect(readMongoUri());
  const patients = mongoose.connection.db.collection("patients");

  console.log(`\nMode      : ${DRY_RUN ? "DRY RUN (no writes)" : "APPLY (will write)"}`);
  console.log(`Batch size: ${BATCH}\n`);

  // normalized -> [minimal record]. Only the fields the collision report needs are
  // held; the patient documents themselves are streamed and never accumulated.
  const seen = new Map();

  let scanned = 0;
  let updated = 0;
  let alreadyCorrect = 0;
  let noPhone = 0;
  let ops = [];

  const flush = async () => {
    if (!ops.length) return;
    if (!DRY_RUN) {
      const res = await patients.bulkWrite(ops, { ordered: false });
      updated += res.modifiedCount;
    } else {
      updated += ops.length;
    }
    ops = [];
    process.stdout.write(`\r  scanned ${scanned}, ${DRY_RUN ? "would update" : "updated"} ${updated}…`);
  };

  const cursor = patients.find(
    {},
    {
      projection: {
        "personal.phone": 1,
        "personal.phoneNormalized": 1,
        "personal.name": 1,
        "personal.branch": 1,
        createdAt: 1,
      },
    },
  );

  for await (const doc of cursor) {
    scanned++;

    const raw = doc.personal?.phone;
    const normalized = normalizePhone(raw);

    if (!normalized) {
      noPhone++;
      continue;
    }

    const record = {
      _id: doc._id,
      name: doc.personal?.name || "",
      branch: doc.personal?.branch || "",
      phone: raw || "",
      createdAt: doc.createdAt,
    };
    const bucket = seen.get(normalized);
    if (bucket) bucket.push(record);
    else seen.set(normalized, [record]);

    if (doc.personal?.phoneNormalized === normalized) {
      alreadyCorrect++;
      continue;
    }

    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { "personal.phoneNormalized": normalized } },
      },
    });

    if (ops.length >= BATCH) await flush();
  }

  await flush();
  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const collisions = [...seen.entries()].filter(([, docs]) => docs.length > 1);
  const collidingPatients = collisions.reduce((n, [, docs]) => n + docs.length, 0);

  if (collisions.length) {
    writeCollisionsCsv(collisions);
    console.log(
      `COLLISIONS — ${collisions.length} normalized number(s) shared by ${collidingPatients} patient(s).`,
    );
    console.log(`  Written to ${COLLISIONS_CSV}`);
    console.log(`  Nothing was merged or deleted — a human decides what each group means.\n`);
  } else if (fs.existsSync(COLLISIONS_CSV)) {
    // A stale file from an earlier run would read as a live problem.
    fs.rmSync(COLLISIONS_CSV);
  }

  console.log("Summary");
  console.log(`  Total scanned  : ${scanned}`);
  console.log(`  ${DRY_RUN ? "Would update   " : "Updated        "}: ${updated}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  No usable phone: ${noPhone}`);
  console.log(`  Collisions     : ${collisions.length}`);

  if (DRY_RUN) {
    console.log(`\nDry run — nothing written. Re-run without --dry-run to apply.\n`);
  } else {
    console.log("");
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
