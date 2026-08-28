
import mongoose from "mongoose";
import fs from "fs";
import { EXPENSE_CATEGORY_TREE } from "../src/constants/expenseCategories.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
    }
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

const PAYLOAD = {
  meta: {
    source: "Dashzer-provided opening balance image, cross-checked against transactions.xlsx",
    period: { month: 3, year: 2026 },
    totalOpeningPayable: 877867.1,
  },
  entries: [
    { expenseSubType: "Rent-Backend Basement", totalAmount: 34400.0, branch: "Delhi" , landlord: "Satpal Singh" },
    { expenseSubType: "Rent-Backend upper ground floor", totalAmount: 198307.10, branch: "Delhi" , landlord: "Satpal Singh" },
    { expenseSubType: "Rent-GD clinic", totalAmount: 262880.0, branch: "Delhi" , landlord: "NARESH PAMNANI" },
    { expenseSubType: "Rent-Manu Vaishali Clinic", totalAmount: 91240.0, branch: "Delhi" , landlord: "MANU AGGARWAL" },
    { expenseSubType: "Rent-Mansi Vaishali clinic", totalAmount: 91240.0, branch: "Delhi" , landlord: "MANSI AGGARWAL" },
    { expenseSubType: "Rent-Hyderebad Clinic", totalAmount: 199800.0, branch: "Hyderabad" , landlord: "VENKATA ROA YALAMANCHI" },
  ],
};

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALLOW_DUPES = args.includes("--allow-duplicates");
const DUMP_JSON = args.includes("--dump-json");

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const normalizeLandlord = (name) => String(name || "").trim().replace(/\s+/g, " ");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LANDLORD_VENDOR_OVERRIDES = {
  "VENKATA ROA YALAMANCHI": "6a882241ec4354da4e5eca13",
};

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
  const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", new mongoose.Schema({}, { strict: false, collection: "vendors" }));

  console.log("Resolving landlords against the vendor database...");
  const uniqueLandlords = new Map();
  for (const e of PAYLOAD.entries) {
    const label = normalizeLandlord(e.landlord);
    if (!label) continue;
    const key = label.toLowerCase();
    if (!uniqueLandlords.has(key)) uniqueLandlords.set(key, label);
  }

  const vendorByKey = new Map();
  const overridden = [];
  const matchedVendors = [];
  const vendorsToCreate = [];
  for (const [key, label] of uniqueLandlords) {
    const overrideId = LANDLORD_VENDOR_OVERRIDES[label];
    if (overrideId) {
      const vendor = await Vendor.findById(overrideId).select("_id name").lean();
      if (!vendor) {
        throw new Error(`LANDLORD_VENDOR_OVERRIDES["${label}"] = "${overrideId}" does not match any vendor — check the ID.`);
      }
      vendorByKey.set(key, vendor);
      overridden.push({ landlord: label, vendorId: String(vendor._id), vendorName: vendor.name });
      continue;
    }

    const existing = await Vendor.findOne({ name: { $regex: `^${escapeRegExp(label)}$`, $options: "i" } })
      .select("_id name")
      .lean();
    if (existing) {
      vendorByKey.set(key, existing);
      matchedVendors.push({ landlord: label, vendorId: String(existing._id), vendorName: existing.name });
    } else if (APPLY) {
      const created = await Vendor.create({
        name: label,
        DealsIn: "Rent",
        createdBy: { ...IMPORT_IDENTITY, date: new Date() },
        editors: [],
      });
      vendorByKey.set(key, { _id: created._id, name: created.name });
      vendorsToCreate.push({ landlord: label, vendorId: String(created._id) });
    } else {
      vendorByKey.set(key, null);
      vendorsToCreate.push({ landlord: label, vendorId: null });
    }
  }

  console.log(`  ${overridden.length} landlord(s) resolved via explicit override:`);
  overridden.forEach((m) => console.log(`    "${m.landlord}" -> ${m.vendorName} (${m.vendorId})`));
  console.log(`  ${matchedVendors.length} landlord(s) matched an existing vendor by name:`);
  matchedVendors.forEach((m) => console.log(`    "${m.landlord}" -> ${m.vendorName} (${m.vendorId})`));
  console.log(`  ${vendorsToCreate.length} landlord(s) ${APPLY ? "had no existing vendor — created" : "would need a NEW vendor created on --apply"}:`);
  vendorsToCreate.forEach((v) => console.log(`    "${v.landlord}"${v.vendorId ? ` -> ${v.vendorId}` : ""}`));
  console.log("");

  const vendorFor = (e) => {
    const label = normalizeLandlord(e.landlord);
    return label ? vendorByKey.get(label.toLowerCase()) : null;
  };

  console.log("Checking the monthly duplicate guard (payee.kind + payee.label + purpose + period)...");
  const dupes = [];
  for (const e of PAYLOAD.entries) {
    const vendor = vendorFor(e);
    if (APPLY === false && vendor === null && normalizeLandlord(e.landlord)) continue;
    const query = vendor
      ? { "payee.kind": "VENDOR", "payee.refId": vendor._id, "payee.label": `${vendor.name} — ${e.expenseSubType}` }
      : { "payee.kind": "RENT_UNIT", "payee.label": e.expenseSubType };
    const existing = await Payable.findOne({
      ...query,
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
      const vendor = vendorFor(e);
      const doc = await Payable.create({
        payee: vendor
          ? { kind: "VENDOR", refId: vendor._id, label: `${vendor.name} — ${e.expenseSubType}` }
          : { kind: "RENT_UNIT", refId: null, label: e.expenseSubType },
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
        createdAt: new Date(Date.UTC(PAYLOAD.meta.period.year, PAYLOAD.meta.period.month - 1, 1)),
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
