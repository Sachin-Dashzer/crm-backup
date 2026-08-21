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
const TXN_ENTRIES = [
  {
    "rowNum": 2,
    "date": "2026-04-02",
    "narration": "satpal singh ji backend basement rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "satpal singh ji backend basement rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 34400.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Backend Basement | 3/2026",
    "allocatedAmount": 34400.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 3,
    "date": "2026-04-03",
    "narration": "Ravi kumar jain cd clinic rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "Ravi kumar jain cd clinic rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 132300.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-CD Clinic | 4/2026",
    "allocatedAmount": 132300.0,
    "allocationNote": ""
  },
  {
    "rowNum": 4,
    "date": "2026-04-03",
    "narration": "manu enterprises vaishali march rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "manu enterprises vaishali march rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 3/2026",
    "allocatedAmount": 90720.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 5,
    "date": "2026-04-03",
    "narration": "mansi enterprises vaishali march rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "mansi enterprises vaishali march rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 3/2026",
    "allocatedAmount": 90720.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 6,
    "date": "2026-04-05",
    "narration": "gd clinic rent naresh feb rent clear [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "gd clinic rent naresh feb rent clear",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 90080.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-GD clinic | 3/2026",
    "allocatedAmount": 90080.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 7,
    "date": "2026-04-08",
    "narration": "CD RENT [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "CD RENT",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 30000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-CD Clinic | 4/2026",
    "allocatedAmount": 30000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 8,
    "date": "2026-04-08",
    "narration": "Cd clinic april part rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "Cd clinic april part rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 40000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-CD Clinic | 4/2026",
    "allocatedAmount": 40000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 9,
    "date": "2026-04-11",
    "narration": "Cd clinic april part rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "Cd clinic april part rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 30000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-CD Clinic | 4/2026",
    "allocatedAmount": 30000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 10,
    "date": "2026-04-12",
    "narration": "Kapil Gurija Deepak flat rent [Delhi Backend]",
    "expenseSubType": "Rent-Deepak staff flat",
    "paidTo": "Kapil Gurija Deepak flat rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 8000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Deepak staff flat | 4/2026",
    "allocatedAmount": 8000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 11,
    "date": "2026-04-13",
    "narration": "CD RENT [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "CD RENT",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 15500.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-CD Clinic | 4/2026",
    "allocatedAmount": 15500.0,
    "allocationNote": ""
  },
  {
    "rowNum": 12,
    "date": "2026-04-13",
    "narration": "Personal house rent [Delhi Backend]",
    "expenseSubType": "Rent-P House Rent",
    "paidTo": "Personal house rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 85000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-P House Rent | 4/2026",
    "allocatedAmount": 85000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 13,
    "date": "2026-04-15",
    "narration": "Mukul jain march rent GD staff Flat [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "Mukul jain march rent GD staff Flat",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 39000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Staff Flat | 4/2026",
    "allocatedAmount": 39000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 14,
    "date": "2026-04-16",
    "narration": "Kuljeet bhasin April Rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "Kuljeet bhasin April Rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 75000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 4/2026",
    "allocatedAmount": 75000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 15,
    "date": "2026-04-17",
    "narration": "upasana jain rent [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "upasana jain rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 54000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Staff Flat | 4/2026",
    "allocatedAmount": 54000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 16,
    "date": "2026-04-29",
    "narration": "yalamanchi rent part [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "yalamanchi rent part",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 100000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Hyderebad Clinic | 3/2026",
    "allocatedAmount": 100000.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 17,
    "date": "2026-05-01",
    "narration": "naresh pamnani march part rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "naresh pamnani march part rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 50000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-GD clinic | 3/2026",
    "allocatedAmount": 50000.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 18,
    "date": "2026-05-03",
    "narration": "ravi jain may rent cd clinic [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain may rent cd clinic",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 132300.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-CD Clinic | 5/2026",
    "allocatedAmount": 132300.0,
    "allocationNote": ""
  },
  {
    "rowNum": 19,
    "date": "2026-05-04",
    "narration": "manu enterprises vaishali april rent [Delhi Backend]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "manu enterprises vaishali april rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 3/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Against opening payable; Leg 1 of 2"
  },
  {
    "rowNum": 20,
    "date": "2026-05-04",
    "narration": "manu enterprises vaishali april rent [Delhi Backend]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "manu enterprises vaishali april rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 4/2026",
    "allocatedAmount": 90200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 21,
    "date": "2026-05-04",
    "narration": "mansi enterprises vaishali april rent [Delhi Backend]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "mansi enterprises vaishali april rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 3/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Against opening payable; Leg 1 of 2"
  },
  {
    "rowNum": 22,
    "date": "2026-05-04",
    "narration": "mansi enterprises vaishali april rent [Delhi Backend]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "mansi enterprises vaishali april rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 4/2026",
    "allocatedAmount": 90200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 23,
    "date": "2026-05-08",
    "narration": "RAVI JAIN MAY RENT PAYMENT [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "RAVI JAIN MAY RENT PAYMENT",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 30000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-CD Clinic | 5/2026",
    "allocatedAmount": 30000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 24,
    "date": "2026-05-08",
    "narration": "personal house rent [Delhi Backend]",
    "expenseSubType": "Rent-P House Rent",
    "paidTo": "personal house rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 85000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-P House Rent | 5/2026",
    "allocatedAmount": 85000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 25,
    "date": "2026-05-09",
    "narration": "ravi jain cd clinic part rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain cd clinic part rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 50000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-CD Clinic | 5/2026",
    "allocatedAmount": 50000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 26,
    "date": "2026-05-10",
    "narration": "ravi jain cd clinic may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain cd clinic may rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 35600.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-CD Clinic | 5/2026",
    "allocatedAmount": 35500.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 27,
    "date": "2026-05-10",
    "narration": "ravi jain cd clinic may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain cd clinic may rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 35600.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-CD Clinic | 6/2026",
    "allocatedAmount": 100.0,
    "allocationNote": "Advance - before period start; Leg 2 of 2"
  },
  {
    "rowNum": 28,
    "date": "2026-05-11",
    "narration": "naresh pamnani gd clinic march part rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "naresh pamnani gd clinic march part rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 60000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-GD clinic | 3/2026",
    "allocatedAmount": 60000.0,
    "allocationNote": "Against opening payable"
  },
  {
    "rowNum": 29,
    "date": "2026-05-13",
    "narration": "satpal singh bhasin part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal singh bhasin part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 200000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Backend upper ground floor | 3/2026",
    "allocatedAmount": 67547.1,
    "allocationNote": "Against opening payable; Leg 1 of 2"
  },
  {
    "rowNum": 30,
    "date": "2026-05-13",
    "narration": "satpal singh bhasin part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal singh bhasin part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 200000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend upper ground floor | 4/2026",
    "allocatedAmount": 132452.9,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 31,
    "date": "2026-05-17",
    "narration": "mukul jain upasana jain staff flat rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "mukul jain upasana jain staff flat rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 39000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Staff Flat | 5/2026",
    "allocatedAmount": 39000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 32,
    "date": "2026-05-17",
    "narration": "kuljeet singh bhaseen may rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "kuljeet singh bhaseen may rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 25000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 5/2026",
    "allocatedAmount": 25000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 33,
    "date": "2026-05-17",
    "narration": "kuljeet singh bhasin 4th floor rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "kuljeet singh bhasin 4th floor rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 50000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 5/2026",
    "allocatedAmount": 50000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 34,
    "date": "2026-05-17",
    "narration": "upasana jain staff flat rent [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "upasana jain staff flat rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 54000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Staff Flat | 5/2026",
    "allocatedAmount": 54000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 35,
    "date": "2026-05-18",
    "narration": "Deepak staff flat rent kapil gurija [Delhi Backend]",
    "expenseSubType": "Rent-Deepak staff flat",
    "paidTo": "Deepak staff flat rent kapil gurija",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 8000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Deepak staff flat | 5/2026",
    "allocatedAmount": 8000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 36,
    "date": "2026-05-26",
    "narration": "Satpal ji 1st floor backend part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 1st Floor",
    "paidTo": "Satpal ji 1st floor backend part rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 30000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend 1st Floor | 4/2026",
    "allocatedAmount": 30000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 37,
    "date": "2026-05-27",
    "narration": "Naresh pamnani gd clinic part rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "Naresh pamnani gd clinic part rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 90000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-GD clinic | 3/2026",
    "allocatedAmount": 62800.0,
    "allocationNote": "Against opening payable; Leg 1 of 2"
  },
  {
    "rowNum": 38,
    "date": "2026-05-27",
    "narration": "Naresh pamnani gd clinic part rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "Naresh pamnani gd clinic part rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 90000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-GD clinic | 4/2026",
    "allocatedAmount": 27200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 39,
    "date": "2026-05-27",
    "narration": "yalamanchi rent part [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "yalamanchi rent part",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 100000.0,
    "period": {
      "month": 3,
      "year": 2026
    },
    "payableDueDateRaw": "31.03.2026",
    "matchKey": "Rent-Hyderebad Clinic | 3/2026",
    "allocatedAmount": 99800.0,
    "allocationNote": "Against opening payable; Leg 1 of 2"
  },
  {
    "rowNum": 40,
    "date": "2026-05-27",
    "narration": "yalamanchi rent part [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "yalamanchi rent part",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 100000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "08.04.2026",
    "matchKey": "Rent-Hyderebad Clinic | 4/2026",
    "allocatedAmount": 200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 41,
    "date": "2026-05-30",
    "narration": "Satpal ji 1st floor rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 1st Floor",
    "paidTo": "Satpal ji 1st floor rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 80000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend 1st Floor | 4/2026",
    "allocatedAmount": 31404.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 42,
    "date": "2026-05-30",
    "narration": "Satpal ji 1st floor rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 1st Floor",
    "paidTo": "Satpal ji 1st floor rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 80000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend 1st Floor | 5/2026",
    "allocatedAmount": 48596.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 43,
    "date": "2026-06-03",
    "narration": "satpal ji part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 200000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend upper ground floor | 4/2026",
    "allocatedAmount": 48147.1,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 44,
    "date": "2026-06-03",
    "narration": "satpal ji part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 200000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend upper ground floor | 5/2026",
    "allocatedAmount": 151852.9,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 45,
    "date": "2026-06-03",
    "narration": "satpal ji part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 100000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend upper ground floor | 5/2026",
    "allocatedAmount": 28747.1,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 46,
    "date": "2026-06-03",
    "narration": "satpal ji part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 100000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend upper ground floor | 6/2026",
    "allocatedAmount": 71252.9,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 47,
    "date": "2026-06-04",
    "narration": "Naresh pamnani rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "Naresh pamnani rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 190080.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-GD clinic | 4/2026",
    "allocatedAmount": 162880.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 48,
    "date": "2026-06-04",
    "narration": "Naresh pamnani rent [Delhi Backend]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "Naresh pamnani rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 190080.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-GD clinic | 5/2026",
    "allocatedAmount": 27200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 49,
    "date": "2026-06-05",
    "narration": "ravi kumar jain cd clinic june part rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi kumar jain cd clinic june part rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 90000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-CD Clinic | 6/2026",
    "allocatedAmount": 90000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 50,
    "date": "2026-06-05",
    "narration": "hyd clinic rent [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "hyd clinic rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 199800.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "08.04.2026",
    "matchKey": "Rent-Hyderebad Clinic | 4/2026",
    "allocatedAmount": 199600.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 51,
    "date": "2026-06-05",
    "narration": "hyd clinic rent [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "hyd clinic rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 199800.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "08.05.2026",
    "matchKey": "Rent-Hyderebad Clinic | 5/2026",
    "allocatedAmount": 200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 52,
    "date": "2026-06-06",
    "narration": "ravi kumar jain cd clinic june rent [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi kumar jain cd clinic june rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 42300.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-CD Clinic | 6/2026",
    "allocatedAmount": 42300.0,
    "allocationNote": ""
  },
  {
    "rowNum": 53,
    "date": "2026-06-08",
    "narration": "yalamanchi rent may 2026 [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "yalamanchi rent may 2026",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 199800.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "08.05.2026",
    "matchKey": "Rent-Hyderebad Clinic | 5/2026",
    "allocatedAmount": 199600.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 54,
    "date": "2026-06-08",
    "narration": "yalamanchi rent may 2026 [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "yalamanchi rent may 2026",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 199800.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "08.06.2026",
    "matchKey": "Rent-Hyderebad Clinic | 6/2026",
    "allocatedAmount": 200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 55,
    "date": "2026-06-09",
    "narration": "CD RENT RAVI JAIN [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "CD RENT RAVI JAIN",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 90000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-CD Clinic | 6/2026",
    "allocatedAmount": 90000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 56,
    "date": "2026-06-09",
    "narration": "satpal ji backend rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji backend rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 250000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend upper ground floor | 6/2026",
    "allocatedAmount": 191247.1,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 57,
    "date": "2026-06-09",
    "narration": "satpal ji backend rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "satpal ji backend rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 250000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend upper ground floor | 7/2026",
    "allocatedAmount": 58752.9,
    "allocationNote": "Advance - before period start; Leg 2 of 2"
  },
  {
    "rowNum": 58,
    "date": "2026-06-11",
    "narration": "ravi jain cd clinic rent clear [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain cd clinic rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 25500.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-CD Clinic | 6/2026",
    "allocatedAmount": 25400.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 59,
    "date": "2026-06-11",
    "narration": "ravi jain cd clinic rent clear [Delhi Backend]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi jain cd clinic rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 25500.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-CD Clinic | 7/2026",
    "allocatedAmount": 100.0,
    "allocationNote": "Advance - before period start; Leg 2 of 2"
  },
  {
    "rowNum": 60,
    "date": "2026-06-11",
    "narration": "personal house rent ajay kejriwal [Delhi Backend]",
    "expenseSubType": "Rent-P House Rent",
    "paidTo": "personal house rent ajay kejriwal",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 85000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-P House Rent | 6/2026",
    "allocatedAmount": 85000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 61,
    "date": "2026-06-12",
    "narration": "stapal singh backend part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 1st Floor",
    "paidTo": "stapal singh backend part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 30000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend 1st Floor | 5/2026",
    "allocatedAmount": 12808.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 62,
    "date": "2026-06-12",
    "narration": "stapal singh backend part rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 1st Floor",
    "paidTo": "stapal singh backend part rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 30000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend 1st Floor | 6/2026",
    "allocatedAmount": 17192.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 63,
    "date": "2026-06-13",
    "narration": "mansi aggarwal vaishali may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "mansi aggarwal vaishali may rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 108864.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 4/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 64,
    "date": "2026-06-13",
    "narration": "mansi aggarwal vaishali may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "mansi aggarwal vaishali may rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 108864.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 5/2026",
    "allocatedAmount": 108344.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 65,
    "date": "2026-06-13",
    "narration": "mannu aggarwal vaishali may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "mannu aggarwal vaishali may rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 108864.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 4/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 66,
    "date": "2026-06-13",
    "narration": "mannu aggarwal vaishali may rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "mannu aggarwal vaishali may rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 108864.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 5/2026",
    "allocatedAmount": 108344.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 67,
    "date": "2026-06-16",
    "narration": "kuljeet sing 4th floor rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "kuljeet sing 4th floor rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 75000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 6/2026",
    "allocatedAmount": 75000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 68,
    "date": "2026-06-16",
    "narration": "upasana jain staff flat rent [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "upasana jain staff flat rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 54000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Staff Flat | 6/2026",
    "allocatedAmount": 54000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 69,
    "date": "2026-06-17",
    "narration": "upasana jain staff flat june cash part clear [Delhi Backend]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "upasana jain staff flat june cash part clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 39000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Staff Flat | 6/2026",
    "allocatedAmount": 39000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 70,
    "date": "2026-06-18",
    "narration": "Deepak staff flat rent [Delhi Backend]",
    "expenseSubType": "Rent-Deepak staff flat",
    "paidTo": "Deepak staff flat rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 8000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Deepak staff flat | 6/2026",
    "allocatedAmount": 8000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 71,
    "date": "2026-06-18",
    "narration": "naman singh noida clinic june advance rent [Delhi Backend]",
    "expenseSubType": "Rent-Noida Clinic",
    "paidTo": "naman singh noida clinic june advance rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 27500.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Noida Clinic | 6/2026",
    "allocatedAmount": 24750.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 72,
    "date": "2026-06-18",
    "narration": "naman singh noida clinic june advance rent [Delhi Backend]",
    "expenseSubType": "Rent-Noida Clinic",
    "paidTo": "naman singh noida clinic june advance rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 27500.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Noida Clinic | 7/2026",
    "allocatedAmount": 2750.0,
    "allocationNote": "Advance - before period start; Leg 2 of 2"
  },
  {
    "rowNum": 73,
    "date": "2026-06-22",
    "narration": "manjeet backend upper ground floor part rent june [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "manjeet backend upper ground floor part rent june",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 100000.0,
    "period": {
      "month": 4,
      "year": 2026
    },
    "payableDueDateRaw": "01.04.2026",
    "matchKey": "Rent-Backend Basement | 4/2026",
    "allocatedAmount": 36120.0,
    "allocationNote": "Leg 1 of 3"
  },
  {
    "rowNum": 74,
    "date": "2026-06-22",
    "narration": "manjeet backend upper ground floor part rent june [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "manjeet backend upper ground floor part rent june",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 100000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Backend Basement | 5/2026",
    "allocatedAmount": 36120.0,
    "allocationNote": "Leg 2 of 3"
  },
  {
    "rowNum": 75,
    "date": "2026-06-22",
    "narration": "manjeet backend upper ground floor part rent june [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "manjeet backend upper ground floor part rent june",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 100000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend Basement | 6/2026",
    "allocatedAmount": 27760.0,
    "allocationNote": "Leg 3 of 3"
  },
  {
    "rowNum": 76,
    "date": "2026-06-22",
    "narration": "manjeet basement balance rent clear [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "manjeet basement balance rent clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 7500.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend Basement | 6/2026",
    "allocatedAmount": 7500.0,
    "allocationNote": ""
  },
  {
    "rowNum": 77,
    "date": "2026-06-22",
    "narration": "Manjeet backend basement june rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "Manjeet backend basement june rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 45000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Backend Basement | 6/2026",
    "allocatedAmount": 17240.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 78,
    "date": "2026-06-22",
    "narration": "Manjeet backend basement june rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "Manjeet backend basement june rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 45000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend Basement | 7/2026",
    "allocatedAmount": 27760.0,
    "allocationNote": "Advance - before period start; Leg 2 of 2"
  },
  {
    "rowNum": 79,
    "date": "2026-06-28",
    "narration": "BD-2 Upper Ground floor Rent [Delhi Backend]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "BD-2 Upper Ground floor Rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "paymentAmount": 100000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend upper ground floor | 7/2026",
    "allocatedAmount": 100000.0,
    "allocationNote": "Advance - before period start"
  },
  {
    "rowNum": 80,
    "date": "2026-07-02",
    "narration": "BD-2 Upper Ground floor Rent [Delhi Center]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "BD-2 Upper Ground floor Rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 62500.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend upper ground floor | 7/2026",
    "allocatedAmount": 62500.0,
    "allocationNote": ""
  },
  {
    "rowNum": 81,
    "date": "2026-07-06",
    "narration": "ravi kumar jain CD rent [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "ravi kumar jain CD rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 132300.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-CD Clinic | 7/2026",
    "allocatedAmount": 132300.0,
    "allocationNote": ""
  },
  {
    "rowNum": 82,
    "date": "2026-07-06",
    "narration": "ajay kejriwal personal rent clear [Delhi Center]",
    "expenseSubType": "Rent-P House Rent",
    "paidTo": "ajay kejriwal personal rent clear",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 85000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-P House Rent | 7/2026",
    "allocatedAmount": 85000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 83,
    "date": "2026-07-07",
    "narration": "Ravi Jain CD rent [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "Ravi Jain CD rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 50000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-CD Clinic | 7/2026",
    "allocatedAmount": 50000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 84,
    "date": "2026-07-10",
    "narration": "Ravi Jain CD rent July clear [Delhi Center]",
    "expenseSubType": "Rent-CD Clinic",
    "paidTo": "Ravi Jain CD rent July clear",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 65500.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-CD Clinic | 7/2026",
    "allocatedAmount": 65500.0,
    "allocationNote": ""
  },
  {
    "rowNum": 85,
    "date": "2026-07-12",
    "narration": "deepak flat rent [Delhi Center]",
    "expenseSubType": "Rent-Deepak staff flat",
    "paidTo": "deepak flat rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 8000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Deepak staff flat | 7/2026",
    "allocatedAmount": 8000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 86,
    "date": "2026-07-18",
    "narration": "naresh pamnani gd 28 part rent [Delhi Center]",
    "expenseSubType": "Rent-GD clinic",
    "paidTo": "naresh pamnani gd 28 part rent",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 150000.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-GD clinic | 5/2026",
    "allocatedAmount": 150000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 87,
    "date": "2026-07-19",
    "narration": "backend part rent to manjeet [Delhi Center]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "backend part rent to manjeet",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 100000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend upper ground floor | 7/2026",
    "allocatedAmount": 100000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 88,
    "date": "2026-07-20",
    "narration": "BD 2 NEW BASMENT TOKEN [Delhi Center]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "BD 2 NEW BASMENT TOKEN",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 30000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend Basement | 7/2026",
    "allocatedAmount": 30000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 89,
    "date": "2026-07-21",
    "narration": "Kuljeet Bhasin July Rent 4th Floor [Delhi Center]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "Kuljeet Bhasin July Rent 4th Floor",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 35000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 7/2026",
    "allocatedAmount": 35000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 90,
    "date": "2026-07-21",
    "narration": "Upasana jain staff flat rent [Delhi Center]",
    "expenseSubType": "Rent-Staff Flat",
    "paidTo": "Upasana jain staff flat rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 54000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Staff Flat | 7/2026",
    "allocatedAmount": 54000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 91,
    "date": "2026-07-21",
    "narration": "Kuljeet singh bhasin july rent [Delhi Center]",
    "expenseSubType": "Rent-Backend 4th floor / Top floor",
    "paidTo": "Kuljeet singh bhasin july rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 40000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend 4th floor / Top floor | 7/2026",
    "allocatedAmount": 40000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 92,
    "date": "2026-07-21",
    "narration": "Mansi aggarwal vaishali rent [Delhi Center]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "Mansi aggarwal vaishali rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 5/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 93,
    "date": "2026-07-21",
    "narration": "Mansi aggarwal vaishali rent [Delhi Center]",
    "expenseSubType": "Rent-Mansi Vaishali clinic",
    "paidTo": "Mansi aggarwal vaishali rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Mansi Vaishali clinic | 6/2026",
    "allocatedAmount": 90200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 94,
    "date": "2026-07-21",
    "narration": "mannu aggarwal vaishali rent [Delhi Center]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "mannu aggarwal vaishali rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 5,
      "year": 2026
    },
    "payableDueDateRaw": "01.05.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 5/2026",
    "allocatedAmount": 520.0,
    "allocationNote": "Leg 1 of 2"
  },
  {
    "rowNum": 95,
    "date": "2026-07-21",
    "narration": "mannu aggarwal vaishali rent [Delhi Center]",
    "expenseSubType": "Rent-Manu Vaishali Clinic",
    "paidTo": "mannu aggarwal vaishali rent",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 90720.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "01.06.2026",
    "matchKey": "Rent-Manu Vaishali Clinic | 6/2026",
    "allocatedAmount": 90200.0,
    "allocationNote": "Leg 2 of 2"
  },
  {
    "rowNum": 96,
    "date": "2026-07-22",
    "narration": "Ashish Mittal Upper Ground Rent Part [Delhi Center]",
    "expenseSubType": "Rent-Backend upper ground floor",
    "paidTo": "Ashish Mittal Upper Ground Rent Part",
    "paymentMethodRaw": "Cash",
    "method": "cash",
    "furtherMode": "Cash Book",
    "paymentAmount": 100000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend upper ground floor | 7/2026",
    "allocatedAmount": 100000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 97,
    "date": "2026-07-25",
    "narration": "naman singh noida clinic july rent [Delhi Center]",
    "expenseSubType": "Rent-Noida Clinic",
    "paidTo": "naman singh noida clinic july rent",
    "paymentMethodRaw": "HDFC Skin Bank Transfer",
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "paymentAmount": 46750.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Noida Clinic | 7/2026",
    "allocatedAmount": 46750.0,
    "allocationNote": ""
  },
  {
    "rowNum": 98,
    "date": "2026-07-31",
    "narration": "Manjeet basement rent july [Delhi Center]",
    "expenseSubType": "Rent-Backend Basement",
    "paidTo": "Manjeet basement rent july",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 45000.0,
    "period": {
      "month": 7,
      "year": 2026
    },
    "payableDueDateRaw": "01.07.2026",
    "matchKey": "Rent-Backend Basement | 7/2026",
    "allocatedAmount": 45000.0,
    "allocationNote": ""
  },
  {
    "rowNum": 99,
    "date": "2026-07-31",
    "narration": "Venkata rao yalamanchi hyd clinic [Hyderabad Clinic]",
    "expenseSubType": "Rent-Hyderebad Clinic",
    "paidTo": "Venkata rao yalamanchi hyd clinic",
    "paymentMethodRaw": "ICICI Medihub Bank Transfer",
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "paymentAmount": 110000.0,
    "period": {
      "month": 6,
      "year": 2026
    },
    "payableDueDateRaw": "08.06.2026",
    "matchKey": "Rent-Hyderebad Clinic | 6/2026",
    "allocatedAmount": 110000.0,
    "allocationNote": ""
  }
];

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const APPLY = args.includes("--apply");
const CONFIRM_UNMATCHED = args.includes("--confirm-unmatched");
const ALLOW_OVERPAYMENT = args.includes("--allow-overpayment");
const DUMP_JSON = args.includes("--dump-json");
const ROWS_FILTER = arg("rows") ? arg("rows").split(",").map((s) => parseInt(s.trim(), 10)) : null;

const ENTRIES = ROWS_FILTER ? TXN_ENTRIES.filter((e) => ROWS_FILTER.includes(e.rowNum)) : TXN_ENTRIES;

const IMPORT_IDENTITY = { name: "Bulk Import", email: "import@system", branch: "" };
const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

if (DUMP_JSON) {
  const out = "rent-expense-transactions-payload.json";
  fs.writeFileSync(out, JSON.stringify(ENTRIES, null, 2));
  console.log(`Wrote ${out} — ${ENTRIES.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

// Basic shape validation — every row must have already-mapped method/furtherMode/dates from
// the parse step. This is a canary (should never fire) since TXN_ENTRIES was generated, not
// hand-edited — but a hand-edit after generation is exactly what this catches.
function validate() {
  const errors = [];
  const VALID_METHODS = ["cash", "hdfc_skin_bank_transfer", "hdfc_ryan_medihub_bank_transfer", "icici_medihub_bank_transfer"];
  for (const e of ENTRIES) {
    const where = `row ${e.rowNum} (${e.expenseSubType}, ${e.matchKey})`;
    if (!VALID_METHODS.includes(e.method)) errors.push(`${where}: unmapped method "${e.method}"`);
    if (!e.furtherMode) errors.push(`${where}: missing furtherMode (Paid From Account)`);
    if (!(e.allocatedAmount > 0)) errors.push(`${where}: allocated amount must be > 0`);
    if (isNaN(new Date(e.date).getTime())) errors.push(`${where}: bad date "${e.date}"`);
    if (!(e.period?.month >= 1 && e.period?.month <= 12)) errors.push(`${where}: bad period month`);
  }
  return errors;
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log(`Rows: ${ENTRIES.length}  (source: transactions.xlsx, ${TXN_ENTRIES.length} total legs)`);
  console.log("=".repeat(90) + "\n");

  const errors = validate();
  if (errors.length) {
    console.error(`VALIDATION FAILED — ${errors.length} problem(s). Nothing imported.\n`);
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  }
  console.log("Validation passed — every row has a mapped method, an account and a valid date.\n");

  const sheetTotal = r2(ENTRIES.reduce((s, e) => s + e.allocatedAmount, 0));
  console.log(`Sum of Allocated Amount across selected rows: ${inr(sheetTotal)}`);
  console.log("(Cross-check this against the source sheet's own \"Total allocated\" footer row.)\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));

  // ---------------------------------------------------------------------------
  // PASS 1 — resolve every row's Payable and classify it, WITHOUT writing anything. This is
  // what both dry run and apply show; apply only additionally executes the "ok" rows below.
  // ---------------------------------------------------------------------------
  console.log("Resolving payables and checking each row...\n");
  const resolved = [];
  for (const e of ENTRIES) {
    const paymentId = `BULK-RENT-TXN-${e.rowNum}`;

    const alreadyImported = await Transactions.findOne({ paymentId }).select("_id amount").lean();
    if (alreadyImported) {
      resolved.push({ e, status: "already-imported", existingId: String(alreadyImported._id) });
      continue;
    }

    const payable = await Payable.findOne({
      "payee.kind": "RENT_UNIT",
      "payee.label": e.expenseSubType,
      purpose: "RENT",
      "period.month": e.period.month,
      "period.year": e.period.year,
      isCancelled: { $ne: true },
    }).lean();

    if (!payable) {
      resolved.push({ e, status: "unmatched" });
      continue;
    }

    // Live aggregation — same UNSETTLED_METHODS exclusion the API route itself uses. Prior
    // legs already created in an EARLIER run of this script are picked up here automatically
    // since this is a fresh query, not an in-memory running total — this is what makes
    // multi-leg payments (and re-running after a partial failure) correct without extra logic.
    const UNSETTLED_METHODS = ["paid_to_external", "paid_by_other"];
    const [paidAgg] = await Transactions.aggregate([
      { $match: { payableId: payable._id, approvalStatus: "APPROVED", method: { $nin: UNSETTLED_METHODS } } },
      { $group: { _id: null, paid: { $sum: "$amount" } } },
    ]);
    const currentPaid = paidAgg?.paid || 0;
    const remaining = r2(payable.totalAmount - currentPaid);

    if (e.allocatedAmount > remaining && !ALLOW_OVERPAYMENT) {
      resolved.push({ e, status: "overpay", payable, currentPaid, remaining });
      continue;
    }

    resolved.push({ e, status: "ok", payable, currentPaid, remaining, paymentId });
  }

  const ok = resolved.filter((r) => r.status === "ok");
  const unmatched = resolved.filter((r) => r.status === "unmatched");
  const overpay = resolved.filter((r) => r.status === "overpay");
  const already = resolved.filter((r) => r.status === "already-imported");

  console.log(`  OK to import          : ${ok.length}`);
  console.log(`  Already imported       : ${already.length}  (idempotent — safe re-run, skipped)`);
  console.log(`  No matching payable    : ${unmatched.length}`);
  console.log(`  Exceeds remaining      : ${overpay.length}  (pass --allow-overpayment to force)`);

  if (unmatched.length) {
    console.log("\n--- NO MATCHING PAYABLE (skipped) ---");
    unmatched.forEach(({ e }) =>
      console.log(`  row ${e.rowNum}  ${e.matchKey.padEnd(38)} ${inr(e.allocatedAmount).padStart(12)}  "${e.narration}"`),
    );
    console.log("\nMost or all of these are the 12 rows referencing \"3/2026\" (an opening payable that");
    console.log("predates every payables-import script). Create the March 2026 opening payables first if");
    console.log("these need to be recorded, then re-run this script — it will pick them up automatically.");
  }

  if (overpay.length) {
    console.log("\n--- EXCEEDS REMAINING BALANCE (skipped) ---");
    overpay.forEach(({ e, payable, currentPaid, remaining }) =>
      console.log(
        `  row ${e.rowNum}  ${e.matchKey.padEnd(38)} allocating ${inr(e.allocatedAmount)}, but only ${inr(remaining)} remains (paid ${inr(currentPaid)} of ${inr(payable.totalAmount)})`,
      ),
    );
  }

  if ((unmatched.length || overpay.length) && APPLY && !CONFIRM_UNMATCHED) {
    console.error("\nRefusing to apply — unmatched/overpaying rows above would be silently skipped.");
    console.error("Re-run with --confirm-unmatched once you've reviewed the lists above (they will");
    console.error("still be skipped, not force-written — this flag only acknowledges you've seen them).");
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply once the lists above look right.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nCreating ${ok.length} transaction(s)...`);
  const created = [];
  const failed = [];

  for (const { e, payable, paymentId } of ok) {
    try {
      const remarks = e.allocationNote ? `${e.narration} (${e.allocationNote})` : e.narration;
      const doc = await Transactions.create({
        transactionCategory: "EXPENSE",
        costType: "Expenses",
        expense: "Rent",
        expenseType: e.expenseSubType,
        payableId: payable._id,
        amount: e.allocatedAmount,
        method: e.method,
        paymentId,
        branch: payable.branch,
        date: new Date(e.date),
        remarks,
        receipts: [],
        furtherMode: e.furtherMode,
        receiptMode: "",
        // Manually-raised RENT payables never have costAlreadyRecognised — nothing books an
        // expense when they're created, so this payment IS the expense. Mirrors the route's
        // own rule exactly (see Payable.costAlreadyRecognised model comment).
        isSettlement: payable.costAlreadyRecognised === true,
        vendor: null,
        approvalStatus: "APPROVED",
        createdBy: { ...IMPORT_IDENTITY, branch: payable.branch, date: new Date() },
      });
      created.push({ rowNum: e.rowNum, matchKey: e.matchKey, id: String(doc._id), amount: e.allocatedAmount });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.matchKey.padEnd(38)} ${inr(e.allocatedAmount).padStart(12)}  OK`);
    } catch (err) {
      failed.push({ rowNum: e.rowNum, matchKey: e.matchKey, reason: err?.message || String(err) });
      console.log(`  row ${String(e.rowNum).padStart(3)}  ${e.matchKey.padEnd(38)}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nCreated ${created.length} transaction(s), ${failed.length} failed.`);
  if (failed.length) {
    console.log("\nFailed rows:");
    failed.forEach((f) => console.log(`  row ${f.rowNum}  ${f.matchKey}: ${f.reason}`));
  }

  const reportPath = `rent-expense-import-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        source: "transactions.xlsx",
        created,
        failed,
        skippedUnmatched: unmatched.map(({ e }) => ({ rowNum: e.rowNum, matchKey: e.matchKey, amount: e.allocatedAmount })),
        skippedOverpay: overpay.map(({ e }) => ({ rowNum: e.rowNum, matchKey: e.matchKey, amount: e.allocatedAmount })),
        alreadyImported: already.map(({ e, existingId }) => ({ rowNum: e.rowNum, matchKey: e.matchKey, existingId })),
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
