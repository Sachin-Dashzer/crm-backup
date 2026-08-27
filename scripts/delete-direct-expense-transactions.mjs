// scripts/delete-direct-expense-transactions.mjs
//
// Deletes EXPENSE transactions in the DIRECT-PAYMENT expense categories, dated 2026-08-13
// onward (through whenever the script is run — no upper bound).
//
// WHAT "DIRECT EXPENSE" MEANS HERE — this script uses the app's own definition, not a guess:
// src/constants/expenseCategories.js exports DIRECT_PAYMENT_CATEGORIES, documented there as
// "Everything else in EXPENSE_CATEGORY_TREE — paid in full when logged, no payable". Those
// eleven categories are duplicated in the list below (a script can't import the @/-aliased
// module outside the Next.js build):
//
//   Marketing · Welfare Expenses · Office Exp. · Travelling Expenses · Hotel Charges ·
//   Telephone Expenses · Bank Charges · Forex Conversion and Fluctuation Charges ·
//   Asset Based Payment · Drawings · Patient Related Expenses
//
// Everything else is deliberately OUT of scope: Salary, Rent, Electricity Bill, Collab Clinic
// Payment, Medicine Procurement, Medical Consumables, Professional Expenses, Taxes, Incentive,
// Commision and the rest are payable-backed categories, not direct payments. If you meant a
// different set, pass --categories="A,B" to override the list explicitly rather than editing
// this file.
//
// SAFETY — mirrors src/app/api/transactions/expense/delete/route.js, because this script
// bypasses the authenticated API and must not skip what that route enforces:
//   - Only transactionCategory "EXPENSE" is ever touched.
//   - PERIOD LOCK: a transaction whose (furtherMode, date) falls in a closed AccountPeriod is
//     refused, exactly as periodLockResponse() refuses it in the route.
//   - CASCADE: refused if this transaction CREATED a Payable/Receivable that something else is
//     now settling (checkCascadeOnDelete Direction A) — deleting it would strand those.
//   - payableId set  -> SKIPPED. Such a row is a payment against a payable; it shouldn't occur
//     in a direct-payment category at all, and deleting it would silently reopen that payable.
//   - reversalOf set, or isReversed true -> SKIPPED. Deleting half of a reversal pair leaves the
//     other half pointing at nothing.
//   - Vendor back-reference cleanup and a DeleteLog entry per deletion, as the route does.
//   - A FULL BACKUP of every matched document is written BEFORE any delete. Plain Transactions
//     have no soft-delete and DeleteLog records only that a deletion happened, not the document
//     — this backup file is the only way to restore one.
//
// Usage:
//   node scripts/delete-direct-expense-transactions.mjs                      # dry run
//   node scripts/delete-direct-expense-transactions.mjs --apply              # delete
//   node scripts/delete-direct-expense-transactions.mjs --from=2026-08-13    # override start date
//   node scripts/delete-direct-expense-transactions.mjs --to=2026-08-31      # add an end date
//   node scripts/delete-direct-expense-transactions.mjs --branch=Delhi       # one branch only
//   node scripts/delete-direct-expense-transactions.mjs --categories="Marketing,Drawings"

import mongoose from "mongoose";
import fs from "fs";

// --- env -----------------------------------------------------------------
for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* already loaded / unsupported — falls through to the MONGODB_URI check below */
    }
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

// Mirrors DIRECT_PAYMENT_CATEGORIES in src/constants/expenseCategories.js.
const DIRECT_PAYMENT_CATEGORIES = [
  "Marketing",
  "Welfare Expenses",
  "Office Exp.",
  "Travelling Expenses",
  "Hotel Charges",
  "Telephone Expenses",
  "Bank Charges",
  "Forex Conversion and Fluctuation Charges",
  "Asset Based Payment",
  "Drawings",
  "Patient Related Expenses",
];

// Mirrors ACCOUNTS in src/constants/bankRouting.js — needed by the period-lock check below.
const ACCOUNTS = [
  "Cash Book", "HDFC Skin", "HDFC Medihub", "ICICI Medihub", "Mumbai Receipts",
  "Cash ( backend )", "Paytm ( Delhi T44P )", "Paytm ( Noida CK5Y )",
  "Bajaj Loan", "Fibe Loan", "Pine Lab",
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const FROM = arg("from") || "2026-08-13";
const TO = arg("to") || null;
const BRANCH = arg("branch") || null;
const CATEGORIES = arg("categories")
  ? arg("categories").split(",").map((s) => s.trim()).filter(Boolean)
  : DIRECT_PAYMENT_CATEGORIES;

const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const iso = (d) => new Date(d).toISOString().slice(0, 10);

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}
if (isNaN(new Date(FROM).getTime())) {
  console.error(`Bad --from date: "${FROM}" (expected YYYY-MM-DD)`);
  process.exit(1);
}

async function run() {
  const fromDate = new Date(`${FROM}T00:00:00.000Z`);
  const toDate = TO ? new Date(`${TO}T23:59:59.999Z`) : new Date();

  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will delete from the database" : "MODE: DRY RUN  <- nothing will be deleted");
  console.log(`Date range   : ${iso(fromDate)}  ->  ${TO ? iso(toDate) : "now (" + iso(toDate) + ")"}`);
  console.log(`Branch       : ${BRANCH || "all"}`);
  console.log(`Categories   : ${CATEGORIES.length === DIRECT_PAYMENT_CATEGORIES.length ? "all direct-payment categories" : CATEGORIES.join(", ")}`);
  console.log("=".repeat(90) + "\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", new mongoose.Schema({}, { strict: false, collection: "vendors" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Receivable = mongoose.models.Receivable || mongoose.model("Receivable", new mongoose.Schema({}, { strict: false, collection: "receivables" }));
  const AccountPeriod = mongoose.models.AccountPeriod || mongoose.model("AccountPeriod", new mongoose.Schema({}, { strict: false, collection: "accountperiods" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));
  const DeleteLog = mongoose.models.DeleteLog || mongoose.model("DeleteLog", new mongoose.Schema({}, { strict: false, collection: "deletelogs" }));

  // --- period lock, reimplemented (src/lib/periodLock.js imports @/-aliased modules that don't
  // resolve outside the Next.js build, so the logic is mirrored rather than imported) ---------
  const isOpeningSeed = (p) => new Date(p.periodStart).getTime() === new Date(p.periodEnd).getTime();
  async function closedPeriodsCovering(account, date) {
    const rows = await AccountPeriod.find({
      account, branch: null, isClosed: true,
      periodStart: { $lte: new Date(date) }, periodEnd: { $gte: new Date(date) },
    }).lean();
    return rows.filter((p) => !isOpeningSeed(p));
  }
  async function periodLockReason(account, date) {
    if (!date) return null;
    if (account && ACCOUNTS.includes(account)) {
      const [closed] = await closedPeriodsCovering(account, date);
      return closed ? `${account} is closed for that period` : null;
    }
    const perAccount = await Promise.all(ACCOUNTS.map(async (a) => (await closedPeriodsCovering(a, date))[0]));
    return perAccount.every(Boolean) ? "the books are closed for that period across all accounts" : null;
  }

  // --- cascade Direction A, mirroring src/lib/cascadeIntegrity.js ----------------------------
  async function cascadeBlockReason(tx) {
    const links = [];
    const ep = tx.externalParty || {};
    const cr = tx.collabRef || {};
    if (ep.linkedReceivableId) links.push({ kind: "receivable", id: ep.linkedReceivableId });
    if (ep.linkedPayableId) links.push({ kind: "payable", id: ep.linkedPayableId });
    if (cr.receivableId) links.push({ kind: "receivable", id: cr.receivableId });
    if (cr.payableId) links.push({ kind: "payable", id: cr.payableId });
    for (const link of links) {
      const Model = link.kind === "payable" ? Payable : Receivable;
      const doc = await Model.findById(link.id).lean();
      if (!doc) continue;
      const field = link.kind === "payable" ? "payableId" : "receivableId";
      const settling = await Transactions.countDocuments({ [field]: doc._id, isSettlement: true, _id: { $ne: tx._id } });
      if (settling > 0) return `would strand ${settling} settlement(s) against ${link.kind} ${doc._id}`;
    }
    return null;
  }

  // --- find candidates ----------------------------------------------------------------------
  const query = {
    transactionCategory: "EXPENSE",
    expense: { $in: CATEGORIES },
    date: { $gte: fromDate, $lte: toDate },
  };
  if (BRANCH) query.branch = BRANCH;

  const all = await Transactions.find(query).sort({ date: 1 }).lean();
  console.log(`Found ${all.length} EXPENSE transaction(s) in scope.\n`);

  if (!all.length) {
    console.log("Nothing matched — check --from / --categories / --branch.");
    await mongoose.disconnect();
    return;
  }

  const deletable = [];
  const skipped = [];

  for (const tx of all) {
    if (tx.payableId) {
      skipped.push({ tx, reason: "linked to a payable (payableId set) — deleting would reopen it" });
      continue;
    }
    if (tx.reversalOf) {
      skipped.push({ tx, reason: "is itself a reversal (reversalOf set)" });
      continue;
    }
    if (tx.isReversed) {
      skipped.push({ tx, reason: "already reversed (isReversed true)" });
      continue;
    }
    const lock = await periodLockReason(tx.furtherMode, tx.date);
    if (lock) {
      skipped.push({ tx, reason: `period locked — ${lock}` });
      continue;
    }
    const cascade = await cascadeBlockReason(tx);
    if (cascade) {
      skipped.push({ tx, reason: `cascade — ${cascade}` });
      continue;
    }
    deletable.push(tx);
  }

  // --- report -------------------------------------------------------------------------------
  const byCategory = {};
  deletable.forEach((t) => {
    byCategory[t.expense] = byCategory[t.expense] || { count: 0, amount: 0 };
    byCategory[t.expense].count += 1;
    byCategory[t.expense].amount += t.amount || 0;
  });

  console.log("--- TO BE DELETED, BY CATEGORY ---");
  Object.entries(byCategory).sort().forEach(([cat, v]) =>
    console.log(`  ${cat.padEnd(42)} ${String(v.count).padStart(4)} txn   ${inr(v.amount).padStart(16)}`),
  );
  const total = deletable.reduce((s, t) => s + (t.amount || 0), 0);
  console.log(`  ${"".padEnd(42)} ${String(deletable.length).padStart(4)} txn   ${inr(total).padStart(16)}  <- TOTAL\n`);

  console.log("--- ROWS ---");
  deletable.forEach((t) =>
    console.log(
      `  ${iso(t.date)}  ${String(t._id)}  ${(t.expense || "").padEnd(30)} ${(t.expenseType || "").padEnd(28)} ${inr(t.amount).padStart(14)}  ${t.branch || ""}  ${t.method || ""}`,
    ),
  );

  if (skipped.length) {
    console.log(`\n--- SKIPPED (${skipped.length}) ---`);
    skipped.forEach(({ tx, reason }) =>
      console.log(`  ${iso(tx.date)}  ${String(tx._id)}  ${(tx.expense || "").padEnd(30)} ${inr(tx.amount).padStart(14)}  — ${reason}`),
    );
  }

  if (!deletable.length) {
    console.log("\nNothing eligible to delete after the safety checks above.");
    await mongoose.disconnect();
    return;
  }

  const backupPath = `delete-direct-expense-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(deletable, null, 2));
  console.log(`\nFull backup of all ${deletable.length} document(s) written to ${backupPath} BEFORE any deletion.`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Review the list and the backup, then re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  // --- delete -------------------------------------------------------------------------------
  console.log("\nDeleting...");
  const deleted = [];
  const failed = [];

  for (const tx of deletable) {
    try {
      // Vendor back-reference cleanup — mirrors the route, both the expenseGiver.vendorId path
      // and the legacy top-level `vendor` field.
      for (const vendorId of [tx.expenseGiver?.vendorId, tx.vendor].filter(Boolean)) {
        const vendorDoc = await Vendor.findById(vendorId);
        if (vendorDoc?.Transactions?.toString() === String(tx._id)) {
          vendorDoc.Transactions = null;
          vendorDoc.editors = vendorDoc.editors || [];
          vendorDoc.editors.push({
            name: "Bulk Delete", email: "import@system", branch: "", date: new Date(),
            updatedFields: [{ name: "Transactions", previousValue: String(tx._id), newValue: "null" }],
          });
          await vendorDoc.save();
        }
      }

      await DeleteLog.create({
        entityType: "Transaction",
        entityId: tx._id,
        entityName: tx.expense || "Expense",
        entityDetails: {
          category: "EXPENSE", expense: tx.expense, expenseType: tx.expenseType,
          amount: tx.amount, method: tx.method, branch: tx.branch, date: tx.date,
        },
        deletedBy: { name: "Bulk Delete", email: "import@system", branch: "" },
        branch: tx.branch,
      });

      await Transactions.findByIdAndDelete(tx._id);
      deleted.push({ id: String(tx._id), date: iso(tx.date), expense: tx.expense, amount: tx.amount });
      console.log(`  ${iso(tx.date)}  ${String(tx._id)}  ${inr(tx.amount).padStart(14)}  DELETED`);
    } catch (err) {
      failed.push({ id: String(tx._id), reason: err?.message || String(err) });
      console.log(`  ${String(tx._id)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nDeleted ${deleted.length}, ${failed.length} failed.`);
  if (failed.length) failed.forEach((f) => console.log(`  ${f.id}: ${f.reason}`));

  const reportPath = `delete-direct-expense-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        range: { from: iso(fromDate), to: iso(toDate) },
        branch: BRANCH, categories: CATEGORIES,
        totalDeletedAmount: deleted.reduce((s, d) => s + d.amount, 0),
        deleted, failed,
        skipped: skipped.map(({ tx, reason }) => ({ id: String(tx._id), date: iso(tx.date), expense: tx.expense, amount: tx.amount, reason })),
        backupFile: backupPath,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport: ${reportPath}   Backup: ${backupPath}`);
  console.log("Keep both — the backup holds the full documents if anything needs restoring.");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
