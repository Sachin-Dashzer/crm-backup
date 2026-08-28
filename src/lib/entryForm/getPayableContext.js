// §2.2 Phase 1 extraction — getPayableContext(), pulled verbatim (behavior unchanged) out of
// src/app/admin/transactions/create/page.jsx so it's unit-testable without mounting the page, and
// so the future UnifiedEntryForm's "Raise Payable" / "Expense against a payable" kinds can import
// the exact same derivation instead of re-deriving it.
//
// Was a closure over component state (expenseData, employees, employeeCache, patients,
// patientCache, vendors) — now takes them explicitly so it has no hidden dependencies. The page
// calls it the same way it always did: getPayableContext({ expenseData, employees, employeeCache,
// patients, patientCache, vendors }).

// Payable Expenses tab: category -> Payable purpose/payee.kind. Rent and Electricity Bill
// keep their existing dedicated kinds; every other payable category uses a generic "OTHER"
// payee (the sub-type itself is the display label — see getPayableContext's "rent" branch).
export const PAYABLE_CATEGORY_PURPOSE = {
  "Rent": "RENT",
  "Electricity Bill": "ELECTRICITY",
  "Medical Consumables": "MEDICAL_CONSUMABLES",
  "Medicine Procurement": "MEDICINE_PROCUREMENT",
  "Professional Expenses": "PROFESSIONAL_EXPENSES",
  "Lab Expenses": "LAB_EXPENSES",
  "Interest Expenses": "INTEREST_EXPENSES",
  "Taxes": "TAX",
  "Software Rental Expenses": "SOFTWARE_RENTAL",
  "Hardware Rental Expenses": "HARDWARE_RENTAL",
};
export const PAYABLE_CATEGORY_KIND = {
  "Rent": "RENT_UNIT",
  "Electricity Bill": "UTILITY_UNIT",
};
// Vendor selection is available for every payable category — see getPayableContext's "rent"
// branch. Picking a vendor switches payeeKind/payeeRefId from the shared OTHER/RENT_UNIT/
// UTILITY_UNIT bucket to that vendor's own payee, so each vendor's bills (created by
// scripts/vendor-payables-bulk-import.mjs, or by this form) are found and paid individually
// instead of being invisible to this tab (they never matched the bucket + sub-type label).
// Leaving it blank keeps the existing shared-bucket convention fully working — vendor picking is
// additive, never a replacement.

// Resolves the current tab/sub-tab into a Payable "context" — who owes,
// what purpose, what taxonomy — or null when the active selection isn't
// pending-able (direct expense, or required picker not yet filled in).
export function getPayableContext({ expenseData, employees, employeeCache, patients, patientCache, vendors }) {
  const d = expenseData;

  if (d.expenseSection === "agent") {
    if (!d.employeeId) return null;
    const emp = employeeCache[d.employeeId] || employees.find((e) => e._id === d.employeeId);
    const label = emp?.name || "Employee";
    if (d.agentSubTab === "salary") {
      return {
        purpose: "SALARY",
        payeeKind: "EMPLOYEE",
        payeeRefId: d.employeeId,
        payeeLabel: label,
        expenseCategory: "Salary",
        expenseSubType: "Salary",
        period: { month: d.salaryMonth, year: d.salaryYear },
        relatedPatient: null,
        branch: d.branch,
        giver: { type: "EMPLOYEE", refId: d.employeeId, name: label },
      };
    }
    // incentive
    return {
      purpose: "INCENTIVE",
      payeeKind: "EMPLOYEE",
      payeeRefId: d.employeeId,
      payeeLabel: label,
      expenseCategory: "Incentive",
      expenseSubType: d.expenseType,
      period: null,
      relatedPatient: d.patientId || null,
      branch: d.branch,
      giver: { type: "EMPLOYEE", refId: d.employeeId, name: label },
    };
  }

  if (d.expenseSection === "patient" && d.patientSubTab === "commission") {
    if (!d.patientId) return null;
    let receiverLabel = "";
    let receiverKind = "OTHER";
    let receiverRefId = null;
    if (d.receiverType === "MANUAL") {
      receiverLabel = d.receiverName;
    } else if (d.receiverType === "Patient") {
      const pat = patientCache[d.receiverId] || patients.find((p) => p._id === d.receiverId);
      receiverLabel = pat?.personal?.name || "";
      receiverKind = "PATIENT";
      receiverRefId = d.receiverId;
    } else {
      const emp = employeeCache[d.receiverId] || employees.find((e) => e._id === d.receiverId);
      receiverLabel = emp?.name || "";
      receiverKind = "EMPLOYEE";
      receiverRefId = d.receiverId;
    }
    return {
      purpose: "PATIENT_COMMISSION",
      payeeKind: receiverKind,
      payeeRefId: receiverRefId,
      payeeLabel: receiverLabel || "Payee",
      expenseCategory: "Commision",
      expenseSubType: d.expenseType,
      period: null,
      relatedPatient: d.patientId,
      branch: d.branch,
      giver: {
        type: d.receiverType === "MANUAL" ? "MANUAL" : d.receiverType === "Patient" ? "PATIENT" : "EMPLOYEE",
        refId: d.receiverType === "MANUAL" ? null : d.receiverId,
        name: receiverLabel,
      },
    };
  }

  if (d.expenseSection === "rent") {
    if (!d.rentSubType) return null;
    const purpose = PAYABLE_CATEGORY_PURPOSE[d.payableCategory];
    if (!purpose) return null;

    // Leaving the vendor blank keeps any payable genuinely created under the shared-bucket
    // convention (OTHER + sub-type-label, or RENT_UNIT/UTILITY_UNIT) fully visible and payable
    // exactly as before. Vendor mode is additive, never a replacement for the existing behavior.
    const vendor = d.payableVendorId ? vendors.find((v) => v._id === d.payableVendorId) : null;

    return {
      purpose,
      payeeKind: vendor ? "VENDOR" : PAYABLE_CATEGORY_KIND[d.payableCategory] || "OTHER",
      payeeRefId: vendor ? vendor._id : null,
      payeeLabel: vendor ? vendor.name : d.rentSubType,
      expenseCategory: d.payableCategory,
      expenseSubType: d.rentSubType,
      period: null, // set when creating a payable, from the create-panel's own month/year picker
      relatedPatient: null,
      branch: d.branch,
      giver: vendor ? { type: "VENDOR", refId: vendor._id, name: vendor.name } : null,
    };
  }

  return null;
}
