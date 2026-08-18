import mongoose from "mongoose";
import { ALL_BRANCHES } from "@/lib/branches";

// Records what is OWED. Actual payments are ordinary EXPENSE Transactions
// tagged with payableId — paid/pending is always computed by aggregating
// those transactions, never stored here. See src/app/api/payables/list and
// /summary for the aggregation. Do NOT add amountPaid/balanceAmount/payments[]
// fields to this model — that reintroduces the double-storage drift this
// design specifically avoids.

const PAYABLE_KINDS = [
  "EMPLOYEE",
  "RENT_UNIT",
  "UTILITY_UNIT",
  "COLLAB_CLINIC",
  "PATIENT",
  "VENDOR",
  "OTHER",
];

const PAYABLE_PURPOSES = [
  "SALARY",
  "INCENTIVE",
  "RENT",
  "ELECTRICITY",
  "COLLAB_CLINIC",
  "PATIENT_COMMISSION",
  "TAX",
  // Added for the Payable Expenses tab's expansion to the full payable category set.
  "MEDICAL_CONSUMABLES",
  "MEDICINE_PROCUREMENT",
  "PROFESSIONAL_EXPENSES",
  "LAB_EXPENSES",
  "INTEREST_EXPENSES",
  "SOFTWARE_RENTAL",
  "HARDWARE_RENTAL",
  // Catch-all for payables with no dedicated purpose above — mirrors Receivable's
  // existing "OTHER". First consumer: a "paid_by_other" expense transaction, where
  // someone else covered our cost and we owe them back. See
  // src/lib/externalPartyDerivation.js.
  "OTHER",
];

// Purposes that recur monthly — guarded against accidental duplicate entry
// for the same month via the partial unique index below. INCENTIVE and
// PATIENT_COMMISSION are deliberately excluded: several per patient per
// month is the normal case, not a duplicate.
const MONTHLY_PURPOSES = ["SALARY", "RENT", "ELECTRICITY", "COLLAB_CLINIC", "TAX"];

const payableSchema = new mongoose.Schema(
  {
    payee: {
      kind: { type: String, enum: PAYABLE_KINDS, required: true },
      // Employee/Patient/Vendor _id; null for RENT_UNIT / UTILITY_UNIT / COLLAB_CLINIC
      refId: { type: mongoose.Schema.Types.ObjectId },
      // Always set, for display without populate (employee name, "Rent-CD Clinic", "Patna", etc.)
      label: { type: String, required: true },
    },
    purpose: { type: String, enum: PAYABLE_PURPOSES, required: true },

    // Mirrors of the existing expense taxonomy, so Payables and Transactions
    // report side by side. Validated against EXPENSE_CATEGORY_TREE at the API layer.
    expenseCategory: String,
    expenseSubType: String,

    // Set for SALARY/RENT/ELECTRICITY/COLLAB_CLINIC/TAX; omitted for INCENTIVE/PATIENT_COMMISSION
    period: {
      month: Number, // 1-12
      year: Number,
    },
    // Required for INCENTIVE and PATIENT_COMMISSION
    relatedPatient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },

    totalAmount: { type: Number, required: true, min: 0 },
    dueDate: Date,
    branch: { type: String, enum: ALL_BRANCHES },
    remarks: String,
    // Soft-close — a payable that's no longer owed is cancelled, never hard-deleted.
    isCancelled: { type: Boolean, default: false },

    // Whether the COST this document represents has ALREADY been recognised by an earlier
    // transaction. It drives isSettlement on the eventual payment:
    //   true  -> auto-created from a paid_by_other transaction that booked the full amount up
    //            front. Its payment moves cash only, so it must be excluded from P&L totals or
    //            the amount counts twice.
    //   false -> raised manually (rent, salary, tax). Nothing has been expensed yet, so its
    //            payment IS the expense and must count normally.
    // Stored rather than inferred: a future flow that creates payables some third way has to
    // make this decision explicitly instead of silently inheriting whichever guess the code made.
    costAlreadyRecognised: { type: Boolean, default: false, index: true },

    // Append-only audit trail of the PAYABLE itself (creation, amount
    // revision, cancellation). NOT a payment log — payments live in
    // Transactions, linked via payableId.
    log: [
      {
        action: {
          type: String,
          enum: ["Created", "Amount Revised", "Due Date Changed", "Cancelled", "Note Added"],
        },
        previousValue: String,
        newValue: String,
        note: String,
        performedBy: { name: String, email: String },
        performedAt: { type: Date, default: Date.now },
      },
    ],

    createdBy: {
      name: String,
      email: String,
      branch: String,
      date: { type: Date, default: Date.now },
    },

    // Set only when this payable was split off an "Include TDS" save (§4.4) — a vendor payable
    // (net of TDS) plus a linked TDS payable created atomically together. null for every
    // standalone payable. grossAmount/tdsRate/tdsAmount are set on the PARENT only.
    tdsLink: {
      role: { type: String, enum: ["PARENT", "TDS"], default: null },
      linkedId: { type: mongoose.Schema.Types.ObjectId, ref: "Payable", default: null },
      grossAmount: Number,
      tdsRate: Number,
      tdsAmount: Number,
    },
  },
  { timestamps: true },
);

payableSchema.index({ "payee.kind": 1, "payee.refId": 1 });
payableSchema.index({ purpose: 1, "period.year": 1, "period.month": 1 });
payableSchema.index({ branch: 1, isCancelled: 1 });
payableSchema.index({ dueDate: 1 });

// Guards against the same monthly payable being entered twice (e.g. March
// salary for the same employee logged twice by accident).
payableSchema.index(
  {
    "payee.kind": 1,
    "payee.refId": 1,
    "payee.label": 1,
    purpose: 1,
    "period.month": 1,
    "period.year": 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      "period.year": { $exists: true },
      purpose: { $in: MONTHLY_PURPOSES },
    },
  },
);

export const PAYABLE_KIND_VALUES = PAYABLE_KINDS;
export const PAYABLE_PURPOSE_VALUES = PAYABLE_PURPOSES;
export const MONTHLY_PAYABLE_PURPOSES = MONTHLY_PURPOSES;

export default mongoose.models.Payable || mongoose.model("Payable", payableSchema);
