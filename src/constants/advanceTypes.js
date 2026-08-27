// Money WE paid out that will be recovered later — advance salary, advance rent, a personal
// advance to someone. The mirror of src/constants/expenseCategories.js's "Borrowings" head.
//
// Lives on Receivable as revenueCategory: ADVANCE_REVENUE_CATEGORY + revenueSubType: one of
// ADVANCE_TYPES. It is deliberately NOT part of the revenue taxonomy proper ("Transplant" /
// "Services" / "Medicine") — an advance is not a sale, and Receivable.excludeFromPnl is what
// keeps it out of income. See src/models/Advance.js.
export const ADVANCE_REVENUE_CATEGORY = "Advances";

export const ADVANCE_TYPES = [
  "Advance Salary",
  "Advance Rent",
  "Personal Advance",
  "Vendor Advance",
  "Other Advance",
];
