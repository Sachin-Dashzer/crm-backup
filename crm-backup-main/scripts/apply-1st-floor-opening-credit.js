

import mongoose from "mongoose";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const CREDIT_TOTAL = 130760;
const IDENTITY = { name: "Bulk Revision", email: "import@system" };

const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false }), "payables");

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  const june = await Payable.findOne({ expenseCategory: "Rent", expenseSubType: "Rent-Backend 1st Floor", "period.month": 6, "period.year": 2026 });
  const july = await Payable.findOne({ expenseCategory: "Rent", expenseSubType: "Rent-Backend 1st Floor", "period.month": 7, "period.year": 2026 });

  if (!june || !july) {
    console.error("Expected both the June and July 2026 Rent-Backend 1st Floor payables to exist — aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const revisions = [
    { doc: june, target: 17192, label: "June 2026" },
    { doc: july, target: 0, label: "July 2026" },
  ];

  let totalApplied = 0;
  for (const { doc, target, label } of revisions) {
    const reduction = (doc.totalAmount || 0) - target;
    totalApplied += reduction;
    console.log(`${label}: totalAmount ${doc.totalAmount} -> ${target}  (credit applied: ${reduction})`);
    if (!APPLY) continue;

    const previousValue = String(doc.totalAmount);
    doc.totalAmount = target;
    doc.log = doc.log || [];
    doc.log.push({
      action: "Amount Revised",
      previousValue,
      newValue: String(target),
      note: `Reduced by ${reduction} to apply the March 2026 opening overpayment credit for Rent-Backend 1st Floor (₹${CREDIT_TOTAL} total credit; already-paid April/May left untouched). scripts/apply-1st-floor-opening-credit.js`,
      performedBy: IDENTITY,
      performedAt: new Date(),
    });
    await doc.save();
  }

  const remainder = Math.round((CREDIT_TOTAL - totalApplied) * 100) / 100;
  console.log(`\nCredit applied: ${totalApplied} of ${CREDIT_TOTAL}. Remainder to carry forward to August: ${remainder}`);

  if (APPLY && remainder > 0) {
    july.log.push({
      action: "Note Added",
      note: `₹${remainder} of the Rent-Backend 1st Floor opening credit remains unapplied after clearing June and July — apply it against August 2026's rent once that payable is created.`,
      performedBy: IDENTITY,
      performedAt: new Date(),
    });
    await july.save();
    console.log("Carry-forward note added to the July payable's log.");
  }

  if (!APPLY) console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
