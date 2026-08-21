import mongoose from "mongoose";
import { COLLAB_BRANCHES } from "@/lib/branches";

// One document per collab (partner clinic) patient case. Tracks money the
// PATIENT paid directly to the partner clinic — money paid to us stays in
// the existing transplant/service Transaction flow and on Patient.payments,
// completely untouched by this model.
//
// Derived numbers (collectedByUs, collectedByClinic, patientOutstanding,
// caseNet) are NEVER stored here — always computed at query time in the API
// layer from clinicCollections[] and a read-only lookup into Transactions.

const COLLECTION_MODES = ["upi", "cash", "card", "banking", "other"];

const collabCaseSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    // Main branches (Delhi/Mumbai/Hyderabad/Noida) can never be persisted
    // here — enforced at the schema level, re-checked at the API level.
    clinic: {
      type: String,
      enum: COLLAB_BRANCHES,
      required: true,
      index: true,
    },

    packageAmount: { type: Number, required: true, min: 0 },
    // Usually fixed at 20,000 but editable per case.
    clinicShare: { type: Number, required: true, min: 0, default: 20000 },

    // Same enum as Transactions.procedure — lets a settlement generate a
    // correctly-categorized revenue Transaction (transactionCategory is
    // derived from this the same way the transplant/service routes do it).
    procedure: {
      type: String,
      required: true,
      enum: [
        "Sapphire FUE",
        "DHI",
        "Turkish DHI",
        "Beard Transplant",
        "PRP",
        "Alopecia",
        "Headwash",
        "Canacot",
        "GFC",
        "Medicine",
        "Other",
      ],
    },

    // Append-only. Money the PATIENT paid DIRECTLY TO THE PARTNER CLINIC.
    clinicCollections: [
      {
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, default: Date.now },
        mode: { type: String, enum: COLLECTION_MODES },
        reference: String,
        note: String,
        recordedBy: { name: String, email: String },
        recordedAt: { type: Date, default: Date.now },
      },
    ],

    // The Payable tracking the clinic's ₹{clinicShare} owed-to-them expense.
    // Created alongside the case; paid/pending on it is computed from
    // Transactions the normal Payable way — never duplicated here.
    clinicSharePayable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payable",
      default: null,
    },
    // Mirror of clinicSharePayable for the opposite imbalance — set when the clinic collected
    // MORE than its share (deriveClinicSettlement's RECEIVABLE branch), so a later
    // CollabSettlement (THEY_PAID) can find and settle the specific Receivable this case
    // created instead of guessing or re-recognising revenue that step 2 of
    // createCollabCaseAtomic already booked in full.
    clinicShareReceivable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receivable",
      default: null,
    },

    status: {
      type: String,
      enum: ["OPEN", "SETTLED", "CANCELLED"],
      default: "OPEN",
    },
    remarks: String,

    // Append-only audit trail of the CASE itself — not a payment log.
    log: [
      {
        action: {
          type: String,
          enum: [
            "Created",
            "Package Revised",
            "Share Revised",
            "Collection Added",
            "Cancelled",
            "Note Added",
          ],
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

collabCaseSchema.index({ clinic: 1, status: 1 });
collabCaseSchema.index({ patient: 1 });

export default mongoose.models.CollabCase ||
  mongoose.model("CollabCase", collabCaseSchema);
