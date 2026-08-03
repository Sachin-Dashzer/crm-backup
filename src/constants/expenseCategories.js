/**
 * Expense Category -> Expense Type tree.
 * Used only for EXPENSE transactions. Every category has at least one
 * Expense Type option (some categories are single-option, mirroring the
 * category name itself). Single source of truth — imported by every
 * panel's expense form, validation, CSV export, WhatsApp approval
 * message, and reports.
 */
export const EXPENSE_CATEGORY_TREE = {
  "Salary": ["Salary"],
  "Rent": [
    "Rent-Backend Basement",
    "Rent-Backend upper ground floor",
    "Rent-Backend 1st Floor",
    "Rent-Backend 4th floor / Top floor",
    "Rent-CD Clinic",
    "Rent-GD clinic",
    "Rent-Manu Vaishali Clinic",
    "Rent-Mansi Vaishali clinic",
    "Rent-Hyderebad Clinic",
    "Rent-Noida Clinic",
    "Rent-Staff Flat",
    "Rent-Deepak staff flat",
    "Rent-P House Rent",
  ],
  "Marketing": [
    "Meta ads",
    "Google ads",
    "Ai Sensy",
    "CX Wizard",
    "Marketing Tools",
    "Marketing-Others",
  ],
  "Medical Consumables": ["Medical Consumables-OT", "Medical Consumables-Others"],
  "Medicine Procurement": ["Medicine Procurement"],
  "Professional Expenses": [
    "Turkey Technician",
    "On Call Staff",
    "Legal Consultant Fee",
    "Finance Consultant Fee",
  ],
  "Electricity Bill": [
    "Electricity Exp-Backend basement",
    "Electricity Exp-Backend upper ground floor",
    "Electricity Exp-Backend 1st Floor",
    "Electricity Exp-Backend 4th floor / Top floor",
    "Electricity Exp-CD Clinic",
    "Electricity Exp-GD clinic",
    "Electricity Exp-Manu Vaishali Clinic",
    "Electricity Exp-Mansi Vaishali clinic",
    "Electricity Exp-Hyderebad Clinic",
    "Electricity Exp-Noida Clinic",
    "Electricity Exp-Staff Flat",
    "Electricity Exp-Deepak staff flat",
    "Electricity Exp-P house",
  ],
  "Incentive": [
    "Sales Incentive-Agents",
    "Sales Incentive--Counsellor",
    "Sales Incentive- Technician",
    "Sales Incentive-- Medicine",
    "Sales Incentive-- HR",
    "Incentive-- Finance",
    "Incentive- Marketing Team",
    "Incentive - Others",
  ],
  "Commision": [
    "Patient Commission Paid to Patients",
    "Patient Commission Paid to Muskan",
    "HR Commission",
    "Commission-others",
  ],
  "Welfare Expenses": [
    "Staff Meals-Management",
    "Staff Welfare",
    "Pantry Expenses",
    "Office Party Expenses",
  ],
  "Office Exp.": [
    "Office Consumables",
    "office Repairs and Maintainence",
    "Vehicle Maintainance",
    "Printing & stationery",
    "Conveyance/Freight",
  ],
  "Lab Expenses": ["Lab Expenses"],
  "Patient Related Expenses": ["Patient Meals", "Patient Refunds", "PATIENT EMI"],
  "Interest Expenses": ["Interest Expenses"],
  "Taxes": ["GST", "ROC", "TDS", "Income Tax"],
  "Software Rental Expenses": ["Software Rental Expenses"],
  "Hardware Rental Expenses": [
    "AC Rent",
    "Laptop/System Rent",
    "Printer Rental Expenses",
  ],
  "Travelling Expenses": ["Travelling Expenses"],
  "Hotel Charges": ["Hotel Charges"],
  "Telephone Expenses": ["Staff Recharge", "Mobile Repairing", "Interenet Recharge/Wifi"],
  "Bank Charges": ["Bank Charges"],
  "Forex Conversion and Fluctuation Charges": ["Forex Conversion and Fluctuation Charges"],
  "Asset Based Payment": [
    "Hardware-Laptop/Computer/Mobile etc",
    "Security & Deposits",
  ],
  "Drawings": ["Personal Payments", "Handover to Family", "Handover to Backend"],
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_TREE);

export const getExpenseTypes = (category) => EXPENSE_CATEGORY_TREE[category] || [];
