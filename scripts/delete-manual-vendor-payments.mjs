
import mongoose from "mongoose";
import fs from "fs";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {
    }
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

const CANDIDATES = [
  {
    "rowNum": 1,
    "date": "2026-08-09",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure bill payment",
    "amount": 60000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 2,
    "date": "2026-08-08",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "301 BILL OT STOCK PAYMENT",
    "amount": 108318.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 3,
    "date": "2026-08-06",
    "branch": "Hyderabad",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "hyd ot bed payment ADEQUATEELE",
    "amount": 65750.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Adequate Electro Mechinical Engineering"
  },
  {
    "rowNum": 4,
    "date": "2026-08-03",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Bhawani drugs medicine payment",
    "amount": 40000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Bhawani Drugs Distributors"
  },
  {
    "rowNum": 5,
    "date": "2026-08-02",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Helpsure health medicine part payment",
    "amount": 137000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 6,
    "date": "2026-08-02",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Helpsure health medicine part payment",
    "amount": 13000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 7,
    "date": "2026-07-21",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Ganpati folirich payment",
    "amount": 40000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Ganapati Bio-Tech Ltd."
  },
  {
    "rowNum": 8,
    "date": "2026-07-20",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma bill payment",
    "amount": 127855.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 9,
    "date": "2026-07-20",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Sacgin mishra surgical",
    "amount": 30000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Mishra Surgical"
  },
  {
    "rowNum": 10,
    "date": "2026-07-19",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Shree ji pharma",
    "amount": 100000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 11,
    "date": "2026-07-17",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine payment",
    "amount": 150000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 12,
    "date": "2026-07-16",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "GFC PAYMENT",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GFC"
  },
  {
    "rowNum": 13,
    "date": "2026-07-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "gfc payment",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GFC"
  },
  {
    "rowNum": 14,
    "date": "2026-07-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono 339 bill payment",
    "amount": 22050.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 15,
    "date": "2026-07-14",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "gnvs medicine bill payment",
    "amount": 47190.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Gnvs Pharmaceuticals"
  },
  {
    "rowNum": 16,
    "date": "2026-07-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 17,
    "date": "2026-07-09",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern Pharma Bill Payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 18,
    "date": "2026-07-08",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma part payment",
    "amount": 100000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 19,
    "date": "2026-07-08",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma part payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 20,
    "date": "2026-07-08",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health part payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 21,
    "date": "2026-07-07",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill part payment",
    "amount": 20446.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 22,
    "date": "2026-07-07",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill part payment",
    "amount": 9450.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 23,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "GNVS pharmaceuticals bill Payment",
    "amount": 24570.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Gnvs Pharmaceuticals"
  },
  {
    "rowNum": 24,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Shivoham Bill payment",
    "amount": 37100.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Shivoham Dermatology Private Limited"
  },
  {
    "rowNum": 25,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "crossQderma Bill Payment",
    "amount": 16612.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Cross Q-Derma"
  },
  {
    "rowNum": 26,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "crossQderma Bill Payment",
    "amount": 16612.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Cross Q-Derma"
  },
  {
    "rowNum": 27,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "Phmg jan bill clear",
    "amount": 64800.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Phmg and Associates"
  },
  {
    "rowNum": 28,
    "date": "2026-07-06",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "Phmg feb bill clear",
    "amount": 64800.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Phmg and Associates"
  },
  {
    "rowNum": 29,
    "date": "2026-07-05",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shree ji pharma Bill Payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 30,
    "date": "2026-07-05",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health Bill payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 31,
    "date": "2026-07-03",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine part payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 32,
    "date": "2026-07-02",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine part payment",
    "amount": 60000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 33,
    "date": "2026-07-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Kusum scientific card bill payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 34,
    "date": "2026-07-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma bill part payment",
    "amount": 55000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 35,
    "date": "2026-06-28",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill payment",
    "amount": 12000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 36,
    "date": "2026-06-28",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shree jii pharma",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 37,
    "date": "2026-06-27",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma ot staock part payment",
    "amount": 150000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 38,
    "date": "2026-06-26",
    "branch": "Hyderabad",
    "expense": "Asset Based Payment",
    "expenseType": "Hardware-Laptop/Computer/Mobile etc",
    "paidTo": "hyd ot bed payment ADEQUATEELE",
    "amount": 94400.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Adequate Electro Mechinical Engineering"
  },
  {
    "rowNum": 39,
    "date": "2026-06-25",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "MIneni ca Bill Payment april increment",
    "amount": 21560.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 40,
    "date": "2026-06-24",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Kusum scientific bill payment",
    "amount": 6300.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 41,
    "date": "2026-06-23",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Medono india bill part payment",
    "amount": 30000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 42,
    "date": "2026-06-20",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "mininee ca bill payment",
    "amount": 102160.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 43,
    "date": "2026-06-19",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma bill payment",
    "amount": 193088.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 44,
    "date": "2026-06-16",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india medical equipment payment",
    "amount": 37499.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 45,
    "date": "2026-06-16",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medica solutions bill payment",
    "amount": 13860.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medica Solutions"
  },
  {
    "rowNum": 46,
    "date": "2026-06-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific card bill payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 47,
    "date": "2026-06-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medica solutions bill payment",
    "amount": 13860.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medica Solutions"
  },
  {
    "rowNum": 48,
    "date": "2026-06-10",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Bhawani hairfact medicine part payment",
    "amount": 40000.0,
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "vendorName": "Bhawani Drugs Distributors"
  },
  {
    "rowNum": 49,
    "date": "2026-06-07",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 50,
    "date": "2026-06-07",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health",
    "amount": 30000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 51,
    "date": "2026-06-07",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "mishra surcigal prp payment",
    "amount": 30000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Mishra Surgical"
  },
  {
    "rowNum": 52,
    "date": "2026-06-07",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "mininee ca bill payment",
    "amount": 85000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 53,
    "date": "2026-06-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "KAPIL SIR GFC PAYMENT",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GFC"
  },
  {
    "rowNum": 54,
    "date": "2026-06-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma bill payment",
    "amount": 166748.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 55,
    "date": "2026-05-31",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Helpsure health medicine payment",
    "amount": 70000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 56,
    "date": "2026-05-29",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment",
    "amount": 30576.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 57,
    "date": "2026-05-27",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicine bill payment",
    "amount": 30000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 58,
    "date": "2026-05-25",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure heath vendor payment",
    "amount": 100000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 59,
    "date": "2026-05-23",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "surender ji medicine payment helpsure",
    "amount": 25000.0,
    "method": "cash",
    "furtherMode": "Cash ( backend )",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 60,
    "date": "2026-05-23",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure heath vendor payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 61,
    "date": "2026-05-23",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure heath vendor payment",
    "amount": 25000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 62,
    "date": "2026-05-18",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment",
    "amount": 33500.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 63,
    "date": "2026-05-18",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "medicine bill payment",
    "amount": 16612.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Cross Q-Derma"
  },
  {
    "rowNum": 64,
    "date": "2026-05-17",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill payment",
    "amount": 11800.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 65,
    "date": "2026-05-17",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill payment",
    "amount": 13338.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 66,
    "date": "2026-05-17",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicine payment",
    "amount": 25000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 67,
    "date": "2026-05-16",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Shivoham dermatology",
    "amount": 37100.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Shivoham Dermatology Private Limited"
  },
  {
    "rowNum": 68,
    "date": "2026-05-16",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicine payment",
    "amount": 25000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 69,
    "date": "2026-05-15",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "moderm phharma bill payment",
    "amount": 36186.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 70,
    "date": "2026-05-15",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicine payment",
    "amount": 30000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 71,
    "date": "2026-05-14",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern part payment",
    "amount": 120000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 72,
    "date": "2026-05-13",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific last bill payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 73,
    "date": "2026-05-10",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "moderm phharma bill payment",
    "amount": 82769.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 74,
    "date": "2026-05-10",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "mininee ca bill payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 75,
    "date": "2026-05-05",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Ganpati biotech Limited",
    "amount": 46875.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Ganapati Bio-Tech Ltd."
  },
  {
    "rowNum": 76,
    "date": "2026-05-04",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "cranix pharma medicine bill payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Cranix Pharma"
  },
  {
    "rowNum": 77,
    "date": "2026-05-02",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "KAPIL SIR GFC PAYMENT",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GLUTA"
  },
  {
    "rowNum": 78,
    "date": "2026-05-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "vejovis ns medicine",
    "amount": 21328.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "VEJOVIS MEDLINE"
  },
  {
    "rowNum": 79,
    "date": "2026-04-30",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine bill payment",
    "amount": 60000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 80,
    "date": "2026-04-29",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "KAPIL SIR PAYMENT GFC",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GLUTA"
  },
  {
    "rowNum": 81,
    "date": "2026-04-29",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine bill payment",
    "amount": 70000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 82,
    "date": "2026-04-29",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "Kusum scientific card payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 83,
    "date": "2026-04-27",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern Pharma bill part payment",
    "amount": 90000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 84,
    "date": "2026-04-27",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern Pharma bill part payment",
    "amount": 10000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 85,
    "date": "2026-04-27",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine bill payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 86,
    "date": "2026-04-26",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment 17",
    "amount": 6300.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 87,
    "date": "2026-04-26",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine bill payment",
    "amount": 60000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 88,
    "date": "2026-04-26",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "Shree ji pharma",
    "amount": 60000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 89,
    "date": "2026-04-26",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "Mininee ca payment",
    "amount": 48500.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 90,
    "date": "2026-04-25",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine vendor",
    "amount": 40000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 91,
    "date": "2026-04-24",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "KAPIL GFC PAYMENT",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GLUTA"
  },
  {
    "rowNum": 92,
    "date": "2026-04-19",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine part payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 93,
    "date": "2026-04-19",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicine part payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 94,
    "date": "2026-04-18",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine part payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  },
  {
    "rowNum": 95,
    "date": "2026-04-15",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicie vendor",
    "amount": 45000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 96,
    "date": "2026-04-15",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma medicie vendor",
    "amount": 30000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 97,
    "date": "2026-04-12",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment",
    "amount": 14280.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 98,
    "date": "2026-04-12",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific bill payment",
    "amount": 13860.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 99,
    "date": "2026-04-11",
    "branch": "Delhi",
    "expense": "Professional Expenses",
    "expenseType": "Finance Consultant Fee",
    "paidTo": "Mininee Ca Bill Payment",
    "amount": 110000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Minenii Corporate Services Private Limited"
  },
  {
    "rowNum": 100,
    "date": "2026-04-08",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma bill payment for ot stock",
    "amount": 138863.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 101,
    "date": "2026-04-07",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "KAPIL SIR GFC PAYMENT",
    "amount": 5000.0,
    "method": "cash",
    "furtherMode": "Cash Book",
    "vendorName": "KAPIL GFC"
  },
  {
    "rowNum": 102,
    "date": "2026-04-05",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "shri ji pharma bill payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Shri Ji Pharma"
  },
  {
    "rowNum": 103,
    "date": "2026-04-04",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "kusum scientific card bill payment",
    "amount": 24276.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Kusum Scientific"
  },
  {
    "rowNum": 104,
    "date": "2026-04-04",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "cranix pharma bill part payment",
    "amount": 50000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Cranix Pharma"
  },
  {
    "rowNum": 105,
    "date": "2026-04-03",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "medono india bill payment",
    "amount": 28455.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Medono India"
  },
  {
    "rowNum": 106,
    "date": "2026-04-02",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-OT",
    "paidTo": "modern pharma latest bill clear",
    "amount": 84477.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Modern Pharmaceuticals"
  },
  {
    "rowNum": 107,
    "date": "2026-04-02",
    "branch": "Hyderabad",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "cranix pharma medicine bill part payment",
    "amount": 40000.0,
    "method": "icici_medihub_bank_transfer",
    "furtherMode": "ICICI Medihub",
    "vendorName": "Cranix Pharma"
  },
  {
    "rowNum": 108,
    "date": "2026-04-01",
    "branch": "Delhi",
    "expense": "Medical Consumables",
    "expenseType": "Medical Consumables-Others",
    "paidTo": "mishra surgical prp wiles payment",
    "amount": 40000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Mishra Surgical"
  },
  {
    "rowNum": 109,
    "date": "2026-04-01",
    "branch": "Delhi",
    "expense": "Medicine Procurement",
    "expenseType": "Medicine Procurement",
    "paidTo": "helpsure health medicine part payment",
    "amount": 50000.0,
    "method": "hdfc_skin_bank_transfer",
    "furtherMode": "HDFC Skin",
    "vendorName": "Helpsure Healthcare Private Limited"
  }
];

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DUMP_JSON = args.includes("--dump-json");

const inr = (n) => "Rs " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });

if (DUMP_JSON) {
  const out = "delete-candidates-payload.json";
  fs.writeFileSync(out, JSON.stringify(CANDIDATES, null, 2));
  console.log(`Wrote ${out} — ${CANDIDATES.length} row(s).`);
  process.exit(0);
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

function signatureKey(e) {
  return [e.date, e.amount, e.method, e.expense, e.expenseType].join("||");
}

const groups = new Map();
for (const e of CANDIDATES) {
  const key = signatureKey(e);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(e);
}

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will delete from the database" : "MODE: DRY RUN  <- nothing will be deleted");
  console.log(`Candidate rows: ${CANDIDATES.length}  (${groups.size} distinct signature(s) — date+amount+method+category+type)`);
  console.log("=".repeat(90) + "\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Vendor = mongoose.models.Vendor || mongoose.model("Vendor", new mongoose.Schema({}, { strict: false, collection: "vendors" }));
  const Payable = mongoose.models.Payable || mongoose.model("Payable", new mongoose.Schema({}, { strict: false, collection: "payables" }));
  const Receivable = mongoose.models.Receivable || mongoose.model("Receivable", new mongoose.Schema({}, { strict: false, collection: "receivables" }));
  const AccountPeriod = mongoose.models.AccountPeriod || mongoose.model("AccountPeriod", new mongoose.Schema({}, { strict: false, collection: "accountperiods" }));
  const Transactions = mongoose.models.Transactions || mongoose.model("Transactions", new mongoose.Schema({}, { strict: false, collection: "transactions" }));
  const DeleteLog = mongoose.models.DeleteLog || mongoose.model("DeleteLog", new mongoose.Schema({}, { strict: false, collection: "deletelogs" }));

  const ACCOUNTS = [
    "Cash Book", "HDFC Skin", "HDFC Medihub", "ICICI Medihub", "Mumbai Receipts",
    "Cash ( backend )", "Paytm ( Delhi T44P )", "Paytm ( Noida CK5Y )", "Bajaj Loan", "Fibe Loan", "Pine Lab",
  ];

  async function isOpeningSeed(period) {
    return new Date(period.periodStart).getTime() === new Date(period.periodEnd).getTime();
  }
  async function closedPeriodsCovering(account, date) {
    const rows = await AccountPeriod.find({
      account, branch: null, isClosed: true,
      periodStart: { $lte: new Date(date) }, periodEnd: { $gte: new Date(date) },
    }).lean();
    const real = [];
    for (const p of rows) if (!(await isOpeningSeed(p))) real.push(p);
    return real;
  }
  async function periodLockReason(account, date) {
    if (!date) return null;
    if (account && ACCOUNTS.includes(account)) {
      const [closed] = await closedPeriodsCovering(account, date);
      return closed ? `${account} is closed for that period. Reopen it to delete this transaction.` : null;
    }
    const perAccount = await Promise.all(ACCOUNTS.map(async (a) => (await closedPeriodsCovering(a, date))[0]));
    return perAccount.every(Boolean) ? "The books are closed for that period across all accounts." : null;
  }

  async function cascadeBlockReason(tx) {
    const links = [];
    const ep = tx.externalParty || {};
    const cr = tx.collabRef || {};
    if (ep.linkedReceivableId) links.push({ kind: "receivable", id: ep.linkedReceivableId });
    if (ep.linkedPayableId) links.push({ kind: "payable", id: ep.linkedPayableId });
    if (cr.receivableId) links.push({ kind: "receivable", id: cr.receivableId });
    if (cr.payableId) links.push({ kind: "payable", id: cr.payableId });
    for (const link of links) {
      const Model = link.kind === "payable" ? Payable : Receivable;
      const doc = await Model.findById(link.id).lean();
      if (!doc) continue;
      const field = link.kind === "payable" ? "payableId" : "receivableId";
      const settlingCount = await Transactions.countDocuments({ [field]: doc._id, isSettlement: true, _id: { $ne: tx._id } });
      if (settlingCount > 0) return `would strand ${settlingCount} settlement(s) against ${link.kind} ${doc._id}`;
    }
    return null;
  }

  console.log("Matching each row against live transactions (date + amount + method + category + type only)...\n");

  const okGroups = [];
  const countMismatch = [];
  const excludedNote = [];

  for (const [key, rows] of groups) {
    const s = rows[0];
    const dayStart = new Date(s.date + "T00:00:00.000Z");
    const dayEnd = new Date(s.date + "T23:59:59.999Z");

    const allMatches = await Transactions.find({
      transactionCategory: "EXPENSE",
      expense: s.expense,
      expenseType: s.expenseType,
      amount: s.amount,
      method: s.method,
      date: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    const eligible = allMatches.filter(
      (t) => !t.payableId && !(t.paymentId || "").startsWith("BULK-") && !(t.remarks || "").includes("[BULK-"),
    );
    const excluded = allMatches.length - eligible.length;
    if (excluded > 0) excludedNote.push({ rows, excludedCount: excluded });

    if (eligible.length !== rows.length) {
      countMismatch.push({ rows, found: eligible.length, matches: eligible });
      continue;
    }
    okGroups.push({ rows, matches: eligible });
  }

  const totalOk = okGroups.reduce((s, g) => s + g.matches.length, 0);
  console.log(`  Groups matched exactly       : ${okGroups.length}  (${totalOk} transaction(s))`);
  console.log(`  Count mismatch (skipped)     : ${countMismatch.length} group(s)`);
  console.log(`  Groups with excluded matches : ${excludedNote.length} (payableId-linked or BULK-tagged, not counted)`);

  if (countMismatch.length) {
    console.log("\n--- COUNT MISMATCH (skipped — review manually) ---");
    countMismatch.forEach(({ rows, found, matches }) => {
      const s = rows[0];
      console.log(`  ${s.date}  ${inr(s.amount)}  ${s.expense}/${s.expenseType}  ${s.method}  — expected ${rows.length}, found ${found}`);
      rows.forEach((r) => console.log(`      candidate: ${r.vendorName}  "${r.paidTo}"`));
      if (found) matches.forEach((m) => console.log(`      db match: ${m._id}  expenseGiver.name="${m.expenseGiver?.name || ""}"  branch=${m.branch}  furtherMode=${m.furtherMode}`));
    });
  }

  if (!okGroups.length) {
    console.log("\nNothing eligible to delete.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n--- MATCHED GROUPS (eligible) ---");
  for (const { rows, matches } of okGroups) {
    const s = rows[0];
    console.log(`\n  ${s.date}  ${inr(s.amount)}  ${s.expense}/${s.expenseType}  ${s.method}`);
    rows.forEach((r, i) => {
      const m = matches[i];
      const nameMatch = (m.expenseGiver?.name || "").trim().toLowerCase() === r.paidTo.trim().toLowerCase();
      console.log(
        `    sheet: ${r.vendorName} — "${r.paidTo}"   db: ${m._id} — "${m.expenseGiver?.name || ""}" (branch ${m.branch}, ${m.furtherMode})${nameMatch ? "" : "   <-- wording differs, check this one"}`,
      );
    });
  }

  console.log("\n\nChecking period lock and cascade integrity on every match...");
  const deletable = [];
  const blocked = [];

  for (const { matches } of okGroups) {
    for (const tx of matches) {
      const lockReason = await periodLockReason(tx.furtherMode, tx.date);
      if (lockReason) { blocked.push({ tx, reason: lockReason }); continue; }
      const cascadeReason = await cascadeBlockReason(tx);
      if (cascadeReason) { blocked.push({ tx, reason: cascadeReason }); continue; }
      deletable.push(tx);
    }
  }

  console.log(`  Deletable    : ${deletable.length}`);
  console.log(`  Blocked      : ${blocked.length}`);
  if (blocked.length) {
    console.log("\n--- BLOCKED (skipped) ---");
    blocked.forEach(({ tx, reason }) => console.log(`  ${tx._id}  ${tx.expense}/${tx.expenseType}  ${inr(tx.amount)}  — ${reason}`));
  }

  const total = deletable.reduce((s, t) => s + t.amount, 0);
  console.log(`\nTOTAL TO BE DELETED: ${inr(total)} across ${deletable.length} transaction(s)\n`);

  const backupPath = `delete-manual-vendor-payments-backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(deletable, null, 2));
  console.log(`Full backup of matched documents written to ${backupPath} BEFORE any deletion.`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Check the 'wording differs' flags above, review the backup,");
    console.log("then re-run with --apply.");
    await mongoose.disconnect();
    return;
  }

  console.log("\nDeleting...");
  const deleted = [];
  const failed = [];

  for (const tx of deletable) {
    try {
      for (const vendorId of [tx.expenseGiver?.vendorId, tx.vendor].filter(Boolean)) {
        const vendorDoc = await Vendor.findById(vendorId);
        if (vendorDoc?.Transactions?.toString() === String(tx._id)) {
          vendorDoc.Transactions = null;
          vendorDoc.editors = vendorDoc.editors || [];
          vendorDoc.editors.push({
            name: "Bulk Delete", email: "import@system", branch: "", date: new Date(),
            updatedFields: [{ name: "Transactions", previousValue: String(tx._id), newValue: "null" }],
          });
          await vendorDoc.save();
        }
      }

      await DeleteLog.create({
        entityType: "Transaction",
        entityId: tx._id,
        entityName: tx.expense || "Expense",
        entityDetails: { category: "EXPENSE", expense: tx.expense, amount: tx.amount, method: tx.method, branch: tx.branch, date: tx.date },
        deletedBy: { name: "Bulk Delete", email: "import@system", branch: "" },
        branch: tx.branch,
      });

      await Transactions.findByIdAndDelete(tx._id);
      deleted.push({ id: String(tx._id), amount: tx.amount, expenseGiverName: tx.expenseGiver?.name });
      console.log(`  ${tx._id}  ${inr(tx.amount)}  DELETED`);
    } catch (err) {
      failed.push({ id: String(tx._id), reason: err?.message || String(err) });
      console.log(`  ${tx._id}  FAILED: ${err?.message || err}`);
    }
  }

  console.log(`\nDeleted ${deleted.length}, ${failed.length} failed.`);

  const reportPath = `delete-manual-vendor-payments-report-${Date.now()}.json`;
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        deleted,
        failed,
        skippedCountMismatch: countMismatch.map(({ rows, found }) => ({ date: rows[0].date, amount: rows[0].amount, expense: rows[0].expense, expenseType: rows[0].expenseType, expected: rows.length, found })),
        skippedBlocked: blocked.map(({ tx, reason }) => ({ id: String(tx._id), reason })),
        backupFile: backupPath,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath}. The backup file (${backupPath}) has the full`);
  console.log("documents — keep both if you need to restore anything.");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
