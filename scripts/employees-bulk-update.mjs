// scripts/employees-bulk-update.mjs
//
// Updates 263 EXISTING employee records from emp_1.txt — matched by phone against the live
// Employee collection, diffed field-by-field, only changed fields written. This is deliberately
// an UPDATE-ONLY script: a row with no matching existing employee is reported and skipped, never
// created (that's scripts/employees-bulk-import.mjs's job, for genuinely new hires — this file
// and that one share zero phone numbers, confirmed while preparing this script, so they're not
// duplicating each other's work).
//
// THE SOURCE FILE HAS REAL DATA-QUALITY ISSUES, surfaced rather than silently resolved:
//
//   - Six phone numbers appear TWICE within this file, for what look like the same person
//     entered twice with a spelling/punctuation variant ("Dr, Ashalata Roy" / "Dr. Ashalata
//     Roy", "SUNIL BHAIRWA" / "SUNIL KUMAR BAIRWA") — harmless, the second occurrence's values
//     simply overwrite the first's, since rows are applied in file order. Two of the six pairs
//     are NOT harmless — "MOHIT SHAH" appears with role "Others" then role "Implanter", and
//     "Sheetal" appears with role "Technician" then "Implanter" for the same phone: a genuine
//     conflict, not a typo. Both are still applied in file order (last wins) but printed
//     explicitly in every run so this is never a silent surprise.
//   - One phone number, 1111111111, is an obvious placeholder (all one digit) shared by two
//     completely different names ("Rahul" and "Yakshi") — this is NEVER used to match an
//     existing employee automatically. Matching on it could just as easily land on some other,
//     unrelated employee already sitting in the database under that same placeholder number.
//     Skipped by default; --confirm-placeholder-phone opts in, and even then the usual
//     name-similarity check below still has to pass.
//   - One row ("Anjali Mathur") has a BLANK phone — cannot be matched at all, skipped and
//     reported; there is nothing else in this schema to match on.
//
// MATCHING SAFEGUARD (same approach as scripts/vendors-bulk-import.mjs, because it already
// proved itself catching a real false match there): matching by phone alone isn't matching by
// identity — two different real people can share a phone by data-entry accident. Every phone
// match is scored by name-similarity (word overlap, case/punctuation-insensitive) against the
// existing employee's stored name. >=50% overlap updates automatically; anything lower is a
// NAME-MISMATCH and requires --confirm-contact-only-updates, printed under its own banner every
// run so a genuine collision (right phone, wrong person) is never applied unreviewed.
//
// Usage:
//   node scripts/employees-bulk-update.mjs                                    # dry run
//   node scripts/employees-bulk-update.mjs --dump-json                         # write entries out, no DB
//   node scripts/employees-bulk-update.mjs --apply                            # write (safe updates only)
//   node scripts/employees-bulk-update.mjs --apply --confirm-contact-only-updates
//   node scripts/employees-bulk-update.mjs --apply --confirm-placeholder-phone

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
// THE DATA — parsed directly from emp_1.txt (one JSON object per line, trailing commas
// stripped), not hand-transcribed.
// ═══════════════════════════════════════════════════════════════════════════════
const EMPLOYEES = [
  {
    "name": "(Gudiya)Anjali",
    "phone": "9310767886",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 17700,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "AMAAN MIRZA",
    "phone": "9810334104",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "AMIT KUMAR",
    "phone": "6283884492",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 30000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ANAS SAIFI",
    "phone": "9667523078",
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
    "name": "ANKIT",
    "phone": "9310136418",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ANKUR KHUSHWAHA",
    "phone": "8527596280",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 30000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ARCHANA",
    "phone": "8076350538",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ARMAN MALIK",
    "phone": "7982653957",
    "email": "armanmalik653957@gmail.com",
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
    "name": "ARTI",
    "phone": "9958741086",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "AVINASH PRAJAPATI",
    "phone": "9026706272",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aachal Chaturvedi",
    "phone": "8448306374",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aachal Kanaujiya",
    "phone": "8423674383",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 11000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aachal Panchal",
    "phone": "9211246549",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aakash Sharma",
    "phone": "9818732337",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aalim",
    "phone": "8920086967",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aarti Thakur",
    "phone": "9220586763",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aarti sharma",
    "phone": "7065727692",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Abhijeet Kumar Mandal",
    "phone": "8527691963",
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
    "name": "Abhilasha",
    "phone": "8303047886",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Abhishek Abhua",
    "phone": "8810404741",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aditya Maurya",
    "phone": "9711581421",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aisha Khan",
    "phone": "7428922270",
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
    "name": "Akansha",
    "phone": "9560304922",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Akansha S",
    "phone": "7011345996",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Akash",
    "phone": "9582018065",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Alisha",
    "phone": "8527753871",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Amar Shinde",
    "phone": "9503806069",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Anam",
    "phone": "7042124866",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Anjali",
    "phone": "9821737758",
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
    "name": "Anjali Gupta",
    "phone": "9021496519",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Anjali Mathur",
    "phone": "",
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
    "name": "Anjali Sharma",
    "phone": "9354003546",
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
    "name": "Anjali singh",
    "phone": "7303878190",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Anju",
    "phone": "9354506934",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Arvind Vishwakarma",
    "phone": "7065653356",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Aryan",
    "phone": "7703854864",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ashish Kumar",
    "phone": "7011287734",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ashu",
    "phone": "7838699102",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 30000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ayesha",
    "phone": "9971915864",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ayush srivastav",
    "phone": "8595382355",
    "email": "gz827275@gmail.com",
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
    "name": "Ayushi",
    "phone": "9217453055",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Babita",
    "phone": "8933064653",
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
    "name": "Beauty Chodhery",
    "phone": "9717674612",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhagwan Jii Mandal",
    "phone": "7070441788",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bharat Goswami",
    "phone": "8527193995",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 100000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhavey Singh Rana",
    "phone": "9266821609",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhavishay Sharma",
    "phone": "7836866524",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhavishay sharma",
    "phone": "9643897813",
    "email": "bhavishaysharma27@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhawana",
    "phone": "8198971158",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Bhawna Tyagi",
    "phone": "9643921282",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "CHANDAN KUMAR",
    "phone": "9334059199",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "CHETNA",
    "phone": "8287867897",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Chanchal",
    "phone": "9643853913",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "DEEPAK KUSHWAHA",
    "phone": "9958741077",
    "email": "",
    "role": "Technician",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "DR PARNAV",
    "phone": "8368912370",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 90000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "DR SURAKSHA POOJARY",
    "phone": "7718008212",
    "email": "",
    "role": "Doctor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "DURGESH GUPTA",
    "phone": "9289147963",
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
    "name": "Deshraj Kumar Bairwa",
    "phone": "9660544875",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Devraj",
    "phone": "9953365762",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dharmendra Tiwari",
    "phone": "7738749683",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dinesh Kumar",
    "phone": "8809139030",
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
    "name": "Disha",
    "phone": "8375851336",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Diya",
    "phone": "9643599516",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr Ishika",
    "phone": "2121212121",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr Tanya Arora",
    "phone": "8368021354",
    "email": "",
    "role": "Doctor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr, Ashalata Roy",
    "phone": "9971125678",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 60000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr. Ashalata Roy",
    "phone": "9971125678",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 60000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr. Pranendra Singh",
    "phone": "8923964333",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 130000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Dr.Mansi Bajpai",
    "phone": "8755211994",
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
    "name": "EKTA",
    "phone": "9910534023",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Farheen Ansari",
    "phone": "7056457004",
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
    "name": "GOURI SAGAR",
    "phone": "9266571543",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "GUDIYA",
    "phone": "9582273771",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 17000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "GUNJAN",
    "phone": "9818697541",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "HIMANSHU KUMAR",
    "phone": "9958741110",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Harshada Rakh",
    "phone": "9356333964",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Harshita Rai",
    "phone": "7827516971",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Harsshita Sabarwal",
    "phone": "9625220513",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Himanshi Kaushik",
    "phone": "8882750475",
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
    "name": "Himanshi Ravi",
    "phone": "8109289175",
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
    "name": "Himanshu Verma",
    "phone": "9212131233",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Hr Anamta",
    "phone": "9643929618",
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
    "name": "Hr Muskan",
    "phone": "9667970342",
    "email": "",
    "role": "Hr",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Hr Priya",
    "phone": "9217974938",
    "email": "",
    "role": "Hr",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Hr Simran Kaur",
    "phone": "7290864105",
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
    "name": "Hr Tulsi",
    "phone": "9355906648",
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
    "name": "JAHANA",
    "phone": "9199329315",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "JATIN",
    "phone": "8700130897",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 18000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "JATIN Jarwal",
    "phone": "9216203543",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "JYOTI Kumari",
    "phone": "9355658634",
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
    "name": "Janvi Gupta",
    "phone": "9958530105",
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
    "name": "Janvi afterservice",
    "phone": "8376849263",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Jashan",
    "phone": "8908550003",
    "email": "",
    "role": "Technician",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Jatin",
    "phone": "9654858988",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Jyoti Gautam",
    "phone": "9289415086",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kamal Bairwa",
    "phone": "8058892785",
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
    "name": "Kanika",
    "phone": "8882388207",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kavaljeet Kaur",
    "phone": "8742958182",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Khushboo",
    "phone": "8742914820",
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
    "name": "Khushbu Mathur",
    "phone": "9318481377",
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
    "name": "Khushi Afterservice",
    "phone": "9643230280",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kiran",
    "phone": "9873343501",
    "email": "",
    "role": "Others",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 16000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kiran",
    "phone": "9355170578",
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
    "name": "Komal Thakur",
    "phone": "9582588988",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Kumkum Rajput",
    "phone": "9718587101",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Laiba",
    "phone": "9643197719",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Lata",
    "phone": "7290824383",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Lavanaya Thapa",
    "phone": "9540035067",
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
    "name": "Lucky Tanwar",
    "phone": "7217767823",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "MANISHA GADEKAR",
    "phone": "9930100351",
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
    "name": "MOHIT SHAH",
    "phone": "9958741089",
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
    "name": "MOHIT SHAH",
    "phone": "9958741089",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "MUKUL TYAGI",
    "phone": "7838507297",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "MUMTAJ",
    "phone": "9667436799",
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
    "name": "MUSKAN KARAR (MANNU)",
    "phone": "9958741095",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Manisha Kumari",
    "phone": "8287178328",
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
    "name": "Manmohan Bairwa",
    "phone": "7877279502",
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
    "name": "Mannat Singh",
    "phone": "9217827351",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mansi Gupta",
    "phone": "9899910359",
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
    "name": "Md Sarfaraz",
    "phone": "9625670667",
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
    "name": "Meenu",
    "phone": "9667901689",
    "email": "aishathakur997@gmail.com",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mehak Bansal",
    "phone": "9289581506",
    "email": "m19220609@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mehzabi",
    "phone": "7048914773",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mohit",
    "phone": "9560130321",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Mushkan Sharma - External",
    "phone": "8527541877",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NARENDRA",
    "phone": "8851212224",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 85000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NISHANT KUSHWAHA",
    "phone": "8171385980",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 85000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "NITESH ( NIKKI)",
    "phone": "9205069771",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nandani",
    "phone": "9643038211",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nargish",
    "phone": "8527544328",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Neha",
    "phone": "8595096127",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Neha",
    "phone": "9711968178",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nikhil arora",
    "phone": "7835858826",
    "email": "nikhilarora98258@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nikita Nikki",
    "phone": "8750887588",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nikita Yadav",
    "phone": "9821574518",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 20000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nilesh",
    "phone": "9756722934",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 70000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nisha (Rajiya)",
    "phone": "8287608586",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nisha Mahor",
    "phone": "8383903389",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nishi Afterservice",
    "phone": "9355906593",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Nitesh",
    "phone": "9990018137",
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
    "name": "Nitika",
    "phone": "7827900974",
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
    "name": "Other",
    "phone": "9953647902",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "PANKAJ",
    "phone": "8958449464",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 90000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "PAYAL",
    "phone": "9958741104",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "POOJA",
    "phone": "9205091244",
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
    "name": "PRACHI JADHAV",
    "phone": "9082671652",
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
    "name": "PRAKASH KUMAR",
    "phone": "9958741076",
    "email": "",
    "role": "Technician",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "PRITAM",
    "phone": "8824185718",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 25000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pardis",
    "phone": "8586043260",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 17000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Parul",
    "phone": "8595557099",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Parveen Meemrot",
    "phone": "9116772736",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pawan Kumar",
    "phone": "7065257882",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Payal Prajapati",
    "phone": "9205502942",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pinki",
    "phone": "8506871705",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Piyush",
    "phone": "8178433668",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pooja Kakkar",
    "phone": "9643086647",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Pooja Sharma",
    "phone": "8826439924",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Poonam",
    "phone": "9311975648",
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
    "name": "Prabhat",
    "phone": "6393583339",
    "email": "parbhatnishad507@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Preeti",
    "phone": "9667097218",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Priyam Bhuteja",
    "phone": "8076676431",
    "email": "",
    "role": "Doctor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 22000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "RAVI KUMAR",
    "phone": "7579782314",
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
    "name": "RAVINDRA KHUSHWAHA",
    "phone": "9675101570",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "RINKU",
    "phone": "9821137715",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "RITIKA",
    "phone": "8744080827",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ROHAN SINGH",
    "phone": "7065869223",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ROHIT",
    "phone": "8764763600",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 30000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rahul",
    "phone": "1111111111",
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
    "name": "Rahul Gupta",
    "phone": "9311545060",
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
    "name": "Rajat",
    "phone": "9354100637",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rajesh Sahu",
    "phone": "8743833878",
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
    "name": "Rajiv singh",
    "phone": "9643075865",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ram Kishan Bairwa",
    "phone": "9636998659",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ramsha Khan",
    "phone": "8595907221",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rani gupta",
    "phone": "9319469553",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ranjana",
    "phone": "8750742361",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ravi",
    "phone": "9211247764",
    "email": "r80513182@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ravi Kushwaha",
    "phone": "7037595070",
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
    "name": "Ravina Adhikari",
    "phone": "9319781023",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 17000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Reetu",
    "phone": "9310157897",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rinku Bhagwat",
    "phone": "9887293547",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rinky",
    "phone": "9335355889",
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
    "name": "Rishabh",
    "phone": "8787878787",
    "email": "",
    "role": "Counsellor",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ritik Kumar",
    "phone": "9310530507",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ritu Afterservice",
    "phone": "9355906593",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rohit Dabla",
    "phone": "9217442418",
    "email": "r3248550@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rohit gusai",
    "phone": "8810442594",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rozy",
    "phone": "8287819671",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 13000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rubi",
    "phone": "9310083626",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ruchi",
    "phone": "9654916903",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Rupesh mishra",
    "phone": "7982541700",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Ryan",
    "phone": "9643809035",
    "email": "ryan@gmail.com",
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
    "name": "SACHIN",
    "phone": "9958741081",
    "email": "",
    "role": "Implanter",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SALMAN KHAN",
    "phone": "7982724902",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SAMSHER CHAUHANc",
    "phone": "9569287571",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SANDHYA",
    "phone": "9198545935",
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
    "name": "SANJAY SINGH",
    "phone": "8448307056",
    "email": "",
    "role": "Technician",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SHIVAM RAI",
    "phone": "7838826632",
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
    "name": "SHRADDHA RANDIVE",
    "phone": "7304770801",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SIMRAN",
    "phone": "9718493850",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 12000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SONIA",
    "phone": "7827848139",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SUNIL BHAIRWA",
    "phone": "7240515815",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SUNIL KUMAR BAIRWA",
    "phone": "7240515815",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "SUNIL NAGAR",
    "phone": "9079115069",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Saanvi",
    "phone": "8766266474",
    "email": "sanvi652006@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sachin sharma",
    "phone": "7982314541",
    "email": "kaushiksachin353@gmail.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sagar Rathor",
    "phone": "7042384731",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Saleem Khan",
    "phone": "9310201901",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Satyam Rai",
    "phone": "9220129430",
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
    "name": "Shaheen",
    "phone": "7247868055",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Shaifali",
    "phone": "9205049061",
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
    "name": "Shama",
    "phone": "9266314594",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sheetal",
    "phone": "7988415814",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sheetal Bhatiya",
    "phone": "7988415814",
    "email": "",
    "role": "Implanter",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sheetal Rathour",
    "phone": "9354232491",
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
    "name": "Shivam",
    "phone": "9990143183",
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
    "name": "Simran Sharma",
    "phone": "8875780931",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sneha",
    "phone": "9873024842",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sourabh Kumar",
    "phone": "9956130556",
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
    "name": "Suhail",
    "phone": "9897854791",
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
    "name": "Sunita",
    "phone": "8920693496",
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
    "name": "Sushma",
    "phone": "9971381020",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Sushma AfterService",
    "phone": "9355006021",
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
    "name": "Sweta",
    "phone": "9355906583",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tamanna",
    "phone": "7838830446",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tanisha",
    "phone": "9717618581",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tanu",
    "phone": "9355170574",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 16500,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Tanya Dubey",
    "phone": "6306683594",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Uvesh",
    "phone": "7055291995",
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
    "name": "VAASHU",
    "phone": "9999216811",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "VAIBHAV",
    "phone": "8929654240",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "VIKAS Bairwa",
    "phone": "8058193092",
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
    "name": "Vikas kashyap",
    "phone": "8986199986",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Vinita",
    "phone": "9315337868",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "YASHIKA",
    "phone": "9667932450",
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
    "name": "Yakshi",
    "phone": "1111111111",
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
    "name": "Yash Thakur",
    "phone": "9220264451",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Yash Yadav",
    "phone": "9217729689",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Yashveer",
    "phone": "9971381255",
    "email": "",
    "role": "Others",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Yashvinder Singh",
    "phone": "8447001548",
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
    "name": "Yogesh Gupta",
    "phone": "9667499969",
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
    "name": "Yogesh Kumar Insha",
    "phone": "8306206226",
    "email": "",
    "role": "Technician",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 35000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "Yuvraj",
    "phone": "8989898989",
    "email": "",
    "role": "Counsellor",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "anas ali",
    "phone": "9667093418",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "ankit gaur",
    "phone": "7827241534",
    "email": "",
    "role": "Agent",
    "isactive": true,
    "salaryStructure": {
      "baseSalary": 15000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "anuj sharma",
    "phone": "9643845347",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "bhavyansh",
    "phone": "7827740351",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "khushi aggarwal",
    "phone": "9625639773",
    "email": "khushiaggarwal472@gmil.com",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 14000,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "lavanya",
    "phone": "9718056005",
    "email": "thapalavanya93@gmail.com",
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
    "name": "lawanya arora",
    "phone": "8368517272",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "manmeet",
    "phone": "9818746316",
    "email": "manmeetsingh91405@gmail.com",
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
    "name": "mantasha",
    "phone": "8700930858",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "other",
    "phone": "1232132212",
    "email": "",
    "role": "Hr",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "rohan chaudhary",
    "phone": "8595420813",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "sandhya",
    "phone": "9354051129",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "sanjay joshi",
    "phone": "8383960420",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "shaan ali",
    "phone": "7428036812",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "shalu",
    "phone": "9310465022",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "simaranjeet kaur",
    "phone": "7701955098",
    "email": "kaursimran93960@gmail.com",
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
    "name": "sujal",
    "phone": "9319081380",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "suraj",
    "phone": "8700849068",
    "email": "",
    "role": "Agent",
    "isactive": false,
    "salaryStructure": {
      "baseSalary": 0,
      "salaryType": "Monthly",
      "effectiveFrom": "2026-04-01"
    },
    "incentiveRate": 0
  },
  {
    "name": "utkarsh",
    "phone": "9319432592",
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
    "name": "yash kumar",
    "phone": "9899185669",
    "email": "",
    "role": "Agent",
    "isactive": false,
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
const CONFIRM_RISKY = args.includes("--confirm-contact-only-updates");
const CONFIRM_PLACEHOLDER = args.includes("--confirm-placeholder-phone");
const DUMP_JSON = args.includes("--dump-json");

if (DUMP_JSON) {
  const out = "employees-update-payload.json";
  fs.writeFileSync(out, JSON.stringify(EMPLOYEES, null, 2));
  console.log(`Wrote ${out} — ${EMPLOYEES.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

const PLACEHOLDER_PHONE_RE = /^(\d)\1{9}$/;

function validate() {
  const errors = [];
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    const where = `row ${i + 1} (${e.name})`;
    if (!e.name) errors.push(`${where}: name is required`);
    if (!VALID_ROLES.includes(e.role)) errors.push(`${where}: invalid role "${e.role}"`);
  }
  return errors;
}

function normWords(name) {
  return (name || "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}
function nameSimilarity(a, b) {
  const wa = new Set(normWords(a));
  const wb = new Set(normWords(b));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}
const NAME_SIMILARITY_THRESHOLD = 0.5;

// A plain word-overlap ratio has a real false-positive mode on this data: "Nishi Afterservice"
// vs "Ritu Afterservice" scores 50% purely from sharing "Afterservice" (a team/role tag, not a
// personal name component) despite being two different people — confirmed live in this file's
// own duplicate-phone group. A shared surname-like suffix isn't identity; the given (first) name
// is what actually distinguishes two people here. So a match only counts as safe when EITHER the
// first word matches, OR overall similarity clears a much higher bar (75%) — this correctly
// keeps Sunil Bhairwa/Sunil Kumar Bairwa and Dr,/Dr. Ashalata Roy safe while pushing
// Nishi/Ritu Afterservice into the reviewed bucket, verified against every duplicate found in
// this file before this script was finalised.
function isSafeNameMatch(a, b) {
  const wa = normWords(a);
  const wb = normWords(b);
  if (wa[0] && wb[0] && wa[0] === wb[0]) return true;
  return nameSimilarity(a, b) >= 0.75;
}

const UPDATABLE_FIELDS = ["name", "email", "role", "isactive"];

function diffFields(entry, existing) {
  const changes = [];
  for (const field of UPDATABLE_FIELDS) {
    const newVal = entry[field];
    if (newVal === undefined || newVal === null || newVal === "") continue;
    const oldVal = existing[field];
    const oldStr = oldVal == null ? "" : String(oldVal).trim();
    const newStr = String(newVal).trim();
    if (oldStr !== newStr) changes.push({ field, from: oldVal ?? null, to: newVal });
  }
  // salaryStructure / incentiveRate diffed separately — nested + numeric, not a simple string compare.
  const ss = entry.salaryStructure || {};
  const existingSs = existing.salaryStructure || {};
  if (ss.baseSalary !== undefined && Number(existingSs.baseSalary || 0) !== Number(ss.baseSalary))
    changes.push({ field: "salaryStructure.baseSalary", from: existingSs.baseSalary ?? 0, to: ss.baseSalary });
  if (ss.salaryType && existingSs.salaryType !== ss.salaryType)
    changes.push({ field: "salaryStructure.salaryType", from: existingSs.salaryType ?? null, to: ss.salaryType });
  if (ss.effectiveFrom) {
    const oldD = existingSs.effectiveFrom ? new Date(existingSs.effectiveFrom).toISOString().slice(0, 10) : null;
    const newD = new Date(ss.effectiveFrom).toISOString().slice(0, 10);
    if (oldD !== newD) changes.push({ field: "salaryStructure.effectiveFrom", from: oldD, to: newD });
  }
  if (entry.incentiveRate !== undefined && Number(existing.incentiveRate || 0) !== Number(entry.incentiveRate))
    changes.push({ field: "incentiveRate", from: existing.incentiveRate ?? 0, to: entry.incentiveRate });
  return changes;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${EMPLOYEES.length}`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed.\n");

  // Surface within-file duplicate phones up front, purely as visibility — they are still
  // processed in file order below, so the later occurrence's values are simply what ends up
  // applied (a second update call overwriting the first's), not specially merged.
  const phoneCounts = {};
  EMPLOYEES.forEach((e) => { if (e.phone) phoneCounts[e.phone] = (phoneCounts[e.phone] || 0) + 1; });
  const repeatedPhones = Object.entries(phoneCounts).filter(([, c]) => c > 1);
  if (repeatedPhones.length) {
    console.log(`--- ${repeatedPhones.length} phone number(s) appear more than once in this file ---`);
    repeatedPhones.forEach(([phone]) => {
      const names = EMPLOYEES.filter((e) => e.phone === phone).map((e) => `${e.name} (role: ${e.role})`);
      console.log(`  ${phone}: ${names.join("  ->  ")}`);
    });
    console.log("(Applied in file order below — the later entry's values win for any field both touch.)\n");
  }

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee =
    mongoose.models.Employee ||
    mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));

  // ---------------------------------------------------------------------------
  // PASS 1 — classify every row: blank phone / placeholder phone / not found / safe update /
  // risky (name-mismatch) update. No writes yet.
  // ---------------------------------------------------------------------------
  console.log("Matching against existing employees by phone...\n");
  const blankPhone = [];
  const placeholderPhone = [];
  const notFound = [];
  const safeUpdates = [];
  const riskyUpdates = [];
  const noChangeNeeded = [];

  for (const e of EMPLOYEES) {
    if (!e.phone) { blankPhone.push(e); continue; }

    if (PLACEHOLDER_PHONE_RE.test(e.phone) && !CONFIRM_PLACEHOLDER) {
      placeholderPhone.push(e);
      continue;
    }

    const existing = await Employee.findOne({ phone: e.phone }).lean();
    if (!existing) { notFound.push(e); continue; }

    const similarity = nameSimilarity(e.name, existing.name);
    const changes = diffFields(e, existing);
    const bucket = { entry: e, existing, similarity, changes };

    if (!changes.length) noChangeNeeded.push(bucket);
    else if (isSafeNameMatch(e.name, existing.name)) safeUpdates.push(bucket);
    else riskyUpdates.push(bucket);
  }

  console.log(`  Blank phone (skipped)         : ${blankPhone.length}`);
  console.log(`  Placeholder phone (skipped)   : ${placeholderPhone.length}  (needs --confirm-placeholder-phone)`);
  console.log(`  No existing employee found    : ${notFound.length}`);
  console.log(`  Already up to date            : ${noChangeNeeded.length}`);
  console.log(`  Name-similar, will update      : ${safeUpdates.length}`);
  console.log(`  NAME-MISMATCH (needs confirm) : ${riskyUpdates.length}`);

  if (blankPhone.length) {
    console.log("\n--- BLANK PHONE (cannot match, skipped) ---");
    blankPhone.forEach((e) => console.log(`  ${e.name}`));
  }
  if (placeholderPhone.length) {
    console.log("\n--- PLACEHOLDER PHONE (skipped — obvious dummy number) ---");
    placeholderPhone.forEach((e) => console.log(`  ${e.name}  (${e.phone})`));
  }
  if (notFound.length) {
    console.log("\n--- NO EXISTING EMPLOYEE FOUND (skipped — this is an update-only script) ---");
    notFound.forEach((e) => console.log(`  ${e.name}  (${e.phone})`));
    console.log("If any of these are genuinely new hires, use scripts/employees-bulk-import.mjs instead.");
  }
  if (safeUpdates.length) {
    console.log("\n--- UPDATES (name-similar match) ---");
    safeUpdates.forEach(({ entry, existing, similarity, changes }) => {
      console.log(`  "${entry.name}" (${entry.phone})  ->  existing "${existing.name}" (${existing._id}, similarity ${(similarity * 100).toFixed(0)}%)`);
      changes.forEach((c) => console.log(`      ${c.field}: ${JSON.stringify(c.from)}  ->  ${JSON.stringify(c.to)}`));
    });
  }
  if (riskyUpdates.length) {
    console.log("\n" + "!".repeat(90));
    console.log("NAME-MISMATCH MATCHES — same phone, but the stored name looks like a different person.");
    console.log("NOT applied unless you pass --confirm-contact-only-updates. Review carefully:");
    console.log("!".repeat(90));
    riskyUpdates.forEach(({ entry, existing, similarity, changes }) => {
      console.log(`\n  "${entry.name}" (${entry.phone})  ->  existing "${existing.name}" (${existing._id}, similarity ${(similarity * 100).toFixed(0)}%)`);
      changes.forEach((c) => console.log(`      ${c.field}: ${JSON.stringify(c.from)}  ->  ${JSON.stringify(c.to)}`));
    });
    console.log("");
  }

  if (riskyUpdates.length && APPLY && !CONFIRM_RISKY) {
    console.error("Refusing to apply the name-mismatch updates above without --confirm-contact-only-updates.");
    console.error("Safe name-similar updates below are unaffected and will still proceed.\n");
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the lists above look right.");
    await mongoose.disconnect();
    return;
  }

  // ---------------------------------------------------------------------------
  // PASS 2 — write.
  // ---------------------------------------------------------------------------
  console.log("\nApplying safe updates...");
  const updated = [];
  const failed = [];

  for (const { entry, existing, changes } of safeUpdates) {
    try {
      const setFields = {};
      changes.forEach((c) => {
        if (c.field.startsWith("salaryStructure.")) {
          const sub = c.field.split(".")[1];
          setFields[`salaryStructure.${sub}`] = sub === "effectiveFrom" ? new Date(c.to) : c.to;
        } else {
          setFields[c.field] = c.field === "isactive" ? Boolean(c.to) : c.to;
        }
      });
      await Employee.updateOne({ _id: existing._id }, { $set: setFields });
      updated.push({ name: entry.name, phone: entry.phone, id: String(existing._id), changes });
      console.log(`  ${entry.name.padEnd(30)} ${entry.phone}  UPDATED (${existing._id}) — ${changes.length} field(s)`);
    } catch (err) {
      failed.push({ name: entry.name, phone: entry.phone, reason: err?.message || String(err) });
      console.log(`  ${entry.name.padEnd(30)} ${entry.phone}  FAILED: ${err?.message || err}`);
    }
  }

  let riskyApplied = [];
  if (riskyUpdates.length && CONFIRM_RISKY) {
    console.log("\n--confirm-contact-only-updates passed — applying the name-mismatch updates too...");
    for (const { entry, existing, changes } of riskyUpdates) {
      try {
        const setFields = {};
        changes.forEach((c) => {
          if (c.field.startsWith("salaryStructure.")) {
            const sub = c.field.split(".")[1];
            setFields[`salaryStructure.${sub}`] = sub === "effectiveFrom" ? new Date(c.to) : c.to;
          } else {
            setFields[c.field] = c.field === "isactive" ? Boolean(c.to) : c.to;
          }
        });
        await Employee.updateOne({ _id: existing._id }, { $set: setFields });
        riskyApplied.push({ name: entry.name, phone: entry.phone, id: String(existing._id), changes });
        console.log(`  ${entry.name.padEnd(30)} ${entry.phone}  UPDATED (${existing._id}) — NAME-MISMATCH, CONFIRMED`);
      } catch (err) {
        failed.push({ name: entry.name, phone: entry.phone, reason: err?.message || String(err) });
      }
    }
  }

  let placeholderApplied = [];
  if (placeholderPhone.length && CONFIRM_PLACEHOLDER) {
    console.log("\n--confirm-placeholder-phone passed — re-checking those rows (still subject to name-similarity)...");
    for (const e of placeholderPhone) {
      const existing = await Employee.findOne({ phone: e.phone }).lean();
      if (!existing) { console.log(`  ${e.name}  (${e.phone})  — still no existing employee found, skipped`); continue; }
      const similarity = nameSimilarity(e.name, existing.name);
      const changes = diffFields(e, existing);
      if (!isSafeNameMatch(e.name, existing.name)) {
        console.log(`  ${e.name}  (${e.phone})  — matched "${existing.name}" but similarity only ${(similarity * 100).toFixed(0)}%, skipped (add --confirm-contact-only-updates too if this is really the same person)`);
        continue;
      }
      if (!changes.length) { console.log(`  ${e.name}  (${e.phone})  — already up to date`); continue; }
      try {
        const setFields = {};
        changes.forEach((c) => {
          if (c.field.startsWith("salaryStructure.")) {
            const sub = c.field.split(".")[1];
            setFields[`salaryStructure.${sub}`] = sub === "effectiveFrom" ? new Date(c.to) : c.to;
          } else {
            setFields[c.field] = c.field === "isactive" ? Boolean(c.to) : c.to;
          }
        });
        await Employee.updateOne({ _id: existing._id }, { $set: setFields });
        placeholderApplied.push({ name: e.name, phone: e.phone, id: String(existing._id), changes });
        console.log(`  ${e.name.padEnd(30)} ${e.phone}  UPDATED (${existing._id}) — PLACEHOLDER PHONE, CONFIRMED`);
      } catch (err) {
        failed.push({ name: e.name, phone: e.phone, reason: err?.message || String(err) });
      }
    }
  }

  const totalUpdated = updated.length + riskyApplied.length + placeholderApplied.length;
  console.log(`\nUpdated ${totalUpdated} employee(s)` + (failed.length ? `, ${failed.length} failed` : "") + ".");
  if (riskyUpdates.length && !CONFIRM_RISKY) console.log(`${riskyUpdates.length} name-mismatch row(s) left untouched.`);
  if (placeholderPhone.length && !CONFIRM_PLACEHOLDER) console.log(`${placeholderPhone.length} placeholder-phone row(s) left untouched.`);

  const reportPath = `employees-update-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        updated,
        riskyUpdatesApplied: riskyApplied,
        placeholderUpdatesApplied: placeholderApplied,
        skippedBlankPhone: blankPhone.map((e) => e.name),
        skippedPlaceholderPhone: CONFIRM_PLACEHOLDER ? [] : placeholderPhone.map((e) => ({ name: e.name, phone: e.phone })),
        skippedNotFound: notFound.map((e) => ({ name: e.name, phone: e.phone })),
        skippedRiskyUpdates: CONFIRM_RISKY ? [] : riskyUpdates.map(({ entry, existing }) => ({ name: entry.name, phone: entry.phone, existingId: String(existing._id), existingName: existing.name })),
        failed,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath} — keep it, the previous values are your undo list.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
