
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

const APPLY = process.argv.slice(2).includes("--apply");

const loose = () => new mongoose.Schema({}, { strict: false });
const Payable = mongoose.models.Payable || mongoose.model("Payable", loose(), "payables");
const Receivable = mongoose.models.Receivable || mongoose.model("Receivable", loose(), "receivables");

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  const targets = [
    { label: "Borrowing payables", Model: Payable, match: { expenseCategory: "Borrowings", excludeFromPnl: { $ne: true } }, name: (d) => d.payee?.label },
    { label: "Advance receivables", Model: Receivable, match: { revenueCategory: "Advances", excludeFromPnl: { $ne: true } }, name: (d) => d.payer?.label },
  ];

  let grandTotal = 0;

  for (const { label, Model, match, name } of targets) {
    const docs = await Model.find(match).lean();
    console.log(`\n${label}: ${docs.length} document(s) missing excludeFromPnl.`);
    grandTotal += docs.length;
    if (docs.length === 0) continue;

    const sum = docs.reduce((s, d) => s + (d.totalAmount || 0), 0);
    console.log(`   Combined principal wrongly reaching P&L: ${sum.toLocaleString("en-IN")}`);
    for (const d of docs.slice(0, 15)) {
      console.log(`   ${d._id}  ${name(d) || "—"}  ${(d.totalAmount || 0).toLocaleString("en-IN")}  raised ${d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : "(unset)"}`);
    }
    if (docs.length > 15) console.log(`   ... and ${docs.length - 15} more`);

    if (APPLY) {
      const res = await Model.updateMany(match, { $set: { excludeFromPnl: true } });
      console.log(`   Updated ${res.modifiedCount} document(s).`);
    }
  }

  if (grandTotal === 0) {
    console.log("\nNothing to do — every financing obligation already carries the flag.");
  } else if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
