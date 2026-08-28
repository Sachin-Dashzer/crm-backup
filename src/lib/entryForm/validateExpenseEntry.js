import { getExpenseTypes } from "@/constants/expenseCategories";

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
  if (!expenseData.expenseCategory) return "Please select expense category";
  if (getExpenseTypes(expenseData.expenseCategory).length > 0 && !expenseData.expenseType)
    return "Please select expense type";
  if (expenseData.isVendor && !expenseData.vendorId) return "Please select a vendor";
  if (!expenseData.isVendor && !expenseData.expenseGiverName) return "Please enter payee name";
  if (!expenseData.amount) return "Please enter amount";
  return null;
}

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
