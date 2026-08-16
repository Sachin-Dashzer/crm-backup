// §2.5 — the one dangling row, cleared rather than flagged or deleted.
//
// Measured state: exactly one transaction carries a payableId pointing at a payable that no
// longer exists. Three options were considered and two are wrong:
//
//   - isSettlement:true  -> WRONG. That flag means "P&L recognised elsewhere". The payable is
//                           gone, so it was recognised nowhere. Expense total would drop
//                           Rs 10,000 and real spend would vanish from the books.
//   - delete the row     -> WORST. The money was genuinely spent; the account balance would
//                           then be Rs 10,000 wrong.
//   - clear the pointer  -> CORRECT. It is an ordinary expense that has lost its link.
//                           Expense total stays Rs 7,45,64,483, which is the true figure.
//
// Sets payableId=null, isSettlement=false, and appends an editors[] entry recording why.
// Idempotent: re-running finds nothing once applied.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

function readMongoUri() {
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(REPO_ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  throw new Error("MONGODB_URI not found");
}

const inr = (n) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const ACTOR = { name: "Link Repair Script", email: "system@clear-dangling-link", branch: "All" };

async function run() {
  await mongoose.connect(readMongoUri());
  const db = mongoose.connection.db;
  const tx = db.collection("transactions");
  const payables = db.collection("payables");

  console.log(`\nMode: ${APPLY ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  const linked = await tx
    .find({ payableId: { $ne: null } }, { projection: { payableId: 1, amount: 1, costType: 1, date: 1, expense: 1, branch: 1 } })
    .toArray();
  const liveIds = new Set(
    (await payables.find({ _id: { $in: linked.map((t) => t.payableId) } }, { projection: { _id: 1 } }).toArray())
      .map((d) => String(d._id)),
  );
  const dangling = linked.filter((t) => !liveIds.has(String(t.payableId)));

  console.log(`Transactions with payableId : ${linked.length}`);
  console.log(`Dangling (target missing)   : ${dangling.length}`);
  for (const t of dangling) {
    console.log(`  ${t._id}  ${inr(t.amount)}  ${t.costType}  ${t.expense || ""}  ${t.branch || ""}  -> missing payable ${t.payableId}`);
  }

  const expenseTotal = async () =>
    (await tx.aggregate([
      { $match: { costType: "Expenses", method: { $nin: ["paid_to_external", "paid_by_other"] }, approvalStatus: { $nin: ["PENDING", "REJECTED"] }, isSettlement: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).toArray())[0]?.total || 0;

  console.log(`\nExpense total BEFORE: ${inr(await expenseTotal())}`);

  if (!dangling.length) {
    console.log("\nNothing to repair.\n");
    return mongoose.disconnect();
  }
  if (!APPLY) {
    console.log("\nDry run — nothing written. Re-run with --apply.\n");
    return mongoose.disconnect();
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const t of dangling) {
        await tx.updateOne(
          { _id: t._id },
          {
            $set: { payableId: null, isSettlement: false },
            $push: {
              editors: {
                ...ACTOR,
                date: new Date(),
                updatedFields: [
                  {
                    name: "payableId",
                    previousValue: String(t.payableId),
                    newValue: "null",
                    note: "Linked payable no longer exists. Cleared the dangling pointer; this stays an ordinary expense (isSettlement=false) so the spend remains on the books.",
                  },
                ],
              },
            },
          },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  console.log(`Repaired ${dangling.length} row(s).`);
  console.log(`Expense total AFTER : ${inr(await expenseTotal())}   (must be unchanged)\n`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("\nFailed.\n", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
