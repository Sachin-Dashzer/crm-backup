import { computeTaxBreakdown, toTaxDetails } from "@/lib/taxMath";

// §2.2 Phase 1 extraction — buildExpensePayload(), pulled verbatim (behavior unchanged) out of
// src/app/admin/transactions/create/page.jsx. Named for the file the spec's target structure
// asks for (src/lib/entryForm/buildTransactionPayload.js) since UnifiedEntryForm will eventually
// need a payload builder per entry kind; today only the Expense kind has one worth extracting —
// Revenue/Contra/Suspense/Borrowing/Advance still build their fetch bodies inline in the page and
// get their own builder in a later phase, not invented here.
//
// Was a closure over component state (expenseData, payableAction, selectedPayableId,
// allowOverpayment, employees/employeeCache, patients/patientCache, patientOptions/
// employeeOptions, vendors) — now takes them explicitly. Which of {employees, employeeCache} vs.
// {patientOptions, employeeOptions} a given branch reads is preserved exactly as it was in the
// original (the "commission" branch's receiver-name lookup used the memoized *Options lists, the
// "agent" and "patient>expense/refund" branches used the raw cache+list pair) — not unified here,
// since Phase 1 is extraction only, never a behavior change.
export function buildExpensePayload({
  expenseData,
  payableAction,
  selectedPayableId,
  allowOverpayment,
  employees,
  employeeCache,
  patients,
  patientCache,
  patientOptions,
  employeeOptions,
  vendors,
}) {
  const common = {
    method: expenseData.method,
    paymentId: expenseData.paymentId,
    branch: expenseData.branch,
    date: expenseData.date,
    remarks: expenseData.remarks,
    receipts: expenseData.receipts,
    furtherMode: expenseData.furtherMode,
    externalParty: expenseData.method === "paid_by_other" ? expenseData.externalParty : undefined,
    ...(payableAction === "pay" ? { payableId: selectedPayableId, allowOverpayment } : {}),
  };

  if (expenseData.expenseSection === "agent") {
    const isSalary = expenseData.agentSubTab === "salary";
    const emp = employeeCache[expenseData.employeeId] || employees.find((e) => e._id === expenseData.employeeId);
    return {
      ...common,
      expenseCategory: isSalary ? "Salary" : "Incentive",
      expenseType: isSalary ? "Salary" : expenseData.expenseType,
      patientId: !isSalary ? expenseData.patientId : undefined,
      expenseGiver: {
        type: "EMPLOYEE",
        refId: expenseData.employeeId,
        name: emp?.name || "",
      },
      amount: expenseData.amount,
    };
  }

  if (expenseData.expenseSection === "patient") {
    if (expenseData.patientSubTab === "commission") {
      const receiverName =
        expenseData.receiverType === "MANUAL"
          ? expenseData.receiverName
          : expenseData.receiverType === "Patient"
            ? patientOptions.find((p) => p._id === expenseData.receiverId)?.personal?.name || ""
            : employeeOptions.find((e) => e._id === expenseData.receiverId)?.name || "";
      const giverType =
        expenseData.receiverType === "MANUAL"
          ? "MANUAL"
          : expenseData.receiverType === "Patient"
            ? "PATIENT"
            : "EMPLOYEE";

      return {
        ...common,
        expenseCategory: "Commision",
        expenseType: expenseData.expenseType,
        patientId: expenseData.patientId,
        amount: expenseData.amount,
        expenseGiver: {
          type: giverType,
          refId: expenseData.receiverType === "MANUAL" ? undefined : expenseData.receiverId,
          name: receiverName,
        },
        commissionReceiver: {
          type: giverType,
          refId: expenseData.receiverType === "MANUAL" ? undefined : expenseData.receiverId,
          name: receiverName,
        },
      };
    }

    const pat = patientCache[expenseData.patientId] || patients.find((p) => p._id === expenseData.patientId);
    const patientGiver = {
      type: "PATIENT",
      refId: expenseData.patientId,
      name: pat?.personal?.name || "",
    };

    if (expenseData.patientSubTab === "refund") {
      return {
        ...common,
        expenseCategory: "Patient Related Expenses",
        expenseType: "Patient Refunds",
        patientId: expenseData.patientId,
        amount: expenseData.amount,
        expenseGiver: patientGiver,
      };
    }
    return {
      ...common,
      expenseCategory: "Patient Related Expenses",
      expenseType: expenseData.expenseType,
      patientId: expenseData.patientId,
      amount: expenseData.amount,
      expenseGiver: patientGiver,
    };
  }

  if (expenseData.expenseSection === "rent") {
    return {
      ...common,
      expenseCategory: expenseData.payableCategory,
      expenseType: expenseData.rentSubType,
      amount: expenseData.amount,
    };
  }

  // "other" — Direct Payments. With GST ticked the Amount field is the BASE amount, so
  // the transaction records the invoice total and keeps the breakdown in taxDetails.
  // GST never becomes a payable and never gets its own transaction.
  const vendor = vendors.find((v) => v._id === expenseData.vendorId);
  const directTax = computeTaxBreakdown({
    baseAmount: expenseData.amount,
    includeGST: expenseData.includeGST,
    gstRate: expenseData.gstRate,
    gstAmount: expenseData.gstAmount,
  });
  return {
    ...common,
    expenseCategory: expenseData.expenseCategory,
    expenseType: expenseData.expenseType,
    expenseGiver: {
      type: expenseData.isVendor ? "VENDOR" : "MANUAL",
      vendorId: expenseData.isVendor ? expenseData.vendorId : "",
      name: expenseData.isVendor ? vendor?.name : expenseData.expenseGiverName,
    },
    amount: expenseData.includeGST ? directTax.invoiceTotal : expenseData.amount,
    ...(expenseData.includeGST ? { taxDetails: toTaxDetails(directTax) } : {}),
  };
}
