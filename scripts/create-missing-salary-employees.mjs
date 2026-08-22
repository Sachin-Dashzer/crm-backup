// scripts/create-missing-salary-employees.mjs
//
// Creates the 107 employees emp_2.txt referenced for July 2026 salary but who don't exist
// anywhere in the Employee collection (not in emp.txt, not in emp_1.txt, not under any name
// variant employee-salary-payables-import.mjs's phone/name resolution could find).
//
// emp_2.txt only ever gave name + phone + one month's amount — never role or a full salary
// structure, so this script fills those in with explicit, visible defaults rather than
// guessing something more specific:
//   role            -> "Others" (the same catch-all role 52 of the original 91 emp.txt
//                       employees already use — the safest default when the source gives no
//                       role signal at all)
//   salaryStructure.baseSalary   -> the July 2026 amount from emp_2.txt (the only real salary
//                                   figure available for any of these 107)
//   salaryStructure.salaryType   -> "Monthly"
//   salaryStructure.effectiveFrom -> 2026-04-01 (matches every other employee's effectiveFrom
//                                    in this dataset)
//   isactive        -> false for the 26 rows tagged "(Inactive)" / "(Left)" in emp_2.txt, true
//                      for the rest — the tag is stripped from the stored name (e.g. "Aisha
//                      Parveen (Inactive)" becomes name "Aisha Parveen", isactive: false) rather
//                      than left embedded in the name text.
//
// THREE ROWS HAVE NO PHONE AT ALL (Shejad, Tanish, Naveen — emp_2.txt literally gave "Not
// found") — created with phone omitted rather than a fabricated placeholder value.
//
// If any of these defaults are wrong for a specific person (wrong role, wrong active status),
// fix it after creation the normal way (the CRM's employee edit screen, or
// scripts/employees-bulk-update.mjs with a corrected source row) — this script's job is only to
// stop blocking the salary payables from being created, not to get every field perfectly right
// on the first pass.
//
// AFTER this script runs, re-run scripts/employee-salary-payables-import.mjs — its employee
// resolution is live, so it will pick up these newly created records automatically and create
// their July 2026 SALARY payables.
//
// Usage:
//   node scripts/create-missing-salary-employees.mjs                        # dry run
//   node scripts/create-missing-salary-employees.mjs --dump-json             # write entries out, no DB
//   node scripts/create-missing-salary-employees.mjs --apply                # write

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

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — the exact 107 rows employee-salary-payables-import.mjs reported as
// "Employee not found", parsed directly from that run's own output.
// ═══════════════════════════════════════════════════════════════════════════════
const MISSING_EMPLOYEES = [
  {
    "name": "pradeep kumar",
    "phone": "9311904205",
    "julyAmount": 32448,
    "isactive": true
  },
  {
    "name": "Aisha Parveen",
    "phone": "9971915865",
    "julyAmount": 6048,
    "isactive": false
  },
  {
    "name": "Khushi Jindhad",
    "phone": "9319348554",
    "julyAmount": 15484,
    "isactive": true
  },
  {
    "name": "Himanshi",
    "phone": "9718299194",
    "julyAmount": 14516,
    "isactive": true
  },
  {
    "name": "Tulsi",
    "phone": "9217188694",
    "julyAmount": 12710,
    "isactive": true
  },
  {
    "name": "Vipin Singh",
    "phone": "7042919593",
    "julyAmount": 27581,
    "isactive": true
  },
  {
    "name": "AMIT JHA",
    "phone": "7210005148",
    "julyAmount": 41094,
    "isactive": true
  },
  {
    "name": "SACHIN KUMAR",
    "phone": "8287037611",
    "julyAmount": 40000,
    "isactive": true
  },
  {
    "name": "RAHUL VASHISHTA",
    "phone": "8766334717",
    "julyAmount": 85000,
    "isactive": true
  },
  {
    "name": "Palak Singh",
    "phone": "9643694314",
    "julyAmount": 8000,
    "isactive": true
  },
  {
    "name": "Shama Nilofar",
    "phone": "9310954658",
    "julyAmount": 10245,
    "isactive": true
  },
  {
    "name": "Annu Kumari",
    "phone": "9310019584",
    "julyAmount": 12000,
    "isactive": true
  },
  {
    "name": "Himanshi Chouhan",
    "phone": "9310517194",
    "julyAmount": 13306,
    "isactive": true
  },
  {
    "name": "Nitin Sahu",
    "phone": "9654816403",
    "julyAmount": 4613,
    "isactive": false
  },
  {
    "name": "Lavanya Thapa",
    "phone": "9266865966",
    "julyAmount": 8129,
    "isactive": true
  },
  {
    "name": "Manmeet Singh",
    "phone": "7827692262",
    "julyAmount": 12097,
    "isactive": true
  },
  {
    "name": "Ramandeep Singh",
    "phone": "9871094208",
    "julyAmount": 4613,
    "isactive": false
  },
  {
    "name": "Harsh Kumar",
    "phone": "9990647635",
    "julyAmount": 12965,
    "isactive": true
  },
  {
    "name": "Simran Kaur",
    "phone": "9818967992",
    "julyAmount": 14758,
    "isactive": true
  },
  {
    "name": "Santosh Kumar",
    "phone": "9310495297",
    "julyAmount": 226,
    "isactive": false
  },
  {
    "name": "Om Upadhyay",
    "phone": "9289458588",
    "julyAmount": 710,
    "isactive": false
  },
  {
    "name": "Muskan Verma",
    "phone": "7065774487",
    "julyAmount": 6500,
    "isactive": false
  },
  {
    "name": "Harshita Sharma",
    "phone": "8287282774",
    "julyAmount": 13000,
    "isactive": true
  },
  {
    "name": "Kiran Sharma",
    "phone": "8750116723",
    "julyAmount": 10742,
    "isactive": true
  },
  {
    "name": "Bindu Kumari",
    "phone": "8287116552",
    "julyAmount": 12500,
    "isactive": true
  },
  {
    "name": "Sudhanshu Sharma",
    "phone": "9558054826",
    "julyAmount": 15000,
    "isactive": true
  },
  {
    "name": "Babita Negi",
    "phone": "9999224629",
    "julyAmount": 10065,
    "isactive": true
  },
  {
    "name": "Sneha Yadav",
    "phone": "7303360478",
    "julyAmount": 9645,
    "isactive": true
  },
  {
    "name": "Payal Sharma",
    "phone": "8059642660",
    "julyAmount": 1258,
    "isactive": false
  },
  {
    "name": "Priya Sharma",
    "phone": "9625224560",
    "julyAmount": 6387,
    "isactive": false
  },
  {
    "name": "Gautam Pawar",
    "phone": "9097461326",
    "julyAmount": 11000,
    "isactive": true
  },
  {
    "name": "Surbhi Joshi",
    "phone": "9968629888",
    "julyAmount": 2177,
    "isactive": false
  },
  {
    "name": "Arti Salal",
    "phone": "7078647252",
    "julyAmount": 8029,
    "isactive": false
  },
  {
    "name": "Urvashi",
    "phone": "9582958796",
    "julyAmount": 7548,
    "isactive": true
  },
  {
    "name": "Lalbabu Kumar",
    "phone": "9667281607",
    "julyAmount": 15000,
    "isactive": true
  },
  {
    "name": "Priya Kumari",
    "phone": "7678530427",
    "julyAmount": 14700,
    "isactive": true
  },
  {
    "name": "Hasad",
    "phone": "7982854287",
    "julyAmount": 11013,
    "isactive": true
  },
  {
    "name": "Nitish Yadav",
    "phone": "8882534458",
    "julyAmount": 13500,
    "isactive": true
  },
  {
    "name": "Vansh Kumar",
    "phone": "9718688350",
    "julyAmount": 9965,
    "isactive": true
  },
  {
    "name": "Nisha Rajput",
    "phone": "8287377747",
    "julyAmount": 8887,
    "isactive": true
  },
  {
    "name": "Faiz",
    "phone": "8057928785",
    "julyAmount": 13000,
    "isactive": true
  },
  {
    "name": "Khushi Goswami",
    "phone": "9873885016",
    "julyAmount": 7863,
    "isactive": false
  },
  {
    "name": "Himanshi Rawat",
    "phone": "8882929649",
    "julyAmount": 9816,
    "isactive": false
  },
  {
    "name": "Komal Lodhi",
    "phone": "6391263383",
    "julyAmount": 11742,
    "isactive": true
  },
  {
    "name": "Bhoomi Kumari Chaurasia",
    "phone": "8777385568",
    "julyAmount": 9677,
    "isactive": true
  },
  {
    "name": "Ashu Kumar",
    "phone": "7703900134",
    "julyAmount": 7839,
    "isactive": true
  },
  {
    "name": "Shubhangi",
    "phone": "8076577693",
    "julyAmount": 9879,
    "isactive": true
  },
  {
    "name": "Sakshi Saroj",
    "phone": "9289121830",
    "julyAmount": 10368,
    "isactive": true
  },
  {
    "name": "Anjali Rana",
    "phone": "9013350101",
    "julyAmount": 3919,
    "isactive": false
  },
  {
    "name": "Chandan Riswal",
    "phone": "9953777962",
    "julyAmount": 9016,
    "isactive": false
  },
  {
    "name": "Sandhya Maurya",
    "phone": "9076757393",
    "julyAmount": 14000,
    "isactive": true
  },
  {
    "name": "Ashwani",
    "phone": "9319400367",
    "julyAmount": 11742,
    "isactive": false
  },
  {
    "name": "Md Ayan",
    "phone": "8810517020",
    "julyAmount": 12865,
    "isactive": true
  },
  {
    "name": "Amit",
    "phone": "8595964518",
    "julyAmount": 194,
    "isactive": false
  },
  {
    "name": "Ankit Pratap",
    "phone": "8376020072",
    "julyAmount": 9290,
    "isactive": false
  },
  {
    "name": "Deepak",
    "phone": "9818810898",
    "julyAmount": 17900,
    "isactive": true
  },
  {
    "name": "Roli Rajbhar",
    "phone": "8285321925",
    "julyAmount": 9852,
    "isactive": false
  },
  {
    "name": "Cutee",
    "phone": "9312318575",
    "julyAmount": 8516,
    "isactive": false
  },
  {
    "name": "Gopal Parasar",
    "phone": "8076044470",
    "julyAmount": 1290,
    "isactive": false
  },
  {
    "name": "Jayant Kumar",
    "phone": "8448153149",
    "julyAmount": 1806,
    "isactive": true
  },
  {
    "name": "Vishal Kumar",
    "phone": "7632977168",
    "julyAmount": 13097,
    "isactive": true
  },
  {
    "name": "Neha Mandal",
    "phone": "9315532616",
    "julyAmount": 2516,
    "isactive": false
  },
  {
    "name": "Ishant",
    "phone": "8851341252",
    "julyAmount": 1306,
    "isactive": false
  },
  {
    "name": "Annu Verma",
    "phone": "7827562612",
    "julyAmount": 3024,
    "isactive": false
  },
  {
    "name": "Santoshi Kumari",
    "phone": "9354973704",
    "julyAmount": 11806,
    "isactive": true
  },
  {
    "name": "Manisha",
    "phone": "9811547639",
    "julyAmount": 13065,
    "isactive": true
  },
  {
    "name": "Anuj",
    "phone": "7835851136",
    "julyAmount": 12481,
    "isactive": true
  },
  {
    "name": "Prachi",
    "phone": "8595957402",
    "julyAmount": 13065,
    "isactive": true
  },
  {
    "name": "Ishank Goel",
    "phone": "7217663865",
    "julyAmount": 3355,
    "isactive": false
  },
  {
    "name": "Ashish Sharma",
    "phone": "9667441983",
    "julyAmount": 6500,
    "isactive": false
  },
  {
    "name": "Nisha Koli",
    "phone": "9354955331",
    "julyAmount": 9677,
    "isactive": true
  },
  {
    "name": "Abhishek",
    "phone": "9634938655",
    "julyAmount": 10903,
    "isactive": true
  },
  {
    "name": "Manisha Negi",
    "phone": "9643296140",
    "julyAmount": 21935,
    "isactive": true
  },
  {
    "name": "Nikita",
    "phone": "8447565683",
    "julyAmount": 968,
    "isactive": true
  },
  {
    "name": "SANJAY Kumar(old)",
    "phone": "7838010543",
    "julyAmount": 70000,
    "isactive": true
  },
  {
    "name": "Pushkar Chaudhary",
    "phone": "9870581915",
    "julyAmount": 16258,
    "isactive": true
  },
  {
    "name": "Mansi Rai",
    "phone": "8826310277",
    "julyAmount": 15484,
    "isactive": true
  },
  {
    "name": "Khushman Kumar",
    "phone": "9988309081",
    "julyAmount": 9355,
    "isactive": true
  },
  {
    "name": "Dr Ashi Gautam",
    "phone": "7985464228",
    "julyAmount": 548,
    "isactive": true
  },
  {
    "name": "Samad Saifi",
    "phone": "7457880023",
    "julyAmount": 16839,
    "isactive": true
  },
  {
    "name": "Dr Sumedha Sagar",
    "phone": "9818970672",
    "julyAmount": 10645,
    "isactive": true
  },
  {
    "name": "dinesh",
    "phone": "9821756097",
    "julyAmount": 15000,
    "isactive": true
  },
  {
    "name": "Mukesh Kushwaha",
    "phone": "7409698060",
    "julyAmount": 7742,
    "isactive": true
  },
  {
    "name": "Salman Toto",
    "phone": "9315173962",
    "julyAmount": 14516,
    "isactive": true
  },
  {
    "name": "Sonali Kumari",
    "phone": "9304113956",
    "julyAmount": 10645,
    "isactive": true
  },
  {
    "name": "Mukund Kumar",
    "phone": "9264273988",
    "julyAmount": 16839,
    "isactive": true
  },
  {
    "name": "Yogesh",
    "phone": "9716112267",
    "julyAmount": 11613,
    "isactive": true
  },
  {
    "name": "PAWAN SHARMA",
    "phone": "7390975405",
    "julyAmount": 34400,
    "isactive": true
  },
  {
    "name": "Adarsh Mathur",
    "phone": "7557291195",
    "julyAmount": 13000,
    "isactive": true
  },
  {
    "name": "Jasleen Kaur",
    "phone": "8076099390",
    "julyAmount": 14758,
    "isactive": true
  },
  {
    "name": "Purnima Singh",
    "phone": "8700103928",
    "julyAmount": 4968,
    "isactive": true
  },
  {
    "name": "Manmeet Kaur",
    "phone": "8076668999",
    "julyAmount": 18000,
    "isactive": true
  },
  {
    "name": "Jyoti",
    "phone": "8572025304",
    "julyAmount": 12000,
    "isactive": true
  },
  {
    "name": "Aditi",
    "phone": "8168849419",
    "julyAmount": 12419,
    "isactive": false
  },
  {
    "name": "Balaji Kumar",
    "phone": "9650084920",
    "julyAmount": 2323,
    "isactive": true
  },
  {
    "name": "Vaishnavi Yadav",
    "phone": "7037219200",
    "julyAmount": 8000,
    "isactive": true
  },
  {
    "name": "Rishabh Sonker",
    "phone": "7054049997",
    "julyAmount": 15000,
    "isactive": true
  },
  {
    "name": "Dr Ishika Jain",
    "phone": "9953625180",
    "julyAmount": 25000,
    "isactive": true
  },
  {
    "name": "Preeti gyadi",
    "phone": "8787832352",
    "julyAmount": 15500,
    "isactive": true
  },
  {
    "name": "AJAY BHATIYA",
    "phone": "9211913109",
    "julyAmount": 12000,
    "isactive": true
  },
  {
    "name": "Preeti Ajney",
    "phone": "7780498940",
    "julyAmount": 18000,
    "isactive": true
  },
  {
    "name": "Shejad",
    "phone": null,
    "julyAmount": 17500,
    "isactive": true
  },
  {
    "name": "karan",
    "phone": "8178939088",
    "julyAmount": 9000,
    "isactive": true
  },
  {
    "name": "Anita",
    "phone": "8976192344",
    "julyAmount": 6500,
    "isactive": true
  },
  {
    "name": "Tanish",
    "phone": null,
    "julyAmount": 1200,
    "isactive": true
  },
  {
    "name": "Monika",
    "phone": "8700475374",
    "julyAmount": 30000,
    "isactive": true
  },
  {
    "name": "Naveen",
    "phone": null,
    "julyAmount": 5600,
    "isactive": true
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DUMP_JSON = args.includes("--dump-json");

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

if (DUMP_JSON) {
  const out = "missing-employees-payload.json";
  fs.writeFileSync(out, JSON.stringify(MISSING_EMPLOYEES, null, 2));
  console.log(`Wrote ${out} — ${MISSING_EMPLOYEES.length} employee(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Employees: ${MISSING_EMPLOYEES.length}`);
  console.log("=".repeat(90) + "\n");

  const inactiveCount = MISSING_EMPLOYEES.filter((e) => !e.isactive).length;
  const noPhoneCount = MISSING_EMPLOYEES.filter((e) => !e.phone).length;
  const total = MISSING_EMPLOYEES.reduce((s, e) => s + e.julyAmount, 0);
  console.log(`  All created with role "Others", salaryType "Monthly", effectiveFrom 2026-04-01`);
  console.log(`  Inactive/Left (isactive: false): ${inactiveCount}`);
  console.log(`  No phone on file: ${noPhoneCount}  (${MISSING_EMPLOYEES.filter((e) => !e.phone).map((e) => e.name).join(", ")})`);
  console.log(`  Sum of baseSalary across all: ${inr(total)}\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee =
    mongoose.models.Employee ||
    mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));

  console.log("Checking for existing employees (by phone, or by exact name when no phone)...");
  const dupes = [];
  for (const e of MISSING_EMPLOYEES) {
    const existing = e.phone
      ? await Employee.findOne({ phone: e.phone }).select("_id name phone").lean()
      : await Employee.findOne({ name: new RegExp(`^\\s*${e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i") }).select("_id name phone").lean();
    if (existing) dupes.push({ name: e.name, existingId: String(existing._id), existingName: existing.name });
  }

  if (dupes.length) {
    console.log(`\nWARNING — ${dupes.length} already exist (skipped, not re-created):`);
    dupes.forEach((d) => console.log(`  "${d.name}" -> already exists as "${d.existingName}" (${d.existingId})`));
  } else {
    console.log("No existing matches found — all 107 are genuinely new.\n");
  }

  console.log("\n--- ROWS ---");
  MISSING_EMPLOYEES.forEach((e) =>
    console.log(`  ${e.name.padEnd(30)} ${(e.phone || "(no phone)").padEnd(12)} ${inr(e.julyAmount).padStart(10)}  ${e.isactive ? "" : "[INACTIVE]"}`),
  );

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once this looks right.");
    await mongoose.disconnect();
    return;
  }

  const dupeSet = new Set(dupes.map((d) => d.name));
  console.log("\nCreating employees...");
  const created = [];
  const failed = [];
  const skipped = [];

  for (const e of MISSING_EMPLOYEES) {
    if (dupeSet.has(e.name)) {
      skipped.push(e.name);
      continue;
    }
    try {
      const doc = await Employee.create({
        name: e.name,
        phone: e.phone || undefined,
        role: "Others",
        isactive: e.isactive,
        salaryStructure: {
          baseSalary: e.julyAmount,
          salaryType: "Monthly",
          effectiveFrom: new Date("2026-04-01"),
        },
        incentiveRate: 0,
        createdBy: { ...IMPORT_IDENTITY, date: new Date() },
      });
      created.push({ name: e.name, id: String(doc._id), julyAmount: e.julyAmount });
      console.log(`  ${e.name.padEnd(30)} ${(e.phone || "(no phone)").padEnd(12)}  OK  -> ${doc._id}`);
    } catch (err) {
      failed.push({ name: e.name, reason: err?.message || String(err) });
      console.log(`  ${e.name.padEnd(30)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nCreated ${created.length} employee(s).`);
  if (skipped.length) console.log(`Skipped ${skipped.length} already-existing.`);
  if (failed.length) {
    console.log(`\n${failed.length} row(s) failed:`);
    failed.forEach((f) => console.log(`  ${f.name}: ${f.reason}`));
  }

  const reportPath = `missing-employees-create-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ created, skipped, failed }, null, 2));
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);

  if (created.length) {
    console.log("\nNext: re-run scripts/employee-salary-payables-import.mjs — it will now resolve");
    console.log(`these ${created.length} newly created employee(s) and create their July 2026 SALARY payables.`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
