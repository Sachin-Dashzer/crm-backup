import mongoose from "mongoose";
import fs from "fs";
import {
  EXPENSE_CATEGORY_TREE,
  TDS_TAX_TYPES,
} from "../src/constants/expenseCategories.js";
import { ALL_BRANCHES } from "../src/lib/branches.js";
import { computeTaxBreakdown } from "../src/lib/taxMath.js";

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
    source:
      'Rent Data.xlsx (single sheet "Sheet1", column-driven by Period Month/Period Year \u2014 not one sheet per month)',
    sheets: ["April 2026", "May 2026", "June 2026", "July 2026"],
    importableRows: 50,
    skippedZeroAmountRows: 0,
    totals: {
      invoiceTotal: 6373852.0,
      vendorPayables: 5758218.0,
      tdsPayables: 615634.0,
    },
    documentsToCreate: 84,
    newInThisVersion: [
      "Covers April-July 2026 (4 months), not May-Aug \u2014 April is now included where the prior version started at May; August is not in this file at all.",
      'Adds a "Paid To (Landlord)" column, folded into each entry\'s remarks as "<remarks> \u2014 Landlord: <name>" \u2014 payee.label stays the expense sub-type (e.g. "Rent-CD Clinic") so the monthly-duplicate unique index still matches the same way; the landlord name is informational only, not a payee identity change.',
    ],
    flags: {
      rate_unit_converted:
        "Excel GST/TDS Rate % cells are percent-formatted (0.18 stored = 18%). Rates were multiplied by 100 to match what computeTaxBreakdown expects (whole-number percent). The money actually written uses each row's own GST Amount / TDS Amount columns directly (direct amount wins over rate), so the rate fields are metadata / display only.",
      needs_confirmation: [
        {
          subType: "Rent-Backend 1st Floor",
          issue:
            "TDS rate 31.2% every month (April-July). Statutory TDS on rent (s.194-I) is 10%. Repeats the same flag raised for the prior imports.",
        },
        {
          subType: "Rent-Backend Basement / Rent-Backend upper ground floor",
          issue:
            "TDS 31.2% in April-May (landlord: Satpal Singh), then Include TDS = No from June onward (landlord changes to Manjeet Laudha / Pramod). Confirm the landlord change and the resulting drop to zero TDS are both correct and not a data-entry gap.",
        },
      ],
      excluded: [],
    },
  },
  entries: [
    {
      sheet: "April 2026",
      rowNum: 2,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend Basement",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 52500.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Satpal Singh",
      landlord: "Satpal Singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 52500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 31.2,
      tdsAmount: 16380.0,
      vendorPayable: 36120.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "April 2026",
      rowNum: 3,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend upper ground floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Satpal Singh",
      landlord: "Satpal Singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 31.2,
      tdsAmount: 81900.0,
      vendorPayable: 180600.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "April 2026",
      rowNum: 4,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 1st Floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 89250.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Bajinder kaur Bhasinr",
      landlord: "Bajinder kaur Bhasinr",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 89250.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 31.2,
      tdsAmount: 27846.0,
      vendorPayable: 61404.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "April 2026",
      rowNum: 5,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 4th floor / Top floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 75000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Kuljeet Singh Bhasin",
      landlord: "Kuljeet Singh Bhasin",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 75000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 75000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "April 2026",
      rowNum: 6,
      expenseCategory: "Rent",
      expenseSubType: "Rent-CD Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: RAVI KUMAR JAIN",
      landlord: "RAVI KUMAR JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 14700.0,
      vendorPayable: 247800.0,
      impliedTdsRate: 5.6,
    },
    {
      sheet: "April 2026",
      rowNum: 7,
      expenseCategory: "Rent",
      expenseSubType: "Rent-GD clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 176000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: NARESH PAMNANI",
      landlord: "NARESH PAMNANI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 31680.0,
      invoiceTotal: 207680.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 17600.0,
      vendorPayable: 190080.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "April 2026",
      rowNum: 8,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Manu Vaishali Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 84000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: MANU AGGARWAL",
      landlord: "MANU AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15120.0,
      invoiceTotal: 99120.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8400.0,
      vendorPayable: 90720.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "April 2026",
      rowNum: 9,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Mansi Vaishali clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 84000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: MANSI AGGARWAL",
      landlord: "MANSI AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15120.0,
      invoiceTotal: 99120.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8400.0,
      vendorPayable: 90720.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "April 2026",
      rowNum: 10,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Hyderebad Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 185000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-08",
      dueDateRaw: "08.04.2026",
      branch: "Hyderabad",
      remarks: "April rent \u2014 Landlord: VENKATA ROA YALAMANCHI",
      landlord: "VENKATA ROA YALAMANCHI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 33300.0,
      invoiceTotal: 218300.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 18500.0,
      vendorPayable: 199800.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "April 2026",
      rowNum: 11,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Staff Flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 99000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: UPASNA JAIN",
      landlord: "UPASNA JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 99000.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 6000.0,
      vendorPayable: 93000.0,
      impliedTdsRate: 6.06,
    },
    {
      sheet: "April 2026",
      rowNum: 12,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Deepak staff flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 8000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Kapil Gurija",
      landlord: "Kapil Gurija",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 8000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 8000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "April 2026",
      rowNum: 13,
      expenseCategory: "Rent",
      expenseSubType: "Rent-P House Rent",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 85000.0,
      period: {
        month: 4,
        year: 2026,
      },
      dueDate: "2026-04-01",
      dueDateRaw: "01.04.2026",
      branch: "Delhi",
      remarks: "April rent \u2014 Landlord: Ajaj Kejriwal",
      landlord: "Ajaj Kejriwal",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 85000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 85000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "May 2026",
      rowNum: 14,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend Basement",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 52500.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Satpal Singh",
      landlord: "Satpal Singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 52500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 31.2,
      tdsAmount: 16380.0,
      vendorPayable: 36120.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "May 2026",
      rowNum: 15,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend upper ground floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Satpal Singh",
      landlord: "Satpal Singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 31.2,
      tdsAmount: 81900.0,
      vendorPayable: 180600.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "May 2026",
      rowNum: 16,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 1st Floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 89250.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Bajinder kaur Baseer",
      landlord: "Bajinder kaur Baseer",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 89250.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 31.2,
      tdsAmount: 27846.0,
      vendorPayable: 61404.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "May 2026",
      rowNum: 17,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 4th floor / Top floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 75000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Kuljeet Singh Bhasin",
      landlord: "Kuljeet Singh Bhasin",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 75000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 75000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "May 2026",
      rowNum: 18,
      expenseCategory: "Rent",
      expenseSubType: "Rent-CD Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: RAVI KUMAR JAIN",
      landlord: "RAVI KUMAR JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 14700.0,
      vendorPayable: 247800.0,
      impliedTdsRate: 5.6,
    },
    {
      sheet: "May 2026",
      rowNum: 19,
      expenseCategory: "Rent",
      expenseSubType: "Rent-GD clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 176000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: NARESH PAMNANI",
      landlord: "NARESH PAMNANI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 31680.0,
      invoiceTotal: 207680.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 17600.0,
      vendorPayable: 190080.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "May 2026",
      rowNum: 20,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Manu Vaishali Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 100800.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: MANU AGGARWAL",
      landlord: "MANU AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 18144.0,
      invoiceTotal: 118944.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 10080.0,
      vendorPayable: 108864.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "May 2026",
      rowNum: 21,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Mansi Vaishali clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 100800.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: MANSI AGGARWAL",
      landlord: "MANSI AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 18144.0,
      invoiceTotal: 118944.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 10080.0,
      vendorPayable: 108864.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "May 2026",
      rowNum: 22,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Hyderebad Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 185000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-08",
      dueDateRaw: "08.05.2026",
      branch: "Hyderabad",
      remarks: "May rent \u2014 Landlord: VENKATA ROA YALAMANCHI",
      landlord: "VENKATA ROA YALAMANCHI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 33300.0,
      invoiceTotal: 218300.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 18500.0,
      vendorPayable: 199800.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "May 2026",
      rowNum: 23,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Staff Flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 99000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: UPASNA JAIN",
      landlord: "UPASNA JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 99000.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 6000.0,
      vendorPayable: 93000.0,
      impliedTdsRate: 6.06,
    },
    {
      sheet: "May 2026",
      rowNum: 24,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Deepak staff flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 8000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Kapil Gurija",
      landlord: "Kapil Gurija",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 8000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 8000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "May 2026",
      rowNum: 25,
      expenseCategory: "Rent",
      expenseSubType: "Rent-P House Rent",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 85000.0,
      period: {
        month: 5,
        year: 2026,
      },
      dueDate: "2026-05-01",
      dueDateRaw: "01.05.2026",
      branch: "Delhi",
      remarks: "May rent \u2014 Landlord: Ajaj Kejriwal",
      landlord: "Ajaj Kejriwal",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 85000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 85000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 26,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend Basement",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 52500.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Manjeet Laudha",
      landlord: "Manjeet Laudha",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 52500.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 52500.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 27,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend upper ground floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Pramod",
      landlord: "Pramod",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 262500.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 28,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 1st Floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 89250.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Bajinder kaur Baseer",
      landlord: "Bajinder kaur Baseer",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 89250.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 31.2,
      tdsAmount: 27846.0,
      vendorPayable: 61404.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "June 2026",
      rowNum: 29,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 4th floor / Top floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 75000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Kuljeet Singh Bhasin",
      landlord: "Kuljeet Singh Bhasin",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 75000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 75000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 30,
      expenseCategory: "Rent",
      expenseSubType: "Rent-CD Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: RAVI KUMAR JAIN",
      landlord: "RAVI KUMAR JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 14700.0,
      vendorPayable: 247800.0,
      impliedTdsRate: 5.6,
    },
    {
      sheet: "June 2026",
      rowNum: 31,
      expenseCategory: "Rent",
      expenseSubType: "Rent-GD clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 176000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: NARESH PAMNANI",
      landlord: "NARESH PAMNANI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 31680.0,
      invoiceTotal: 207680.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 17600.0,
      vendorPayable: 190080.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "June 2026",
      rowNum: 32,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Manu Vaishali Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 88200.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: MANU AGGARWAL",
      landlord: "MANU AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15876.0,
      invoiceTotal: 104076.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8820.0,
      vendorPayable: 95256.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "June 2026",
      rowNum: 33,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Mansi Vaishali clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 88200.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: MANSI AGGARWAL",
      landlord: "MANSI AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15876.0,
      invoiceTotal: 104076.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8820.0,
      vendorPayable: 95256.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "June 2026",
      rowNum: 34,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Hyderebad Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 185000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-08",
      dueDateRaw: "08.06.2026",
      branch: "Hyderabad",
      remarks: "June rent \u2014 Landlord: VENKATA ROA YALAMANCHI",
      landlord: "VENKATA ROA YALAMANCHI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 33300.0,
      invoiceTotal: 218300.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 18500.0,
      vendorPayable: 199800.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "June 2026",
      rowNum: 35,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Staff Flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 99000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: UPASNA JAIN",
      landlord: "UPASNA JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 99000.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 6000.0,
      vendorPayable: 93000.0,
      impliedTdsRate: 6.06,
    },
    {
      sheet: "June 2026",
      rowNum: 36,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Deepak staff flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 8000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Kapil Gurija",
      landlord: "Kapil Gurija",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 8000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 8000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 37,
      expenseCategory: "Rent",
      expenseSubType: "Rent-P House Rent",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 85000.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Delhi",
      remarks: "June rent \u2014 Landlord: Ajaj Kejriwal",
      landlord: "Ajaj Kejriwal",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 85000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 85000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "June 2026",
      rowNum: 38,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Noida Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 27500.0,
      period: {
        month: 6,
        year: 2026,
      },
      dueDate: "2026-06-01",
      dueDateRaw: "01.06.2026",
      branch: "Noida",
      remarks: "June rent \u2014 Landlord: Naman singh",
      landlord: "Naman singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 27500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 2750.0,
      vendorPayable: 24750.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "July 2026",
      rowNum: 39,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend Basement",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 52500.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Manjeet Laudha",
      landlord: "Manjeet Laudha",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 52500.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 52500.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "July 2026",
      rowNum: 40,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend upper ground floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Pramod",
      landlord: "Pramod",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 262500.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "July 2026",
      rowNum: 41,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 1st Floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 89250.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Bajinder kaur Baseer",
      landlord: "Bajinder kaur Baseer",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 89250.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 31.2,
      tdsAmount: 27846.0,
      vendorPayable: 61404.0,
      impliedTdsRate: 31.2,
    },
    {
      sheet: "July 2026",
      rowNum: 42,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Backend 4th floor / Top floor",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 75000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Kuljeet Singh Bhasin",
      landlord: "Kuljeet Singh Bhasin",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 75000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 75000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "July 2026",
      rowNum: 43,
      expenseCategory: "Rent",
      expenseSubType: "Rent-CD Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 262500.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: RAVI KUMAR JAIN",
      landlord: "RAVI KUMAR JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 262500.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 14700.0,
      vendorPayable: 247800.0,
      impliedTdsRate: 5.6,
    },
    {
      sheet: "July 2026",
      rowNum: 44,
      expenseCategory: "Rent",
      expenseSubType: "Rent-GD clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 176000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: NARESH PAMNANI",
      landlord: "NARESH PAMNANI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 31680.0,
      invoiceTotal: 207680.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 17600.0,
      vendorPayable: 190080.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "July 2026",
      rowNum: 45,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Manu Vaishali Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 88200.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: MANU AGGARWAL",
      landlord: "MANU AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15876.0,
      invoiceTotal: 104076.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8820.0,
      vendorPayable: 95256.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "July 2026",
      rowNum: 46,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Mansi Vaishali clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 88200.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: MANSI AGGARWAL",
      landlord: "MANSI AGGARWAL",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 15876.0,
      invoiceTotal: 104076.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 8820.0,
      vendorPayable: 95256.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "July 2026",
      rowNum: 47,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Hyderebad Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 185000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-08",
      dueDateRaw: "08.07.2026",
      branch: "Hyderabad",
      remarks: "July rent \u2014 Landlord: VENKATA ROA YALAMANCHI",
      landlord: "VENKATA ROA YALAMANCHI",
      includeGST: true,
      gstRate: 18.0,
      gstAmount: 33300.0,
      invoiceTotal: 218300.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Medihub",
      tdsRate: 10.0,
      tdsAmount: 18500.0,
      vendorPayable: 199800.0,
      impliedTdsRate: 10.0,
    },
    {
      sheet: "July 2026",
      rowNum: 48,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Staff Flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 99000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: UPASNA JAIN",
      landlord: "UPASNA JAIN",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 99000.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 6000.0,
      vendorPayable: 93000.0,
      impliedTdsRate: 6.06,
    },
    {
      sheet: "July 2026",
      rowNum: 49,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Deepak staff flat",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 8000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Kapil Gurija",
      landlord: "Kapil Gurija",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 8000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 8000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "July 2026",
      rowNum: 50,
      expenseCategory: "Rent",
      expenseSubType: "Rent-P House Rent",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 85000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Delhi",
      remarks: "July rent \u2014 Landlord: Ajaj Kejriwal",
      landlord: "Ajaj Kejriwal",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 85000.0,
      includeTDS: false,
      tdsCategory: "",
      tdsRate: 0,
      tdsAmount: 0,
      vendorPayable: 85000.0,
      impliedTdsRate: 0.0,
    },
    {
      sheet: "July 2026",
      rowNum: 51,
      expenseCategory: "Rent",
      expenseSubType: "Rent-Noida Clinic",
      purpose: "RENT",
      payeeKind: "RENT_UNIT",
      baseAmount: 55000.0,
      period: {
        month: 7,
        year: 2026,
      },
      dueDate: "2026-07-01",
      dueDateRaw: "01.07.2026",
      branch: "Noida",
      remarks: "July rent \u2014 Landlord: Naman singh",
      landlord: "Naman singh",
      includeGST: false,
      gstRate: 0,
      gstAmount: 0,
      invoiceTotal: 55000.0,
      includeTDS: true,
      tdsCategory: "TDS on Rent Ryan Skin",
      tdsRate: 10.0,
      tdsAmount: 5500.0,
      vendorPayable: 49500.0,
      impliedTdsRate: 10.0,
    },
  ],
};

const ALL_ENTRIES = PAYLOAD.entries.filter((e) => e.baseAmount > 0);

const FLAG_TDS_RATE_ABOVE = 15;

const args = process.argv.slice(2);
const arg = (name) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const CONFIRM_FLAGGED = args.includes("--confirm-flagged");
const ALLOW_DUPES = args.includes("--allow-duplicates");
const DUMP_JSON = args.includes("--dump-json");
const MONTHS_FILTER = arg("months")
  ? arg("months")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
  : null;

const ENTRIES = MONTHS_FILTER
  ? ALL_ENTRIES.filter((e) => MONTHS_FILTER.includes(e.period.month))
  : ALL_ENTRIES;

const IMPORT_IDENTITY = {
  name: "Bulk Import",
  email: "import@system",
  branch: "",
};
const inr = (n) =>
  "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const normalizeLandlord = (name) => String(name || "").trim().replace(/\s+/g, " ");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const LANDLORD_VENDOR_OVERRIDES = {
  "Bajinder kaur Bhasinr": "6a881e55ce0a9a374d6d55f0",
  "VENKATA ROA YALAMANCHI": "6a882241ec4354da4e5eca13",
  "Ajaj Kejriwal": "6a8821f3ec4354da4e5eca12",
  "Bajinder kaur Baseer": "6a881e55ce0a9a374d6d55f0",
  "Manjeet Laudha": "6a882424ec4354da4e5eca19",
  "Pramod": "6a8823dbec4354da4e5eca18",
};

if (DUMP_JSON) {
  const out = "rent-payables-payload.json";
  fs.writeFileSync(out, JSON.stringify(PAYLOAD, null, 2));
  console.log(
    `Wrote ${out} — ${ENTRIES.length} of ${ALL_ENTRIES.length} row(s) selected.`,
  );
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function validate() {
  const errors = [];
  for (const e of ENTRIES) {
    const where = `${e.sheet} row ${e.rowNum} (${e.expenseSubType})`;

    if (!EXPENSE_CATEGORY_TREE["Rent"]?.includes(e.expenseSubType))
      errors.push(
        `${where}: "${e.expenseSubType}" is not a valid sub-type under "Rent"`,
      );
    if (!ALL_BRANCHES.includes(e.branch))
      errors.push(`${where}: unknown branch "${e.branch}"`);
    if (!(e.baseAmount > 0)) errors.push(`${where}: base amount must be > 0`);
    if (!(e.period?.month >= 1 && e.period?.month <= 12))
      errors.push(`${where}: period month must be 1-12`);
    if (isNaN(new Date(e.dueDate).getTime()))
      errors.push(`${where}: bad due date "${e.dueDate}"`);

    if (e.tdsAmount > 0) {
      if (!e.tdsCategory)
        errors.push(`${where}: TDS amount is set but TDS Category is empty`);
      else if (
        !TDS_TAX_TYPES.includes(e.tdsCategory) ||
        !EXPENSE_CATEGORY_TREE["Taxes"]?.includes(e.tdsCategory)
      )
        errors.push(
          `${where}: TDS Category "${e.tdsCategory}" is not a valid Taxes sub-type`,
        );
      if (e.tdsAmount >= e.invoiceTotal)
        errors.push(
          `${where}: TDS ${e.tdsAmount} must be less than invoice total ${e.invoiceTotal}`,
        );
    }

    const tax = computeTaxBreakdown({
      baseAmount: e.baseAmount,
      includeGST: e.includeGST,
      gstRate: e.gstRate || undefined,
      gstAmount: e.includeGST ? e.gstAmount : undefined,
      includeTDS: e.includeTDS,
      tdsAmount: e.includeTDS ? e.tdsAmount : undefined,
      tdsRate: e.tdsRate || undefined,
      tdsCategory: e.tdsCategory,
    });
    if (r2(tax.invoiceTotal) !== r2(e.invoiceTotal))
      errors.push(
        `${where}: invoice total mismatch — embedded ${e.invoiceTotal}, computed ${tax.invoiceTotal}`,
      );
    if (r2(tax.vendorPayable) !== r2(e.vendorPayable))
      errors.push(
        `${where}: vendor payable mismatch — embedded ${e.vendorPayable}, computed ${tax.vendorPayable}`,
      );
    if (r2(tax.tdsAmount) !== r2(e.tdsAmount))
      errors.push(
        `${where}: TDS mismatch — embedded ${e.tdsAmount}, computed ${tax.tdsAmount}`,
      );
  }
  return errors;
}

function flagRows() {
  const flags = [];
  for (const e of ENTRIES) {
    if (e.tdsAmount > 0 && e.tdsRate > FLAG_TDS_RATE_ABOVE) {
      flags.push({
        sheet: e.sheet,
        rowNum: e.rowNum,
        subType: e.expenseSubType,
        issue: `TDS rate ${e.tdsRate}% on rent — statutory rent TDS (s.194-I) is 10%. Confirm this is intentional.`,
        atStatedAmount: e.tdsAmount,
        at10pct: r2(e.baseAmount * 0.1),
      });
    }
    if (e.includeTDS && !(e.tdsAmount > 0)) {
      flags.push({
        sheet: e.sheet,
        rowNum: e.rowNum,
        subType: e.expenseSubType,
        issue: `Include TDS = Yes but the resolved TDS amount is 0 — imports as a plain payable with no TDS split.`,
      });
    }
  }
  return flags;
}

const taxNote = (e) =>
  e.includeGST || e.tdsAmount > 0
    ? `Base ${e.baseAmount} + GST ${e.gstAmount} = invoice ${e.invoiceTotal}; TDS ${e.tdsAmount} on base`
    : undefined;

const commonFields = (e) => ({
  period: e.period,
  dueDate: new Date(e.dueDate),
  branch: e.branch,
  remarks: e.remarks || "",
  isCancelled: false,
  createdAt: new Date(Date.UTC(e.period.year, e.period.month - 1, 1)),
  createdBy: { ...IMPORT_IDENTITY, branch: e.branch, date: new Date() },
});

function buildRentPayable(e, vendor) {
  const note = taxNote(e);
  const hasTds = e.tdsAmount > 0;
  return {
    ...commonFields(e),
    payee: vendor
      ? { kind: "VENDOR", refId: vendor._id, label: `${vendor.name} — ${e.expenseSubType}` }
      : { kind: e.payeeKind, refId: null, label: e.expenseSubType },
    purpose: e.purpose,
    expenseCategory: e.expenseCategory,
    expenseSubType: e.expenseSubType,
    totalAmount: e.vendorPayable,
    ...(hasTds
      ? {
          tdsLink: {
            role: "PARENT",
            linkedId: null,
            tdsRate: e.tdsRate,
            tdsAmount: e.tdsAmount,
            grossAmount: e.invoiceTotal,
          },
        }
      : {}),
    log: [
      {
        action: "Created",
        newValue: String(e.vendorPayable),
        note: note
          ? `${note} [bulk import: ${e.sheet}]`
          : `Bulk import from Excel [${e.sheet}]`,
        performedBy: IMPORT_IDENTITY,
        performedAt: new Date(),
      },
    ],
  };
}

function buildTdsPayable(e, parentId) {
  return {
    ...commonFields(e),
    payee: { kind: "OTHER", refId: null, label: `${e.tdsCategory} — ${e.expenseSubType}` },
    purpose: "TAX",
    expenseCategory: "Taxes",
    expenseSubType: e.tdsCategory,
    totalAmount: e.tdsAmount,
    tdsLink: {
      role: "TDS",
      linkedId: parentId,
      tdsRate: e.tdsRate,
      tdsAmount: e.tdsAmount,
      grossAmount: e.invoiceTotal,
    },
    log: [
      {
        action: "Created",
        newValue: String(e.tdsAmount),
        note: `TDS split from payable ${parentId}. ${taxNote(e) || ""} [bulk import: ${e.sheet}]`.trim(),
        performedBy: IMPORT_IDENTITY,
        performedAt: new Date(),
      },
    ],
  };
}

async function run() {
  const withTds = ENTRIES.filter((e) => e.tdsAmount > 0);
  const invoiceTotal = ENTRIES.reduce((s, e) => s + e.invoiceTotal, 0);
  const vendorTotal = ENTRIES.reduce((s, e) => s + e.vendorPayable, 0);
  const tdsTotal = ENTRIES.reduce((s, e) => s + e.tdsAmount, 0);

  console.log("=".repeat(90));
  console.log(
    APPLY
      ? "MODE: APPLY  <- will write to the database"
      : "MODE: DRY RUN  <- nothing will be written",
  );
  console.log(
    `Source: ${PAYLOAD.meta.source} (${PAYLOAD.meta.sheets.join(", ")})`,
  );
  console.log(
    `Rows: ${ENTRIES.length} rent payables + ${withTds.length} TDS payables = ${ENTRIES.length + withTds.length} documents`,
  );
  if (MONTHS_FILTER)
    console.log(`Month filter applied: ${MONTHS_FILTER.join(",")}`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(
      `VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`,
    );
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log(
    "Validation passed — sub-types, branches and every tax figure recompute correctly.\n",
  );

  const conserved =
    Math.abs(vendorTotal + tdsTotal - invoiceTotal) < 0.01 * ENTRIES.length;
  console.log("--- TOTALS ---");
  console.log(`  Invoice total (base + GST) : ${inr(invoiceTotal)}`);
  console.log(`  Vendor payables            : ${inr(vendorTotal)}`);
  console.log(`  TDS payables               : ${inr(tdsTotal)}`);
  console.log(
    `  Conservation check         : ${inr(vendorTotal + tdsTotal)} ${conserved ? "== invoice total  OK" : "!= invoice total  MISMATCH"}`,
  );
  if (!conserved) {
    console.error(
      "\nABORTING — vendor + TDS does not equal the invoice total.",
    );
    process.exit(1);
  }

  console.log("\n--- ROWS ---");
  let currentSheet = null;
  const flags = flagRows();
  const flaggedSet = new Set(flags.map((f) => `${f.sheet}#${f.rowNum}`));
  ENTRIES.forEach((e) => {
    if (e.sheet !== currentSheet) {
      currentSheet = e.sheet;
      console.log(`\n  ${currentSheet}`);
    }
    const flag = flaggedSet.has(`${e.sheet}#${e.rowNum}`)
      ? "  <-- FLAGGED"
      : "";
    const tds =
      e.tdsAmount > 0
        ? `  +TDS ${inr(e.tdsAmount)} @${e.tdsRate}%`
        : "  (no TDS)";
    console.log(
      `    ${String(e.rowNum).padStart(3)}  ${e.expenseSubType.padEnd(34)} ${inr(e.vendorPayable).padStart(14)}${tds}${flag}`,
    );
  });

  if (flags.length) {
    console.log("\n" + "!".repeat(90));
    console.log(
      `FLAGGED — ${flags.length} row(s) worth a second look before writing`,
    );
    console.log("!".repeat(90));
    flags.forEach((f) => {
      console.log(`  ${f.sheet} row ${f.rowNum} (${f.subType}): ${f.issue}`);
      if (f.at10pct !== undefined)
        console.log(
          `      at stated rate: ${inr(f.atStatedAmount)}   at 10%: ${inr(f.at10pct)}`,
        );
    });
    console.log("");
    if (APPLY && !CONFIRM_FLAGGED) {
      console.error(
        "Refusing to apply. If these figures are correct, re-run with --confirm-flagged.",
      );
      console.error(
        "If they are not, fix PAYLOAD (or regenerate it from the sheet) and re-run.",
      );
      process.exit(1);
    }
    if (APPLY)
      console.log(
        "--confirm-flagged passed — proceeding with the figures as they stand.\n",
      );
  }

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Payable =
    mongoose.models.Payable ||
    mongoose.model(
      "Payable",
      new mongoose.Schema({}, { strict: false, collection: "payables" }),
    );
  const Vendor =
    mongoose.models.Vendor ||
    mongoose.model(
      "Vendor",
      new mongoose.Schema({}, { strict: false, collection: "vendors" }),
    );

  console.log("Resolving landlords against the vendor database...");
  const uniqueLandlords = new Map();
  for (const e of ENTRIES) {
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
  console.log(
    "  NOTE: spelling variants of the same person (if any) are NOT merged automatically — check the list above for near-duplicates (e.g. a name that differs only by a typo) and merge manually if needed.\n",
  );

  const vendorFor = (e) => {
    const label = normalizeLandlord(e.landlord);
    return label ? vendorByKey.get(label.toLowerCase()) : null;
  };

  console.log("Checking the monthly duplicate guard...");
  const dupes = [];
  for (const e of ENTRIES) {
    const vendor = vendorFor(e);
    if (APPLY === false && vendor === null && normalizeLandlord(e.landlord)) continue;
    const query = vendor
      ? { "payee.kind": "VENDOR", "payee.refId": vendor._id, "payee.label": `${vendor.name} — ${e.expenseSubType}` }
      : { "payee.kind": e.payeeKind, "payee.label": e.expenseSubType };
    const existing = await Payable.findOne({
      ...query,
      purpose: e.purpose,
      "period.month": e.period.month,
      "period.year": e.period.year,
    })
      .select("_id totalAmount isCancelled")
      .lean();
    if (existing)
      dupes.push({
        sheet: e.sheet,
        rowNum: e.rowNum,
        subType: e.expenseSubType,
        id: String(existing._id),
        amount: existing.totalAmount,
        cancelled: !!existing.isCancelled,
      });
  }

  if (dupes.length) {
    console.log(
      `\nWARNING — ${dupes.length} row(s) already have a payable for that month:`,
    );
    dupes.forEach((d) =>
      console.log(
        `  ${d.sheet} row ${d.rowNum}  ${d.subType.padEnd(34)} -> ${d.id} (${inr(d.amount)})${d.cancelled ? " [cancelled]" : ""}`,
      ),
    );
    console.log(
      "\nThis is what the model's unique index is for — skip rather than force through.",
    );
    if (APPLY && !ALLOW_DUPES) {
      console.error(
        "\nRefusing to import. Pass --allow-duplicates only if these are genuinely separate obligations.",
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log("No duplicates found.\n");
  }

  if (!APPLY) {
    console.log(
      "DRY RUN — nothing written. Reconcile the totals above, then re-run with --apply.",
    );
    await mongoose.disconnect();
    return;
  }

  const dupeKeys = new Set(dupes.map((d) => `${d.sheet}#${d.rowNum}`));
  console.log("Creating payables...");
  const created = [];
  const failed = [];
  const skippedAsDupe = [];

  for (const e of ENTRIES) {
    if (dupeKeys.has(`${e.sheet}#${e.rowNum}`) && !ALLOW_DUPES) {
      skippedAsDupe.push({
        sheet: e.sheet,
        rowNum: e.rowNum,
        subType: e.expenseSubType,
      });
      continue;
    }
    try {
      const vendor = vendorFor(e);
      if (!(e.tdsAmount > 0)) {
        const doc = await Payable.create(buildRentPayable(e, vendor));
        created.push({
          sheet: e.sheet,
          rowNum: e.rowNum,
          subType: e.expenseSubType,
          ids: [String(doc._id)],
        });
      } else {
        const dbSession = await mongoose.startSession();
        let parentId, tdsId;
        try {
          await dbSession.withTransaction(async () => {
            const [parent] = await Payable.create([buildRentPayable(e, vendor)], {
              session: dbSession,
            });
            parentId = parent._id;
            const [tds] = await Payable.create([buildTdsPayable(e, parentId)], {
              session: dbSession,
            });
            tdsId = tds._id;
            await Payable.updateOne(
              { _id: parentId },
              { $set: { "tdsLink.linkedId": tdsId } },
              { session: dbSession },
            );
          });
        } finally {
          await dbSession.endSession();
        }
        created.push({
          sheet: e.sheet,
          rowNum: e.rowNum,
          subType: e.expenseSubType,
          ids: [String(parentId), String(tdsId)],
        });
      }
      console.log(
        `  ${e.sheet} row ${String(e.rowNum).padStart(3)}  ${e.expenseSubType}  OK`,
      );
    } catch (err) {
      const reason =
        err?.code === 11000
          ? "duplicate — a payable already exists for this rent unit this month"
          : err?.message || String(err);
      failed.push({
        sheet: e.sheet,
        rowNum: e.rowNum,
        subType: e.expenseSubType,
        reason,
      });
      console.log(
        `  ${e.sheet} row ${String(e.rowNum).padStart(3)}  ${e.expenseSubType}  FAILED: ${reason}`,
      );
    }
  }

  const docCount = created.reduce((s, c) => s + c.ids.length, 0);
  console.log(
    `\nCreated ${docCount} payable document(s) from ${created.length} row(s).`,
  );
  if (skippedAsDupe.length)
    console.log(`Skipped ${skippedAsDupe.length} row(s) already imported.`);
  if (failed.length) {
    console.log(`\n${failed.length} row(s) failed:`);
    failed.forEach((f) =>
      console.log(`  ${f.sheet} row ${f.rowNum}  ${f.subType}: ${f.reason}`),
    );
    console.log(
      "\nSuccessful rows above are committed. Fix and re-run — the duplicate guard will skip everything already imported.",
    );
  }

  const reportPath = `rent-payable-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        source: PAYLOAD.meta.source,
        invoiceTotal,
        vendorTotal,
        tdsTotal,
        created,
        skippedAsDupe,
        failed,
      },
      null,
      2,
    ),
  );
  console.log(
    `\nReport written to ${reportPath} — keep it, the IDs are your undo list.`,
  );

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
