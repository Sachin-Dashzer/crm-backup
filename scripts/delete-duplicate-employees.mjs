
import mongoose from "mongoose";
import fs from "fs";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const TO_DELETE = [
  { id: "6932822400c9ea07011edec6", label: "Sheetal (duplicate of 691e9d24164751f6ae6a30e9)" },
  { id: "6944ef3371989d90c05707d9", label: "MOHIT SHAH (duplicate of 691e9d24164751f6ae6a312f)" },
  { id: "6944f17e71989d90c057081f", label: "Dr, Ashalata Roy (duplicate of 693fe75982eaa1deb8bda397)" },
];

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will delete from the database" : "MODE: DRY RUN  <- nothing will be deleted");
  console.log("=".repeat(90) + "\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));

  const toDeleteDocs = [];
  const blocked = [];

  for (const { id, label } of TO_DELETE) {
    const _id = new mongoose.Types.ObjectId(id);
    const emp = await Employee.findById(_id).lean();
    if (!emp) {
      console.log(`${label}  (${id})  -- already gone, nothing to do`);
      continue;
    }

    const payableCount = await Payable.countDocuments({ "payee.kind": "EMPLOYEE", "payee.refId": _id });
    const txnCount = await Transactions.countDocuments({ "expenseGiver.refId": _id });

    if (payableCount > 0 || txnCount > 0) {
      blocked.push({ id, label, payableCount, txnCount });
      console.log(`${label}  (${id})  -- BLOCKED: now has ${payableCount} payable(s) and ${txnCount} transaction(s) linked, re-check before deleting`);
      continue;
    }

    console.log(`${label}  (${id})  -- confirmed empty, safe to delete. name="${emp.name}" phone=${emp.phone}`);
    toDeleteDocs.push(emp);
  }

  if (!toDeleteDocs.length) {
    console.log("\nNothing eligible to delete.");
    await mongoose.disconnect();
    return;
  }

  const backupPath = `delete-duplicate-employees-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(toDeleteDocs, null, 2));
  console.log(`\nFull backup of the document(s) to delete written to ${backupPath} BEFORE any deletion.`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply once this looks right.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nDeleting...");
  for (const emp of toDeleteDocs) {
    await Employee.findByIdAndDelete(emp._id);
    console.log(`  ${emp._id}  "${emp.name}"  DELETED`);
  }

  console.log(`\nDeleted ${toDeleteDocs.length} duplicate employee record(s).`);
  if (blocked.length) console.log(`${blocked.length} were blocked — see above, re-run diagnose-duplicate-employees.mjs to see why.`);
  console.log(`\nBackup: ${backupPath} — keep it, it's your undo if needed.`);
  console.log("\nNext: re-run scripts/employee-salary-payables-import.mjs — all 3 pairs should now");
  console.log("resolve cleanly (single match each) instead of ambiguous.");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("FATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
