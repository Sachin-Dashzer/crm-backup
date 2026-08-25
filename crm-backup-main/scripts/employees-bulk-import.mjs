// scripts/employees-bulk-import.mjs
//
// Bulk-imports 91 employee records from emp.txt into the Employee collection. Matches the
// model exactly (src/models/Employee.js): name, phone, email, role, isactive, salaryStructure
// {baseSalary, salaryType, effectiveFrom}, incentiveRate. All 91 rows validated clean before
// being embedded here — every role is a valid enum value, no blank phones, no phone repeated
// within the source file itself.
//
// NO DUPLICATE GUARD EXISTS in src/app/api/employees/create/route.js — it does a bare
// `new Employee({...}).save()` with no check at all, so re-running the real create form twice
// would happily create two identical employees. This script adds its own guard, matching by
// `phone` (the closest thing to a real identifier here — names have no enforced uniqueness and
// several are common first names only, e.g. "Nandni", "Arjun"): a row whose phone already
// exists in the database is skipped and reported, never duplicated.
//
// Usage:
//   node scripts/employees-bulk-import.mjs                        # dry run
//   node scripts/employees-bulk-import.mjs --dump-json             # write entries out, no DB
//   node scripts/employees-bulk-import.mjs --apply                # write

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

const VALID_ROLES = ["Agent", "Counsellor", "Doctor", "Technician", "Implanter", "Others", "Hr"];

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — parsed directly from emp.txt (one JSON object per line, trailing commas
// stripped), not hand-transcribed.
// ═══════════════════════════════════════════════════════════════════════════════
const EMPLOYEES = [
  {
    "name": "KAVITA BORA",
    "phone": "9582812921",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aman Patwal",
    "phone": "9711180932",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nandni",
    "phone": "8882861940",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Arjun",
    "phone": "9311636824",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Farhin Gul",
    "phone": "8920218078",
    "email": "",
    "role": "Hr",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Naziya",
    "phone": "6397841469",
    "email": "",
    "role": "Hr",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Shubham Chitransh",
    "phone": "7766839176",
    "email": "",
    "role": "Hr",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SOYAL",
    "phone": "9650233754",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 16000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ASFIYA TAJANNUM",
    "phone": "9535083320",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "AYDEN CARL",
    "phone": "8956254785",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Afnan Pasha",
    "phone": "9113997622",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Anuruddh pratap patel",
    "phone": "7489056299",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 16500.06,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhumi Shresth",
    "phone": "8920560350",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dayashankar",
    "phone": "6395614128",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dhruv Nirmal",
    "phone": "6230331340",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr Ede Akhila",
    "phone": "8121835968",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr Raunak Prasonna",
    "phone": "6206144557",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr Rithika Shaw",
    "phone": "8697444936",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Hangama Sayedy",
    "phone": "9821017296",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 22000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ibrahim",
    "phone": "8368892176",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Jassica",
    "phone": "8860257729",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "KURSAT",
    "phone": "8447971104",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Khuwish",
    "phone": "9891176694",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 10000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Madan",
    "phone": "9588835502",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Marzia Halim",
    "phone": "9625521850",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mohammad Nadeem",
    "phone": "8318789737",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NITIN",
    "phone": "9958488965",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "PRATEEK",
    "phone": "7011630210",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pramod",
    "phone": "7409469982",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 10000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Priyanka Shaw",
    "phone": "9565794503",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rashida Langary",
    "phone": "8373986054",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 23000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sahil Jatav",
    "phone": "9315814985",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sant Vijiy",
    "phone": "9990622469",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sayed Noman",
    "phone": "9599259259",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Shagufi",
    "phone": "7827448876",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sharifa Haqbin",
    "phone": "8287753169",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Vineeta",
    "phone": "7011313765",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Vipul Rao",
    "phone": "8059944730",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Yalda Yousoufi",
    "phone": "9911484498",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Zohra Halim",
    "phone": "9899815339",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aashtha",
    "phone": "8976026105",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NASHRA SHAIKH",
    "phone": "9137085071",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "misbah shaikh",
    "phone": "9029780869",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ANISH CHAUHAN",
    "phone": "8851050270",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "MD Shajad",
    "phone": "7093779384",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aliya shaikh",
    "phone": "9167225573",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "BHOOMIKA",
    "phone": "9137654811",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "KISHMI",
    "phone": "8730812312",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "MOHD FAIZAN",
    "phone": "9076266381",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NOVEL SHYAM SONE",
    "phone": "8104468949",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rajina Tamang",
    "phone": "9593892598",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "VAISHNAVI JAISWAL",
    "phone": "9930568483",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "pushpa",
    "phone": "6303130904",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ABDUL",
    "phone": "7235029269",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SHABBIR",
    "phone": "9653016703",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ALVIRA SHAIKH",
    "phone": "9136140356",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "IRAM SAYYED",
    "phone": "7977122191",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mamatha Chawan",
    "phone": "9989497410",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 22000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "divya rajbhar",
    "phone": "9792726566",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "sania shaikh",
    "phone": "9137084832",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "sheela",
    "phone": "8830236593",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aadil",
    "phone": "8700831937",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhoomika Mehta",
    "phone": "9717067547",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Chandani",
    "phone": "8882871446",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Farha",
    "phone": "9873533636",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Harsha",
    "phone": "7982325787",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Hemant",
    "phone": "7011838711",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Isha Chandel",
    "phone": "9717892623",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kartik Kaushal",
    "phone": "9311079177",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kashish Waris",
    "phone": "8851498657",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kirti",
    "phone": "8130953354",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Krishna",
    "phone": "9718327207",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Lakshman",
    "phone": "9311218921",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 16000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Leeza",
    "phone": "8178091651",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Lovely",
    "phone": "8766268660",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mohd Kaif",
    "phone": "8700495134",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nancy Pateriaya",
    "phone": "7580992054",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Prabhjot",
    "phone": "7835904952",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Praveen",
    "phone": "9958331811",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Priyanka",
    "phone": "9650496758",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rashi",
    "phone": "8448747204",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rukhsar",
    "phone": "8860733585",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sakshi Bhardwaj",
    "phone": "8796651068",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sufiyan",
    "phone": "7037170762",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 17000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sushant Choudhary",
    "phone": "8287443498",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 130000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tannu",
    "phone": "9821920433",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tannushri",
    "phone": "8285520882",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Varsha",
    "phone": "9625869227",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Vidit",
    "phone": "9999154046",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Akshay",
    "phone": "7620872364",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SYED SAJID",
    "phone": "9851472586",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DUMP_JSON = args.includes("--dump-json");

if (DUMP_JSON) {
  const out = "employees-payload.json";
  fs.writeFileSync(out, JSON.stringify(EMPLOYEES, null, 2));
  console.log(`Wrote ${out} — ${EMPLOYEES.length} employee(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function validate() {
  const errors = [];
  const seenPhones = new Set();
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    const where = `row ${i + 1} (${e.name})`;
    if (!e.name) errors.push(`${where}: name is required`);
    if (!e.phone) errors.push(`${where}: phone is required`);
    if (!VALID_ROLES.includes(e.role)) errors.push(`${where}: invalid role "${e.role}"`);
    if (seenPhones.has(e.phone)) errors.push(`${where}: phone ${e.phone} repeated within this file`);
    seenPhones.add(e.phone);
  }
  return errors;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Employees: ${EMPLOYEES.length}`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed — every role is valid, every phone present and unique in the file.\n");

  const byRole = {};
  EMPLOYEES.forEach((e) => (byRole[e.role] = (byRole[e.role] || 0) + 1));
  console.log("--- BY ROLE ---");
  Object.entries(byRole).sort().forEach(([role, count]) => console.log(`  ${role.padEnd(12)} ${count}`));
  console.log("");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee =
    mongoose.models.Employee ||
    mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));

  console.log("Checking for existing employees by phone...");
  const dupes = [];
  for (const e of EMPLOYEES) {
    const existing = await Employee.findOne({ phone: e.phone }).select("_id name phone").lean();
    if (existing) dupes.push({ name: e.name, phone: e.phone, existingId: String(existing._id), existingName: existing.name });
  }

  if (dupes.length) {
    console.log(`\nWARNING — ${dupes.length} employee(s) already exist with this phone number (skipped):`);
    dupes.forEach((d) => console.log(`  "${d.name}" (${d.phone}) -> already exists as "${d.existingName}" (${d.existingId})`));
  } else {
    console.log("No existing employees matched.\n");
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the list above looks right.");
    await mongoose.disconnect();
    return;
  }

  const dupeSet = new Set(dupes.map((d) => d.phone));
  console.log("\nCreating employees...");
  const created = [];
  const failed = [];
  const skipped = [];

  for (const e of EMPLOYEES) {
    if (dupeSet.has(e.phone)) {
      skipped.push(e.name);
      continue;
    }
    try {
      const doc = await Employee.create({
        name: e.name,
        phone: e.phone,
        email: e.email || undefined,
        role: e.role,
        isactive: e.isactive,
        salaryStructure: {
          baseSalary: e.salaryStructure.baseSalary,
          salaryType: e.salaryStructure.salaryType,
          effectiveFrom: new Date(e.salaryStructure.effectiveFrom),
        },
        incentiveRate: e.incentiveRate,
      });
      created.push({ name: e.name, phone: e.phone, id: String(doc._id) });
      console.log(`  ${e.name.padEnd(30)} ${e.phone}  OK  -> ${doc._id}`);
    } catch (err) {
      failed.push({ name: e.name, phone: e.phone, reason: err?.message || String(err) });
      console.log(`  ${e.name.padEnd(30)} ${e.phone}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nCreated ${created.length} employee(s).`);
  if (skipped.length) console.log(`Skipped ${skipped.length} already-existing: ${skipped.join(", ")}`);
  if (failed.length) {
    console.log(`\n${failed.length} row(s) failed:`);
    failed.forEach((f) => console.log(`  ${f.name}: ${f.reason}`));
  }

  const reportPath = `employees-import-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ created, skipped, failed }, null, 2));
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
