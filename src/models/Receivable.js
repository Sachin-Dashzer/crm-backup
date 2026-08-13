import mongoose from "mongoose";
import { ALL_BRANCHES } from "@/lib/branches";

// Mirror image of Payable — records what is OWED TO US. Actual receipts are ordinary
// REVENUE Transactions (Transplant/Service/Medicine) tagged with receivableId — received/pending
// is always computed by aggregating those transactions, never stored here. See
// src/lib/receivableAggregation.js. Do NOT add amountReceived/balance/status fields to this
// model — that reintroduces the double-storage drift Payable specifically avoids.

const RECEIVABLE_KINDS = ["PATIENT", "COLLAB_CLINIC", "VENDOR", "EMPLOYEE", "OTHER"];

const RECEIVABLE_PURPOSES = [
  "PATIENT_DUE",
  "COLLAB_SETTLEMENT",
  "REFUND_DUE",
  "ADVANCE_RECOVERY",
  "OTHER",
];

const receivableSchema = new mongoose.Schema(
  {
    payer: {
      kind: { type: String, enum: RECEIVABLE_KINDS, required: true },
      // Patient/Employee/Vendor _id; null for COLLAB_CLINIC / OTHER
      refId: { type: mongoose.Schema.Types.ObjectId },
      // Always set, for display without populate
      label: { type: String, required: true },
    },
    purpose: { type: String, enum: RECEIVABLE_PURPOSES, required: true },

    // "Transplant" / "Services" / "Medicine" where applicable — mirrors the revenue taxonomy.
    revenueCategory: String,

    period: {
      month: Number, // 1-12
      year: Number,
    },
    relatedPatient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },

    totalAmount: { type: Number, required: true, min: 0 },
    dueDate: Date,
    branch: { type: String, enum: ALL_BRANCHES },
    remarks: String,
    // Soft-close — a receivable no longer expected is cancelled, never hard-deleted.
    isCancelled: { type: Boolean, default: false },

    // Pure concurrency fence — NOT a cached balance, never read for its value. received/pending
    // stay fully computed-on-read (see the file header); this field's only job is to give two
    // concurrent allocations against this receivable a document to genuinely conflict over.
    // src/lib/receivableAllocation.js increments it (inside the same session as the Transaction
    // write) every time it allocates against this receivable, so a concurrent second allocation
    // reading the same stale "pending" snapshot hits a real MongoDB write conflict and retries
    // (session.withTransaction retries TransientTransactionError automatically) instead of both
    // succeeding against headroom that only existed once.
    allocationFence: { type: Number, default: 0 },

    // Append-only audit trail of the RECEIVABLE itself (creation, amount revision,
    // cancellation). NOT a receipt log — receipts live in Transactions, linked via receivableId.
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
  },
  { timestamps: true },
);

receivableSchema.index({ "payer.kind": 1, "payer.refId": 1 });
receivableSchema.index({ purpose: 1, "period.year": 1, "period.month": 1 });
receivableSchema.index({ branch: 1, isCancelled: 1 });
receivableSchema.index({ dueDate: 1 });

export const RECEIVABLE_KIND_VALUES = RECEIVABLE_KINDS;
export const RECEIVABLE_PURPOSE_VALUES = RECEIVABLE_PURPOSES;

export default mongoose.models.Receivable || mongoose.model("Receivable", receivableSchema);
