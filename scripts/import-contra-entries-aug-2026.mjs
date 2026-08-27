// scripts/import-contra-entries-aug-2026.mjs
//
// Imports the 143 contra entries from contra_entry_13_Aug_to_24_Aug.xlsx (13-24 Aug 2026) as
// AccountTransfer documents — money moved between our own accounts, never income or expense.
//
// ─── ACCOUNT NAME NORMALISATION (the thing most likely to have silently failed) ──────────────
//
// The sheet's account names do not match the ACCOUNTS enum in src/constants/bankRouting.js
// character-for-character, and AccountTransfer's schema enforces that enum on both
// `fromAccount` and `toAccount` — so a raw import would have been rejected outright, or worse,
// partially succeeded. Every name is normalised (case-folded, whitespace around parentheses
// collapsed) and mapped to the canonical value:
//
//     "Fibe loan"            -> "Fibe Loan"
//     "Bajaj loan"           -> "Bajaj Loan"
//     "Paytm ( Delhi T44P)"  -> "Paytm ( Delhi T44P )"     (missing space before the bracket)
//     "Paytm (Noida CK5Y)"   -> "Paytm ( Noida CK5Y )"     (missing spaces inside the brackets)
//     "Cash (backend)"       -> "Cash ( backend )"         (same)
//     "HDFC Skin" / "ICICI Medihub" / "HDFC Medihub"       (already exact)
//
// All 143 rows resolved cleanly against the enum when this script was prepared, and none has
// fromAccount === toAccount (which the create route rejects). The script re-checks both anyway
// and refuses to write if anything fails — a name that stops resolving means the ACCOUNTS enum
// changed, and that must be looked at rather than skipped.
//
// ─── WHAT A CONTRA ENTRY DOES, AND WHY THE TOTAL IS NOT A "TOTAL" ───────────────────────────
//
// The Rs 71,63,174.32 across these 143 rows is NOT revenue, expense, or any kind of net figure.
// Each row moves money out of one of our accounts and into another, so the company-wide balance
// is unchanged by every single one of them — that invariant is what the dry run's per-account
// net table below is for. If those nets don't look right, stop before applying.
//
// The mix here is what you'd expect: Paytm settling into HDFC Skin (69 rows), Bajaj/Fibe loan
// disbursals landing in HDFC Skin (31), inter-bank transfers between HDFC Skin and ICICI
// Medihub (26), and cash withdrawals into "Cash ( backend )" (17).
//
// ─── BRANCH ─────────────────────────────────────────────────────────────────────────────────
//
// Every row is Branch "Delhi", which is a valid ALL_BRANCHES value, so it is written as-is.
// Note the model's own warning: a branch-filtered close-book view HIDES untagged transfers, so
// tagging these "Delhi" (rather than leaving them company-level null) is what makes them
// visible in a Delhi-filtered Assets page. That matches how the sheet recorded them.
//
// ─── OTHER NOTES ────────────────────────────────────────────────────────────────────────────
//
// - Every row's Status is "Active" and "Moves balances" is "Yes", so none is imported cancelled.
// - The Reference column is blank on all 143 rows; the sheet's Remarks column carries the real
//   description ("Paytm Settlement", "Bajaj Finance", "ATW-...-cash withdrawl") and is written
//   to `remarks`.
// - `transferKind` is left at its "MANUAL" default. These are ordinary contra entries, NOT loan
//   settlements — even the Bajaj/Fibe rows, which are disbursals INTO our account, not the
//   settlement of a specific loan-financed sale. Marking them LOAN_SETTLEMENT would make
//   cancel-loan try to reverse them.
// - PERIOD LOCK is checked on BOTH accounts, exactly as
//   src/app/api/account-transfers/create/route.js does.
// - IDEMPOTENT: each transfer's remarks is prefixed "[BULK-CONTRA-<rowNum>]" and checked before
//   insert. Safe to re-run after a partial failure; never double-imports a row that succeeded.
//
// Usage:
//   node scripts/import-contra-entries-aug-2026.mjs                  # dry run
//   node scripts/import-contra-entries-aug-2026.mjs --dump-json       # entries out, no DB
//   node scripts/import-contra-entries-aug-2026.mjs --apply          # import
//   node scripts/import-contra-entries-aug-2026.mjs --from=2026-08-15 --to=2026-08-20

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

// Mirrors ACCOUNTS in src/constants/bankRouting.js (a script can't import the @/-aliased module).
const ACCOUNTS = [
  "Cash Book", "HDFC Skin", "HDFC Medihub", "ICICI Medihub", "Mumbai Receipts",
  "Cash ( backend )", "Paytm ( Delhi T44P )", "Paytm ( Noida CK5Y )",
  "Bajaj Loan", "Fibe Loan", "Pine Lab",
];
const ALL_BRANCHES = [
  "Delhi", "Mumbai", "Hyderabad", "Noida",
  "Patna", "Kolkata", "Ahmedabad", "Jaipur", "Bengaluru", "Pune", "Lucknow",
  "Chennai", "Jammu", "Kashmir", "Ranchi", "Prayagraj", "Chandigarh", "Jalandhar",
];

// ═══════════════════════════════════════════════════════════════════════════════
// THE DATA — parsed directly from contra_entry_13_Aug_to_24_Aug.xlsx. `fromRaw`/`toRaw` keep
// the sheet's original spelling next to the resolved enum value, so any future mismatch is
// visible rather than buried.
// ═══════════════════════════════════════════════════════════════════════════════
const ENTRIES = [
  {
    "rowNum": 2,
    "date": "2026-08-13",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 41575.3,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 3,
    "date": "2026-08-14",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 100914.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 4,
    "date": "2026-08-17",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 176872.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 5,
    "date": "2026-08-18",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 79592.4,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 6,
    "date": "2026-08-20",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 110074.82,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 7,
    "date": "2026-08-21",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 208236.52,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 8,
    "date": "2026-08-22",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 159184.8,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 9,
    "date": "2026-08-24",
    "fromRaw": "Fibe loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Fibe Loan",
    "toAccount": "HDFC Skin",
    "amount": 420611.3,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Fibe Finance",
    "status": "Active"
  },
  {
    "rowNum": 10,
    "date": "2026-08-13",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 13299.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 11,
    "date": "2026-08-14",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 45379.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 12,
    "date": "2026-08-14",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 42568.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 13,
    "date": "2026-08-16",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 38551.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 14,
    "date": "2026-08-16",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 34088.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 15,
    "date": "2026-08-16",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 34618.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 16,
    "date": "2026-08-16",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 43014.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 17,
    "date": "2026-08-16",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 25162.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 18,
    "date": "2026-08-17",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 25162.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 19,
    "date": "2026-08-17",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 45781.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 20,
    "date": "2026-08-17",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 34618.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 21,
    "date": "2026-08-19",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 28732.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 22,
    "date": "2026-08-19",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 34668.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 23,
    "date": "2026-08-20",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 29625.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 24,
    "date": "2026-08-20",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 20396.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 25,
    "date": "2026-08-21",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 43014.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 26,
    "date": "2026-08-21",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 45246.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 27,
    "date": "2026-08-21",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 38551.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 28,
    "date": "2026-08-21",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 30389.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 29,
    "date": "2026-08-22",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 42121.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 30,
    "date": "2026-08-23",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 51940.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 31,
    "date": "2026-08-23",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 43014.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 32,
    "date": "2026-08-23",
    "fromRaw": "Bajaj loan",
    "toRaw": "HDFC Skin",
    "fromAccount": "Bajaj Loan",
    "toAccount": "HDFC Skin",
    "amount": 29625.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Bajaj Finance",
    "status": "Active"
  },
  {
    "rowNum": 33,
    "date": "2026-08-13",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 4195.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 34,
    "date": "2026-08-13",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 49995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 35,
    "date": "2026-08-13",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 49500.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 36,
    "date": "2026-08-13",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 12995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 37,
    "date": "2026-08-13",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 58410.9,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 38,
    "date": "2026-08-14",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 39005.22,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 39,
    "date": "2026-08-14",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 44995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 40,
    "date": "2026-08-14",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 48995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 41,
    "date": "2026-08-14",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 10495.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 42,
    "date": "2026-08-14",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 12995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 43,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 5613.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 44,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 16195.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 45,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 48140.01,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 46,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 173995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 47,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 9995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 48,
    "date": "2026-08-15",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 15995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 49,
    "date": "2026-08-16",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 31258.68,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 50,
    "date": "2026-08-16",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 29995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 51,
    "date": "2026-08-16",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 118197.67,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 52,
    "date": "2026-08-16",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 8975.5,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 53,
    "date": "2026-08-16",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 12195.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 54,
    "date": "2026-08-17",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 5000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 55,
    "date": "2026-08-17",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 199161.54,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 56,
    "date": "2026-08-17",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 53140.01,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 57,
    "date": "2026-08-18",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 2000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 58,
    "date": "2026-08-18",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 29995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 59,
    "date": "2026-08-18",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 83485.26,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 60,
    "date": "2026-08-18",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 91995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 61,
    "date": "2026-08-19",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 486.25,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 62,
    "date": "2026-08-19",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 19995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 63,
    "date": "2026-08-19",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 4995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 64,
    "date": "2026-08-19",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 40995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 65,
    "date": "2026-08-19",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 65995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 66,
    "date": "2026-08-20",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 2000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 67,
    "date": "2026-08-20",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 2495.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 68,
    "date": "2026-08-20",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 31612.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 69,
    "date": "2026-08-20",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 11495.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 70,
    "date": "2026-08-20",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 12995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 71,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 3500.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 72,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 49995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 73,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 34995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 74,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 16993.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 75,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 50995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 76,
    "date": "2026-08-21",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 6967.51,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 77,
    "date": "2026-08-22",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 1000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 78,
    "date": "2026-08-22",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 48095.24,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 79,
    "date": "2026-08-22",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 25612.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 80,
    "date": "2026-08-22",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 81,
    "date": "2026-08-22",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 10925.97,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 82,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 6677.42,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 83,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 125898.48,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 84,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 5995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 85,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 1171.6,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 86,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 2925.97,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 87,
    "date": "2026-08-23",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 10995.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 88,
    "date": "2026-08-24",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 72967.51,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 89,
    "date": "2026-08-24",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 12424.55,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 90,
    "date": "2026-08-24",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 133694.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 91,
    "date": "2026-08-24",
    "fromRaw": "Paytm ( Delhi T44P)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Delhi T44P )",
    "toAccount": "HDFC Skin",
    "amount": 10557.53,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 92,
    "date": "2026-08-14",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 38584.2,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 93,
    "date": "2026-08-15",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 2700.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 94,
    "date": "2026-08-16",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 76175.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 95,
    "date": "2026-08-17",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 8600.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 96,
    "date": "2026-08-18",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 32181.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 97,
    "date": "2026-08-19",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 5798.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 98,
    "date": "2026-08-20",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 1985.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 99,
    "date": "2026-08-22",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 4385.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 100,
    "date": "2026-08-23",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 17992.16,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 101,
    "date": "2026-08-24",
    "fromRaw": "Paytm (Noida CK5Y)",
    "toRaw": "HDFC Skin",
    "fromAccount": "Paytm ( Noida CK5Y )",
    "toAccount": "HDFC Skin",
    "amount": 10240.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "Paytm Settlement",
    "status": "Active"
  },
  {
    "rowNum": 102,
    "date": "2026-08-14",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 135000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 103,
    "date": "2026-08-15",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 45000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 104,
    "date": "2026-08-16",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 175000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 105,
    "date": "2026-08-16",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 80000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 106,
    "date": "2026-08-17",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 195000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 107,
    "date": "2026-08-18",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 22000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 108,
    "date": "2026-08-21",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 150000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 109,
    "date": "2026-08-21",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 30000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 110,
    "date": "2026-08-21",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 40000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 111,
    "date": "2026-08-22",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 35000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 112,
    "date": "2026-08-23",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 35000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 113,
    "date": "2026-08-24",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 35000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 114,
    "date": "2026-08-24",
    "fromRaw": "HDFC Skin",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Skin",
    "toAccount": "ICICI Medihub",
    "amount": 70000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 115,
    "date": "2026-08-13",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 27900.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 116,
    "date": "2026-08-14",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 10000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 117,
    "date": "2026-08-15",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 35000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 118,
    "date": "2026-08-17",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 30000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 119,
    "date": "2026-08-18",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 28000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 120,
    "date": "2026-08-19",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 10000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 121,
    "date": "2026-08-19",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 19500.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 122,
    "date": "2026-08-20",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 20000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 123,
    "date": "2026-08-21",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 61000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 124,
    "date": "2026-08-23",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 12955.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 125,
    "date": "2026-08-24",
    "fromRaw": "ICICI Medihub",
    "toRaw": "HDFC Skin",
    "fromAccount": "ICICI Medihub",
    "toAccount": "HDFC Skin",
    "amount": 11500.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 126,
    "date": "2026-08-13",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 50000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 127,
    "date": "2026-08-14",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 35000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 128,
    "date": "2026-08-15",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 175000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 129,
    "date": "2026-08-16",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 45000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 130,
    "date": "2026-08-17",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 97000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 131,
    "date": "2026-08-18",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 50000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 132,
    "date": "2026-08-20",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 100000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 133,
    "date": "2026-08-21",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 225000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 134,
    "date": "2026-08-22",
    "fromRaw": "HDFC Skin",
    "toRaw": "Cash (backend)",
    "fromAccount": "HDFC Skin",
    "toAccount": "Cash ( backend )",
    "amount": 110000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "ATW-403875XXXXXX2828-DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 135,
    "date": "2026-08-14",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 87000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 136,
    "date": "2026-08-15",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 10000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 137,
    "date": "2026-08-16",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 93000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 138,
    "date": "2026-08-17",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 17000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 139,
    "date": "2026-08-21",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 80000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 140,
    "date": "2026-08-22",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 15000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 141,
    "date": "2026-08-23",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 80000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 142,
    "date": "2026-08-24",
    "fromRaw": "ICICI Medihub",
    "toRaw": "Cash (backend)",
    "fromAccount": "ICICI Medihub",
    "toAccount": "Cash ( backend )",
    "amount": 100000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "NFS/CASH WDL/609718008979/DELHI-cash withdrawl",
    "status": "Active"
  },
  {
    "rowNum": 143,
    "date": "2026-08-17",
    "fromRaw": "HDFC Medihub",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Medihub",
    "toAccount": "ICICI Medihub",
    "amount": 29700.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  },
  {
    "rowNum": 144,
    "date": "2026-08-21",
    "fromRaw": "HDFC Medihub",
    "toRaw": "ICICI Medihub",
    "fromAccount": "HDFC Medihub",
    "toAccount": "ICICI Medihub",
    "amount": 43000.0,
    "branch": "Delhi",
    "reference": "",
    "remarks": "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY",
    "status": "Active"
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const DUMP_JSON = args.includes("--dump-json");
const FROM = arg("from") || null;
const TO = arg("to") || null;

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let SELECTED = ENTRIES;
if (FROM) SELECTED = SELECTED.filter((e) => e.date >= FROM);
if (TO) SELECTED = SELECTED.filter((e) => e.date <= TO);

if (DUMP_JSON) {
  const out = "contra-entries-payload.json";
  fs.writeFileSync(out, JSON.stringify(SELECTED, null, 2));
  console.log(`Wrote ${out} — ${SELECTED.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function validate() {
  const errors = [];
  for (const e of SELECTED) {
    const where = `row ${e.rowNum} (${e.fromRaw} -> ${e.toRaw})`;
    if (!e.fromAccount || !ACCOUNTS.includes(e.fromAccount))
      errors.push(`${where}: "from" did not resolve to a valid account (raw: "${e.fromRaw}")`);
    if (!e.toAccount || !ACCOUNTS.includes(e.toAccount))
      errors.push(`${where}: "to" did not resolve to a valid account (raw: "${e.toRaw}")`);
    if (e.fromAccount && e.fromAccount === e.toAccount)
      errors.push(`${where}: a contra entry must move between two DIFFERENT accounts`);
    if (!(e.amount > 0)) errors.push(`${where}: amount must be > 0`);
    if (isNaN(new Date(e.date).getTime())) errors.push(`${where}: bad date "${e.date}"`);
    if (e.branch && !ALL_BRANCHES.includes(e.branch)) errors.push(`${where}: unknown branch "${e.branch}"`);
  }
  return errors;
}

async function run() {
  console.log("=".repeat(92));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${SELECTED.length} of ${ENTRIES.length}${FROM || TO ? `  (filtered ${FROM || "start"} -> ${TO || "end"})` : ""}`);
  console.log("=".repeat(92) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed — every account name resolves to the ACCOUNTS enum, no self-transfers.\n");

  // --- the invariant that matters for a contra entry ----------------------------------------
  const net = {};
  SELECTED.forEach((e) => {
    net[e.fromAccount] = (net[e.fromAccount] || 0) - e.amount;
    net[e.toAccount] = (net[e.toAccount] || 0) + e.amount;
  });
  const companyNet = r2(Object.values(net).reduce((s, v) => s + v, 0));

  console.log("--- NET EFFECT PER ACCOUNT (this is what to sanity-check) ---");
  Object.entries(net).sort().forEach(([acct, v]) =>
    console.log(`  ${acct.padEnd(26)} ${(v >= 0 ? "+" : "") + inr(v).padStart(17)}`),
  );
  console.log(`  ${"COMPANY-WIDE NET".padEnd(26)} ${inr(companyNet).padStart(18)}  ${Math.abs(companyNet) < 0.01 ? "<- 0, correct: contra moves money, never creates it" : "<-  NOT ZERO — STOP"}`);
  if (Math.abs(companyNet) >= 0.01) {
    console.error("\nABORTING — the company-wide net of a set of contra entries must be exactly zero.");
    process.exit(1);
  }

  const byRoute = {};
  SELECTED.forEach((e) => {
    const k = `${e.fromAccount}  ->  ${e.toAccount}`;
    byRoute[k] = byRoute[k] || { count: 0, amount: 0 };
    byRoute[k].count += 1;
    byRoute[k].amount += e.amount;
  });
  console.log("\n--- BY ROUTE ---");
  Object.entries(byRoute).sort().forEach(([route, v]) =>
    console.log(`  ${route.padEnd(52)} ${String(v.count).padStart(4)} rows  ${inr(v.amount).padStart(16)}`),
  );
  console.log(`  ${"".padEnd(52)} ${String(SELECTED.length).padStart(4)} rows  ${inr(r2(SELECTED.reduce((s, e) => s + e.amount, 0))).padStart(16)}  <- gross moved\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const AccountPeriod = mongoose.models.AccountPeriod || mongoose.model("AccountPeriod", new mongoose.Schema({}, { strict: false, collection: "accountperiods" }));
  const AccountTransfer = mongoose.models.AccountTransfer || mongoose.model("AccountTransfer", new mongoose.Schema({}, { strict: false, collection: "accounttransfers" }));

  // --- period lock, reimplemented (periodLock.js imports @/-aliased modules) -----------------
  const isOpeningSeed = (p) => new Date(p.periodStart).getTime() === new Date(p.periodEnd).getTime();
  async function closedPeriodsCovering(account, date) {
    const rows = await AccountPeriod.find({
      account, branch: null, isClosed: true,
      periodStart: { $lte: new Date(date) }, periodEnd: { $gte: new Date(date) },
    }).lean();
    return rows.filter((p) => !isOpeningSeed(p));
  }
  async function lockReason(account, date) {
    const [closed] = await closedPeriodsCovering(account, date);
    return closed ? `${account} is closed for that period` : null;
  }

  console.log("Checking idempotency tags and period locks (both accounts, as the route does)...");
  const toCreate = [];
  const already = [];
  const locked = [];

  for (const e of SELECTED) {
    const tag = `[BULK-CONTRA-${e.rowNum}]`;
    const exists = await AccountTransfer.findOne({ remarks: new RegExp(escapeRegex(tag)) }).select("_id").lean();
    if (exists) {
      already.push({ e, existingId: String(exists._id) });
      continue;
    }
    const fromLock = await lockReason(e.fromAccount, e.date);
    const toLock = fromLock ? null : await lockReason(e.toAccount, e.date);
    if (fromLock || toLock) {
      locked.push({ e, reason: fromLock || toLock });
      continue;
    }
    toCreate.push({ e, tag });
  }

  console.log(`  To create        : ${toCreate.length}`);
  console.log(`  Already imported : ${already.length}  (idempotent — safe re-run, skipped)`);
  console.log(`  Period locked    : ${locked.length}`);

  if (locked.length) {
    console.log("\n--- PERIOD LOCKED (skipped) ---");
    locked.forEach(({ e, reason }) => console.log(`  row ${e.rowNum}  ${e.date}  ${inr(e.amount)}  — ${reason}`));
  }

  if (!toCreate.length) {
    console.log("\nNothing to create.");
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Check the per-account nets above, then re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCreating ${toCreate.length} contra entr(ies)...`);
  const created = [];
  const failed = [];

  for (const { e, tag } of toCreate) {
    try {
      const doc = await AccountTransfer.create({
        fromAccount: e.fromAccount,
        toAccount: e.toAccount,
        amount: e.amount,
        date: new Date(e.date),
        branch: e.branch || null,
        reference: e.reference || "",
        remarks: `${tag} ${e.remarks}`.trim(),
        receipts: [],
        // Ordinary contra entries — NOT loan settlements. See the header note on why the
        // Bajaj/Fibe rows are MANUAL too.
        transferKind: "MANUAL",
        sourceTransactionId: null,
        isCancelled: false,
        createdBy: { ...IMPORT_IDENTITY, branch: e.branch || "", date: new Date() },
        log: [
          {
            action: "Created",
            newValue: String(e.amount),
            note: `Bulk import from contra_entry_13_Aug_to_24_Aug.xlsx, row ${e.rowNum}`,
            performedBy: IMPORT_IDENTITY,
            performedAt: new Date(),
          },
        ],
      });
      created.push({ rowNum: e.rowNum, id: String(doc._id), amount: e.amount, route: `${e.fromAccount} -> ${e.toAccount}` });
      console.log(`  row ${String(e.rowNum).padStart(4)}  ${e.date}  ${(e.fromAccount + " -> " + e.toAccount).padEnd(48)} ${inr(e.amount).padStart(14)}  OK`);
    } catch (err) {
      failed.push({ rowNum: e.rowNum, reason: err?.message || String(err) });
      console.log(`  row ${String(e.rowNum).padStart(4)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nCreated ${created.length}, ${failed.length} failed.`);
  if (failed.length) failed.forEach((f) => console.log(`  row ${f.rowNum}: ${f.reason}`));

  const reportPath = `contra-entries-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        source: "contra_entry_13_Aug_to_24_Aug.xlsx",
        grossMoved: r2(created.reduce((s, c) => s + c.amount, 0)),
        netPerAccount: net,
        created, failed,
        alreadyImported: already.map(({ e, existingId }) => ({ rowNum: e.rowNum, existingId })),
        periodLocked: locked.map(({ e, reason }) => ({ rowNum: e.rowNum, date: e.date, amount: e.amount, reason })),
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath} — keep it, the IDs are your undo list.`);
  console.log("\nVerify on /admin/assets: each account's closing balance should have moved by the");
  console.log("net shown above, and the company-wide total should be completely unchanged.");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
