
import mongoose from "mongoose";
import fs from "fs";
// import dotenv from "dotenv";
import { ACCOUNTS } from "../src/constants/bankRouting.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";

// dotenv.config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Embedded data - 508 rows (account names already normalised)
// ---------------------------------------------------------------------------
const ENTRIES = [
  { rowNum: 2, date: "2026-05-01", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 63990, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 3, date: "2026-05-01", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 458907.57, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 4, date: "2026-05-01", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 10000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 5, date: "2026-05-01", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 6, date: "2026-05-01", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 47000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 7, date: "2026-05-02", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 110866, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 8, date: "2026-05-02", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 406108, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 9, date: "2026-05-02", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 70000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 10, date: "2026-05-03", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 435121, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 11, date: "2026-05-03", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 244662.61, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 12, date: "2026-05-03", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 220000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 13, date: "2026-05-03", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 110000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 14, date: "2026-05-03", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 102000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 15, date: "2026-05-04", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 72639, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 16, date: "2026-05-04", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 93814.47, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 17, date: "2026-05-04", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 60000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 18, date: "2026-05-04", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 19, date: "2026-05-05", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 59974, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 20, date: "2026-05-05", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 172929.58000000002, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 21, date: "2026-05-05", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 10000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 22, date: "2026-05-05", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 25000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 23, date: "2026-05-05", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 142000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 24, date: "2026-05-06", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 173294, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 25, date: "2026-05-06", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 11527, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 26, date: "2026-05-06", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 50000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 27, date: "2026-05-06", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 28, date: "2026-05-07", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 72639, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 29, date: "2026-05-07", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 113346.42, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 30, date: "2026-05-07", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 154000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 31, date: "2026-05-07", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 32, date: "2026-05-07", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 33, date: "2026-05-07", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 53000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 34, date: "2026-05-07", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 35, date: "2026-05-08", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 333734, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 36, date: "2026-05-08", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 229429.58000000002, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 37, date: "2026-05-08", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 170000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 38, date: "2026-05-09", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 150320, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 39, date: "2026-05-09", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 516527.41, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 40, date: "2026-05-09", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 20000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 41, date: "2026-05-09", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 140000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 42, date: "2026-05-09", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 25000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 43, date: "2026-05-09", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 36000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 44, date: "2026-05-10", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 350147, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 45, date: "2026-05-10", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 275859.32999999996, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 46, date: "2026-05-10", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 50000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 47, date: "2026-05-10", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 42000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 48, date: "2026-05-10", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 49, date: "2026-05-11", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 208052, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 50, date: "2026-05-11", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 176707.3, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 51, date: "2026-05-11", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 13000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 52, date: "2026-05-11", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 21000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 53, date: "2026-05-11", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 54, date: "2026-05-12", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 168754, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 55, date: "2026-05-12", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 79616.6, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 56, date: "2026-05-12", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 112700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 57, date: "2026-05-13", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 63410, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 58, date: "2026-05-13", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 292390.66, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 59, date: "2026-05-13", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 199000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 60, date: "2026-05-13", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 61, date: "2026-05-13", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 30000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 62, date: "2026-05-13", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 63, date: "2026-05-14", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 79065, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 64, date: "2026-05-14", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 127471.77, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 65, date: "2026-05-14", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 70000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 66, date: "2026-05-14", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 67, date: "2026-05-15", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 147387.8, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 68, date: "2026-05-15", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 27000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 69, date: "2026-05-15", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 17900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 70, date: "2026-05-16", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 48321.66, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 71, date: "2026-05-16", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 14000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 72, date: "2026-05-16", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 58900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 73, date: "2026-05-16", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 74, date: "2026-05-16", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 9000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 75, date: "2026-05-16", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 76, date: "2026-05-17", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 216904, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 77, date: "2026-05-17", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 410472.76, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 78, date: "2026-05-17", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 1000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 79, date: "2026-05-17", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 32000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 80, date: "2026-05-17", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 127000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 81, date: "2026-05-17", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 30000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 82, date: "2026-05-17", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 83, date: "2026-05-18", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 158884, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 84, date: "2026-05-18", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 128767.76000000001, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 85, date: "2026-05-18", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 66200, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 86, date: "2026-05-18", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 87, date: "2026-05-18", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 40000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 88, date: "2026-05-18", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 42000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 89, date: "2026-05-19", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 59250, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 90, date: "2026-05-19", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 46385.5, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 91, date: "2026-05-19", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 29700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 92, date: "2026-05-19", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 45000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 93, date: "2026-05-19", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 94, date: "2026-05-19", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 19000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 95, date: "2026-05-20", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 161102.18, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 96, date: "2026-05-20", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 42000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 97, date: "2026-05-20", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 55000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 98, date: "2026-05-20", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 39000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 99, date: "2026-05-21", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 27055, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 100, date: "2026-05-21", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 85967.66, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 101, date: "2026-05-21", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 20000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 102, date: "2026-05-21", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 103000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 103, date: "2026-05-21", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 104, date: "2026-05-21", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 45000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 105, date: "2026-05-21", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 49600, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 106, date: "2026-05-21", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 107, date: "2026-05-22", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 87089, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 108, date: "2026-05-22", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 212256.40999999997, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 109, date: "2026-05-22", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 136000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 110, date: "2026-05-22", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 92000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 111, date: "2026-05-22", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 55000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 112, date: "2026-05-22", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 113, date: "2026-05-23", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 56933, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 114, date: "2026-05-23", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 220709.62, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 115, date: "2026-05-23", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 145000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 116, date: "2026-05-23", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 40000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 117, date: "2026-05-23", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 95000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 118, date: "2026-05-23", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 30000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 119, date: "2026-05-24", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 156905, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 120, date: "2026-05-24", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 180206.89, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 121, date: "2026-05-24", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 51000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 122, date: "2026-05-24", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 123, date: "2026-05-24", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 37000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 124, date: "2026-05-25", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 115289, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 125, date: "2026-05-25", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 82566, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 126, date: "2026-05-25", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 240729.84000000003, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 127, date: "2026-05-25", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 63000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 128, date: "2026-05-25", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 60000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 129, date: "2026-05-26", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 30205, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 130, date: "2026-05-26", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 73795.59999999999, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 131, date: "2026-05-26", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 70000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 132, date: "2026-05-26", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 22000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 133, date: "2026-05-26", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 23000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 134, date: "2026-05-26", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 42000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 135, date: "2026-05-27", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 83439, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 136, date: "2026-05-27", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 81775.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 137, date: "2026-05-27", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 123013.48, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 138, date: "2026-05-27", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 83000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 139, date: "2026-05-27", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 7000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 140, date: "2026-05-27", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 141, date: "2026-05-28", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 200700, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 142, date: "2026-05-28", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 34336.74, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 143, date: "2026-05-28", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 142277.68, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 144, date: "2026-05-28", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 15000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 145, date: "2026-05-28", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 28000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 146, date: "2026-05-28", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 147, date: "2026-05-28", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 148, date: "2026-05-29", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 131887, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 149, date: "2026-05-29", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 112440.03, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 150, date: "2026-05-29", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 33000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 151, date: "2026-05-29", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 11800, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 152, date: "2026-05-29", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 92000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 153, date: "2026-05-30", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 195120, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 154, date: "2026-05-30", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 97279.6, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 155, date: "2026-05-30", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 116417.67, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 156, date: "2026-05-30", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 190000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 157, date: "2026-05-30", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 44500, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 158, date: "2026-05-30", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 2000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 159, date: "2026-05-30", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 160, date: "2026-05-31", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 114303, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 161, date: "2026-05-31", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 44218, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 162, date: "2026-05-31", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 257093.18999999997, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 163, date: "2026-05-31", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 170000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 164, date: "2026-05-31", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 145000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 165, date: "2026-06-01", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 158629, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 166, date: "2026-06-01", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 276288.22000000003, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 167, date: "2026-06-01", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 80000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 168, date: "2026-06-01", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 71000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 169, date: "2026-06-01", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 170, date: "2026-06-01", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 171, date: "2026-06-02", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 63420, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 172, date: "2026-06-02", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 27840.6, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 173, date: "2026-06-02", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 123263.12, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 174, date: "2026-06-02", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 43400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 175, date: "2026-06-02", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 5000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 176, date: "2026-06-02", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 177, date: "2026-06-03", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 175338, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 178, date: "2026-06-03", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 46191.38, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 179, date: "2026-06-03", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 87580.36, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 180, date: "2026-06-03", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 133000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 181, date: "2026-06-03", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 56700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 182, date: "2026-06-03", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 183, date: "2026-06-03", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 155000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 184, date: "2026-06-03", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 29000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 185, date: "2026-06-04", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 128232.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 186, date: "2026-06-04", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 163633.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 187, date: "2026-06-04", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 200000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 188, date: "2026-06-04", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 38000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 189, date: "2026-06-05", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 123110, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 190, date: "2026-06-05", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 127347.84, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 191, date: "2026-06-05", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 144707.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 192, date: "2026-06-05", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 143000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 193, date: "2026-06-05", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 22300, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 194, date: "2026-06-05", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 75000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 195, date: "2026-06-06", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 186723, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 196, date: "2026-06-06", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 26530.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 197, date: "2026-06-06", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 212709.19, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 198, date: "2026-06-06", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 11900, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 199, date: "2026-06-06", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 72000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 200, date: "2026-06-07", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 204927, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 201, date: "2026-06-07", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 229575.71, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 202, date: "2026-06-07", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 203, date: "2026-06-07", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 204, date: "2026-06-08", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 180411, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 205, date: "2026-06-08", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 108766.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 206, date: "2026-06-08", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 300170.86, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 207, date: "2026-06-08", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 120000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 208, date: "2026-06-08", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 12400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 209, date: "2026-06-08", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 210, date: "2026-06-08", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 8000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 211, date: "2026-06-09", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 249950, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 212, date: "2026-06-09", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 88778.31999999999, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 213, date: "2026-06-09", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 170000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 214, date: "2026-06-09", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 215, date: "2026-06-09", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 216, date: "2026-06-10", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 96427, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 217, date: "2026-06-10", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 37143.12, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 218, date: "2026-06-10", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 129793.09, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 219, date: "2026-06-10", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 230000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 220, date: "2026-06-10", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 14700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 221, date: "2026-06-10", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 75000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 222, date: "2026-06-11", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 104321, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 223, date: "2026-06-11", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 48639.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 224, date: "2026-06-11", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 226825, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 225, date: "2026-06-11", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 105000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 226, date: "2026-06-11", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 44000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 227, date: "2026-06-11", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 120000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 228, date: "2026-06-12", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 107307, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 229, date: "2026-06-12", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 58805, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 230, date: "2026-06-12", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 164568.5, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 231, date: "2026-06-12", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 190000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 232, date: "2026-06-12", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 5840, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 233, date: "2026-06-12", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 60000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 234, date: "2026-06-12", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 25500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 235, date: "2026-06-13", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 187481, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 236, date: "2026-06-13", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 114966.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 237, date: "2026-06-13", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 142811.58000000002, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 238, date: "2026-06-13", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 160000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 239, date: "2026-06-13", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 90000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 240, date: "2026-06-13", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 45000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 241, date: "2026-06-14", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 201368, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 242, date: "2026-06-14", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 232264.13999999998, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 243, date: "2026-06-14", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 155000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 244, date: "2026-06-14", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 43000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 245, date: "2026-06-15", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 208054, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 246, date: "2026-06-15", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 207824.6, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 247, date: "2026-06-15", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 168976.01, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 248, date: "2026-06-15", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 344000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 249, date: "2026-06-15", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 80000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 250, date: "2026-06-16", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 113048, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 251, date: "2026-06-16", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 107814.78, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 252, date: "2026-06-16", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 128016, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 253, date: "2026-06-16", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 52000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 254, date: "2026-06-16", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 255, date: "2026-06-16", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 256, date: "2026-06-17", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 143891, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 257, date: "2026-06-17", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 70748.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 258, date: "2026-06-17", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 198301.65999999997, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 259, date: "2026-06-17", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 30000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 260, date: "2026-06-17", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 16800, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 261, date: "2026-06-17", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 155000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 262, date: "2026-06-17", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 263, date: "2026-06-18", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 77544, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 264, date: "2026-06-18", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 55681.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 265, date: "2026-06-18", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 136052.99, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 266, date: "2026-06-18", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 105000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 267, date: "2026-06-18", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 65000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 268, date: "2026-06-18", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 45000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 269, date: "2026-06-19", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 39373, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 270, date: "2026-06-19", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 154763, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 271, date: "2026-06-19", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 236108.54, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 272, date: "2026-06-19", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 39200, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 273, date: "2026-06-20", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 191562, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 274, date: "2026-06-20", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 28513.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 275, date: "2026-06-20", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 158287.64, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 276, date: "2026-06-20", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 122000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 277, date: "2026-06-20", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 26800, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 278, date: "2026-06-20", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 30000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 279, date: "2026-06-20", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 223000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 280, date: "2026-06-21", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 208246, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 281, date: "2026-06-21", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 234158.63, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 282, date: "2026-06-21", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 55000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 283, date: "2026-06-21", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 22000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 284, date: "2026-06-21", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 190000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 285, date: "2026-06-21", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 286, date: "2026-06-21", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 48000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 287, date: "2026-06-22", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 145709, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 288, date: "2026-06-22", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 327213.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 289, date: "2026-06-22", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 219826.6, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 290, date: "2026-06-22", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 310000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 291, date: "2026-06-22", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 200000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 292, date: "2026-06-22", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 120000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 293, date: "2026-06-22", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 294, date: "2026-06-22", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 36000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 295, date: "2026-06-23", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 132464, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 296, date: "2026-06-23", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 82820.66, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 297, date: "2026-06-23", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 75600, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 298, date: "2026-06-23", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 299, date: "2026-06-24", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 183528, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 300, date: "2026-06-24", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 44218, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 301, date: "2026-06-24", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 151053.51, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 302, date: "2026-06-24", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 62700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 303, date: "2026-06-24", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 77000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 304, date: "2026-06-25", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 57483.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 305, date: "2026-06-25", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 288173.65, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 306, date: "2026-06-25", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 65000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 307, date: "2026-06-25", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 95000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 308, date: "2026-06-25", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 80000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 309, date: "2026-06-25", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 310, date: "2026-06-26", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 195264, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 311, date: "2026-06-26", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 103666.1, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 312, date: "2026-06-26", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 214660.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 313, date: "2026-06-26", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 183000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 314, date: "2026-06-26", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 11000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 315, date: "2026-06-26", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 316, date: "2026-06-27", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 48057, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 317, date: "2026-06-27", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 114966.8, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 318, date: "2026-06-27", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 119138.39, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 319, date: "2026-06-27", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 56200, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 320, date: "2026-06-27", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 9000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 321, date: "2026-06-27", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 322, date: "2026-06-28", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 335589, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 323, date: "2026-06-28", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 140179.15, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 324, date: "2026-06-28", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 105000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 325, date: "2026-06-28", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 20000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 326, date: "2026-06-28", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 90000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 327, date: "2026-06-28", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 105400, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 328, date: "2026-06-29", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 120646, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 329, date: "2026-06-29", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 192780.59999999998, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 330, date: "2026-06-29", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 30699.3, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 331, date: "2026-06-29", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 15000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 332, date: "2026-06-29", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 71600, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 333, date: "2026-06-29", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 82500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 334, date: "2026-06-30", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 25162, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 335, date: "2026-06-30", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 66327, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 336, date: "2026-06-30", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 41100.119999999995, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 337, date: "2026-06-30", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 28600, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 338, date: "2026-06-30", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 6000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 339, date: "2026-07-01", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 74308, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 340, date: "2026-07-01", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 161392, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 341, date: "2026-07-01", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 1495, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 342, date: "2026-07-01", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 31000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 343, date: "2026-07-01", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 28500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 344, date: "2026-07-02", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 143513, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 345, date: "2026-07-02", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 79592.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 346, date: "2026-07-02", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 90956.3, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 347, date: "2026-07-02", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 50000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 348, date: "2026-07-02", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 45000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 349, date: "2026-07-02", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 137500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 350, date: "2026-07-03", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 296302, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 351, date: "2026-07-03", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 106123.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 352, date: "2026-07-03", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 244429, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 353, date: "2026-07-03", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 42000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 354, date: "2026-07-03", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 52000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 355, date: "2026-07-04", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 154730, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 356, date: "2026-07-04", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 121157.32, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 357, date: "2026-07-04", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 21500, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 358, date: "2026-07-05", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 162817, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 359, date: "2026-07-05", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 447071.4, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 360, date: "2026-07-05", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 361, date: "2026-07-06", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 203905, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 362, date: "2026-07-06", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 217648.28, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 363, date: "2026-07-06", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 451591.1, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 364, date: "2026-07-06", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 250000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 365, date: "2026-07-06", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 114500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 366, date: "2026-07-07", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 40063, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 367, date: "2026-07-07", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 99425.42, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 368, date: "2026-07-07", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 2748, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 369, date: "2026-07-07", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 57000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 370, date: "2026-07-07", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 371, date: "2026-07-07", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 372, date: "2026-07-07", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 97000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 373, date: "2026-07-07", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 33500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 374, date: "2026-07-08", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 152176, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 375, date: "2026-07-08", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 39796.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 376, date: "2026-07-08", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 133209, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 377, date: "2026-07-08", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 15300, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 378, date: "2026-07-08", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 379, date: "2026-07-08", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 22550, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 380, date: "2026-07-09", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 2000000, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 381, date: "2026-07-09", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 134636.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 382, date: "2026-07-09", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 85552.86, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 383, date: "2026-07-09", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 120000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 384, date: "2026-07-09", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 9400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 385, date: "2026-07-09", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 44000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 386, date: "2026-07-10", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 44218, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 387, date: "2026-07-10", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 46610.75, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 388, date: "2026-07-10", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 40000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 389, date: "2026-07-10", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 390, date: "2026-07-10", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 55000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 391, date: "2026-07-10", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 13500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 392, date: "2026-07-11", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 159181.04, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 393, date: "2026-07-11", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 313876.29, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 394, date: "2026-07-11", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 100000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 395, date: "2026-07-11", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 200000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 396, date: "2026-07-11", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 397, date: "2026-07-11", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 81000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 398, date: "2026-07-12", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 118812.48999999999, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 399, date: "2026-07-12", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 50000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 400, date: "2026-07-12", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 49000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 401, date: "2026-07-13", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 405155.72, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 402, date: "2026-07-13", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 245440.67, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 403, date: "2026-07-13", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 1000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 404, date: "2026-07-13", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 390000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 405, date: "2026-07-13", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 142700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 406, date: "2026-07-13", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 200000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 407, date: "2026-07-13", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 34000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 408, date: "2026-07-13", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 98000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 409, date: "2026-07-14", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 133974.45, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 410, date: "2026-07-14", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 128533.45000000001, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 411, date: "2026-07-14", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 5000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 412, date: "2026-07-14", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 32400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 413, date: "2026-07-14", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 414, date: "2026-07-14", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 415, date: "2026-07-15", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 134936.77000000002, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 416, date: "2026-07-15", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 16450, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 417, date: "2026-07-15", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 48000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 418, date: "2026-07-16", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 69657.6, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 419, date: "2026-07-16", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 145203.18, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 420, date: "2026-07-16", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 41000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 421, date: "2026-07-16", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 562600, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 422, date: "2026-07-16", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 423, date: "2026-07-16", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 424, date: "2026-07-17", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 61020.84, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 425, date: "2026-07-17", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 303567, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 426, date: "2026-07-17", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 123000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 427, date: "2026-07-17", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 428, date: "2026-07-17", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 18000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 429, date: "2026-07-18", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 194559.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 430, date: "2026-07-18", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 146836.31, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 431, date: "2026-07-18", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 1500, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 432, date: "2026-07-18", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 47500, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 433, date: "2026-07-18", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 100000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 434, date: "2026-07-18", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 435, date: "2026-07-18", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 25000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 436, date: "2026-07-18", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 93000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 437, date: "2026-07-19", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 343851.34, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 438, date: "2026-07-19", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 34000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 439, date: "2026-07-19", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 40000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 440, date: "2026-07-19", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 441, date: "2026-07-19", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 95500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 442, date: "2026-07-20", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 359050.16, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 443, date: "2026-07-20", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 45061, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 444, date: "2026-07-20", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 9772, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 445, date: "2026-07-20", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 99400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 446, date: "2026-07-20", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 70000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 447, date: "2026-07-20", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 60000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 448, date: "2026-07-20", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 12645, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 449, date: "2026-07-21", fromAccount: "Bajaj Loan", toAccount: "HDFC Skin", amount: 2375000, branch: "Delhi", reference: "", remarks: "Bajaj Finance" },
  { rowNum: 450, date: "2026-07-21", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 30952.6, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 451, date: "2026-07-21", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 171697, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 452, date: "2026-07-21", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 250000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 453, date: "2026-07-21", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 38400, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 454, date: "2026-07-21", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 200000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 455, date: "2026-07-21", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 90000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 456, date: "2026-07-21", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 35500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 457, date: "2026-07-22", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 123799.24, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 458, date: "2026-07-22", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 420388.38, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 459, date: "2026-07-22", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 75000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 460, date: "2026-07-22", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 35500, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 461, date: "2026-07-22", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 20000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 462, date: "2026-07-22", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 2500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 463, date: "2026-07-23", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 84014.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 464, date: "2026-07-23", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 236397.36000000002, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 465, date: "2026-07-23", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 110000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 466, date: "2026-07-23", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 17700, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 467, date: "2026-07-23", fromAccount: "HDFC Skin", toAccount: "Cash ( backend )", amount: 9000, branch: "Delhi", reference: "", remarks: "ATW-403875XXXXXX2828-DELHI-cash withdrawl" },
  { rowNum: 468, date: "2026-07-23", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 30000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 469, date: "2026-07-24", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 172450.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 470, date: "2026-07-24", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 82490.98, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 471, date: "2026-07-24", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 1617, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 472, date: "2026-07-24", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 69000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 473, date: "2026-07-24", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 90000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 474, date: "2026-07-25", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 57483.4, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 475, date: "2026-07-25", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 48804.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 476, date: "2026-07-25", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 102800, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 477, date: "2026-07-25", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 10000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 478, date: "2026-07-25", fromAccount: "HDFC Medihub", toAccount: "ICICI Medihub", amount: 53000, branch: "Delhi", reference: "", remarks: "From HDFC Medihub To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 479, date: "2026-07-25", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 100800, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 480, date: "2026-07-26", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 151636.85, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 481, date: "2026-07-26", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 48500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 482, date: "2026-07-27", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 251600.42, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 483, date: "2026-07-27", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 185702.2, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 484, date: "2026-07-27", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 20000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 485, date: "2026-07-27", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 586000, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 486, date: "2026-07-27", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 50000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 487, date: "2026-07-27", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 18500, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 488, date: "2026-07-28", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 216668.2, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 489, date: "2026-07-28", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 109762, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 490, date: "2026-07-28", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 684, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 491, date: "2026-07-28", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 23000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 492, date: "2026-07-28", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 14900, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 493, date: "2026-07-29", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 39619.33, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 494, date: "2026-07-29", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 251517, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 495, date: "2026-07-29", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 476, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 496, date: "2026-07-29", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 23000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 497, date: "2026-07-29", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 65000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 498, date: "2026-07-30", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 201634.08, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 499, date: "2026-07-30", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 97887.37, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 500, date: "2026-07-30", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 8000, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 501, date: "2026-07-30", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 35000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 502, date: "2026-07-30", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 68000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
  { rowNum: 503, date: "2026-07-31", fromAccount: "Fibe Loan", toAccount: "HDFC Skin", amount: 179055, branch: "Delhi", reference: "", remarks: "Fibe Finance" },
  { rowNum: 504, date: "2026-07-31", fromAccount: "Paytm ( Delhi T44P )", toAccount: "HDFC Skin", amount: 177882, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 505, date: "2026-07-31", fromAccount: "Paytm ( Noida CK5Y )", toAccount: "HDFC Skin", amount: 4882.59, branch: "Delhi", reference: "", remarks: "Paytm Settlement" },
  { rowNum: 506, date: "2026-07-31", fromAccount: "HDFC Skin", toAccount: "ICICI Medihub", amount: 137000, branch: "Delhi", reference: "", remarks: "From HDFC Skin To ICICI Medihub Transfer - CONTRA ENTRY" },
  { rowNum: 507, date: "2026-07-31", fromAccount: "ICICI Medihub", toAccount: "HDFC Skin", amount: 20200, branch: "Delhi", reference: "", remarks: "From ICICI Medihub To HDFC Skin Transfer - CONTRA ENTRY" },
  { rowNum: 508, date: "2026-07-31", fromAccount: "ICICI Medihub", toAccount: "Cash ( backend )", amount: 15000, branch: "Delhi", reference: "", remarks: "NFS/CASH WDL/609718008979/DELHI-cash withdrawl" },
  { rowNum: 509, date: "2026-07-31", fromAccount: "Cash Book", toAccount: "Cash ( backend )", amount: 9000, branch: "Delhi", reference: "", remarks: "Takenover Contra  entry to Backend" },
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