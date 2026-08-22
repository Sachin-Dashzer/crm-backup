// scripts/diagnose-duplicate-employees.mjs
//
// READ-ONLY — makes no changes. Pulls up every piece of activity tied to each of the 6
// employee _ids in the 3 duplicate-name pairs that scripts/employee-salary-payables-import.mjs
// keeps reporting as "ambiguous", so the decision of which one to KEEP isn't a guess — it's
// based on which one actually has real history (payables, transactions, join date).
//
// Usage:
//   node scripts/diagnose-duplicate-employees.mjs

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
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

const PAIRS = [
  {
    label: "Sheetal / Sheetal Bhatiya (phone 7988415814)",
    ids: ["691e9d24164751f6ae6a30e9", "6932822400c9ea07011edec6"],
  },
  {
    label: "MOHIT SHAH (phone 9958741089)",
    ids: ["691e9d24164751f6ae6a312f", "6944ef3371989d90c05707d9"],
  },
  {
    label: "Dr, Ashalata Roy (phone 9971125678)",
    ids: ["693fe75982eaa1deb8bda397", "6944f17e71989d90c057081f"],
  },
];

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));

  for (const pair of PAIRS) {
    console.log("=".repeat(90));
    console.log(pair.label);
    console.log("=".repeat(90));

    for (const idStr of pair.ids) {
      const id = new mongoose.Types.ObjectId(idStr);
      const emp = await Employee.findById(id).lean();
      if (!emp) {
        console.log(`\n  ${idStr}  -- NOT FOUND (may have already been removed)`);
        continue;
      }

      const payableCount = await Payable.countDocuments({ "payee.kind": "EMPLOYEE", "payee.refId": id });
      const payables = await Payable.find({ "payee.kind": "EMPLOYEE", "payee.refId": id })
        .select("purpose period totalAmount isCancelled")
        .sort({ "period.year": 1, "period.month": 1 })
        .lean();
      const txnCount = await Transactions.countDocuments({ "expenseGiver.refId": id });
      const txnAmountAgg = await Transactions.aggregate([
        { $match: { "expenseGiver.refId": id } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      console.log(`\n  _id: ${idStr}`);
      console.log(`  name: "${emp.name}"   phone: ${emp.phone}   role: ${emp.role}   isactive: ${emp.isactive}`);
      console.log(`  createdAt (employee doc): ${emp._id.getTimestamp().toISOString()}`);
      console.log(`  salaryStructure: ${JSON.stringify(emp.salaryStructure || {})}`);
      console.log(`  Payables linked (payee.refId): ${payableCount}`);
      payables.forEach((p) =>
        console.log(`      ${p.purpose}  ${p.period?.month}/${p.period?.year}  Rs ${p.totalAmount}${p.isCancelled ? "  [CANCELLED]" : ""}`),
      );
      console.log(`  Transactions directly linked (expenseGiver.refId): ${txnCount}${txnAmountAgg[0] ? `  (total Rs ${txnAmountAgg[0].total})` : ""}`);
    }
    console.log("");
  }

  console.log("=".repeat(90));
  console.log("HOW TO READ THIS:");
  console.log("The _id with more Payables/Transactions and an EARLIER createdAt timestamp is almost");
  console.log("certainly the real, original employee record. The other is very likely a stray");
  console.log("duplicate (e.g. created by accident during an earlier import). Once you've decided");
  console.log("which _id to KEEP for each pair, tell me and I'll write the exact fix (rename the");
  console.log("duplicate so it's distinguishable again, or delete it if it has zero real activity).");

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("FATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
