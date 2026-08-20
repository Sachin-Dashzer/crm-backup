// scripts/rent-opening-payables-march-2026.mjs
//
// Creates the missing March 2026 "opening payable" (pre-April) Rent payables — the root cause
// of the 12 "NO MATCHING PAYABLE" rows scripts/rent-expense-transactions-import.mjs reported.
// Those 12 transaction rows all reference period 3/2026, which predates every payables-import
// script (they start at April), so no Payable existed for them to settle against.
//
// The six amounts below come directly from Dashzer's own "Opening Payable (pre-Apr)" figures
// and were cross-checked against the transactions.xlsx source data before being embedded: they
// equal, exactly, the sum of every "3/2026"-period Allocated Amount in that sheet for the same
// sub-type. That agreement is what confirms these are the right totals to open with — a
// payable sized to exactly what the historical payments were clearing, not an arbitrary figure.
//   Rent-Backend Basement             34,400.00   = row2
//   Rent-Backend upper ground floor   67,547.10   = row29
//   Rent-GD clinic                   262,880.00   = row6 + row17 + row28 + row37
//   Rent-Manu Vaishali Clinic         91,240.00   = row4 + row19
//   Rent-Mansi Vaishali clinic        91,240.00   = row5 + row21
//   Rent-Hyderebad Clinic            199,800.00   = row16 + row39
// The other six Rent sub-types (1st Floor, 4th floor/Top floor, CD Clinic, Staff Flat, Deepak
// staff flat, P House Rent) have no opening balance ("-" in the source) and are NOT created —
// there is nothing pre-April for them to owe.
//
// AFTER this script runs successfully, re-run rent-expense-transactions-import.mjs — its
// payable lookup is live (queried at run time, never cached), so it will pick up these newly
// created March payables automatically and import the 12 previously-unmatched rows without any
// further change.
//
// Usage:
//   node scripts/rent-opening-payables-march-2026.mjs                  # dry run
//   node scripts/rent-opening-payables-march-2026.mjs --dump-json      # write PAYLOAD out, no DB
//   node scripts/rent-opening-payables-march-2026.mjs --apply          # write
//   node scripts/rent-opening-payables-march-2026.mjs --apply --allow-duplicates

import mongoose from "mongoose";
import fs from "fs";
import { EXPENSE_CATEGORY_TREE } from "../src/constants/expenseCategories.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";

// --- env -----------------------------------------------------------------
for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
      /* already loaded / unsupported — fall through to the MONGODB_URI check below */
    }
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — opening (pre-April) Rent payables for period 3/2026. No GST/TDS: these are plain
// opening balances, not fresh invoices, and the source gives a single net figure per sub-type.
// dueDate 2026-03-31 matches the "Payable Due Date" column transactions.xlsx itself carries for
// every 3/2026-period row.
// ═══════════════════════════════════════════════════════════════════════════════
const PAYLOAD = {
  meta: {
    source: "Dashzer-provided opening balance image, cross-checked against transactions.xlsx",
    period: { month: 3, year: 2026 },
    totalOpeningPayable: 747107.1,
  },
  entries: [
    { expenseSubType: "Rent-Backend Basement", totalAmount: 34400.0, branch: "Delhi" },
    { expenseSubType: "Rent-Backend upper ground floor", totalAmount: 67547.1, branch: "Delhi" },
    { expenseSubType: "Rent-GD clinic", totalAmount: 262880.0, branch: "Delhi" },
    { expenseSubType: "Rent-Manu Vaishali Clinic", totalAmount: 91240.0, branch: "Delhi" },
    { expenseSubType: "Rent-Mansi Vaishali clinic", totalAmount: 91240.0, branch: "Delhi" },
    { expenseSubType: "Rent-Hyderebad Clinic", totalAmount: 199800.0, branch: "Hyderabad" },
  ],
};

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALLOW_DUPES = args.includes("--allow-duplicates");
const DUMP_JSON = args.includes("--dump-json");

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

if (DUMP_JSON) {
  const out = "rent-opening-payables-march-2026.json";
  fs.writeFileSync(out, JSON.stringify(PAYLOAD, null, 2));
  console.log(`Wrote ${out} — ${PAYLOAD.entries.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function validate() {
  const errors = [];
  for (const e of PAYLOAD.entries) {
    const where = e.expenseSubType;
    if (!EXPENSE_CATEGORY_TREE["Rent"]?.includes(e.expenseSubType))
      errors.push(`${where}: not a valid sub-type under "Rent"`);
    if (!ALL_BRANCHES.includes(e.branch)) errors.push(`${where}: unknown branch "${e.branch}"`);
    if (!(e.totalAmount > 0)) errors.push(`${where}: amount must be > 0`);
  }
  const declaredTotal = r2(PAYLOAD.entries.reduce((s, e) => s + e.totalAmount, 0));
  if (Math.abs(declaredTotal - PAYLOAD.meta.totalOpeningPayable) > 0.01) {
    errors.push(
      `meta.totalOpeningPayable (${PAYLOAD.meta.totalOpeningPayable}) does not match the sum of entries (${declaredTotal})`,
    );
  }
  return errors;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Period: March ${PAYLOAD.meta.period.year} (opening, pre-April)`);
  console.log(`Rows: ${PAYLOAD.entries.length}`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed.\n");

  const total = r2(PAYLOAD.entries.reduce((s, e) => s + e.totalAmount, 0));
  console.log("--- ROWS ---");
  PAYLOAD.entries.forEach((e) => console.log(`  ${e.expenseSubType.padEnd(34)} ${inr(e.totalAmount).padStart(14)}  (${e.branch})`));
  console.log(`\n  TOTAL: ${inr(total)}\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));

  console.log("Checking the monthly duplicate guard (payee.kind + payee.label + purpose + period)...");
  const dupes = [];
  for (const e of PAYLOAD.entries) {
    const existing = await Payable.findOne({
      "payee.kind": "RENT_UNIT",
      "payee.label": e.expenseSubType,
      purpose: "RENT",
      "period.month": PAYLOAD.meta.period.month,
      "period.year": PAYLOAD.meta.period.year,
    })
      .select("_id totalAmount isCancelled")
      .lean();
    if (existing)
      dupes.push({ subType: e.expenseSubType, id: String(existing._id), amount: existing.totalAmount, cancelled: !!existing.isCancelled });
  }

  if (dupes.length) {
    console.log(`\nWARNING — ${dupes.length} row(s) already have a March 2026 payable:`);
    dupes.forEach((d) => console.log(`  ${d.subType.padEnd(34)} -> ${d.id} (${inr(d.amount)})${d.cancelled ? " [cancelled]" : ""}`));
    if (APPLY && !ALLOW_DUPES) {
      console.error("\nRefusing to import. Pass --allow-duplicates only if these are genuinely separate obligations.");
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log("No duplicates found.\n");
  }

  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply, then re-run");
    console.log("rent-expense-transactions-import.mjs to pick up the 12 previously-unmatched rows.");
    await mongoose.disconnect();
    return;
  }

  const dupeSet = new Set(dupes.map((d) => d.subType));
  console.log("Creating opening payables...");
  const created = [];
  const failed = [];
  const skipped = [];

  for (const e of PAYLOAD.entries) {
    if (dupeSet.has(e.expenseSubType) && !ALLOW_DUPES) {
      skipped.push(e.expenseSubType);
      continue;
    }
    try {
      const doc = await Payable.create({
        payee: { kind: "RENT_UNIT", refId: null, label: e.expenseSubType },
        purpose: "RENT",
        expenseCategory: "Rent",
        expenseSubType: e.expenseSubType,
        period: { month: PAYLOAD.meta.period.month, year: PAYLOAD.meta.period.year },
        totalAmount: e.totalAmount,
        dueDate: new Date("2026-03-31"),
        branch: e.branch,
        remarks: "Opening payable (pre-April 2026) — bulk import",
        isCancelled: false,
        costAlreadyRecognised: false,
        createdBy: { ...IMPORT_IDENTITY, branch: e.branch, date: new Date() },
        log: [
          {
            action: "Created",
            newValue: String(e.totalAmount),
            note: "Opening payable (pre-April 2026) — bulk import, sized to the outstanding amount the March/opening-balance payments were clearing",
            performedBy: IMPORT_IDENTITY,
            performedAt: new Date(),
          },
        ],
      });
      created.push({ subType: e.expenseSubType, id: String(doc._id), amount: e.totalAmount });
      console.log(`  ${e.expenseSubType.padEnd(34)} ${inr(e.totalAmount).padStart(14)}  OK  -> ${doc._id}`);
    } catch (err) {
      const reason = err?.code === 11000 ? "duplicate — a March 2026 payable already exists for this rent unit" : err?.message || String(err);
      failed.push({ subType: e.expenseSubType, reason });
      console.log(`  ${e.expenseSubType.padEnd(34)}  FAILED: ${reason}`);
    }
  }

  console.log(`\nCreated ${created.length} opening payable(s).`);
  if (skipped.length) console.log(`Skipped ${skipped.length} already-existing row(s): ${skipped.join(", ")}`);
  if (failed.length) {
    console.log(`\n${failed.length} row(s) failed:`);
    failed.forEach((f) => console.log(`  ${f.subType}: ${f.reason}`));
  }

  const reportPath = `rent-opening-payables-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ created, skipped, failed }, null, 2));
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);

  if (created.length) {
    console.log("\nNext step: re-run scripts/rent-expense-transactions-import.mjs (dry run first) —");
    console.log("it will now resolve the 12 previously-unmatched \"3/2026\" rows against these payables.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
