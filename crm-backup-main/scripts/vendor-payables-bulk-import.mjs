// scripts/vendor-payables-bulk-import.mjs
//
// Creates a Payable for every vendor bill in patient-vouncher.xlsx — 16 opening balances (Bill
// Type "Opening") plus 105 purchase/journal bills, across all 24 vendors imported by
// scripts/vendors-bulk-import.mjs. This is what finally categorises the vendor opening
// balances flagged (but deliberately not written) by that script — this sheet gives the
// Expense Category / Expense Type each bill actually belongs under, which the vendor sheet
// alone didn't.
//
// PURPOSE MAPPING (all three map cleanly onto PAYABLE_PURPOSES — no guessing needed this time):
//   "Medicine Procurement"  -> MEDICINE_PROCUREMENT
//   "Medical Consumables"   -> MEDICAL_CONSUMABLES
//   "Professional Expenses" -> PROFESSIONAL_EXPENSES
//
// "Bill Type" (Opening / Purchase / Journal) doesn't change how a row is written — all three
// create the same kind of Payable; the type is folded into remarks for traceability, nothing
// more. An "Opening" row is exactly the same opening-balance figure vendors.xlsx carried,
// finally getting a purpose/expenseCategory.
//
// VENDOR RESOLUTION IS LIVE, NOT EMBEDDED: payee.refId must be an actual Vendor _id, which only
// exists once scripts/vendors-bulk-import.mjs has run. Every row looks its vendor up by name at
// run time — exact match first, then a case/whitespace-insensitive fallback (covers a vendor
// whose messy DB name hasn't been cleaned up by the safe-update pass yet). A row whose vendor
// can't be found is SKIPPED and reported — never silently created against no vendor.
//
// NO BRANCH COLUMN in this sheet, and vendor purchases like these (medicine/consumables
// procurement, professional/consultancy fees) aren't naturally tied to one clinic branch the
// way rent or per-branch electricity is — a wholesaler like Helpsure supplies stock centrally.
// branch is deliberately left UNSET on every payable this script creates (the Payable model
// does not require it). If you want these tagged to a specific branch instead, tell me which
// and I'll add that as a mapping rather than guessing one.
//
// dueDate: the sheet has no separate due date column, so each payable's dueDate is set to its
// own Bill Date — the neutral choice when no payment-terms figure was given, rather than
// inventing a 30/45-day term that isn't in the data.
//
// NO DUPLICATE-GUARD EXISTS AT THE DATABASE LEVEL for these purposes: the Payable model's own
// partial unique index only covers the MONTHLY_PURPOSES (SALARY/RENT/ELECTRICITY/COLLAB_CLINIC/
// TAX) — MEDICINE_PROCUREMENT etc. are deliberately not in that list, because many bills from
// the same vendor in the same month is completely normal, not a duplicate. So this script
// builds its OWN idempotency: every payable's remarks is prefixed with a
// "[BULK-VENDOR-BILL-<rowNum>]" tag, checked before creating — safe to re-run after a partial
// failure, never double-imports a row that already succeeded.
//
// Usage:
//   node scripts/vendor-payables-bulk-import.mjs                        # dry run
//   node scripts/vendor-payables-bulk-import.mjs --dump-json             # write entries out, no DB
//   node scripts/vendor-payables-bulk-import.mjs --apply                # write
//   node scripts/vendor-payables-bulk-import.mjs --rows=2,3,4            # only these source rows

import mongoose from "mongoose";
import fs from "fs";
import { EXPENSE_CATEGORY_TREE } from "../src/constants/expenseCategories.js";

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
// THE DATA — parsed from patient-vouncher.xlsx, one entry per bill row (opening balance,
// purchase, or journal — see note above, all handled identically).
// ═══════════════════════════════════════════════════════════════════════════════
const BILL_ENTRIES = [
  {
    "rowNum": 2,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 1,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 150000.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 3,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 2,
    "billDate": "2026-04-01",
    "billType": "Purchase",
    "billVchNo": "3",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 74617.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 4,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 3,
    "billDate": "2026-04-06",
    "billType": "Purchase",
    "billVchNo": "1",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 127840.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 5,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 4,
    "billDate": "2026-04-06",
    "billType": "Purchase",
    "billVchNo": "2",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 111750.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 6,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 5,
    "billDate": "2026-04-17",
    "billType": "Purchase",
    "billVchNo": "10",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 134039.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 7,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 6,
    "billDate": "2026-04-24",
    "billType": "Purchase",
    "billVchNo": "11",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 161674.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 8,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 7,
    "billDate": "2026-05-05",
    "billType": "Purchase",
    "billVchNo": "41",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 41013.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 9,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 8,
    "billDate": "2026-05-06",
    "billType": "Purchase",
    "billVchNo": "42",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 41013.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 10,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 9,
    "billDate": "2026-06-09",
    "billType": "Purchase",
    "billVchNo": "97",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 183579.48,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 11,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 10,
    "billDate": "2026-06-12",
    "billType": "Purchase",
    "billVchNo": "136",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 41013.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 12,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 11,
    "billDate": "2026-06-18",
    "billType": "Purchase",
    "billVchNo": "98",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 286444.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 13,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 12,
    "billDate": "2026-07-27",
    "billType": "Purchase",
    "billVchNo": "132",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 115000.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 14,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 13,
    "billDate": "2026-08-09",
    "billType": "Purchase",
    "billVchNo": "134",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 679561.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 15,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 14,
    "billDate": "2026-08-09",
    "billType": "Purchase",
    "billVchNo": "135",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 367401.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 16,
    "vendorName": "Helpsure Healthcare Private Limited",
    "billSrNo": 15,
    "billDate": "2026-08-10",
    "billType": "Purchase",
    "billVchNo": "133",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 214116.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 17,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 16,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 377374.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 18,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 17,
    "billDate": "2026-04-04",
    "billType": "Purchase",
    "billVchNo": "12",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 140963.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 19,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 18,
    "billDate": "2026-04-27",
    "billType": "Purchase",
    "billVchNo": "22",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 182769.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 20,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 19,
    "billDate": "2026-05-14",
    "billType": "Purchase",
    "billVchNo": "56",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 156186.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 21,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 20,
    "billDate": "2026-06-08",
    "billType": "Purchase",
    "billVchNo": "79",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 79900.8,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 22,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 21,
    "billDate": "2026-06-10",
    "billType": "Purchase",
    "billVchNo": "80",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 61533.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 23,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 22,
    "billDate": "2026-06-22",
    "billType": "Purchase",
    "billVchNo": "81",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 51660.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 24,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 23,
    "billDate": "2026-06-25",
    "billType": "Purchase",
    "billVchNo": "82",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 82593.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 25,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 24,
    "billDate": "2026-06-26",
    "billType": "Purchase",
    "billVchNo": "83",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 87084.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 26,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 25,
    "billDate": "2026-06-27",
    "billType": "Purchase",
    "billVchNo": "84",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 45145.5,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 27,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 26,
    "billDate": "2026-06-29",
    "billType": "Purchase",
    "billVchNo": "85",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 84156.06,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 28,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 27,
    "billDate": "2026-07-02",
    "billType": "Purchase",
    "billVchNo": "110",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 76829.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 29,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 28,
    "billDate": "2026-07-03",
    "billType": "Purchase",
    "billVchNo": "111",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 60341.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 30,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 29,
    "billDate": "2026-07-10",
    "billType": "Purchase",
    "billVchNo": "112",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 12642.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 31,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 30,
    "billDate": "2026-07-18",
    "billType": "Purchase",
    "billVchNo": "113",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 70350.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 32,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 31,
    "billDate": "2026-07-20",
    "billType": "Purchase",
    "billVchNo": "114",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 64098.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 33,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 32,
    "billDate": "2026-07-25",
    "billType": "Purchase",
    "billVchNo": "129",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 108318.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 34,
    "vendorName": "Modern Pharmaceuticals",
    "billSrNo": 33,
    "billDate": "2026-08-07",
    "billType": "Purchase",
    "billVchNo": "130",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 171265.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 35,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 34,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 410803.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 36,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 35,
    "billDate": "2026-04-23",
    "billType": "Purchase",
    "billVchNo": "103",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 70445.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 37,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 36,
    "billDate": "2026-05-02",
    "billType": "Purchase",
    "billVchNo": "104",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 72129.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 38,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 37,
    "billDate": "2026-05-02",
    "billType": "Purchase",
    "billVchNo": "105",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 8175.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 39,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 38,
    "billDate": "2026-06-04",
    "billType": "Purchase",
    "billVchNo": "107",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 83692.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 40,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 39,
    "billDate": "2026-06-15",
    "billType": "Purchase",
    "billVchNo": "108",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 11901.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 41,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 40,
    "billDate": "2026-07-08",
    "billType": "Purchase",
    "billVchNo": "109",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 136160.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 42,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 41,
    "billDate": "2026-07-11",
    "billType": "Purchase",
    "billVchNo": "128",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 17184.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 43,
    "vendorName": "Shri Ji Pharma",
    "billSrNo": 42,
    "billDate": "2026-07-28",
    "billType": "Purchase",
    "billVchNo": "127",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 78720.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 44,
    "vendorName": "Cranix Pharma",
    "billSrNo": 43,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 345353.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 45,
    "vendorName": "Cranix Pharma",
    "billSrNo": 44,
    "billDate": "2026-04-02",
    "billType": "Purchase",
    "billVchNo": "4",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 67725.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 46,
    "vendorName": "Bhawani Drugs Distributors",
    "billSrNo": 45,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 210364.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 47,
    "vendorName": "Bhawani Drugs Distributors",
    "billSrNo": 46,
    "billDate": "2026-04-24",
    "billType": "Purchase",
    "billVchNo": "21",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 30359.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 48,
    "vendorName": "Bhawani Drugs Distributors",
    "billSrNo": 47,
    "billDate": "2026-05-28",
    "billType": "Purchase",
    "billVchNo": "55",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 30359.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 49,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 48,
    "billDate": "2026-04-23",
    "billType": "Purchase",
    "billVchNo": "38",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 16612.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 50,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 49,
    "billDate": "2026-05-01",
    "billType": "Purchase",
    "billVchNo": "37",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 16612.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 51,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 50,
    "billDate": "2026-05-11",
    "billType": "Purchase",
    "billVchNo": "39",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 16612.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 52,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 51,
    "billDate": "2026-06-05",
    "billType": "Purchase",
    "billVchNo": "69",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 38350.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 53,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 52,
    "billDate": "2026-06-06",
    "billType": "Purchase",
    "billVchNo": "70",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 6854.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 54,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 53,
    "billDate": "2026-06-22",
    "billType": "Purchase",
    "billVchNo": "71",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 16612.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 55,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 54,
    "billDate": "2026-06-24",
    "billType": "Purchase",
    "billVchNo": "72",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 26315.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 56,
    "vendorName": "Cross Q-Derma",
    "billSrNo": 55,
    "billDate": "2026-06-30",
    "billType": "Purchase",
    "billVchNo": "73",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 36474.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 57,
    "vendorName": "Gnvs Pharmaceuticals",
    "billSrNo": 56,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 41370.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 58,
    "vendorName": "Gnvs Pharmaceuticals",
    "billSrNo": 57,
    "billDate": "2026-05-07",
    "billType": "Purchase",
    "billVchNo": "93",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 24570.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 59,
    "vendorName": "Gnvs Pharmaceuticals",
    "billSrNo": 58,
    "billDate": "2026-06-09",
    "billType": "Purchase",
    "billVchNo": "94",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 47190.15,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 60,
    "vendorName": "Gnvs Pharmaceuticals",
    "billSrNo": 59,
    "billDate": "2026-06-22",
    "billType": "Purchase",
    "billVchNo": "95",
    "billParticulars": "Purchases of OT Stock",
    "billAmount": 56026.11,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 61,
    "vendorName": "Godiva Bioadvances Pvt. Ltd.",
    "billSrNo": 60,
    "billDate": "2026-07-06",
    "billType": "Purchase",
    "billVchNo": "123",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 23626.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 62,
    "vendorName": "Godiva Bioadvances Pvt. Ltd.",
    "billSrNo": 61,
    "billDate": "2026-07-10",
    "billType": "Journal",
    "billVchNo": "205",
    "billParticulars": "godiva",
    "billAmount": 11450.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 63,
    "vendorName": "Godiva Bioadvances Pvt. Ltd.",
    "billSrNo": 62,
    "billDate": "2026-07-11",
    "billType": "Purchase",
    "billVchNo": "124",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 16020.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 64,
    "vendorName": "Godiva Bioadvances Pvt. Ltd.",
    "billSrNo": 63,
    "billDate": "2026-07-25",
    "billType": "Purchase",
    "billVchNo": "122",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 28620.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 65,
    "vendorName": "Mishra Surgical",
    "billSrNo": 64,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 78000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 66,
    "vendorName": "Mishra Surgical",
    "billSrNo": 65,
    "billDate": "2026-06-15",
    "billType": "Purchase",
    "billVchNo": "67",
    "billParticulars": "Purchases Others",
    "billAmount": 58000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 67,
    "vendorName": "Mishra Surgical",
    "billSrNo": 66,
    "billDate": "2026-07-16",
    "billType": "Purchase",
    "billVchNo": "102",
    "billParticulars": "Purchases Others",
    "billAmount": 38000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 68,
    "vendorName": "Ganapati Bio-Tech Ltd.",
    "billSrNo": 67,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 46875.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 69,
    "vendorName": "Ganapati Bio-Tech Ltd.",
    "billSrNo": 68,
    "billDate": "2026-05-25",
    "billType": "Purchase",
    "billVchNo": "52",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 93750.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 70,
    "vendorName": "Pharmachem Distributors",
    "billSrNo": 69,
    "billDate": "2026-05-26",
    "billType": "Purchase",
    "billVchNo": "53",
    "billParticulars": "Purchases Others",
    "billAmount": 52500.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 71,
    "vendorName": "KAPIL GFC",
    "billSrNo": 70,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 5000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 72,
    "vendorName": "KAPIL GFC",
    "billSrNo": 71,
    "billDate": "2026-05-02",
    "billType": "Purchase",
    "billVchNo": "19",
    "billParticulars": "Purchases Others",
    "billAmount": 20000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 73,
    "vendorName": "KAPIL GLUTA",
    "billSrNo": 72,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 38400.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 74,
    "vendorName": "KAPIL GLUTA",
    "billSrNo": 73,
    "billDate": "2026-05-23",
    "billType": "Purchase",
    "billVchNo": "43",
    "billParticulars": "Purchases Others",
    "billAmount": 7000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 75,
    "vendorName": "KAPIL GLUTA",
    "billSrNo": 74,
    "billDate": "2026-07-19",
    "billType": "Purchase",
    "billVchNo": "126",
    "billParticulars": "Purchases Others",
    "billAmount": 14000.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 76,
    "vendorName": "VEJOVIS MEDLINE",
    "billSrNo": 75,
    "billDate": "2026-04-30",
    "billType": "Purchase",
    "billVchNo": "61",
    "billParticulars": "Purchases Others",
    "billAmount": 22750.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 77,
    "vendorName": "VEJOVIS MEDLINE",
    "billSrNo": 76,
    "billDate": "2026-05-30",
    "billType": "Purchase",
    "billVchNo": "47",
    "billParticulars": "Purchases Others",
    "billAmount": 42656.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 78,
    "vendorName": "Raaveetech Pharma",
    "billSrNo": 77,
    "billDate": "2026-05-04",
    "billType": "Purchase",
    "billVchNo": "62",
    "billParticulars": "Medical Consumables",
    "billAmount": 20506.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 79,
    "vendorName": "Raaveetech Pharma",
    "billSrNo": 78,
    "billDate": "2026-06-01",
    "billType": "Purchase",
    "billVchNo": "96",
    "billParticulars": "Medical Consumables",
    "billAmount": 20506.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 80,
    "vendorName": "Medono India",
    "billSrNo": 79,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 37255.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 81,
    "vendorName": "Medono India",
    "billSrNo": 80,
    "billDate": "2026-04-15",
    "billType": "Purchase",
    "billVchNo": "50",
    "billParticulars": "Purchases Others",
    "billAmount": 11800.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 82,
    "vendorName": "Medono India",
    "billSrNo": 81,
    "billDate": "2026-05-02",
    "billType": "Purchase",
    "billVchNo": "51",
    "billParticulars": "Purchases Others",
    "billAmount": 13338.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 83,
    "vendorName": "Medono India",
    "billSrNo": 82,
    "billDate": "2026-05-04",
    "billType": "Purchase",
    "billVchNo": "49",
    "billParticulars": "Purchases Others",
    "billAmount": 67499.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 84,
    "vendorName": "Medono India",
    "billSrNo": 83,
    "billDate": "2026-06-01",
    "billType": "Purchase",
    "billVchNo": "48",
    "billParticulars": "Purchases Others",
    "billAmount": 20446.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 85,
    "vendorName": "Kusum Scientific",
    "billSrNo": 84,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 86,
    "vendorName": "Kusum Scientific",
    "billSrNo": 85,
    "billDate": "2026-04-01",
    "billType": "Purchase",
    "billVchNo": "16",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 13860.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 87,
    "vendorName": "Kusum Scientific",
    "billSrNo": 86,
    "billDate": "2026-04-09",
    "billType": "Purchase",
    "billVchNo": "13",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 14280.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 88,
    "vendorName": "Kusum Scientific",
    "billSrNo": 87,
    "billDate": "2026-04-12",
    "billType": "Purchase",
    "billVchNo": "14",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 89,
    "vendorName": "Kusum Scientific",
    "billSrNo": 88,
    "billDate": "2026-04-12",
    "billType": "Purchase",
    "billVchNo": "15",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 6300.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 90,
    "vendorName": "Kusum Scientific",
    "billSrNo": 89,
    "billDate": "2026-04-30",
    "billType": "Purchase",
    "billVchNo": "34",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 91,
    "vendorName": "Kusum Scientific",
    "billSrNo": 90,
    "billDate": "2026-05-13",
    "billType": "Purchase",
    "billVchNo": "33",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 30576.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 92,
    "vendorName": "Kusum Scientific",
    "billSrNo": 91,
    "billDate": "2026-05-17",
    "billType": "Purchase",
    "billVchNo": "40",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 33500.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 93,
    "vendorName": "Kusum Scientific",
    "billSrNo": 92,
    "billDate": "2026-05-28",
    "billType": "Purchase",
    "billVchNo": "64",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 94,
    "vendorName": "Kusum Scientific",
    "billSrNo": 93,
    "billDate": "2026-06-14",
    "billType": "Purchase",
    "billVchNo": "63",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 95,
    "vendorName": "Kusum Scientific",
    "billSrNo": 94,
    "billDate": "2026-06-17",
    "billType": "Purchase",
    "billVchNo": "66",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 6300.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 96,
    "vendorName": "Kusum Scientific",
    "billSrNo": 95,
    "billDate": "2026-07-01",
    "billType": "Purchase",
    "billVchNo": "100",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 97,
    "vendorName": "Kusum Scientific",
    "billSrNo": 96,
    "billDate": "2026-07-14",
    "billType": "Purchase",
    "billVchNo": "101",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 24276.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 98,
    "vendorName": "Yurexa Wellness",
    "billSrNo": 97,
    "billDate": "2026-06-03",
    "billType": "Purchase",
    "billVchNo": "131",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 19200.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 99,
    "vendorName": "Medica Solutions",
    "billSrNo": 98,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 75.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 100,
    "vendorName": "Medica Solutions",
    "billSrNo": 99,
    "billDate": "2026-05-01",
    "billType": "Purchase",
    "billVchNo": "23",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 13860.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 101,
    "vendorName": "Medica Solutions",
    "billSrNo": 100,
    "billDate": "2026-06-15",
    "billType": "Purchase",
    "billVchNo": "65",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 13860.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 102,
    "vendorName": "Medica Solutions",
    "billSrNo": 101,
    "billDate": "2026-07-15",
    "billType": "Purchase",
    "billVchNo": "116",
    "billParticulars": "Purchase of Lab consumables",
    "billAmount": 13860.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-Others"
  },
  {
    "rowNum": 103,
    "vendorName": "Shivoham Dermatology Private Limited",
    "billSrNo": 102,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 37100.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 104,
    "vendorName": "Shivoham Dermatology Private Limited",
    "billSrNo": 103,
    "billDate": "2026-05-01",
    "billType": "Purchase",
    "billVchNo": "91",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 4294.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 105,
    "vendorName": "Shivoham Dermatology Private Limited",
    "billSrNo": 104,
    "billDate": "2026-05-20",
    "billType": "Purchase",
    "billVchNo": "92",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 4294.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 106,
    "vendorName": "A Square Pharmaceuticals",
    "billSrNo": 105,
    "billDate": "2026-04-18",
    "billType": "Purchase",
    "billVchNo": "26",
    "billParticulars": "Purchase of Medicine",
    "billAmount": 5500.0,
    "purpose": "MEDICINE_PROCUREMENT",
    "expenseCategory": "Medicine Procurement",
    "expenseSubType": "Medicine Procurement"
  },
  {
    "rowNum": 107,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 106,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 50700.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 108,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 107,
    "billDate": "2026-04-11",
    "billType": "Journal",
    "billVchNo": "17",
    "billParticulars": "Professional Charges",
    "billAmount": 107800.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 109,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 108,
    "billDate": "2026-05-01",
    "billType": "Journal",
    "billVchNo": "70",
    "billParticulars": "Professional Charges",
    "billAmount": 107800.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 110,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 109,
    "billDate": "2026-06-01",
    "billType": "Journal",
    "billVchNo": "71",
    "billParticulars": "Professional Charges",
    "billAmount": 129360.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 111,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 110,
    "billDate": "2026-06-01",
    "billType": "Journal",
    "billVchNo": "120",
    "billParticulars": "Professional Charges",
    "billAmount": 43120.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 112,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 111,
    "billDate": "2026-07-01",
    "billType": "Journal",
    "billVchNo": "154",
    "billParticulars": "Professional Charges",
    "billAmount": 129360.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 113,
    "vendorName": "Minenii Corporate Services Private Limited",
    "billSrNo": 112,
    "billDate": "2026-08-01",
    "billType": "Journal",
    "billVchNo": "207",
    "billParticulars": "Professional Charges",
    "billAmount": 129360.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 114,
    "vendorName": "Phmg and Associates",
    "billSrNo": 113,
    "billDate": "2026-04-01",
    "billType": "Opening",
    "billVchNo": "",
    "billParticulars": "Opening Balance",
    "billAmount": 233200.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 115,
    "vendorName": "Phmg and Associates",
    "billSrNo": 114,
    "billDate": "2026-04-11",
    "billType": "Journal",
    "billVchNo": "18",
    "billParticulars": "Professional Charges",
    "billAmount": 64800.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 116,
    "vendorName": "Phmg and Associates",
    "billSrNo": 115,
    "billDate": "2026-05-01",
    "billType": "Journal",
    "billVchNo": "51",
    "billParticulars": "Professional Charges",
    "billAmount": 64800.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 117,
    "vendorName": "Phmg and Associates",
    "billSrNo": 116,
    "billDate": "2026-06-01",
    "billType": "Journal",
    "billVchNo": "72",
    "billParticulars": "Professional Charges",
    "billAmount": 64800.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 118,
    "vendorName": "Phmg and Associates",
    "billSrNo": 117,
    "billDate": "2026-06-01",
    "billType": "Journal",
    "billVchNo": "130",
    "billParticulars": "Professional Charges",
    "billAmount": 25920.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 119,
    "vendorName": "Phmg and Associates",
    "billSrNo": 118,
    "billDate": "2026-06-01",
    "billType": "Journal",
    "billVchNo": "209",
    "billParticulars": "Professional Charges",
    "billAmount": 12960.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 120,
    "vendorName": "Phmg and Associates",
    "billSrNo": 119,
    "billDate": "2026-07-01",
    "billType": "Journal",
    "billVchNo": "155",
    "billParticulars": "Professional Charges",
    "billAmount": 77760.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 121,
    "vendorName": "Phmg and Associates",
    "billSrNo": 120,
    "billDate": "2026-08-01",
    "billType": "Journal",
    "billVchNo": "210",
    "billParticulars": "Professional Charges",
    "billAmount": 77760.0,
    "purpose": "PROFESSIONAL_EXPENSES",
    "expenseCategory": "Professional Expenses",
    "expenseSubType": "Finance Consultant Fee"
  },
  {
    "rowNum": 122,
    "vendorName": "Adequate Electro Mechinical Engineering",
    "billSrNo": 121,
    "billDate": "2026-07-04",
    "billType": "Journal",
    "billVchNo": "204",
    "billParticulars": "Derma Chair",
    "billAmount": 160150.0,
    "purpose": "MEDICAL_CONSUMABLES",
    "expenseCategory": "Medical Consumables",
    "expenseSubType": "Medical Consumables-OT"
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const DUMP_JSON = args.includes("--dump-json");
const ROWS_FILTER = arg("rows") ? arg("rows").split(",").map((s) => parseInt(s.trim(), 10)) : null;

const ENTRIES = ROWS_FILTER ? BILL_ENTRIES.filter((e) => ROWS_FILTER.includes(e.rowNum)) : BILL_ENTRIES;

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (DUMP_JSON) {
  const out = "vendor-payables-payload.json";
  fs.writeFileSync(out, JSON.stringify(ENTRIES, null, 2));
  console.log(`Wrote ${out} — ${ENTRIES.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

const VALID_PURPOSES = ["MEDICINE_PROCUREMENT", "MEDICAL_CONSUMABLES", "PROFESSIONAL_EXPENSES"];

function validate() {
  const errors = [];
  for (const e of ENTRIES) {
    const where = `row ${e.rowNum} (${e.vendorName}, bill #${e.billSrNo})`;
    if (!VALID_PURPOSES.includes(e.purpose)) errors.push(`${where}: unmapped purpose "${e.purpose}"`);
    if (!EXPENSE_CATEGORY_TREE[e.expenseCategory]?.includes(e.expenseSubType))
      errors.push(`${where}: "${e.expenseSubType}" is not a valid sub-type under "${e.expenseCategory}"`);
    if (!(e.billAmount > 0)) errors.push(`${where}: bill amount must be > 0`);
    if (isNaN(new Date(e.billDate).getTime())) errors.push(`${where}: bad bill date "${e.billDate}"`);
  }
  return errors;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${ENTRIES.length}  (source: patient-vouncher.xlsx, ${BILL_ENTRIES.length} total)`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed — every purpose and sub-type resolves against EXPENSE_CATEGORY_TREE.\n");

  const total = r2(ENTRIES.reduce((s, e) => s + e.billAmount, 0));
  const byVendor = {};
  ENTRIES.forEach((e) => (byVendor[e.vendorName] = r2((byVendor[e.vendorName] || 0) + e.billAmount)));
  console.log("--- TOTALS BY VENDOR ---");
  Object.entries(byVendor)
    .sort()
    .forEach(([v, amt]) => console.log(`  ${v.padEnd(45)} ${inr(amt).padStart(14)}`));
  console.log(`\n  GRAND TOTAL: ${inr(total)}\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", new mongoose.Schema({}, { strict: false, collection: "vendors" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));

  // ---------------------------------------------------------------------------
  // PASS 1 — resolve every row's vendor and check idempotency, WITHOUT writing anything.
  // ---------------------------------------------------------------------------
  console.log("Resolving vendors and checking for already-imported rows...\n");
  const vendorCache = new Map();
  async function resolveVendor(name) {
    if (vendorCache.has(name)) return vendorCache.get(name);
    let v = await Vendor.findOne({ name }).select("_id name").lean();
    if (!v) {
      v = await Vendor.findOne({ name: new RegExp(`^\\s*${escapeRegex(name)}\\s*$`, "i") })
        .select("_id name")
        .lean();
    }
    vendorCache.set(name, v || null);
    return v || null;
  }

  const resolved = [];
  for (const e of ENTRIES) {
    const tag = `[BULK-VENDOR-BILL-${e.rowNum}]`;
    const already = await Payable.findOne({ remarks: new RegExp(escapeRegex(tag)) }).select("_id").lean();
    if (already) {
      resolved.push({ e, status: "already-imported", existingId: String(already._id) });
      continue;
    }
    const vendor = await resolveVendor(e.vendorName);
    if (!vendor) {
      resolved.push({ e, status: "vendor-not-found" });
      continue;
    }
    resolved.push({ e, status: "ok", vendor, tag });
  }

  const ok = resolved.filter((r) => r.status === "ok");
  const notFound = resolved.filter((r) => r.status === "vendor-not-found");
  const already = resolved.filter((r) => r.status === "already-imported");

  console.log(`  OK to import       : ${ok.length}`);
  console.log(`  Already imported     : ${already.length}  (idempotent — safe re-run, skipped)`);
  console.log(`  Vendor not found     : ${notFound.length}`);

  if (notFound.length) {
    console.log("\n--- VENDOR NOT FOUND (skipped) ---");
    const byName = {};
    notFound.forEach(({ e }) => (byName[e.vendorName] = (byName[e.vendorName] || 0) + 1));
    Object.entries(byName).forEach(([name, count]) => console.log(`  ${name}  (${count} row(s))`));
    console.log("\nRun scripts/vendors-bulk-import.mjs --apply first if these vendors don't exist yet,");
    console.log("then re-run this script.");
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the lists above look right.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCreating ${ok.length} payable(s)...`);
  const created = [];
  const failed = [];

  for (const { e, vendor, tag } of ok) {
    try {
      const remarks = `${tag} ${e.billType} bill #${e.billSrNo}${e.billVchNo ? ` (Vch ${e.billVchNo})` : ""}: ${e.billParticulars}`;
      const doc = await Payable.create({
        payee: { kind: "VENDOR", refId: vendor._id, label: vendor.name },
        purpose: e.purpose,
        expenseCategory: e.expenseCategory,
        expenseSubType: e.expenseSubType,
        totalAmount: e.billAmount,
        dueDate: new Date(e.billDate),
        // No branch column in the source and these purchases aren't branch-specific — see the
        // header note. Left unset rather than guessed.
        remarks,
        isCancelled: false,
        createdBy: { ...IMPORT_IDENTITY, date: new Date() },
        log: [
          {
            action: "Created",
            newValue: String(e.billAmount),
            note: `Bulk import from patient-vouncher.xlsx, row ${e.rowNum}`,
            performedBy: IMPORT_IDENTITY,
            performedAt: new Date(),
          },
        ],
      });
      created.push({ rowNum: e.rowNum, vendorName: e.vendorName, id: String(doc._id), amount: e.billAmount });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.vendorName.padEnd(38)} ${inr(e.billAmount).padStart(12)}  OK`);
    } catch (err) {
      failed.push({ rowNum: e.rowNum, vendorName: e.vendorName, reason: err?.message || String(err) });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.vendorName.padEnd(38)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nCreated ${created.length} payable(s), ${failed.length} failed.`);
  if (failed.length) {
    console.log("\nFailed rows:");
    failed.forEach((f) => console.log(`  row ${f.rowNum}  ${f.vendorName}: ${f.reason}`));
  }

  const reportPath = `vendor-payables-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        source: "patient-vouncher.xlsx",
        created,
        failed,
        skippedVendorNotFound: notFound.map(({ e }) => ({ rowNum: e.rowNum, vendorName: e.vendorName, amount: e.billAmount })),
        alreadyImported: already.map(({ e, existingId }) => ({ rowNum: e.rowNum, vendorName: e.vendorName, existingId })),
      },
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
