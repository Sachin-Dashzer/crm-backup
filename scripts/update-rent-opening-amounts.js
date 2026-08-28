
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

const REVISIONS = [
  { expenseSubType: "Rent-Backend upper ground floor", newAmount: 198307.1 },
  { expenseSubType: "Rent-Backend Basement", newAmount: 34400 },
];

const IDENTITY = { name: "Bulk Revision", email: "import@system" };

const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false }), "payables");

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  for (const rev of REVISIONS) {
    const doc = await Payable.findOne({
      expenseCategory: "Rent",
      expenseSubType: rev.expenseSubType,
      "period.month": 3,
      "period.year": 2026,
    });

    if (!doc) {
      console.log(`⚠ ${rev.expenseSubType}: no March 2026 opening payable found — skipped (nothing to revise).`);
      continue;
    }

    if (Math.abs((doc.totalAmount || 0) - rev.newAmount) < 0.005) {
      console.log(`✓ ${rev.expenseSubType}: already ${rev.newAmount} — no change needed.`);
      continue;
    }

    console.log(`${rev.expenseSubType}: ${doc.totalAmount} -> ${rev.newAmount}  (id ${doc._id})`);
    if (!APPLY) continue;

    const previousValue = String(doc.totalAmount);
    doc.totalAmount = rev.newAmount;
    doc.log = doc.log || [];
    doc.log.push({
      action: "Amount Revised",
      previousValue,
      newValue: String(rev.newAmount),
      note: "Opening balance corrected to supplied figure — scripts/update-rent-opening-amounts.js",
      performedBy: IDENTITY,
      performedAt: new Date(),
    });
    await doc.save();
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
