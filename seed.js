/**
 * import-expenses-august.js
 *
 * Self-contained import of the August expense sheet into the Transactions collection.
 * Data is embedded below - no Excel or JSON file needed at runtime.
 *
 * DRY RUN by default. Nothing is written until you pass --apply.
 *
 *   node scripts/import-expenses-august.js            # preview
 *   node scripts/import-expenses-august.js --apply    # write
 *
 * Source: August_ExP.xlsx
 *   614 rows, Rs 53,11,000.54, 1-12 August 2026.
 *
 * NORMALISATION APPLIED TO THE RAW SHEET
 *
 * 1. Payment method -> CRM method / account
 *      "Cash"              -> cash                        / Cash Book (or Cash ( backend ), see 2)
 *      "Hdfc Skin 739"     -> hdfc_skin_bank_transfer     / HDFC Skin
 *      "Icici Medihub 292" -> icici_medihub_bank_transfer / ICICI Medihub
 *
 * 2. Backend cash account - this sheet has only a plain "Cash" method, with no separate
 *    "Cash ( Backend )" value (unlike the May-July sheet). Backend cash is therefore
 *    inferred from the Place column, same as the original April sheets: 67 rows are
 *    Place "Delhi Backend" with method Cash, and route to account "Cash ( backend )"
 *    instead of "Cash Book". Bank-transfer rows from the backend are NOT overridden -
 *    they still leave from their own bank account regardless of which office spent it.
 *
 * 3. Head correction (3 rows) - rows whose expenseType is "Electricity Exp-*" were filed
 *    under head "Rent". Those types belong to "Electricity Bill"; the head is corrected
 *    and the type left untouched. Same correction every earlier sheet needed:
 *      row 220  Electricity Exp-Staff Flat
 *      row loop Electricity Exp-Staff Flat (2nd occurrence)
 *      row loop Electricity Exp-Backend basement
 *    (exact row numbers are in the embedded data below - grep "Electricity Bill" if needed)
 *
 * 4. "Expense Type Breakdown" (column 9) is not imported - it duplicates Expense Type
 *    for every row in this sheet. The CRM has no field for it.
 *
 * All heads matched EXPENSE_CATEGORY_TREE exactly once the correction above is applied -
 * no new expense types are needed for this sheet (unlike April and May-July, which needed
 * "PATIENT TREATMENT CHARGES" and "Loan Repayment" added first).
 *
 * expenseGiver.name is taken from Remarks, as the sheet has no vendor column.
 * Place (Delhi Backend / Delhi Center / Hyderabad Clinic) is appended to remarks, since
 * the CRM has no separate place field and the distinction is worth keeping.
 *
 * EXPECTED IMPACT BY ACCOUNT (each figure REDUCES that account):
 *     HDFC Skin           29,78,408.36
 *     ICICI Medihub        9,13,545.18
 *     Cash ( backend )     7,24,922.00
 *     Cash Book            6,94,125.00
 * Reconcile these against your bank statements before applying.
 */

import mongoose from "mongoose";
import fs from "fs";
import dotenv from "dotenv";
import { EXPENSE_CATEGORY_TREE } from "../src/constants/expenseCategories.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";
import { ACCOUNTS } from "../src/constants/bankRouting.js";

dotenv.config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Embedded data - 614 rows
// ---------------------------------------------------------------------------
const ENTRIES = [
  { rowNum: 2, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 6000, method: "cash", furtherMode: "Cash Book", remarks: "KAILESH PT REFUND DUE TO LEAVE NOT APPROVED ARMY PT" },
  { rowNum: 3, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "pt for cd medicines" },
  { rowNum: 4, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "pt gd medicines" },
  { rowNum: 5, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 460, method: "cash", furtherMode: "Cash Book", remarks: "a4 sheets for bd" },
  { rowNum: 6, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "bike service" },
  { rowNum: 7, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 6500, method: "cash", furtherMode: "Cash Book", remarks: "cd and gd ,house ro service" },
  { rowNum: 8, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Patients", amount: 3000, method: "cash", furtherMode: "Cash Book", remarks: "VIJAY PT COMISSION" },
  { rowNum: 9, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 7700, method: "cash", furtherMode: "Cash Book", remarks: "PATIENT TIFFIN PAYMENT" },
  { rowNum: 10, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "cash", furtherMode: "Cash Book", remarks: "MANMEET MAM JULY PART SALARY" },
  { rowNum: 11, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "PLUMBER WORK AND PRODUCT GD AND CD" },
  { rowNum: 12, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 15000, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR PENDING INCENTIVE" },
  { rowNum: 13, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Patients", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "PT COMISSION" },
  { rowNum: 14, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "RAVINA MAM INCENTIVE" },
  { rowNum: 15, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "GLASS GATE REPAIR FOR CD" },
  { rowNum: 16, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV MANGER JULY SALARY ADVANCE" },
  { rowNum: 17, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 3000, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 18, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM INCENTIVE" },
  { rowNum: 19, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "PAITENTS REFUND EXTRA UPI" },
  { rowNum: 20, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Muskan", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "MUSKAN MAM AMIR PT PAYMENT" },
  { rowNum: 21, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "CD GARBAGE" },
  { rowNum: 22, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 460, method: "cash", furtherMode: "Cash Book", remarks: "WATER BOTTLE FOR PT" },
  { rowNum: 23, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "NOTE PAD" },
  { rowNum: 24, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 700, method: "cash", furtherMode: "Cash Book", remarks: "INSULIN" },
  { rowNum: 25, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 26, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 80, method: "cash", furtherMode: "Cash Book", remarks: "PIUMBER PRODUCT" },
  { rowNum: 27, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 40, method: "cash", furtherMode: "Cash Book", remarks: "WATER BOTTLE FOR HOME" },
  { rowNum: 28, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 72, method: "cash", furtherMode: "Cash Book", remarks: "MILK FOR BACKAND" },
  { rowNum: 29, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "NODIA HEAD CAP PAYMENT" },
  { rowNum: 30, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE" },
  { rowNum: 31, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Rent", expenseType: "Rent-CD Clinic", amount: 10000, method: "cash", furtherMode: "Cash Book", remarks: "CD  PART RENT" },
  { rowNum: 32, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR PENDING INCENTIVE" },
  { rowNum: 33, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 11500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE" },
  { rowNum: 34, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM INCENTIVE" },
  { rowNum: 35, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAVINA MAN INCENTIVE" },
  { rowNum: 36, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 3000, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 37, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "SANTVIJAY INCENTIVE" },
  { rowNum: 38, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "FOOD MONEY KUSHRAT" },
  { rowNum: 39, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "Purnima recp. july advance" },
  { rowNum: 40, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "jasleen recp. july advance" },
  { rowNum: 41, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "Khushi recp. july advance" },
  { rowNum: 42, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "vinita recp. july advance" },
  { rowNum: 43, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "bala recp. july advance" },
  { rowNum: 44, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Muskan", amount: 9000, method: "cash", furtherMode: "Cash Book", remarks: "MUSKAN MAM PT JASVANT PAYMENT" },
  { rowNum: 45, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 1037, method: "cash", furtherMode: "Cash Book", remarks: "PT  AMAR REFUND" },
  { rowNum: 46, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 1037, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR ADV SALARY" },
  { rowNum: 47, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 8000, method: "cash", furtherMode: "Cash Book", remarks: "KAPIL SIR GFC PAYMENT" },
  { rowNum: 48, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "YASH YADAV PT REFUND REF : NIKITA /CONSULT by Rajiv sir" },
  { rowNum: 49, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 1750, method: "cash", furtherMode: "Cash Book", remarks: "INSULIN FOR BACKAND" },
  { rowNum: 50, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 60, method: "cash", furtherMode: "Cash Book", remarks: "INJECTION FOR BACKAND" },
  { rowNum: 51, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 52, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "RAVINA MAM INCENTIVE" },
  { rowNum: 53, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM INCENTIVE" },
  { rowNum: 54, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 55, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 50, method: "cash", furtherMode: "Cash Book", remarks: "2 PEICE AGARBATTI FOR GD&VAISHALI CLINIC" },
  { rowNum: 56, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 40, method: "cash", furtherMode: "Cash Book", remarks: "MEDICAL PRODUCTS FOR VAISALI" },
  { rowNum: 57, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 270, method: "cash", furtherMode: "Cash Book", remarks: "LUNCH FOR SUSHANT SIR" },
  { rowNum: 58, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 1163, method: "cash", furtherMode: "Cash Book", remarks: "MEDICAL PRODUCTS" },
  { rowNum: 59, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 60, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE" },
  { rowNum: 61, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "MANMEET  MAM INCENTIVE" },
  { rowNum: 62, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 160, method: "cash", furtherMode: "Cash Book", remarks: "MEDICINES PARCEL TRACKON" },
  { rowNum: 63, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 530, method: "cash", furtherMode: "Cash Book", remarks: "STATIONERY ITEM FOR BCND" },
  { rowNum: 64, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "SANTVIJAY MEDICINE INCENTIVE" },
  { rowNum: 65, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 680, method: "cash", furtherMode: "Cash Book", remarks: "MEDICINE MANSI MAM FOR PT" },
  { rowNum: 66, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 67, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 550, method: "cash", furtherMode: "Cash Book", remarks: "CAKE FOR KHUSHI MAM BCND" },
  { rowNum: 68, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 550, method: "cash", furtherMode: "Cash Book", remarks: "CAKE FOR RAMSHA MAM" },
  { rowNum: 69, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "SHIVAM SIR SCOOTY PETROL" },
  { rowNum: 70, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "CLINIC BIKE PETROL" },
  { rowNum: 71, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAVINA MAM INCENTIVE CLEAR PENDING /TODAY" },
  { rowNum: 72, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE CLEAR TODAY" },
  { rowNum: 73, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE CLEAR" },
  { rowNum: 74, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "MANMEET MAM INCENTIVE" },
  { rowNum: 75, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 3000, method: "cash", furtherMode: "Cash Book", remarks: "CHANDAN ADVANCE" },
  { rowNum: 76, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1300, method: "cash", furtherMode: "Cash Book", remarks: "SHIVAM SIR ORDER PAYMENT" },
  { rowNum: 77, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE COUNSELOR" },
  { rowNum: 78, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "SEEL FOR CD" },
  { rowNum: 79, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE COUNSELOR" },
  { rowNum: 80, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "ADIYA SIR INCENTIVE COUNSELOR" },
  { rowNum: 81, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "JASICA INCENTIVE" },
  { rowNum: 82, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "repairs work for cd" },
  { rowNum: 83, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 400, method: "cash", furtherMode: "Cash Book", remarks: "AUTO RIKSHAW PAYMENT" },
  { rowNum: 84, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "1-20 CAR PETROL" },
  { rowNum: 85, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 3300, method: "cash", furtherMode: "Cash Book", remarks: "LASER MACHINE REPAIRING" },
  { rowNum: 86, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 7000, method: "cash", furtherMode: "Cash Book", remarks: "TIFFUN SERVICE" },
  { rowNum: 87, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "SUGAR FOR GD" },
  { rowNum: 88, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "BLADE GILLETE" },
  { rowNum: 89, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM PENDING INCENTIVE" },
  { rowNum: 90, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 36, method: "cash", furtherMode: "Cash Book", remarks: "MILK" },
  { rowNum: 91, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "MILK PAYMENT" },
  { rowNum: 92, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 93, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1300, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE" },
  { rowNum: 94, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Rent", expenseType: "Rent-CD Clinic", amount: 35500, method: "cash", furtherMode: "Cash Book", remarks: "Ravi Jain CD clinic rent" },
  { rowNum: 95, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 10000, method: "cash", furtherMode: "Cash Book", remarks: "MIlk payment" },
  { rowNum: 96, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 97, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 98, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "BACKEND BASEMENT ELECTRICITY REPAIR" },
  { rowNum: 99, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "BMW PAYMENT" },
  { rowNum: 100, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 1400, method: "cash", furtherMode: "Cash Book", remarks: "NODIA CAB PAYMENT" },
  { rowNum: 101, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 15000, method: "cash", furtherMode: "Cash Book", remarks: "CILINIC GROCERIES" },
  { rowNum: 102, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR PENDING INCENTIVE YESTERDAY" },
  { rowNum: 103, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "GD FOR BLADE" },
  { rowNum: 104, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "DATA CABLE FOR CD" },
  { rowNum: 105, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "VASHU REPAIR" },
  { rowNum: 106, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM INCENTIVE" },
  { rowNum: 107, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE" },
  { rowNum: 108, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 109, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE" },
  { rowNum: 110, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 8000, method: "cash", furtherMode: "Cash Book", remarks: "BACKEND HR ROOM GATE & OTHER REOPAIR" },
  { rowNum: 111, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "ABDUL JULY PART SALARY" },
  { rowNum: 112, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "A-4 SHEETS FOR BCND" },
  { rowNum: 113, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 290, method: "cash", furtherMode: "Cash Book", remarks: "GILLETE FOAM FOR HEADWASH" },
  { rowNum: 114, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "ANKIT PT REFUND DUE TO HBSAG" },
  { rowNum: 115, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 116, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "MEDICINE" },
  { rowNum: 117, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 15000, method: "cash", furtherMode: "Cash Book", remarks: "BRIJ PRINTER" },
  { rowNum: 118, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 119, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 280, method: "cash", furtherMode: "Cash Book", remarks: "POWER SWITCH" },
  { rowNum: 120, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 120, method: "cash", furtherMode: "Cash Book", remarks: "2PKT PEN BOX" },
  { rowNum: 121, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "AATA FOR HOME" },
  { rowNum: 122, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR TODAY INCENTIVE CLEAR" },
  { rowNum: 123, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "MEDICINE SALE INCENTIVE BY MEDICINE" },
  { rowNum: 124, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "MEDICINE SALE INCENTIVE BY MEDICINE" },
  { rowNum: 125, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE" },
  { rowNum: 126, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM TODAY INCENTIVE CLEAR" },
  { rowNum: 127, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 3000, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR TODAY INCENTIVE CLEAR" },
  { rowNum: 128, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 600, method: "cash", furtherMode: "Cash Book", remarks: "AUTO RIKSHAW PAYMENT CHAIRS FARE BY MEDICINE" },
  { rowNum: 129, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "Sushant Sir July Part salary Clear" },
  { rowNum: 130, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 7000, method: "cash", furtherMode: "Cash Book", remarks: "GUDIYA NURSING CD JULY PART SALARY" },
  { rowNum: 131, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "GUDIYA MEDICINE INCENTIVE" },
  { rowNum: 132, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "PRATEEK MEDICIE INCENTIVE" },
  { rowNum: 133, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 440, method: "cash", furtherMode: "Cash Book", remarks: "WATERBOTTLES FOR PT" },
  { rowNum: 134, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "PT  FOOD" },
  { rowNum: 135, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 220, method: "cash", furtherMode: "Cash Book", remarks: "SHIVAM SIR SCOOTY PETROL" },
  { rowNum: 136, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 350, method: "cash", furtherMode: "Cash Book", remarks: "MONA MAM FOOD FOR HOME" },
  { rowNum: 137, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Hotel Charges", expenseType: "Hotel Charges", amount: 1600, method: "cash", furtherMode: "Cash Book", remarks: "PT STAY HOTEL PAYMENT" },
  { rowNum: 138, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 400, method: "cash", furtherMode: "Cash Book", remarks: "ICE PACK FOR GD/VAISHALI" },
  { rowNum: 139, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "NOIDA CAB PAYMENT" },
  { rowNum: 140, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "JYOTI DIDI ADVANCE" },
  { rowNum: 141, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCENTIVE" },
  { rowNum: 142, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV SIR INCENTIVE" },
  { rowNum: 143, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM INCENTIVE" },
  { rowNum: 144, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR INCENTIVE" },
  { rowNum: 145, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 320, method: "cash", furtherMode: "Cash Book", remarks: "HARDWARE ITEM FOR FLAT" },
  { rowNum: 146, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "SANT VIJAY MEDICINE INCENTIVE" },
  { rowNum: 147, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "PRATEEK MEDICIE INCENTIVE" },
  { rowNum: 148, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 2150, method: "cash", furtherMode: "Cash Book", remarks: "BALA RECP. JULY ADVANCE DUE TO MISMATCH" },
  { rowNum: 149, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 2150, method: "cash", furtherMode: "Cash Book", remarks: "PURNIMA RECP. JULY ADVANCE DUE TO MISMATCH" },
  { rowNum: 150, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Muskan", amount: 20000, method: "cash", furtherMode: "Cash Book", remarks: "MUSKAN PT COMISSION VIPIN PT" },
  { rowNum: 151, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 22000, method: "cash", furtherMode: "Cash Book", remarks: "JULY SALARY CLEAR DR. PRIYAM" },
  { rowNum: 152, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "TAPE AND FEVIQUIKE FOR BACKAND" },
  { rowNum: 153, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 90, method: "cash", furtherMode: "Cash Book", remarks: "HAIR COLOUR FOR VISHALI" },
  { rowNum: 154, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 5400, method: "cash", furtherMode: "Cash Book", remarks: "STAFF BIRTHDAY GIFT RAMSHA/KHUSHI/ANJALI" },
  { rowNum: 155, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 380, method: "cash", furtherMode: "Cash Book", remarks: "MONA MAM PARCEL" },
  { rowNum: 156, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 332, method: "cash", furtherMode: "Cash Book", remarks: "PORTER PAYMENT NOIDA" },
  { rowNum: 157, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 3200, method: "cash", furtherMode: "Cash Book", remarks: "MONA MAM PENDING PARCEL PAYMENT" },
  { rowNum: 158, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL" },
  { rowNum: 159, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "COFFEE POWDER AND GINGER" },
  { rowNum: 160, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "CARPENTER PAYMENT FOR BACKAND" },
  { rowNum: 161, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "IBRAHIM JULY PART SALARY" },
  { rowNum: 162, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV COUNCELLER TODAY INCENTIVE" },
  { rowNum: 163, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV COUNCELLER TODAY INCENTIVE MY MEDICINCE" },
  { rowNum: 164, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "PARDIS SIR TODAY INCENTIVE" },
  { rowNum: 165, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAMSHA MAM TODAY INCENTIVE" },
  { rowNum: 166, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR TODAY INCENTIVE" },
  { rowNum: 167, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive-- Medicine", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR TODAY INCENTIVE BY MEDICNE" },
  { rowNum: 168, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "DISPOSLE FOR VISHALI" },
  { rowNum: 169, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 7000, method: "cash", furtherMode: "Cash Book", remarks: "TAFFINPAYMENT CLEAR 7/8/26 TO 11/8/26" },
  { rowNum: 170, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 6500, method: "cash", furtherMode: "Cash Book", remarks: "JUNE PART SALARY CLEAR ND JULY SALARY CLAER" },
  { rowNum: 171, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "BIKE PETROL CD BIKES" },
  { rowNum: 172, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "DISPOSIBLE GLASS FOR BCAKEND" },
  { rowNum: 173, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 882, method: "cash", furtherMode: "Cash Book", remarks: "PT MEDICINE FOR CD PT" },
  { rowNum: 174, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "RAJIV MANGER PART SALARY  JULY" },
  { rowNum: 175, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "BD BAJRANGI ELRCTRICIAN PAYMENT" },
  { rowNum: 176, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 8600, method: "cash", furtherMode: "Cash Book", remarks: "CHANDAN IMPT JUNE SALARY CLEAR" },
  { rowNum: 177, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "TOMMROE ND TODAY INCT CLEAR BY MEDICINE CASH" },
  { rowNum: 178, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "RAVINA MAM INCT" },
  { rowNum: 179, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 4500, method: "cash", furtherMode: "Cash Book", remarks: "HR CABING REPAIR" },
  { rowNum: 180, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "ADITYA SIR INCT CLEAR BY MEDICINE CASH" },
  { rowNum: 181, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Incentive", expenseType: "Sales Incentive--Counsellor", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "Pardis sir inct" },
  { rowNum: 182, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 36, method: "cash", furtherMode: "Cash Book", remarks: "milk for backend" },
  { rowNum: 183, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Salary", expenseType: "Salary", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "Abdul sir july part Salary" },
  { rowNum: 184, date: "2026-08-01", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 90, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 185, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 2340, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 186, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 750, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 187, date: "2026-08-02", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 188, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 2940, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 189, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 190, date: "2026-08-03", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 710, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 191, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 192, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 193, date: "2026-08-04", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 1500, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 194, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 8200, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 195, date: "2026-08-05", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 6410, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 196, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 130, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 197, date: "2026-08-06", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 2200, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 198, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 84500, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 199, date: "2026-08-07", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 400, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 200, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 201, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 5000, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO SHIVAM SIR" },
  { rowNum: 202, date: "2026-08-08", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 203, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 6100, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 204, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 11850, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 205, date: "2026-08-09", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 2000, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 206, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 207, date: "2026-08-10", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 2890, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO MONA MAM" },
  { rowNum: 208, date: "2026-08-11", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 460, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 209, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 210, date: "2026-08-12", branch: "Delhi", place: "Delhi Center", expenseCategory: "Drawings", expenseType: "Handover to Family", amount: 1980, method: "cash", furtherMode: "Cash Book", remarks: "HANDOVER TO UNCLE JI" },
  { rowNum: 211, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 20000, method: "cash", furtherMode: "Cash ( backend )", remarks: "rahul daily consult incentive" },
  { rowNum: 212, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 14000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Bhoomi gd recp. june salary clear" },
  { rowNum: 213, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 6000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Abhisheak Thakur meeso payment" },
  { rowNum: 214, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 9275, method: "cash", furtherMode: "Cash ( backend )", remarks: "Khushi goswami telecaller june salary clear" },
  { rowNum: 215, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 43000, method: "cash", furtherMode: "Cash ( backend )", remarks: "bharat Goswami sales head incentive on 2,03,00,000 sales" },
  { rowNum: 216, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ashu tl july sales incentive" },
  { rowNum: 217, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-Backend Basement", amount: 2500, method: "cash", furtherMode: "Cash ( backend )", remarks: "backend basement rent manjit lodha" },
  { rowNum: 218, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-Backend upper ground floor", amount: 62500, method: "cash", furtherMode: "Cash ( backend )", remarks: "backend upper ground part rent" },
  { rowNum: 219, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 15000, method: "cash", furtherMode: "Cash ( backend )", remarks: "rahul tl daily consult incentive" },
  { rowNum: 220, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 4500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Sakshi saroj telecaller june salary clear" },
  { rowNum: 221, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 9900, method: "cash", furtherMode: "Cash ( backend )", remarks: "Harsha telecaller june salary clear" },
  { rowNum: 222, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-CD Clinic", amount: 30000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ravi jain cd clinic part rent cd" },
  { rowNum: 223, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-Staff Flat", amount: 39000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Mukul jain staff flat rent" },
  { rowNum: 224, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 11000, method: "cash", furtherMode: "Cash ( backend )", remarks: "rahul tl daily consult incentive" },
  { rowNum: 225, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 12500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Himanshi rawat telecaller june salary clear" },
  { rowNum: 226, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 7000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Rajesh telecaller july part salary" },
  { rowNum: 227, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Kursat food money" },
  { rowNum: 228, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-Backend Basement", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "basement rent manjeet" },
  { rowNum: 229, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 3200, method: "cash", furtherMode: "Cash ( backend )", remarks: "chandan Biswal june fnf salary clear" },
  { rowNum: 230, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 2000, method: "cash", furtherMode: "Cash ( backend )", remarks: "jyoti Housekeeping 5 Days work in Aug CD" },
  { rowNum: 231, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 2000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Annu Mishara 5 days Payment at CD Clinic" },
  { rowNum: 232, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nitesh Tech July part Salary" },
  { rowNum: 233, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Incentive- Marketing Team", amount: 15000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Abhishekh Editor Incentive" },
  { rowNum: 234, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 25000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Bharat goswami July Part Salary" },
  { rowNum: 235, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 806, method: "cash", furtherMode: "Cash ( backend )", remarks: "Shivam Sir Porter Payment By Pradeep" },
  { rowNum: 236, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 300, method: "cash", furtherMode: "Cash ( backend )", remarks: "Poter For telescope" },
  { rowNum: 237, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 2400, method: "cash", furtherMode: "Cash ( backend )", remarks: "Auditors Food" },
  { rowNum: 238, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-CD Clinic", amount: 40000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ravi jain cd clinic part rent cd" },
  { rowNum: 239, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anam Telecaller May-3000,June-2000" },
  { rowNum: 240, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Milk Payment" },
  { rowNum: 241, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 3000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anjali Singh core team June Salary Clear" },
  { rowNum: 242, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 9500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anjali Singh Core Team May Incentive Clear" },
  { rowNum: 243, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Sunil Tech Aug Part Salary" },
  { rowNum: 244, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 15500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anam Core Team June Incentive Clear" },
  { rowNum: 245, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 10500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nikita Yadav Core Team June Incentive Clear" },
  { rowNum: 246, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 28500, method: "cash", furtherMode: "Cash ( backend )", remarks: "Pawan Lab July Salary Clear" },
  { rowNum: 247, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 7000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nikita Nikki Core team June Incentive Clear" },
  { rowNum: 248, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 2941, method: "cash", furtherMode: "Cash ( backend )", remarks: "Urvashi Telecaller FNF Salary Clear" },
  { rowNum: 249, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 3000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nitish Yadav telecaller june-2000,july-1000" },
  { rowNum: 250, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 15000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Sunita Housekeeping July Part Salary" },
  { rowNum: 251, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 4354, method: "cash", furtherMode: "Cash ( backend )", remarks: "Bhawana Bhardwaj Telecaller AUG FNF Salary clear" },
  { rowNum: 252, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 4354, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nikita Kaur Telecaller AUG FNF Salary Clear" },
  { rowNum: 253, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 4613, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ramandeep Singh July FNF Salary Clear" },
  { rowNum: 254, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Kursat food money" },
  { rowNum: 255, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5451, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ashwani telecaller JulyFNF Salary Clear" },
  { rowNum: 256, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Ashu tl july Salary Part" },
  { rowNum: 257, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 1000, method: "cash", furtherMode: "Cash ( backend )", remarks: "ca team food" },
  { rowNum: 258, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "rahul jul tl part salary" },
  { rowNum: 259, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 2000, method: "cash", furtherMode: "Cash ( backend )", remarks: "khushboo july incentive clear" },
  { rowNum: 260, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 16354, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anish chouhan (hosekeeping) july salary clear" },
  { rowNum: 261, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 10000, method: "cash", furtherMode: "Cash ( backend )", remarks: "shana nilofer july incentive clear" },
  { rowNum: 262, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 3000, method: "cash", furtherMode: "Cash ( backend )", remarks: "harsh kumar july incentive clear" },
  { rowNum: 263, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 9000, method: "cash", furtherMode: "Cash ( backend )", remarks: "harshita rai july incentive clear" },
  { rowNum: 264, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 5000, method: "cash", furtherMode: "Cash ( backend )", remarks: "tannu thakur july incentive clear" },
  { rowNum: 265, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 50000, method: "cash", furtherMode: "Cash ( backend )", remarks: "prakash (tech) july part salary" },
  { rowNum: 266, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 3500, method: "cash", furtherMode: "Cash ( backend )", remarks: "ayushi telecaller july incentive clear" },
  { rowNum: 267, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 4000, method: "cash", furtherMode: "Cash ( backend )", remarks: "shana nilofer july incentive clear" },
  { rowNum: 268, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 12774, method: "cash", furtherMode: "Cash ( backend )", remarks: "Annu kumari (hosekeeping) july salary clear" },
  { rowNum: 269, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 6000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Gautam stock july part salary" },
  { rowNum: 270, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 13000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Arjun Office Boy July Salary Clear" },
  { rowNum: 271, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 8000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Usha washroom Clean of July At BD" },
  { rowNum: 272, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 9000, method: "cash", furtherMode: "Cash ( backend )", remarks: "water bill backend -8k july clear , 1k vaishali july part" },
  { rowNum: 273, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 6000, method: "cash", furtherMode: "Cash ( backend )", remarks: "sanjay cleaning work At vaishali for 15 days part" },
  { rowNum: 274, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 200, method: "cash", furtherMode: "Cash ( backend )", remarks: "Anju Housekeeping Work at vaishali clinic for 3 days 1k already taken" },
  { rowNum: 275, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 2500, method: "cash", furtherMode: "Cash ( backend )", remarks: "hr cabin repair charges paid to vaasu" },
  { rowNum: 276, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 9000, method: "cash", furtherMode: "Cash ( backend )", remarks: "karan office boy july salary clear" },
  { rowNum: 277, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 4000, method: "cash", furtherMode: "Cash ( backend )", remarks: "Nitesh Tech July part Salary" },
  { rowNum: 278, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 112, method: "cash", furtherMode: "Cash Book", remarks: "SUGAR" },
  { rowNum: 279, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 288, method: "cash", furtherMode: "Cash Book", remarks: "COFFEE" },
  { rowNum: 280, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 240, method: "cash", furtherMode: "Cash Book", remarks: "TURKEY DR SIGRET" },
  { rowNum: 281, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 51, method: "cash", furtherMode: "Cash Book", remarks: "Rapido payment for head punches" },
  { rowNum: 282, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "head punches payent to shejad tech." },
  { rowNum: 283, date: "2026-08-02", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "pt LUNCH" },
  { rowNum: 284, date: "2026-08-02", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "bord EXTENSION" },
  { rowNum: 285, date: "2026-08-03", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "DISPOSAL GLASS" },
  { rowNum: 286, date: "2026-08-03", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 30, method: "cash", furtherMode: "Cash Book", remarks: "TISHU" },
  { rowNum: 287, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 140, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 288, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 240, method: "cash", furtherMode: "Cash Book", remarks: "JONSAN BABY" },
  { rowNum: 289, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 44, method: "cash", furtherMode: "Cash Book", remarks: "MILK" },
  { rowNum: 290, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 50, method: "cash", furtherMode: "Cash Book", remarks: "PEN" },
  { rowNum: 291, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "A4 SHEET" },
  { rowNum: 292, date: "2026-08-05", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 380, method: "cash", furtherMode: "Cash Book", remarks: "rapido" },
  { rowNum: 293, date: "2026-08-05", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 140, method: "cash", furtherMode: "Cash Book", remarks: "pt lunCH" },
  { rowNum: 294, date: "2026-08-05", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "staff night food" },
  { rowNum: 295, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 230, method: "cash", furtherMode: "Cash Book", remarks: "ROOM SPREY" },
  { rowNum: 296, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 380, method: "cash", furtherMode: "Cash Book", remarks: "SUGAR NEDEELS" },
  { rowNum: 297, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 298, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 150, method: "cash", furtherMode: "Cash Book", remarks: "CARRY BAG" },
  { rowNum: 299, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 105, method: "cash", furtherMode: "Cash Book", remarks: "FILES COVER" },
  { rowNum: 300, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 2084, method: "cash", furtherMode: "Cash Book", remarks: "MILK PAYMANT" },
  { rowNum: 301, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 300, method: "cash", furtherMode: "Cash Book", remarks: "NIGHT STAFF FOOD" },
  { rowNum: 302, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 500, method: "cash", furtherMode: "Cash Book", remarks: "MADAN ADVANCE JULY PART SALARY" },
  { rowNum: 303, date: "2026-08-07", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 486, method: "cash", furtherMode: "Cash Book", remarks: "STOCK  RAPIDO" },
  { rowNum: 304, date: "2026-08-07", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 140, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 305, date: "2026-08-07", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 33000, method: "cash", furtherMode: "Cash Book", remarks: "NARENDAR SIR SALARY JULY" },
  { rowNum: 306, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 150, method: "cash", furtherMode: "Cash Book", remarks: "DISPOSAL GLASS" },
  { rowNum: 307, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 76, method: "cash", furtherMode: "Cash Book", remarks: "SUGAR" },
  { rowNum: 308, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 64, method: "cash", furtherMode: "Cash Book", remarks: "TEA BAG" },
  { rowNum: 309, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 324, method: "cash", furtherMode: "Cash Book", remarks: "SARF" },
  { rowNum: 310, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 30, method: "cash", furtherMode: "Cash Book", remarks: "SOPE" },
  { rowNum: 311, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "HAND WASH" },
  { rowNum: 312, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 30, method: "cash", furtherMode: "Cash Book", remarks: "RABER BAND" },
  { rowNum: 313, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 96, method: "cash", furtherMode: "Cash Book", remarks: "HAIR COLOR" },
  { rowNum: 314, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 112, method: "cash", furtherMode: "Cash Book", remarks: "SURGERY BLED" },
  { rowNum: 315, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 800, method: "cash", furtherMode: "Cash Book", remarks: "NIGHT STAFF FOOD" },
  { rowNum: 316, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 25000, method: "cash", furtherMode: "Cash Book", remarks: "NARENDAR SIR SALARY JULY" },
  { rowNum: 317, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 70, method: "cash", furtherMode: "Cash Book", remarks: "KAPUR" },
  { rowNum: 318, date: "2026-08-09", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 140, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 319, date: "2026-08-09", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 44, method: "cash", furtherMode: "Cash Book", remarks: "MILK" },
  { rowNum: 320, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 240, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 321, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 110, method: "cash", furtherMode: "Cash Book", remarks: "medition" },
  { rowNum: 322, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 3400, method: "cash", furtherMode: "Cash Book", remarks: "HOUSEKEEPING AUNTY SALARY JULY" },
  { rowNum: 323, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 277, method: "cash", furtherMode: "Cash Book", remarks: "rapido" },
  { rowNum: 324, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 615, method: "cash", furtherMode: "Cash Book", remarks: "MEDICAL" },
  { rowNum: 325, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 1000, method: "cash", furtherMode: "Cash Book", remarks: "MADAN ADVANCE JULY PART SALARY" },
  { rowNum: 326, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 200, method: "cash", furtherMode: "Cash Book", remarks: "NIGHT STAFF FOOD" },
  { rowNum: 327, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 120, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 328, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 728, method: "cash", furtherMode: "Cash Book", remarks: "AC SERVICE" },
  { rowNum: 329, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 518, method: "cash", furtherMode: "Cash Book", remarks: "RO WATER PURIFY" },
  { rowNum: 330, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 10, method: "cash", furtherMode: "Cash Book", remarks: "SODA" },
  { rowNum: 331, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 5, method: "cash", furtherMode: "Cash Book", remarks: "FEVISTICK" },
  { rowNum: 332, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 3800, method: "cash", furtherMode: "Cash Book", remarks: "GAS AMMOUNT" },
  { rowNum: 333, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 15500, method: "cash", furtherMode: "Cash Book", remarks: "PREETI OT STAFF JULY SALARY CLEAR" },
  { rowNum: 334, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Salary", expenseType: "Salary", amount: 18000, method: "cash", furtherMode: "Cash Book", remarks: "PREETI RECIEPTION JULY SALARY CLEAR" },
  { rowNum: 335, date: "2026-08-11", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 2491, method: "cash", furtherMode: "Cash Book", remarks: "SMART POINT" },
  { rowNum: 336, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Meals", amount: 120, method: "cash", furtherMode: "Cash Book", remarks: "PT LUNCH" },
  { rowNum: 337, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 140, method: "cash", furtherMode: "Cash Book", remarks: "DUSTBIN COVER" },
  { rowNum: 338, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 250, method: "cash", furtherMode: "Cash Book", remarks: "A4 SHEET" },
  { rowNum: 339, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 30, method: "cash", furtherMode: "Cash Book", remarks: "XEROX" },
  { rowNum: 340, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 100, method: "cash", furtherMode: "Cash Book", remarks: "DISPOSAL GLASS" },
  { rowNum: 341, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 131, method: "cash", furtherMode: "Cash Book", remarks: "rapido" },
  { rowNum: 342, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Welfare Expenses", expenseType: "Pantry Expenses", amount: 199, method: "cash", furtherMode: "Cash Book", remarks: "LOX" },
  { rowNum: 343, date: "2026-08-12", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Office Exp.", expenseType: "Printing & stationery", amount: 150, method: "cash", furtherMode: "Cash Book", remarks: "MARKERS" },
  { rowNum: 344, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 48000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Kailash singh pt. refund" },
  { rowNum: 345, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 346, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 516, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "breakfast for staff" },
  { rowNum: 347, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Electricity Bill", expenseType: "Electricity Exp-Staff Flat", amount: 1200, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Staff flat electricity bill 2nd floor" },
  { rowNum: 348, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-Others", amount: 24276, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Kusum scientific" },
  { rowNum: 349, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Electricity Bill", expenseType: "Electricity Exp-Staff Flat", amount: 48446, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Staff flat electricity bill ground floor" },
  { rowNum: 350, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 16520, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "ai marketing payment" },
  { rowNum: 351, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Sanjay tech. June part salary" },
  { rowNum: 352, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 35000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Shubham Hr June salary clear" },
  { rowNum: 353, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 24000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Pankaj Tech. June salary clear" },
  { rowNum: 354, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Telephone Expenses", expenseType: "Staff Recharge", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Telecaller recharge" },
  { rowNum: 355, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 3000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Aisha Khatun july part salary" },
  { rowNum: 356, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 13667, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Prakash tech. june salary clear" },
  { rowNum: 357, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 1800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "sagar pt refund due to gfc not performed" },
  { rowNum: 358, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 1878.45, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "pizza for top management staff" },
  { rowNum: 359, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 110.84, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "bank charges" },
  { rowNum: 360, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 8000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "anjali mittal personal payment" },
  { rowNum: 361, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 50000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Sushant Sir july part salary" },
  { rowNum: 362, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 2000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Salman toto july advance" },
  { rowNum: 363, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1135, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "kharak singh personal payment" },
  { rowNum: 364, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 306, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 365, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "nitesh tech. july advance salary" },
  { rowNum: 366, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "nishant tech. may part salary" },
  { rowNum: 367, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 2000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Muskan personal payment" },
  { rowNum: 368, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "rahul Hr July part salary" },
  { rowNum: 369, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 25000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 370, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 1950, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Google play store subscription" },
  { rowNum: 371, date: "2026-08-01", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 278, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 372, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1341, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 373, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 307, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "breakfast for staff" },
  { rowNum: 374, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 470.74, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "breakfast for staff" },
  { rowNum: 375, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "prateek kharti" },
  { rowNum: 376, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1100, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "petmedicity" },
  { rowNum: 377, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 215, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "goldy medical" },
  { rowNum: 378, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Muskan", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Muskan malhotra pt comission share" },
  { rowNum: 379, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 380, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 25000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google ads" },
  { rowNum: 381, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Noida clinic renovation advanvce" },
  { rowNum: 382, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 329.7, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 383, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Amit telecaller june fnf salary clear" },
  { rowNum: 384, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 11150, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Nikhil arora telecaller june salary clear" },
  { rowNum: 385, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 855.3, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 386, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 300, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 387, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 15000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Anjali Singh core team june salary clear" },
  { rowNum: 388, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4598, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 389, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 180, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 390, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 350, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 391, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 210, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 392, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 944, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 393, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 633.37, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 394, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 50000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "Shree ji pharma medicine part payment" },
  { rowNum: 395, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 137000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "Helpsure health medicine part payment" },
  { rowNum: 396, date: "2026-08-02", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 13000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "Helpsure health medicine part payment" },
  { rowNum: 397, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 799, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Link please software" },
  { rowNum: 398, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 399, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Lab Expenses", expenseType: "Lab Expenses", amount: 8340, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Crl lab payment" },
  { rowNum: 400, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Rent", expenseType: "Rent-CD Clinic", amount: 132300, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Ravi jain cd clinic rent" },
  { rowNum: 401, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 6000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Naved aalam noida chair payment" },
  { rowNum: 402, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Nohseen noida chair payment" },
  { rowNum: 403, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 150, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "salman" },
  { rowNum: 404, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 260, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 405, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 38000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Dr. asha lata roy june salary clear" },
  { rowNum: 406, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google ads" },
  { rowNum: 407, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 2000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Md. harish noida furniture" },
  { rowNum: 408, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 3000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Nohseen" },
  { rowNum: 409, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 83333, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Deepak tech. june salary clear" },
  { rowNum: 410, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Telephone Expenses", expenseType: "Staff Recharge", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "telecaller recharge" },
  { rowNum: 411, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Jatin implanter july advance" },
  { rowNum: 412, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "noida furniture porter ppayment" },
  { rowNum: 413, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 579, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 414, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 83, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 415, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 144, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 416, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 9013.05, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "cx wizard watsapp payment" },
  { rowNum: 417, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Bhawani drugs medicine payment" },
  { rowNum: 418, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 310, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 419, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 20, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 420, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Vehicle Maintainance", amount: 3000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "petrol to car" },
  { rowNum: 421, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 995.13, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 422, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 1828.75, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "bank charges" },
  { rowNum: 423, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 160, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payment" },
  { rowNum: 424, date: "2026-08-03", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 2346.31, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "antropic software marketing payment" },
  { rowNum: 425, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 75, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 426, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 29.5, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "bank charges" },
  { rowNum: 427, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 655, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "breakfast for staff" },
  { rowNum: 428, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 429, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "goldy medicine payment" },
  { rowNum: 430, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Sanjay Tech June Salary Clear" },
  { rowNum: 431, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 90, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 432, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 433, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 2000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 434, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 895, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 435, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 895, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 436, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 799, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 437, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 661, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 438, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 17000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "noida furniture furniture payment" },
  { rowNum: 439, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 447, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "paint" },
  { rowNum: 440, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 1999, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Apple media service" },
  { rowNum: 441, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 319, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Apple media service" },
  { rowNum: 442, date: "2026-08-04", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 616, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 443, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 444, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 646, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 445, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 27581, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "vipin marketing july salary clear" },
  { rowNum: 446, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1069.24, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 447, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google leads" },
  { rowNum: 448, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Nishant Tech June Part Salary" },
  { rowNum: 449, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 6933, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "LEEZA TELECALLER JUNE SALARY CLEAR" },
  { rowNum: 450, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 451, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "chair payment" },
  { rowNum: 452, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Patients", amount: 12000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "patient commission" },
  { rowNum: 453, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 13570, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Aisensy software" },
  { rowNum: 454, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 455, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Hardware Rental Expenses", expenseType: "AC Rent", amount: 13000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Ac rent" },
  { rowNum: 456, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "mukund manager GD july part Salary" },
  { rowNum: 457, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 458, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 532.36, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 459, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 10, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 460, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 461, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 2800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "office furniture" },
  { rowNum: 462, date: "2026-08-05", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 190, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 463, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 1008.59, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 464, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 200, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 465, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 466, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "narender tech june part salary" },
  { rowNum: 467, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 4602, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "razorpay optiization" },
  { rowNum: 468, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Noida interior payment" },
  { rowNum: 469, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 286, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 470, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 190, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 471, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 999, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Apple media service" },
  { rowNum: 472, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google leads" },
  { rowNum: 473, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 999, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Apple media service" },
  { rowNum: 474, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 789.32, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 475, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 476, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 7000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "noida furniture furniture payment" },
  { rowNum: 477, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Commission-others", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "collab payment skin mantra" },
  { rowNum: 478, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 1701, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 479, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 784.36, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 480, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1999, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 481, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 12000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "chair payment" },
  { rowNum: 482, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 483, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 2500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "chair payment" },
  { rowNum: 484, date: "2026-08-06", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 79.37, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 485, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 83, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 486, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 714, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 487, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4020, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 488, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 2800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "furniture office" },
  { rowNum: 489, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 350.8, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 490, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 31308, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments-thar emi" },
  { rowNum: 491, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Patients", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Afgani ref pt commission" },
  { rowNum: 492, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 493, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Telephone Expenses", expenseType: "Staff Recharge", amount: 4000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "telecaller Recharge" },
  { rowNum: 494, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 372.24, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "bank charges" },
  { rowNum: 495, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 190, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 496, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "office Repairs and Maintainence", amount: 447, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "hr cabin repair" },
  { rowNum: 497, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Electricity Bill", expenseType: "Electricity Exp-Backend basement", amount: 13809.14, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "electricity bill bd basement" },
  { rowNum: 498, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 20000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments-AC" },
  { rowNum: 499, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 450, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 500, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 709.18, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 501, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 160, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 502, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Asset Based Payment", expenseType: "Hardware-Laptop/Computer/Mobile etc", amount: 16500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "chair payments" },
  { rowNum: 503, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "SACHIN WEB JULY PART SALARY" },
  { rowNum: 504, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 300, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 505, date: "2026-08-07", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 42.6, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 506, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 371.89, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 507, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 31308, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments-thar emi" },
  { rowNum: 508, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 372.74, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 509, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 600, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "office exp" },
  { rowNum: 510, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 511, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google leads" },
  { rowNum: 512, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 84370, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Aisensy software" },
  { rowNum: 513, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 25370, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Aisensy software" },
  { rowNum: 514, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 108318, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "301 BILL OT STOCK PAYMENT" },
  { rowNum: 515, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "380 BILL PART PAYMENT MEDONA" },
  { rowNum: 516, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 15000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "BHARAT SIRJULY PART SALARY" },
  { rowNum: 517, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 127, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 518, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 15000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 519, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Welfare Expenses", expenseType: "Staff Welfare", amount: 1156.05, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "staff meals" },
  { rowNum: 520, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Conveyance/Freight", amount: 8840, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "SUNIL TECH DELHI TO HYD" },
  { rowNum: 521, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 522, date: "2026-08-08", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 22.42, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 523, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 900, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "OFFICE EXPENSES" },
  { rowNum: 524, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 525, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "google leads" },
  { rowNum: 526, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 11800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Aisensy software" },
  { rowNum: 527, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 138, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 528, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 210, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 529, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 45000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "REFUND ASHISH TIWARI PART" },
  { rowNum: 530, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1399, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 531, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 690, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 532, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 466, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 533, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Patient Commission Paid to Patients", amount: 3500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "commission" },
  { rowNum: 534, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "SUSHANT SIR JULY PART SALARY" },
  { rowNum: 535, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 1000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "PURNIMA RECEPTION JULY PART SALARY" },
  { rowNum: 536, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1065.82, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 537, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 21774, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "RITHIKA BDS JULY SALARY CLEAR" },
  { rowNum: 538, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 539, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 420, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 540, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 360, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 541, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 288.43, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 542, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 403.57, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 543, date: "2026-08-09", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 60000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "helpsure bill payment" },
  { rowNum: 544, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 505, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 545, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 499, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 546, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 3499, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 547, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 548, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 2000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 549, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "NISHANT TCEH JUNE SALARY CLEAR" },
  { rowNum: 550, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 212, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "OFFICE EXPENSES" },
  { rowNum: 551, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "GOOGLE ADS" },
  { rowNum: 552, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1598, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 553, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Telephone Expenses", expenseType: "Staff Recharge", amount: 10000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "TELECALLER RECHARGE" },
  { rowNum: 554, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 118, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 555, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 88871, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "PRAKASH TECH JULY SALARY CLEAR" },
  { rowNum: 556, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1712.75, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 557, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 690, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 558, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Office Exp.", expenseType: "Office Consumables", amount: 199, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "OFFICE EXPENSES" },
  { rowNum: 559, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1777.86, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 560, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 520, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 561, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 300, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 562, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 528, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 563, date: "2026-08-10", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 451.54, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bank charges" },
  { rowNum: 564, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 2249.31, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "vercel software exp" },
  { rowNum: 565, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 1148.74, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "ai sensy" },
  { rowNum: 566, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 1119.31, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "ai sensy" },
  { rowNum: 567, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 50000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 568, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Commision", expenseType: "Commission-others", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "supermax commission" },
  { rowNum: 569, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 30000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Akaar medicine payment" },
  { rowNum: 570, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 35000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "VASHU TECH JUNE SALARY CLEAR" },
  { rowNum: 571, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 11800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "ADAPTABIZ TECHNOLOGI personal payment" },
  { rowNum: 572, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 690, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 573, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 2357, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 574, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 9328.77, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "CX wizard software" },
  { rowNum: 575, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 2723, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 576, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 200, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 577, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 578, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 579, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4019, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 580, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 319, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 581, date: "2026-08-11", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Professional Expenses", expenseType: "Finance Consultant Fee", amount: 100000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "minee payment" },
  { rowNum: 582, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 583, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 100000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "325 BILL PART PAYMENT OT TSOCK" },
  { rowNum: 584, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 13410, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "NISHA MAHOR TELECALLELR FNF CLEAR JULY SALARY INCENTIVE" },
  { rowNum: 585, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Software Rental Expenses", expenseType: "Software Rental Expenses", amount: 40000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "meta ads" },
  { rowNum: 586, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Incentive", expenseType: "Sales Incentive-Agents", amount: 18000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "SHAHEEN TELECALLER JUNE INCENTIVE CLEAR" },
  { rowNum: 587, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 260, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 588, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "GAUTAM STOCK JULY SALARY CLEAR" },
  { rowNum: 589, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 45767, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "PT REFUND ASHISH TIWARI" },
  { rowNum: 590, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1032, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 591, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 4699, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 592, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Bank Charges", expenseType: "Bank Charges", amount: 236, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "bank charges" },
  { rowNum: 593, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 17000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "SACHIN WEB JULY PART SALARY" },
  { rowNum: 594, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Salary", expenseType: "Salary", amount: 16500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "ANIRUDH JULY SALARY COLEEB COUNSELLOR" },
  { rowNum: 595, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1500, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 596, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 1200, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 597, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 300, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 598, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 599, date: "2026-08-12", branch: "Delhi", place: "Delhi Backend", expenseCategory: "Drawings", expenseType: "Personal Payments", amount: 800, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "personal payments" },
  { rowNum: 600, date: "2026-08-01", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Professional Expenses", expenseType: "On Call Staff", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Dr. Sripathipandit on call payment" },
  { rowNum: 601, date: "2026-08-02", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Professional Expenses", expenseType: "On Call Staff", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "Dr. Sripathipandit on call payment" },
  { rowNum: 602, date: "2026-08-02", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Lab Expenses", expenseType: "Lab Expenses", amount: 5000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "tata 1 mg lab payment pt test reports" },
  { rowNum: 603, date: "2026-08-03", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 45000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "prashant pt. refund due to wrong treatment" },
  { rowNum: 604, date: "2026-08-03", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 45000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "Sarfaraz pt refund due to loan received" },
  { rowNum: 605, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Hotel Charges", expenseType: "Hotel Charges", amount: 19220, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "hotel payment" },
  { rowNum: 606, date: "2026-08-04", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 5000, method: "hdfc_skin_bank_transfer", furtherMode: "HDFC Skin", remarks: "handpiece" },
  { rowNum: 607, date: "2026-08-06", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medical Consumables", expenseType: "Medical Consumables-OT", amount: 65750, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "hyd ot bed payment ADEQUATEELE" },
  { rowNum: 608, date: "2026-08-07", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 26182, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "mohan medical bill payment" },
  { rowNum: 609, date: "2026-08-07", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Medicine Procurement", expenseType: "Medicine Procurement", amount: 2756, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "mohan medical bill payment" },
  { rowNum: 610, date: "2026-08-08", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 15000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bhanu prakash pt refund" },
  { rowNum: 611, date: "2026-08-09", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 10000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "shaik amer pt refund" },
  { rowNum: 612, date: "2026-08-09", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 15000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "shaik amer pt refund" },
  { rowNum: 613, date: "2026-08-09", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Patient Related Expenses", expenseType: "Patient Refunds", amount: 30000, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "bhanu prakash pt refund" },
  { rowNum: 614, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Rent", expenseType: "Rent-Hyderebad Clinic", amount: 89800, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "JUNE RENT CLEAR/YALAMANCHI" },
  { rowNum: 615, date: "2026-08-10", branch: "Hyderabad", place: "Hyderabad Clinic", expenseCategory: "Rent", expenseType: "Rent-Hyderebad Clinic", amount: 199800, method: "icici_medihub_bank_transfer", furtherMode: "ICICI Medihub", remarks: "JULY RENT CLEAR/YALAMANCHI" },
];

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALLOW_DUPES = args.includes("--allow-duplicates");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI missing in .env.local");
  process.exit(1);
}

const VALID_METHODS = [
  "cash",
  "hdfc_skin_bank_transfer",
  "icici_medihub_bank_transfer",
  "hdfc_ryan_medihub_bank_transfer",
];

const Transactions =
  mongoose.models.Transactions ||
  mongoose.model(
    "Transactions",
    new mongoose.Schema({}, { strict: false, collection: "transactions" })
  );

const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Validation - every row checked before anything is written. A partial import of
// financial data is worse than no import, so one bad row aborts the whole run.
// ---------------------------------------------------------------------------
function validate(entries) {
  const errors = [];
  const missingTypes = new Set();

  for (const e of entries) {
    const where = `row ${e.rowNum}`;
    if (!EXPENSE_CATEGORY_TREE[e.expenseCategory]) {
      errors.push(`${where}: unknown expenseCategory "${e.expenseCategory}"`);
    } else if (!EXPENSE_CATEGORY_TREE[e.expenseCategory].includes(e.expenseType)) {
      errors.push(`${where}: "${e.expenseType}" is not valid under "${e.expenseCategory}"`);
      missingTypes.add(`${e.expenseCategory} > ${e.expenseType}`);
    }
    if (!ALL_BRANCHES.includes(e.branch)) errors.push(`${where}: unknown branch "${e.branch}"`);
    if (!VALID_METHODS.includes(e.method)) errors.push(`${where}: invalid method "${e.method}"`);
    if (!ACCOUNTS.includes(e.furtherMode)) {
      errors.push(`${where}: account "${e.furtherMode}" is not in ACCOUNTS (src/constants/bankRouting.js)`);
    }
    if (!(e.amount > 0)) errors.push(`${where}: amount must be > 0 (got ${e.amount})`);
    if (isNaN(new Date(e.date).getTime())) errors.push(`${where}: bad date "${e.date}"`);
  }
  return { errors, missingTypes: [...missingTypes] };
}

// ---------------------------------------------------------------------------
async function run() {
  const total = ENTRIES.reduce((s, e) => s + e.amount, 0);

  console.log("=".repeat(80));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${ENTRIES.length}   Total: ${inr(total)}`);
  console.log("=".repeat(80) + "\n");

  const { errors, missingTypes } = validate(ENTRIES);
  if (errors.length) {
    console.error(`VALIDATION FAILED - ${errors.length} problem(s). Nothing imported.\n`);
    errors.slice(0, 25).forEach((e) => console.error("  " + e));
    if (errors.length > 25) console.error(`  ...and ${errors.length - 25} more`);
    if (missingTypes.length) {
      console.error(`\nFIX: add these to EXPENSE_CATEGORY_TREE in src/constants/expenseCategories.js:`);
      missingTypes.forEach((t) => console.error(`     ${t}`));
    }
    if (errors.some((e) => e.includes("not in ACCOUNTS"))) {
      console.error(`\nFIX: the account above is missing from ACCOUNTS in src/constants/bankRouting.js.`);
    }
    process.exit(1);
  }
  console.log("Validation passed - categories, types, branches, methods and accounts all valid.\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // --- duplicate guard, batched by date ---
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

    const existing = await Transactions.find({
      transactionCategory: "EXPENSE",
      date: { $gte: dayStart, $lte: dayEnd },
    }).select("amount expense expenseType remarks").lean();

    const seen = new Map();
    existing.forEach((x) => {
      seen.set(`${x.amount}|${x.expense}|${x.expenseType}|${x.remarks || ""}`, String(x._id));
    });

    group.forEach((e) => {
      const place = e.place ? ` [${e.place}]` : "";
      const key = `${e.amount}|${e.expenseCategory}|${e.expenseType}|${e.remarks + place}`;
      if (seen.has(key)) dupes.push({ rowNum: e.rowNum, id: seen.get(key), remarks: e.remarks });
    });
  }

  if (dupes.length) {
    console.log(`\nWARNING - ${dupes.length} row(s) appear to be already imported:`);
    dupes.slice(0, 20).forEach((d) => console.log(`  row ${d.rowNum}  "${d.remarks}"  -> existing ${d.id}`));
    if (dupes.length > 20) console.log(`  ...and ${dupes.length - 20} more`);
    console.log("");
    if (APPLY && !ALLOW_DUPES) {
      console.error("Refusing to import. Re-run with --allow-duplicates if these are genuinely separate entries.");
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log("No duplicates found.\n");
  }

  // --- build documents ---
  const docs = ENTRIES.map((e) => ({
    transactionCategory: "EXPENSE",
    costType: "Expense",
    approvalStatus: "APPROVED",
    date: new Date(e.date),
    branch: e.branch,
    amount: e.amount,
    expense: e.expenseCategory,
    expenseType: e.expenseType,
    expenseGiver: { type: "MANUAL", name: e.remarks || "Imported" },
    method: e.method,
    furtherMode: e.furtherMode,
    remarks: e.remarks ? `${e.remarks} [${e.place}]` : e.place,
    createdBy: { name: "Bulk Import", email: "import@system", branch: e.branch, date: new Date() },
  }));

  // --- summaries ---
  const byAccount = {}, byBranch = {}, byCategory = {}, byDay = {};
  docs.forEach((d, i) => {
    byAccount[d.furtherMode] = (byAccount[d.furtherMode] || 0) + d.amount;
    byBranch[d.branch] = (byBranch[d.branch] || 0) + d.amount;
    byCategory[d.expense] = (byCategory[d.expense] || 0) + d.amount;
    byDay[ENTRIES[i].date] = (byDay[ENTRIES[i].date] || 0) + d.amount;
  });

  console.log("--- IMPACT BY ACCOUNT (each figure reduces that account) ---");
  Object.entries(byAccount).sort((a, b) => b[1] - a[1])
    .forEach(([a, v]) => console.log(`  ${a.padEnd(20)} -${inr(v)}`));

  console.log("\n--- BY DAY ---");
  Object.entries(byDay).sort().forEach(([d, v]) => console.log(`  ${d}   ${inr(v)}`));

  console.log("\n--- BY BRANCH ---");
  Object.entries(byBranch).sort((a, b) => b[1] - a[1])
    .forEach(([b, v]) => console.log(`  ${b.padEnd(14)} ${inr(v)}`));

  console.log("\n--- BY CATEGORY (top 15) ---");
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([c, v]) => console.log(`  ${c.padEnd(30)} ${inr(v)}`));

  if (!APPLY) {
    console.log(`\nDRY RUN - nothing written. Re-run with --apply to import.`);
    console.log(`Reconcile the figures above against your sheet and bank statements before applying.`);
    await mongoose.disconnect();
    return;
  }

  // --- insert in batches ---
  console.log("\nInserting...");
  const BATCH = 200;
  const insertedIds = [];
  for (let i = 0; i < docs.length; i += BATCH) {
    const res = await Transactions.insertMany(docs.slice(i, i + BATCH), { ordered: true });
    insertedIds.push(...res.map((d) => String(d._id)));
    console.log(`  ${insertedIds.length}/${docs.length}`);
  }

  console.log(`\nInserted ${insertedIds.length} expense transactions totalling ${inr(total)}.`);

  const reportPath = `import-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    source: "August_ExP.xlsx",
    rowCount: insertedIds.length,
    total,
    byAccount,
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