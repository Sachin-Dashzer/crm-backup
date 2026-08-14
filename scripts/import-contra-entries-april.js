
import mongoose from "mongoose";
import fs from "fs";
// import dotenv from "dotenv";
import { ACCOUNTS } from "../src/constants/bankRouting.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";

// dotenv.config({ path: ".env.local" });

const ENTRIES = [
  { rowNum: 2, date: "2026-08-01", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 48639.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 3, date: "2026-08-03", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 376054.56, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 4, date: "2026-08-07", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 37269.94, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 5, date: "2026-08-08", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 143266.32, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 6, date: "2026-08-10", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 304208.68, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 7, date: "2026-08-11", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 133516.04, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 8, date: "2026-08-12", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 159184.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 9, date: "2026-08-01", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 343830.99, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 10, date: "2026-08-02", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 247306.68, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 11, date: "2026-08-03", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 105175, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 12, date: "2026-08-04", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 97480, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 13, date: "2026-08-05", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 219447.51, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 14, date: "2026-08-06", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 318060.03, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 15, date: "2026-08-07", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 131724.51, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 16, date: "2026-08-08", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 249093.98, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 17, date: "2026-08-09", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 180750.66, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 18, date: "2026-08-10", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 148217, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 19, date: "2026-08-11", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 120315.90999999999, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 20, date: "2026-08-12", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 23933, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 21, date: "2026-08-01", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 35904.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 22, date: "2026-08-02", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 7817, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 23, date: "2026-08-05", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 4500, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 24, date: "2026-08-07", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 3000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 25, date: "2026-08-09", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 500, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 26, date: "2026-08-10", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 28275, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 27, date: "2026-08-12", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 10000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 28, date: "2026-08-02", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 104000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 29, date: "2026-08-03", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 35000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 30, date: "2026-08-06", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 93000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 31, date: "2026-08-07", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 35000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 32, date: "2026-08-08", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 18000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 33, date: "2026-08-09", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 10000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 34, date: "2026-08-10", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 300000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 35, date: "2026-08-11", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 100000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 36, date: "2026-08-12", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 25000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 37, date: "2026-08-01", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 21700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 38, date: "2026-08-02", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 5900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 39, date: "2026-08-03", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 24100, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 40, date: "2026-08-04", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 31900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 41, date: "2026-08-05", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 40900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 42, date: "2026-08-06", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 16000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 43, date: "2026-08-07", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 25300, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 44, date: "2026-08-09", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 30000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 45, date: "2026-08-10", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 84000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 46, date: "2026-08-12", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 63700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 47, date: "2026-08-01", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 60000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 48, date: "2026-08-04", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 49, date: "2026-08-07", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 35000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 50, date: "2026-08-10", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 25000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 51, date: "2026-08-11", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 28000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 52, date: "2026-08-01", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 53, date: "2026-08-03", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 54, date: "2026-08-05", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 55, date: "2026-08-06", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 25000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 56, date: "2026-08-11", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 12000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 57, date: "2026-08-03", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 34000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
];


// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALLOW_DUPES = args.includes("--allow-duplicates");

const MONGODB_URI = "mongodb://sachindashzer:user8520@ac-pu86ixj-shard-00-00.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-01.hwjor1r.mongodb.net:27017,ac-pu86ixj-shard-00-02.hwjor1r.mongodb.net:27017/?ssl=true&replicaSet=atlas-ool7b4-shard-0&authSource=admin&appName=crm";
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing in .env.local");
  process.exit(1);
}

// Minimal schema, strict:false - avoids importing the real model, which uses "@/" path
// aliases a plain node script cannot resolve, while writing the same document shape.
const AccountTransfer =
  mongoose.models.AccountTransfer ||
  mongoose.model(
    "AccountTransfer",
    new mongoose.Schema({}, { strict: false, collection: "accounttransfers" })
  );

const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
function validate(entries) {
  const errors = [];
  for (const e of entries) {
    const where = `row ${e.rowNum}`;
    if (!ACCOUNTS.includes(e.fromAccount))
      errors.push(`${where}: fromAccount "${e.fromAccount}" is not in ACCOUNTS (src/constants/bankRouting.js)`);
    if (!ACCOUNTS.includes(e.toAccount))
      errors.push(`${where}: toAccount "${e.toAccount}" is not in ACCOUNTS`);
    if (e.fromAccount === e.toAccount)
      errors.push(`${where}: from and to are the same account ("${e.fromAccount}")`);
    if (e.branch && !ALL_BRANCHES.includes(e.branch))
      errors.push(`${where}: unknown branch "${e.branch}"`);
    if (!(e.amount > 0)) errors.push(`${where}: amount must be > 0 (got ${e.amount})`);
    if (isNaN(new Date(e.date).getTime())) errors.push(`${where}: bad date "${e.date}"`);
  }
  return errors;
}

function netByAccount(entries) {
  const net = {};
  for (const e of entries) {
    net[e.fromAccount] = (net[e.fromAccount] || 0) - e.amount;
    net[e.toAccount] = (net[e.toAccount] || 0) + e.amount;
  }
  return net;
}

// ---------------------------------------------------------------------------
async function run() {
  const total = ENTRIES.reduce((s, e) => s + e.amount, 0);

  console.log("=".repeat(80));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${ENTRIES.length}   Total moved: ${inr(total)}`);
  console.log("=".repeat(80) + "\n");

  const errors = validate(ENTRIES);
  if (errors.length) {
    console.error(`VALIDATION FAILED - ${errors.length} problem(s). Nothing imported.\n`);
    errors.slice(0, 25).forEach((e) => console.error("  " + e));
    if (errors.length > 25) console.error(`  ...and ${errors.length - 25} more`);
    if (errors.some((e) => e.includes("not in ACCOUNTS"))) {
      console.error(`\nFIX: add the account(s) above to ACCOUNTS in src/constants/bankRouting.js,`);
      console.error(`     or correct the spelling in this script's ENTRIES if it is a typo.`);
    }
    process.exit(1);
  }
  console.log("Validation passed - all accounts, branches, amounts and dates are valid.\n");

  // --- the invariant check ---
  const net = netByAccount(ENTRIES);
  const netSum = Object.values(net).reduce((a, b) => a + b, 0);

  console.log("--- NET EFFECT BY ACCOUNT ---");
  Object.entries(net).sort((a, b) => b[1] - a[1]).forEach(([acc, v]) => {
    const sign = v >= 0 ? "+" : "-";
    console.log(`  ${acc.padEnd(24)} ${sign}${inr(Math.abs(v))}`);
  });
  console.log(`  ${"NET SUM".padEnd(24)} ${inr(netSum)}`);

  if (Math.abs(netSum) > 0.005) {
    console.error(`\nABORTING - net sum is ${netSum}, not zero.`);
    console.error(`A contra entry moves money between own accounts and cannot change the total.`);
    console.error(`A non-zero sum means a sign error, and importing it would corrupt every balance.`);
    process.exit(1);
  }
  console.log("  (zero as required - contra entries never change the total cash position)\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // --- duplicate guard, batched by date so 508 rows are not 508 round trips ---
  console.log("Checking for already-imported rows...");
  const dupes = [];
  const byDate = new Map();
  ENTRIES.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });

  for (const [dateStr, group] of byDate) {
    const d = new Date(dateStr);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

    const existing = await AccountTransfer.find({
      date: { $gte: dayStart, $lte: dayEnd },
    }).select("fromAccount toAccount amount remarks").lean();

    const seen = new Map();
    existing.forEach((x) => {
      seen.set(`${x.fromAccount}|${x.toAccount}|${x.amount}|${x.remarks || ""}`, String(x._id));
    });

    group.forEach((e) => {
      const key = `${e.fromAccount}|${e.toAccount}|${e.amount}|${e.remarks}`;
      if (seen.has(key)) dupes.push({ rowNum: e.rowNum, id: seen.get(key), amount: e.amount });
    });
  }

  if (dupes.length) {
    console.log(`\nWARNING - ${dupes.length} row(s) appear to be already imported:`);
    dupes.slice(0, 20).forEach((d) => console.log(`  row ${d.rowNum}  ${inr(d.amount)}  -> existing ${d.id}`));
    if (dupes.length > 20) console.log(`  ...and ${dupes.length - 20} more`);
    console.log("");
    if (APPLY && !ALLOW_DUPES) {
      console.error("Refusing to import. Re-run with --allow-duplicates if these are genuinely separate transfers.");
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log("No duplicates found.\n");
  }

  // --- build documents ---
  const docs = ENTRIES.map((e) => ({
    fromAccount: e.fromAccount,
    toAccount: e.toAccount,
    amount: e.amount,
    date: new Date(e.date),
    branch: e.branch || null,
    reference: e.reference || "",
    remarks: e.remarks || "",
    receipts: [],
    isCancelled: false,
    createdBy: { name: "Bulk Import", email: "import@system", branch: e.branch || "", date: new Date() },
    log: [{
      action: "Created",
      note: "Imported from contra_entry_active_may_to_july.xlsx",
      performedBy: { name: "Bulk Import", email: "import@system" },
      performedAt: new Date(),
    }],
  }));

  // --- summaries ---
  const byPair = {}, byMonth = {};
  docs.forEach((d, i) => {
    const pair = `${d.fromAccount} -> ${d.toAccount}`;
    byPair[pair] = (byPair[pair] || 0) + d.amount;
    byMonth[ENTRIES[i].date.slice(0, 7)] = (byMonth[ENTRIES[i].date.slice(0, 7)] || 0) + d.amount;
  });

  console.log("--- BY TRANSFER PAIR ---");
  Object.entries(byPair).sort((a, b) => b[1] - a[1])
    .forEach(([p, v]) => console.log(`  ${p.padEnd(42)} ${inr(v)}`));

  console.log("\n--- BY MONTH ---");
  Object.entries(byMonth).sort().forEach(([m, v]) => console.log(`  ${m}   ${inr(v)}`));

  if (!APPLY) {
    console.log(`\nDRY RUN - nothing written. Re-run with --apply to import.`);
    console.log(`Reconcile the net effect above against your bank and settlement statements first.`);
    await mongoose.disconnect();
    return;
  }

  // --- insert in batches ---
  console.log("\nInserting...");
  const BATCH = 200;
  const insertedIds = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const res = await AccountTransfer.insertMany(docs.slice(i, i + BATCH), { ordered: true });
    insertedIds.push(...res.map((d) => String(d._id)));
    console.log(`  ${insertedIds.length}/${docs.length}`);
  }

  console.log(`\nInserted ${insertedIds.length} contra entries moving ${inr(total)}.`);

  const reportPath = `contra-import-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    source: "contra_entry_active_may_to_july.xlsx",
    rowCount: insertedIds.length,
    totalMoved: total,
    netEffectByAccount: net,
    byMonth,
    insertedIds,
  }, null, 2));
  console.log(`Report and inserted IDs written to ${reportPath} - keep this, it is your undo list.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});