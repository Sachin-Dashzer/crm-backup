import { getExpenseTypes } from "@/constants/expenseCategories";

// §2.2 Phase 1 extraction — validation, pulled verbatim (behavior unchanged) out of
// src/app/admin/transactions/create/page.jsx. The original page split this across two places:
// validateExpenseSection() (a named function) and a handful of inline checks inside
// handleSaveExpense() that ran right after calling it (method/paymentId, paid_by_other). Both are
// combined here into ONE composed check, in the exact original order, so the page's submit
// handler now makes a single call instead of two.
//
// NOTE for whoever builds UnifiedEntryForm: the method/paymentId and paid_by_other checks below
// are NOT expense-specific — they're the same rule src/components/TransactionFieldSet.jsx's
// validateTransactionFields already implements for every other money-movement form. This page
// never adopted that shared implementation; Phase 1 preserves the duplication as-is (extraction,
// not unification) rather than risk a behavior change by switching this page over to it.

// Section-specific rules only — which fields each expenseSection/sub-tab requires. Exported
// separately in case a caller needs just this piece (e.g. re-validating after a section switch)
// without also re-checking the payment-method rules below.
export function validateExpenseSection({ expenseData, payableAction, selectedPayableId }) {
  if (payableAction === "create") {
    return "Use the Create Payable button to record this as owed.";
  }
  if (payableAction === "pay" && !selectedPayableId) {
    return "Select which payable this payment is against";
  }

  if (expenseData.expenseSection === "agent") {
    if (!expenseData.employeeId) return "Please select an employee";
    if (expenseData.agentSubTab === "incentive") {
      if (!expenseData.expenseType) return "Please select an incentive type";
      if (!expenseData.patientId) return "Please select the related patient";
    }
    if (!expenseData.amount) return "Please enter amount";
    return null;
  }
  if (expenseData.expenseSection === "patient") {
    if (!expenseData.patientId) return "Please select a patient";
    if (expenseData.patientSubTab === "commission") {
      if (!expenseData.expenseType) return "Please select a commission type";
      if (expenseData.receiverType === "MANUAL" && !expenseData.receiverName)
        return "Please enter the payee's name";
      if (expenseData.receiverType !== "MANUAL" && !expenseData.receiverId)
        return "Please select the commission recipient";
    }
    if (expenseData.patientSubTab === "expense" && !expenseData.expenseType)
      return "Please select an expense type";
    if (!expenseData.amount) return "Please enter amount";
    return null;
  }
  if (expenseData.expenseSection === "rent") {
    if (!expenseData.rentSubType) return "Please select a sub-type";
    if (!expenseData.amount) return "Please enter amount";
    return null;
  }
  // other
  if (!expenseData.expenseCategory) return "Please select expense category";
  if (getExpenseTypes(expenseData.expenseCategory).length > 0 && !expenseData.expenseType)
    return "Please select expense type";
  if (expenseData.isVendor && !expenseData.vendorId) return "Please select a vendor";
  if (!expenseData.isVendor && !expenseData.expenseGiverName) return "Please enter payee name";
  if (!expenseData.amount) return "Please enter amount";
  return null;
}

// The complete pre-submit check handleSaveExpense ran: section rules, then the payment-method
// rules that used to sit inline in the handler. Returns an error string, or null when valid —
// same contract validateExpenseSection always had.
export function validateExpenseEntry({ expenseData, payableAction, selectedPayableId }) {
  const sectionError = validateExpenseSection({ expenseData, payableAction, selectedPayableId });
  if (sectionError) return sectionError;

  if (expenseData.method !== "cash" && !expenseData.paymentId) {
    return expenseData.method === "card"
      ? "Please enter card last no."
      : expenseData.method?.toLowerCase() === "bajaj_loan" || expenseData.method?.toLowerCase() === "fibe_loan"
        ? "Please add the reference id"
        : "Please add transaction id";
  }
  if (
    expenseData.method === "paid_by_other" &&
    (!expenseData.externalParty.name || !expenseData.externalParty.method)
  ) {
    return "Please enter the sender's name and payment method";
  }

  return null;
}
