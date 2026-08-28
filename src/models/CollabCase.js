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

// Mirrors the app-wide revenue method set (src/constants/paymentMethods.js REVENUE_METHODS)
// plus "other", so a clinic collection can record the same payment types every real revenue
// transaction can — including the two loan financiers, which the original 5-value list omitted.
const COLLECTION_MODES = ["upi", "cash", "card", "banking", "bajaj_loan", "fibe_loan", "other"];

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

    // Append-only log of every collection recorded after case creation — a useful per-case
    // audit trail, but NOT the source of truth for money movement any more (see
    // src/lib/collabDerivation.js): each entry here now has a real Transaction behind it,
    // found live via that transaction's collabRef.caseId, so financial totals are always
    // aggregated from Transactions and never from this array.
    clinicCollections: [
      {
        amount: { type: Number, required: true, min: 0 },
        // A waiver granted at the time of this collection — reduces the patient's outstanding
        // the same as a payment would, but is never money collected, so it stays out of `amount`.
        // Also recorded on the generated Transaction's own `discount` field, which is what
        // financial aggregations actually read — this copy is descriptive/audit only.
        discount: { type: Number, default: 0, min: 0 },
        // Who physically took this money — the same distinction createCollabCaseAtomic makes
        // for the amounts collected at case-creation time. Defaults to "CLINIC" because every
        // entry recorded before this field existed was, by definition, a clinic collection —
        // this route had no other kind until now.
        collectedBy: { type: String, enum: ["US", "CLINIC"], default: "CLINIC" },
        date: { type: Date, default: Date.now },
        mode: { type: String, enum: COLLECTION_MODES },
        // Transaction ID / reference for the payment itself.
        reference: String,
        // Same "how was this paid, and through which account" pair every real revenue
        // transaction records (see BankRoutingFields) — descriptive here; the real values live
        // on the Transaction this collection generates (see collabDerivation.js).
        receiptMode: String,
        furtherMode: String,
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

    // When the case's running total first reached its package amount and the clinic's fixed fee
    // was crystallised (see collabDerivation.js's crystalliseClinicShare) — null while the case is
    // still partially collected. The single idempotency gate: crystallisation must fire exactly
    // once per case, and this is what it checks. Cleared back to null if a later reversal drops
    // the case back under its package total (unwindClinicShareCrystallisation) or the case is
    // cancelled.
    clinicShareSettledAt: { type: Date, default: null },

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
            "Clinic Share Crystallised",
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
