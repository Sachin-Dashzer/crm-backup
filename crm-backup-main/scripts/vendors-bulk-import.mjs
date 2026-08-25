// scripts/vendors-bulk-import.mjs
//
// Bulk-imports vendor directory entries from vendors.xlsx into the Vendor collection, ahead of
// creating payables for the "Other Expense" / procurement heads that need these vendors as
// their payee.
//
// UPDATED behaviour: a row that matches an existing vendor no longer just gets skipped — it
// UPDATES that vendor's details (name cleanup, contact, email, address, gstNumber, DealsIn),
// filling in anything blank and correcting anything that differs, via $set plus a logged entry
// in the vendor's own `editors[]` array (previousValue/newValue per field, matching what the
// update API itself records).
//
// THE CATCH — a "match" here comes from the same $or query the create API uses (same `name` OR
// same `contact`), and a same-contact match does NOT guarantee it's the same vendor. Live check
// against this database found exactly that case: row 12 "Pharmachem Distributors" matches an
// EXISTING VENDOR NAMED "CUTISOINS COSMECEUTICALS PVT LTD" — completely different business,
// same phone number on file. Blindly updating that record would overwrite Cutisoins' real data
// with Pharmachem's, under Cutisoins' _id.
//
// So every match is classified before anything is written:
//   - NAME-SIMILAR match (>=50% word overlap between the sheet name and the existing name, after
//     normalising case/punctuation) — treated as the same vendor with messy formatting, e.g.
//     "Helpsure Healthcare Private Limited" / "HELPSURE HEALTHCARE PVT LTD". Updated automatically.
//   - NAME-MISMATCH match (matched only by contact, names share nothing) — e.g. Pharmachem /
//     Cutisoins. NEVER auto-updated. Requires --confirm-contact-only-updates, and even then is
//     printed under its own loud warning banner every run, dry or applied.
// This is a heuristic on real but messy data, not a certainty — the dry run always prints the
// full old-vs-new diff for every match, safe or risky, so nothing changes without being visible
// first.
//
// SCHEMA GAP — read before running: the Vendor model (src/models/Vendor.js) has no field for
// "opening balance", "contact person name", or a second phone number. It only holds name,
// contact (a single Number), email, address, gstNumber, DealsIn. So:
//   - "Contact Person" (e.g. "SURRENDRA" for Helpsure Healthcare) is folded into `address` as
//     "Contact person: <name> | <original address>" — there's nowhere else for it to go.
//   - A second phone number (two rows have "<num1> / <num2>") is folded into `address` as
//     "Alt contact: <num2>" — `contact` only ever takes the first number, since it's a Number
//     field, not a string.
//   - "Opening Balance" is captured in this script's PAYLOAD for the record, but is
//     DELIBERATELY NOT WRITTEN anywhere — money owed to a vendor belongs in a Payable (payee.kind:
//     "VENDOR"), never on the vendor document itself (mirrors the Payable model's own comment:
//     "Do NOT add amountPaid/balanceAmount fields — that reintroduces double-storage drift").
//     Tell me how to categorise each vendor's balance (purpose/expenseCategory) once vendors
//     exist and I'll build that script next, the way rent-opening-payables-march-2026.mjs was built.
//
// ONE DATA ANOMALY FLAGGED (not blocking): row 19, "Yurexa Wellness", has a 9-digit contact
// number (991195209) in the source sheet — one digit short of a normal Indian mobile number.
//
// Usage:
//   node scripts/vendors-bulk-import.mjs                                  # dry run
//   node scripts/vendors-bulk-import.mjs --dump-json                       # write entries out, no DB
//   node scripts/vendors-bulk-import.mjs --apply                          # write (new + name-similar updates)
//   node scripts/vendors-bulk-import.mjs --apply --confirm-contact-only-updates   # also apply the risky ones

import mongoose from "mongoose";
import fs from "fs";

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
// THE DATA — parsed from vendors.xlsx. openingBalance is carried along for the record (see the
// schema-gap note above) but is never written to the Vendor document.
// ═══════════════════════════════════════════════════════════════════════════════
const VENDOR_ENTRIES = [
  {
    "rowNum": 2,
    "name": "Helpsure Healthcare Private Limited",
    "contact": 9313207836,
    "email": "HELPSUREHEALTHCARE@GMAIL.COM",
    "address": "Contact person: SURRENDRA | H NO. 359 G/F NEW LAHORE COLONY SHASTRI NAGAR",
    "gstNumber": "07AAECH4722K1ZJ",
    "DealsIn": "Medicine",
    "openingBalance": 150000.0
  },
  {
    "rowNum": 3,
    "name": "Modern Pharmaceuticals",
    "contact": 8285385467,
    "email": "modernpharmaceuticals@yahoo.in",
    "address": "Contact person: Ankit | 1519-A, Ground Floor Bhagirath Palace New Delhi -110006 D: L: No:- 115087/115088",
    "gstNumber": "07AIUPA5683P1ZE",
    "DealsIn": "Ot stock",
    "openingBalance": 377374.0
  },
  {
    "rowNum": 4,
    "name": "Shri Ji Pharma",
    "contact": 9811573313,
    "email": "shrijipharma2009@gmail.com",
    "address": "Contact person: ABHISHEK SETHIA | SHOP NO-103 FIRST FLOOR PROPRTY NO-173/RAM GALI MANGAL",
    "gstNumber": "07BMOPS2003N1ZP",
    "DealsIn": "Medicine",
    "openingBalance": 410803.0
  },
  {
    "rowNum": 5,
    "name": "Cranix Pharma",
    "contact": 9586731039,
    "email": "cranixpharma@gmail.com",
    "address": "Contact person: hiren | 51,GROUND FLOOR, ORANGE PARK-1, KARANJ, To, RYAN MEDIHUB PRIVATE LIMITED PUNAGAM,SURAT- 395010 GUJARAT",
    "gstNumber": "24BBAPJ8587R1ZU",
    "DealsIn": "Medicine",
    "openingBalance": 345353.0
  },
  {
    "rowNum": 6,
    "name": "Bhawani Drugs Distributors",
    "contact": 9891127165,
    "email": null,
    "address": "Contact person: ARUN | GODOWN NO / KHASRA NO 1307 - 1310 DELHI MEERUT ROAD, MORTA GHAZIABAD UTTAR PRADESH 201001",
    "gstNumber": "09AAFFB3250L1ZF",
    "DealsIn": "Medicine",
    "openingBalance": 210364.0
  },
  {
    "rowNum": 7,
    "name": "Cross Q-Derma",
    "contact": 9971933895,
    "email": null,
    "address": "Contact person: TANISHQ | OFFICE NO.B-2,BASEMENT FLOOR PLOT NO.11,KIRTI SHIKHAR BUILDING 07-DELHI",
    "gstNumber": "07BBEPA6565L1ZH",
    "DealsIn": "Medicine",
    "openingBalance": 0.0
  },
  {
    "rowNum": 8,
    "name": "Gnvs Pharmaceuticals",
    "contact": 9711511421,
    "email": null,
    "address": "Contact person: vicky | LANE NO 11 CANTT AREA 124-7 SOCITY AREA DEHRADUN",
    "gstNumber": "05AAWFG8262C1Z6",
    "DealsIn": "Medicine",
    "openingBalance": 41370.0
  },
  {
    "rowNum": 9,
    "name": "Godiva Bioadvances Pvt. Ltd.",
    "contact": 7011310912,
    "email": null,
    "address": "Contact person: jatin | B-11 BASEMENT SHALIMAR BAGH PLAZA 110088",
    "gstNumber": "07AADCG9476A1ZL",
    "DealsIn": "Medicine",
    "openingBalance": 0.0
  },
  {
    "rowNum": 10,
    "name": "Mishra Surgical",
    "contact": 8920149183,
    "email": null,
    "address": "Contact person: sachin | PART OF PROP NO 1529 SHOP BHAGIRATH PLACE CHANDNI CHOWK",
    "gstNumber": "36AAOCR2005F1ZL",
    "DealsIn": "Prp wile",
    "openingBalance": 78000.0
  },
  {
    "rowNum": 11,
    "name": "Ganapati Bio-Tech Ltd.",
    "contact": 9717108191,
    "email": "ganapatibio@yahoo.co.in",
    "address": "Contact person: Kuldeep | SHOP NO 58 GROUNF FLOOR MAIN MARKET RAJINDRA NAGAR 110060",
    "gstNumber": "07AAACG4685Q1ZY",
    "DealsIn": "Gfc",
    "openingBalance": 46875.0
  },
  {
    "rowNum": 12,
    "name": "Pharmachem Distributors",
    "contact": 9711383834,
    "email": "p.chem2010@gmail.com",
    "address": "Contact person: VISHAL | B-1244, SECOND FLOOR SHASTRI NAGAR, DELHI-110052",
    "gstNumber": "07AEHPG1096F1ZO",
    "DealsIn": "Medicine",
    "openingBalance": 0.0
  },
  {
    "rowNum": 13,
    "name": "KAPIL GFC",
    "contact": 9873000836,
    "email": null,
    "address": "Contact person: Kapil",
    "gstNumber": null,
    "DealsIn": null,
    "openingBalance": 5000.0
  },
  {
    "rowNum": 14,
    "name": "KAPIL GLUTA",
    "contact": null,
    "email": null,
    "address": null,
    "gstNumber": null,
    "DealsIn": null,
    "openingBalance": 38400.0
  },
  {
    "rowNum": 15,
    "name": "VEJOVIS MEDLINE",
    "contact": 8882443507,
    "email": "vejovismedline@gmail.com",
    "address": "Contact person: Vijendra | Y-14, DSIDC Complex Centre, Nangloi, New Delhi, West Delhi, Delhi - 110041",
    "gstNumber": "07ADOPK2205L1ZH",
    "DealsIn": "MedicineNS",
    "openingBalance": 0.0
  },
  {
    "rowNum": 16,
    "name": "Raaveetech Pharma",
    "contact": null,
    "email": null,
    "address": null,
    "gstNumber": null,
    "DealsIn": null,
    "openingBalance": 0.0
  },
  {
    "rowNum": 17,
    "name": "Medono India",
    "contact": 8178487780,
    "email": "info@medonoindia.com",
    "address": "KH. NO. 894 NEW-115, Ground Floor, Landmark Near Water Tank, Lal Dora, Village Alipur, North West Delhi, Delhi - 110036 | Alt contact: 8500008712",
    "gstNumber": "07GVSPK9534A1Z7",
    "DealsIn": "Medical Equipment",
    "openingBalance": 37255.0
  },
  {
    "rowNum": 18,
    "name": "Kusum Scientific",
    "contact": 9899229035,
    "email": "kusumscientific8285@gmail.com",
    "address": "Contact person: Pawan | Shop No. 1, street no. 10 Baprola Vihar nangli dairy near lal convent School new delhi-110043 | Alt contact: 9311718980",
    "gstNumber": "07GFTPS4086A1ZY",
    "DealsIn": "lab card",
    "openingBalance": 24276.0
  },
  {
    "rowNum": 19,
    "name": "Yurexa Wellness",
    "contact": 991195209,
    "email": "YUREXAWELLNESS@GMAIL.COM",
    "address": "Contact person: Abhisheak | KH. NO. 1/18/2/2 NND FLOOR MAIN 100 FOOTA NATHUPURA ROAD HARIJAN COLONY BURARI DELHI-110084",
    "gstNumber": "07BIKPK7383M2ZH",
    "DealsIn": "Medicine",
    "openingBalance": 0.0
  },
  {
    "rowNum": 20,
    "name": "Medica Solutions",
    "contact": 9811240444,
    "email": "medicasolutions@outlook.com",
    "address": "E-1018, Saraswati Vihar, Delhi - 110034 | Alt contact: 9625490781",
    "gstNumber": "07ABJFM6010C1ZP",
    "DealsIn": "Lab equipments",
    "openingBalance": 75.0
  },
  {
    "rowNum": 21,
    "name": "Shivoham Dermatology Private Limited",
    "contact": 7003418082,
    "email": null,
    "address": "Contact person: Akhilesh Mishra | C-16, Pamposh Enclave, New Delhi - 110048",
    "gstNumber": "07ABDCS2277E1ZE",
    "DealsIn": "Medicines",
    "openingBalance": 37100.0
  },
  {
    "rowNum": 22,
    "name": "A Square Pharmaceuticals",
    "contact": null,
    "email": null,
    "address": null,
    "gstNumber": null,
    "DealsIn": null,
    "openingBalance": 0.0
  },
  {
    "rowNum": 23,
    "name": "Minenii Corporate Services Private Limited",
    "contact": 9634462788,
    "email": "info.minenii@gmail.com",
    "address": "D23, Third Floor, Sector 59, Near Sector 59 Metro, Noida, Uttar Pradesh - 201301",
    "gstNumber": null,
    "DealsIn": "Manpower Supply",
    "openingBalance": 50700.0
  },
  {
    "rowNum": 24,
    "name": "Phmg and Associates",
    "contact": 9654123003,
    "email": "piyushm@phmgindia.com",
    "address": "Contact person: PHMG & Associates | D23, Third Floor, Sector 59, Govindham, Noida, Uttar Pradesh - 201301",
    "gstNumber": "09AALFH5375A1ZC",
    "DealsIn": "Consultancy Services",
    "openingBalance": 233200.0
  },
  {
    "rowNum": 25,
    "name": "Adequate Electro Mechinical Engineering",
    "contact": 9649922222,
    "email": null,
    "address": "Contact person: Adequate Electro Mechanical Engineering Pvt. Ltd. | G-184, Road No. 18, Akeda Dungar, RIICO Vishwakarma Industrial Area, Jaipur - 302013 | Alt contact: 9828563734",
    "gstNumber": "08AATCA5431B1ZS",
    "DealsIn": "Hospital Furniture / Medical Equipment",
    "openingBalance": 0.0
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRM_RISKY = args.includes("--confirm-contact-only-updates");
const DUMP_JSON = args.includes("--dump-json");

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

if (DUMP_JSON) {
  const out = "vendors-payload.json";
  fs.writeFileSync(out, JSON.stringify(VENDOR_ENTRIES, null, 2));
  console.log(`Wrote ${out} — ${VENDOR_ENTRIES.length} vendor(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function validate() {
  const errors = [];
  const warnings = [];
  const seenNames = new Set();
  for (const e of VENDOR_ENTRIES) {
    const where = `row ${e.rowNum} (${e.name})`;
    if (!e.name) errors.push(`${where}: vendor name is required`);
    if (seenNames.has(e.name.toLowerCase())) errors.push(`${where}: duplicate name within this sheet itself`);
    seenNames.add(e.name.toLowerCase());
    if (e.contact != null && String(e.contact).length !== 10)
      warnings.push(`${where}: contact "${e.contact}" is ${String(e.contact).length} digits, not the usual 10`);
  }
  return { errors, warnings };
}

// Normalises a vendor name for comparison: uppercase, strip punctuation, collapse whitespace.
function normWords(name) {
  return (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Word-overlap ratio against the SMALLER name's word count, so "Bhawani Drugs Distributors"
// vs "BHAWANI DRUGS" (2 of 2 words in the shorter name present) scores high even though the
// longer name has an extra word — the mismatch case (Pharmachem vs Cutisoins) shares zero
// words either way, so the threshold cleanly separates the two kinds of match seen live.
function nameSimilarity(a, b) {
  const wa = new Set(normWords(a));
  const wb = new Set(normWords(b));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

const NAME_SIMILARITY_THRESHOLD = 0.5;

// Fields that can be updated on an existing vendor. `name` is included deliberately — cleaning
// up "HELPSURE HEALTHCARE PVT LTD      " to the sheet's "Helpsure Healthcare Private Limited"
// is exactly the kind of detail-refresh being asked for, not an identity change, since the
// match already confirmed (by name-similarity or explicit confirmation) that it's the same
// vendor. Never applied to a NAME-MISMATCH match unless --confirm-contact-only-updates is set.
const UPDATABLE_FIELDS = ["name", "contact", "email", "address", "gstNumber", "DealsIn"];

// Diffs a sheet entry against an existing vendor doc. A field only counts as a change when the
// sheet has a real value AND it differs from what's stored — an entry with no email, say, never
// blanks out an existing one. Returns [] when nothing would change.
function diffFields(entry, existing) {
  const changes = [];
  for (const field of UPDATABLE_FIELDS) {
    const newVal = field === "name" ? entry.name : entry[field];
    if (newVal === undefined || newVal === null || newVal === "") continue;
    const oldVal = existing[field];
    const oldStr = oldVal == null ? "" : String(oldVal).trim();
    const newStr = String(newVal).trim();
    if (oldStr !== newStr) changes.push({ field, from: oldVal ?? null, to: newVal });
  }
  return changes;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Vendors: ${VENDOR_ENTRIES.length}`);
  console.log("=".repeat(90) + "\n");

  const { errors, warnings } = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  if (warnings.length) {
    console.log("Warnings (not blocking):");
    warnings.forEach((w) => console.log("  " + w));
    console.log("");
  }
  console.log("Validation passed.\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Vendor =
    mongoose.models.Vendor ||
    mongoose.model(
      "Vendor",
      new mongoose.Schema({}, { strict: false, collection: "vendors" }),
    );

  // ---------------------------------------------------------------------------
  // PASS 1 — classify every row: new / name-similar update / name-mismatch update. No writes.
  // ---------------------------------------------------------------------------
  console.log("Matching against existing vendors (by name or contact, same rule the create API uses)...\n");
  const toCreate = [];
  const safeUpdates = [];
  const riskyUpdates = [];
  const noChangeNeeded = [];

  for (const e of VENDOR_ENTRIES) {
    const existing = await Vendor.findOne({
      $or: [{ name: e.name }, ...(e.contact ? [{ contact: e.contact }] : [])],
    }).lean();

    if (!existing) {
      toCreate.push(e);
      continue;
    }

    const similarity = nameSimilarity(e.name, existing.name);
    const changes = diffFields(e, existing);
    const bucket = { entry: e, existing, similarity, changes };

    if (!changes.length) {
      noChangeNeeded.push(bucket);
    } else if (similarity >= NAME_SIMILARITY_THRESHOLD) {
      safeUpdates.push(bucket);
    } else {
      riskyUpdates.push(bucket);
    }
  }

  console.log(`  New vendors to create        : ${toCreate.length}`);
  console.log(`  Existing, already up to date : ${noChangeNeeded.length}`);
  console.log(`  Existing, name-similar update : ${safeUpdates.length}`);
  console.log(`  Existing, NAME-MISMATCH update: ${riskyUpdates.length}  (needs --confirm-contact-only-updates)`);

  if (toCreate.length) {
    console.log("\n--- NEW VENDORS ---");
    toCreate.forEach((e) => console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.name}`));
  }

  if (safeUpdates.length) {
    console.log("\n--- UPDATES (name-similar match — will apply automatically) ---");
    safeUpdates.forEach(({ entry, existing, similarity, changes }) => {
      console.log(`  row ${entry.rowNum}  "${entry.name}"  ->  existing "${existing.name}"  (${existing._id}, similarity ${(similarity * 100).toFixed(0)}%)`);
      changes.forEach((c) => console.log(`      ${c.field}: ${JSON.stringify(c.from)}  ->  ${JSON.stringify(c.to)}`));
    });
  }

  if (riskyUpdates.length) {
    console.log("\n" + "!".repeat(90));
    console.log("NAME-MISMATCH MATCHES — matched only by contact number, names do not correspond.");
    console.log("These are NOT applied unless you pass --confirm-contact-only-updates. Review carefully:");
    console.log("!".repeat(90));
    riskyUpdates.forEach(({ entry, existing, similarity, changes }) => {
      console.log(`\n  row ${entry.rowNum}  "${entry.name}"  ->  existing "${existing.name}"  (${existing._id}, similarity ${(similarity * 100).toFixed(0)}%)`);
      console.log(`      Matched via: contact ${entry.contact}`);
      changes.forEach((c) => console.log(`      ${c.field}: ${JSON.stringify(c.from)}  ->  ${JSON.stringify(c.to)}`));
    });
    console.log("");
  }

  if (riskyUpdates.length && APPLY && !CONFIRM_RISKY) {
    console.error("Refusing to apply the name-mismatch updates above without --confirm-contact-only-updates.");
    console.error("New vendors and name-similar updates below are unaffected by this and will still proceed.\n");
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the lists above look right.");
    await mongoose.disconnect();
    return;
  }

  // ---------------------------------------------------------------------------
  // PASS 2 — write.
  // ---------------------------------------------------------------------------
  console.log("\nCreating new vendors...");
  const created = [];
  const createFailed = [];
  for (const e of toCreate) {
    try {
      const doc = await Vendor.create({
        name: e.name,
        contact: e.contact || undefined,
        email: e.email || undefined,
        address: e.address || undefined,
        gstNumber: e.gstNumber || undefined,
        DealsIn: e.DealsIn || undefined,
        createdBy: { ...IMPORT_IDENTITY, date: new Date() },
      });
      created.push({ rowNum: e.rowNum, name: e.name, id: String(doc._id), openingBalance: e.openingBalance });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.name.padEnd(44)}  CREATED -> ${doc._id}`);
    } catch (err) {
      createFailed.push({ rowNum: e.rowNum, name: e.name, reason: err?.message || String(err) });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.name.padEnd(44)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log("\nUpdating name-similar matches...");
  const updated = [];
  const updateFailed = [];
  for (const { entry, existing, changes } of safeUpdates) {
    try {
      const setFields = {};
      changes.forEach((c) => (setFields[c.field] = c.field === "contact" ? Number(c.to) : c.to));
      await Vendor.updateOne(
        { _id: existing._id },
        {
          $set: setFields,
          $push: {
            editors: {
              name: IMPORT_IDENTITY.name,
              email: IMPORT_IDENTITY.email,
              branch: "",
              date: new Date(),
              updatedFields: changes.map((c) => ({
                name: c.field,
                previousValue: c.from == null ? "" : String(c.from),
                newValue: String(c.to),
              })),
            },
          },
        },
      );
      updated.push({ rowNum: entry.rowNum, name: entry.name, id: String(existing._id), changes });
      console.log(`  row ${String(entry.rowNum).padStart(3)}  ${entry.name.padEnd(44)}  UPDATED (${existing._id}) — ${changes.length} field(s)`);
    } catch (err) {
      updateFailed.push({ rowNum: entry.rowNum, name: entry.name, reason: err?.message || String(err) });
      console.log(`  row ${String(entry.rowNum).padStart(3)}  ${entry.name.padEnd(44)}  UPDATE FAILED: ${err?.message || err}`);
    }
  }

  let riskyApplied = [];
  if (riskyUpdates.length && CONFIRM_RISKY) {
    console.log("\n--confirm-contact-only-updates passed — applying the name-mismatch updates too...");
    for (const { entry, existing, changes } of riskyUpdates) {
      try {
        const setFields = {};
        changes.forEach((c) => (setFields[c.field] = c.field === "contact" ? Number(c.to) : c.to));
        await Vendor.updateOne(
          { _id: existing._id },
          {
            $set: setFields,
            $push: {
              editors: {
                name: IMPORT_IDENTITY.name,
                email: IMPORT_IDENTITY.email,
                branch: "",
                date: new Date(),
                updatedFields: changes.map((c) => ({
                  name: c.field,
                  previousValue: c.from == null ? "" : String(c.from),
                  newValue: String(c.to),
                })),
              },
            },
          },
        );
        riskyApplied.push({ rowNum: entry.rowNum, name: entry.name, id: String(existing._id), changes });
        console.log(`  row ${String(entry.rowNum).padStart(3)}  ${entry.name.padEnd(44)}  UPDATED (${existing._id}) — CONTACT-ONLY MATCH, CONFIRMED`);
      } catch (err) {
        updateFailed.push({ rowNum: entry.rowNum, name: entry.name, reason: err?.message || String(err) });
      }
    }
  }

  console.log(`\nCreated ${created.length}, updated ${updated.length + riskyApplied.length}` + (createFailed.length + updateFailed.length ? `, ${createFailed.length + updateFailed.length} failed` : "") + ".");
  if (riskyUpdates.length && !CONFIRM_RISKY) {
    console.log(`${riskyUpdates.length} name-mismatch row(s) were left untouched — re-run with --confirm-contact-only-updates to apply them.`);
  }

  const reportPath = `vendors-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        created,
        updated,
        riskyUpdatesApplied: riskyApplied,
        riskyUpdatesSkipped: riskyUpdates
          .filter((r) => !CONFIRM_RISKY)
          .map(({ entry, existing }) => ({ rowNum: entry.rowNum, name: entry.name, existingId: String(existing._id), existingName: existing.name })),
        createFailed,
        updateFailed,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list AND what you'll`);
  console.log("need (vendor _id per name) to build the opening-balance payables next.");

  const withOpening = created.filter((c) => c.openingBalance > 0);
  if (withOpening.length) {
    console.log(`\n${withOpening.length} newly created vendor(s) have a non-zero opening balance that is NOT yet`);
    console.log("in the CRM as a Payable — tell me how to categorise each (purpose/expenseCategory)");
    console.log("and I'll build that script next, the same way we did for the Rent opening balances.");
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
