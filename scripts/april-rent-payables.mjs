

import mongoose from "mongoose";
import fs from "fs";
// import dotenv from "dotenv";
import { EXPENSE_CATEGORY_TREE } from "../src/constants/expenseCategories.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";
import { computeTaxBreakdown } from "../src/lib/taxMath.js";

// dotenv.config({ path: ".env.local" });

// Rows whose figures need a human decision before they can be written (findings 2 and 3).
const FLAGGED_ROWS = [2, 3, 4, 5];

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — this is the JSON. Rates are whole-number percent, already converted.
// ═══════════════════════════════════════════════════════════════════════════════
const PAYLOAD = {
  "meta": {
    "source": "journal-voucher-bulk-template.xlsx",
    "sheet": "1-Create Payable",
    "dataRows": 13,
    "importableRows": 12,
    "period": "April 2026",
    "category": "Rent",
    "purpose": "RENT",
    "totals": {
      "invoiceTotal": 1557970.0,
      "vendorPayables": 1358244.0,
      "tdsPayables": 199726.0
    },
    "payableDocumentsToCreate": 21,
    "flags": {
      "rate_unit_converted": "Excel cells are percent-formatted (0.18 stored = 18%). All rates multiplied by 100 so they match what computeTaxBreakdown expects (whole-number percent).",
      "needs_confirmation": [
        {
          "rows": [
            2,
            3,
            4
          ],
          "issue": "TDS rate 31.2% on rent. Statutory TDS on rent (s.194-I) is 10%. 31.2% is the corporate tax rate (30% + cess), not a TDS rate.",
          "atStatedRate": {
            "2": 16380,
            "3": 81900,
            "4": 27846
          },
          "at10pct": {
            "2": 5250,
            "3": 26250,
            "4": 8925
          },
          "difference": 85701
        },
        {
          "rows": [
            5
          ],
          "issue": "Include TDS = Yes and rate 10%, but TDS Amount explicitly 0. A direct amount wins over a rate, so TDS resolves to 0 and the row is rejected. Either set the amount to 7500 (10% of 75000) or set Include TDS to No."
        }
      ],
      "informational": [
        {
          "rows": [
            6,
            11
          ],
          "issue": "Explicit TDS Amount contradicts the stated 10% rate \u2014 implied 5.6% and 6.1%. The explicit amount is used (direct amount wins). Confirm these are the actual amounts deducted."
        },
        {
          "rows": [
            12,
            13
          ],
          "issue": "Include TDS = No but the rate column is filled. Rate is ignored; no TDS payable created."
        }
      ],
      "excluded": [
        {
          "rows": [
            14
          ],
          "issue": "Rent-Noida Clinic base amount is 0. Nothing is owed, so no payable is created. Fill the amount and re-run if it should exist."
        }
      ]
    }
  },
  "entries": [
    {
      "rowNum": 2,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Backend Basement",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 52500.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 52500.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Medihub",
      "tdsRate": 31.2,
      "tdsAmount": 16380.0,
      "vendorPayable": 36120.0,
      "impliedTdsRate": 31.2
    },
    {
      "rowNum": 3,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Backend upper ground floor",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 262500.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 262500.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Medihub",
      "tdsRate": 31.2,
      "tdsAmount": 81900.0,
      "vendorPayable": 180600.0,
      "impliedTdsRate": 31.2
    },
    {
      "rowNum": 4,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Backend 1st Floor",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 89250.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 89250.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 31.2,
      "tdsAmount": 27846.0,
      "vendorPayable": 61404.0,
      "impliedTdsRate": 31.2
    },
    {
      "rowNum": 5,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Backend 4th floor / Top floor",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 75000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 75000.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 10.0,
      "tdsAmount": 0.0,
      "vendorPayable": 75000.0,
      "impliedTdsRate": 0.0
    },
    {
      "rowNum": 6,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-CD Clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 262500.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 262500.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 10.0,
      "tdsAmount": 14700.0,
      "vendorPayable": 247800.0,
      "impliedTdsRate": 5.6
    },
    {
      "rowNum": 7,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-GD clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 176000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": true,
      "gstRate": 18.0,
      "gstAmount": 31680.0,
      "invoiceTotal": 207680.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 10.0,
      "tdsAmount": 17600.0,
      "vendorPayable": 190080.0,
      "impliedTdsRate": 10.0
    },
    {
      "rowNum": 8,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Manu Vaishali Clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 84000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": true,
      "gstRate": 18.0,
      "gstAmount": 15120.0,
      "invoiceTotal": 99120.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Medihub",
      "tdsRate": 10.0,
      "tdsAmount": 8400.0,
      "vendorPayable": 90720.0,
      "impliedTdsRate": 10.0
    },
    {
      "rowNum": 9,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Mansi Vaishali clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 84000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": true,
      "gstRate": 18.0,
      "gstAmount": 15120.0,
      "invoiceTotal": 99120.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Medihub",
      "tdsRate": 10.0,
      "tdsAmount": 8400.0,
      "vendorPayable": 90720.0,
      "impliedTdsRate": 10.0
    },
    {
      "rowNum": 10,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Hyderebad Clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 185000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-08",
      "branch": "Hyderabad",
      "remarks": "April rent",
      "includeGST": true,
      "gstRate": 18.0,
      "gstAmount": 33300.0,
      "invoiceTotal": 218300.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Medihub",
      "tdsRate": 10.0,
      "tdsAmount": 18500.0,
      "vendorPayable": 199800.0,
      "impliedTdsRate": 10.0
    },
    {
      "rowNum": 11,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Staff Flat",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 99000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 99000.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 10.0,
      "tdsAmount": 6000.0,
      "vendorPayable": 93000.0,
      "impliedTdsRate": 6.06
    },
    {
      "rowNum": 12,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Deepak staff flat",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 8000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 8000.0,
      "includeTDS": false,
      "tdsCategory": "",
      "tdsRate": 10.0,
      "tdsAmount": 0.0,
      "vendorPayable": 8000.0,
      "impliedTdsRate": 0.0
    },
    {
      "rowNum": 13,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-P House Rent",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 85000.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Delhi",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 85000.0,
      "includeTDS": false,
      "tdsCategory": "",
      "tdsRate": 10.0,
      "tdsAmount": 0.0,
      "vendorPayable": 85000.0,
      "impliedTdsRate": 0.0
    },
    {
      "rowNum": 14,
      "expenseCategory": "Rent",
      "expenseSubType": "Rent-Noida Clinic",
      "purpose": "RENT",
      "payeeKind": "RENT_UNIT",
      "baseAmount": 0.0,
      "period": {
        "month": 4,
        "year": 2026
      },
      "dueDate": "2026-04-01",
      "branch": "Noida",
      "remarks": "April rent",
      "includeGST": false,
      "gstRate": 0.0,
      "gstAmount": 0.0,
      "invoiceTotal": 0.0,
      "includeTDS": true,
      "tdsCategory": "TDS on Rent Ryan Skin",
      "tdsRate": 10.0,
      "tdsAmount": 0.0,
      "vendorPayable": 0.0,
      "impliedTdsRate": 0
    }
  ]
};

// Only rows with a positive base amount are importable (excludes row 14).
const ENTRIES = PAYLOAD.entries.filter((e) => e.baseAmount > 0);

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRM_FLAGGED = args.includes("--confirm-flagged");
const ALLOW_DUPES = args.includes("--allow-duplicates");
const DUMP_JSON = args.includes("--dump-json");

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// --- job 1: dump the JSON and stop -----------------------------------------
if (DUMP_JSON) {
  const out = "april-rent-payables.json";
  fs.writeFileSync(out, JSON.stringify(PAYLOAD, null, 2));
  console.log(`Wrote ${out} — ${PAYLOAD.entries.length} rows, ${PAYLOAD.meta.importableRows} importable.`);
  process.exit(0);
}

const MONGODB_URI = "mongodb://sachindashzer:user8520@ac-pu86ixj-shard-00-00.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-01.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-02.hwjor1r.mongodb.net:27017/?ssl=true&replicaSet=atlas-ool7b4-shard-0&authSource=admin&appName=crm";
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing in .env.local");
  process.exit(1);
}

const Payable =
  mongoose.models.Payable ||
  mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));

// ---------------------------------------------------------------------------
// Validation — recomputes every tax figure from the shared function and checks it
// against what is embedded. A mismatch means PAYLOAD was hand-edited incorrectly.
// ---------------------------------------------------------------------------
function validate() {
  const errors = [];
  for (const e of ENTRIES) {
    const where = `row ${e.rowNum}`;

    if (!EXPENSE_CATEGORY_TREE[e.expenseCategory]?.includes(e.expenseSubType))
      errors.push(`${where}: "${e.expenseSubType}" is not a valid sub-type under "${e.expenseCategory}"`);
    if (!ALL_BRANCHES.includes(e.branch)) errors.push(`${where}: unknown branch "${e.branch}"`);
    if (!(e.baseAmount > 0)) errors.push(`${where}: base amount must be > 0`);
    if (!(e.period?.month >= 1 && e.period?.month <= 12))
      errors.push(`${where}: period month must be 1-12`);
    if (isNaN(new Date(e.dueDate).getTime())) errors.push(`${where}: bad due date "${e.dueDate}"`);

    if (e.includeTDS && e.tdsAmount > 0) {
      if (!e.tdsCategory) errors.push(`${where}: TDS is set but TDS Category is empty`);
      else if (!EXPENSE_CATEGORY_TREE["Taxes"]?.includes(e.tdsCategory))
        errors.push(`${where}: TDS Category "${e.tdsCategory}" is not a sub-type under Taxes`);
    }

    const tax = computeTaxBreakdown({
      baseAmount: e.baseAmount,
      includeGST: e.includeGST,
      gstRate: e.gstRate ?? undefined,
      gstAmount: e.includeGST ? e.gstAmount : undefined,
      includeTDS: e.includeTDS,
      tdsAmount: e.includeTDS ? e.tdsAmount : undefined,
      tdsRate: e.tdsRate ?? undefined,
      tdsCategory: e.tdsCategory,
    });
    if (r2(tax.invoiceTotal) !== r2(e.invoiceTotal))
      errors.push(`${where}: invoice total mismatch — embedded ${e.invoiceTotal}, computed ${tax.invoiceTotal}`);
    if (r2(tax.vendorPayable) !== r2(e.vendorPayable))
      errors.push(`${where}: vendor payable mismatch — embedded ${e.vendorPayable}, computed ${tax.vendorPayable}`);
    if (r2(tax.tdsAmount) !== r2(e.tdsAmount))
      errors.push(`${where}: TDS mismatch — embedded ${e.tdsAmount}, computed ${tax.tdsAmount}`);
    // TDS is withheld out of what we owe, so it can never reach the invoice total.
    if (e.tdsAmount > 0 && e.tdsAmount >= e.invoiceTotal)
      errors.push(`${where}: TDS ${e.tdsAmount} must be less than invoice total ${e.invoiceTotal}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Document builders — mirror app/api/payables/create/route.js
// ---------------------------------------------------------------------------
const taxNote = (e) =>
  e.includeGST || e.tdsAmount > 0
    ? `Base ${e.baseAmount} + GST ${e.gstAmount} = invoice ${e.invoiceTotal}; TDS ${e.tdsAmount} on base`
    : undefined;

const commonFields = (e) => ({
  period: e.period,
  dueDate: new Date(e.dueDate),
  branch: e.branch,
  remarks: e.remarks || "",
  isCancelled: false,
  createdBy: { ...IMPORT_IDENTITY, branch: e.branch, date: new Date() },
});

function buildRentPayable(e) {
  const note = taxNote(e);
  const hasTds = e.tdsAmount > 0;
  return {
    ...commonFields(e),
    payee: { kind: e.payeeKind, refId: null, label: e.expenseSubType },
    purpose: e.purpose,
    expenseCategory: e.expenseCategory,
    expenseSubType: e.expenseSubType,
    totalAmount: e.vendorPayable,
    ...(hasTds
      ? {
          tdsLink: {
            role: "PARENT",
            linkedId: null,
            tdsRate: e.tdsRate,
            tdsAmount: e.tdsAmount,
            grossAmount: e.invoiceTotal,
          },
        }
      : {}),
    log: [
      {
        action: "Created",
        newValue: String(e.vendorPayable),
        note: note ? `${note} [bulk import]` : "Bulk import from Excel",
        performedBy: IMPORT_IDENTITY,
        performedAt: new Date(),
      },
    ],
  };
}

function buildTdsPayable(e, parentId) {
  return {
    ...commonFields(e),
    payee: { kind: "OTHER", refId: null, label: e.tdsCategory },
    purpose: "TAX",
    expenseCategory: "Taxes",
    expenseSubType: e.tdsCategory,
    totalAmount: e.tdsAmount,
    tdsLink: {
      role: "TDS",
      linkedId: parentId,
      tdsRate: e.tdsRate,
      tdsAmount: e.tdsAmount,
      grossAmount: e.invoiceTotal,
    },
    log: [
      {
        action: "Created",
        newValue: String(e.tdsAmount),
        note: `TDS split from payable ${parentId}. ${taxNote(e) || ""} [bulk import]`.trim(),
        performedBy: IMPORT_IDENTITY,
        performedAt: new Date(),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
async function run() {
  const withTds = ENTRIES.filter((e) => e.tdsAmount > 0);
  const invoiceTotal = ENTRIES.reduce((s, e) => s + e.invoiceTotal, 0);
  const vendorTotal = ENTRIES.reduce((s, e) => s + e.vendorPayable, 0);
  const tdsTotal = ENTRIES.reduce((s, e) => s + e.tdsAmount, 0);

  console.log("=".repeat(86));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(
    `Rows: ${ENTRIES.length} rent payables + ${withTds.length} TDS payables = ${ENTRIES.length + withTds.length} documents`,
  );
  console.log(`Skipped: ${PAYLOAD.entries.length - ENTRIES.length} row(s) with a zero base amount`);
  console.log("=".repeat(86) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED - ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed — sub-types, branches and every tax figure recompute correctly.\n");

  const conserved = Math.abs(vendorTotal + tdsTotal - invoiceTotal) < 0.005;
  console.log("--- TOTALS ---");
  console.log(`  Invoice total (base + GST) : ${inr(invoiceTotal)}`);
  console.log(`  Vendor payables            : ${inr(vendorTotal)}`);
  console.log(`  TDS payables               : ${inr(tdsTotal)}`);
  console.log(
    `  Conservation check         : ${inr(vendorTotal + tdsTotal)} ${conserved ? "== invoice total  OK" : "!= invoice total  MISMATCH"}`,
  );
  if (!conserved) {
    console.error("\nABORTING - vendor + TDS does not equal the invoice total. That invariant holds");
    console.error("at every rate pair, so a mismatch means the embedded data is wrong.");
    process.exit(1);
  }

  console.log("\n--- ROWS ---");
  ENTRIES.forEach((e) => {
    const flag = FLAGGED_ROWS.includes(e.rowNum) ? "  <-- FLAGGED" : "";
    const tds = e.tdsAmount > 0 ? `  +TDS ${inr(e.tdsAmount)} @${e.tdsRate}%` : "  (no TDS)";
    console.log(
      `  ${String(e.rowNum).padStart(3)}  ${e.expenseSubType.padEnd(34)} ${inr(e.vendorPayable).padStart(14)}${tds}${flag}`,
    );
  });

  // --- flagged-row gate ---
  if (ENTRIES.some((e) => FLAGGED_ROWS.includes(e.rowNum))) {
    console.log("\n" + "!".repeat(86));
    console.log("FLAGGED ROWS — see findings 2 and 3 in this file's header");
    console.log("!".repeat(86));
    console.log("  rows 2, 3, 4 : TDS at 31.2%, not the statutory 10% for rent.");
    console.log("                 Withholds Rs 1,26,126 where 10% would withhold Rs 40,425.");
    console.log("  row 5        : Include TDS = Yes but TDS Amount is 0, so no TDS payable is");
    console.log("                 created. Imports as a plain Rs 75,000 payable.");
    console.log("");
    if (APPLY && !CONFIRM_FLAGGED) {
      console.error("Refusing to apply. If those figures are correct, re-run with:");
      console.error("  node scripts/april-rent-payables.mjs --apply --confirm-flagged");
      console.error("If they are not, fix the sheet and regenerate this file instead.");
      process.exit(1);
    }
    if (APPLY) console.log("--confirm-flagged passed — proceeding with the figures as they stand.\n");
  }

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  // --- monthly duplicate guard: mirrors the Payable model's partial unique index ---
  console.log("Checking the monthly duplicate guard...");
  const dupes = [];
  for (const e of ENTRIES) {
    const existing = await Payable.findOne({
      "payee.kind": e.payeeKind,
      "payee.label": e.expenseSubType,
      purpose: e.purpose,
      "period.month": e.period.month,
      "period.year": e.period.year,
    })
      .select("_id totalAmount isCancelled")
      .lean();
    if (existing)
      dupes.push({
        rowNum: e.rowNum,
        subType: e.expenseSubType,
        id: String(existing._id),
        amount: existing.totalAmount,
        cancelled: !!existing.isCancelled,
      });
  }

  if (dupes.length) {
    console.log(`\nWARNING - ${dupes.length} row(s) already have an April 2026 payable:`);
    dupes.forEach((d) =>
      console.log(
        `  row ${d.rowNum}  ${d.subType.padEnd(34)} -> ${d.id} (${inr(d.amount)})${d.cancelled ? " [cancelled]" : ""}`,
      ),
    );
    console.log("\nThis is what the model's unique index is for. Skip those rows rather than");
    console.log("changing the period to force them through.");
    if (APPLY && !ALLOW_DUPES) {
      console.error("\nRefusing to import. Pass --allow-duplicates only if these are genuinely");
      console.error("separate obligations (the index will most likely still reject them).");
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log("No duplicates found.\n");
  }

  if (!APPLY) {
    console.log("DRY RUN - nothing written.");
    console.log("Reconcile the totals above against your rent agreements, then re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  // --- write ---
  console.log("Creating payables...");
  const created = [];
  const failed = [];

  for (const e of ENTRIES) {
    try {
      if (!(e.tdsAmount > 0)) {
        const doc = await Payable.create(buildRentPayable(e));
        created.push({ rowNum: e.rowNum, subType: e.expenseSubType, ids: [String(doc._id)] });
      } else {
        // Both payables or neither. A half-created TDS pair is worse than no entry, so this
        // uses a real transaction rather than compensating deletes — the API route notes the
        // delete approach left a crash window where the vendor payable could survive alone.
        // Requires a replica set; confirmed live on this deployment.
        const dbSession = await mongoose.startSession();
        let parentId, tdsId;
        try {
          await dbSession.withTransaction(async () => {
            const [parent] = await Payable.create([buildRentPayable(e)], { session: dbSession });
            parentId = parent._id;
            const [tds] = await Payable.create([buildTdsPayable(e, parentId)], { session: dbSession });
            tdsId = tds._id;
            // Back-link so neither side can be found without the other.
            await Payable.updateOne(
              { _id: parentId },
              { $set: { "tdsLink.linkedId": tdsId } },
              { session: dbSession },
            );
          });
        } finally {
          await dbSession.endSession();
        }
        created.push({ rowNum: e.rowNum, subType: e.expenseSubType, ids: [String(parentId), String(tdsId)] });
      }
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.expenseSubType}  OK`);
    } catch (err) {
      const reason =
        err?.code === 11000
          ? "duplicate — an April 2026 payable already exists for this rent unit"
          : err?.message || String(err);
      failed.push({ rowNum: e.rowNum, subType: e.expenseSubType, reason });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.expenseSubType}  FAILED: ${reason}`);
    }
  }

  const docCount = created.reduce((s, c) => s + c.ids.length, 0);
  console.log(`\nCreated ${docCount} payable document(s) from ${created.length} row(s).`);

  if (failed.length) {
    console.log(`\n${failed.length} row(s) failed and were skipped:`);
    failed.forEach((f) => console.log(`  row ${f.rowNum}  ${f.subType}: ${f.reason}`));
    console.log("\nSuccessful rows above are committed. Fix and re-run — the duplicate guard");
    console.log("will skip everything already imported.");
  }

  const reportPath = `payable-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { source: PAYLOAD.meta.source, period: PAYLOAD.meta.period, invoiceTotal, vendorTotal, tdsTotal, created, failed },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
