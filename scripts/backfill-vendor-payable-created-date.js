
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

const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false }), "payables");

const isOpeningBill = (remarks) => /opening/i.test(remarks || "");
const oneDayBefore = (date) => new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000);

async function run() {
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  await mongoose.connect(readMongoUri(), { serverSelectionTimeoutMS: 5000 });

  const missing = await Payable.find({
    "payee.kind": "VENDOR",
    createdAt: { $exists: false },
  }).lean();

  console.log(`\nFound ${missing.length} VENDOR-kind payable(s) missing createdAt.`);

  const noDueDate = missing.filter((p) => !p.dueDate);
  if (noDueDate.length) {
    console.log(`⚠ ${noDueDate.length} of these have no dueDate either — SKIPPED (nothing safe to derive from):`);
    for (const p of noDueDate) console.log(`   ${p._id}  ${p.payee?.label || "—"}  ${p.remarks || ""}`);
  }

  const changes = missing
    .filter((p) => p.dueDate)
    .map((doc) => ({
      doc,
      target: isOpeningBill(doc.remarks) ? oneDayBefore(doc.dueDate) : new Date(doc.dueDate),
      isOpening: isOpeningBill(doc.remarks),
    }));

  const openingCount = changes.filter((c) => c.isOpening).length;
  console.log(`${changes.length} document(s) to update (${openingCount} opening-labeled, ${changes.length - openingCount} regular bills).`);

  console.log("\nSample (up to 10):");
  for (const { doc, target, isOpening } of changes.slice(0, 10)) {
    console.log(
      `   ${doc._id}  ${doc.payee?.label || "—"}  ₹${doc.totalAmount}  ${isOpening ? "[OPENING] " : ""}dueDate=${new Date(doc.dueDate).toISOString().slice(0, 10)} -> createdAt=${target.toISOString().slice(0, 10)}`,
    );
  }
  if (changes.length > 10) console.log(`   ... and ${changes.length - 10} more`);

  const openingTotal = changes.filter((c) => c.isOpening).reduce((s, c) => s + (c.doc.totalAmount || 0), 0);
  console.log(`\nTotal opening-labeled amount: ₹${openingTotal.toLocaleString("en-IN")}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nApplying...");
  for (const { doc, target } of changes) {
    await Payable.updateOne({ _id: doc._id }, { $set: { createdAt: target } });
  }
  console.log(`Updated ${changes.length} document(s).`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
