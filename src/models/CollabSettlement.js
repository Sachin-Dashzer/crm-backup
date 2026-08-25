import mongoose from "mongoose";
import { COLLAB_BRANCHES } from "@/lib/branches";

// One document per actual money movement between us and a partner clinic.
// Settlements are clinic-level and periodic, not per-case — coveredCases is
// optional/informational; the running net balance is always computed from
// clinic-level totals (CollabCase.clinicCollections/clinicShare + signed
// settlements), never by matching case-by-case.

const SETTLEMENT_MODES = ["upi", "cash", "card", "banking", "other"];

const collabSettlementSchema = new mongoose.Schema(
  {
    clinic: {
      type: String,
      enum: COLLAB_BRANCHES,
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ["WE_PAID", "THEY_PAID"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: SETTLEMENT_MODES },
    reference: String,

    // Optional — which cases this settlement was meant to cover, and how
    // much of the settlement amount each case accounts for. Only used to
    // decide which revenue Transaction(s) to generate for THEY_PAID
    // settlements (see the sign-convention helper below) — never used to
    // compute the balance itself.
    coveredCases: [
      {
        case: { type: mongoose.Schema.Types.ObjectId, ref: "CollabCase" },
        amount: { type: Number, min: 0 },
      },
    ],

    // Every transaction this settlement generated — one expense transaction
    // for WE_PAID, or one transplant transaction per covered case for
    // THEY_PAID. Empty if a THEY_PAID settlement had no case allocation (a
    // pure balance-only lump settlement recognises no revenue).
    generatedTransactions: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Transactions" },
    ],

    remarks: String,
    createdBy: {
      name: String,
      email: String,
      branch: String,
      date: { type: Date, default: Date.now },
    },
  },
  { timestamps: true },
);

// Signed contribution to the running balance — the ONE place this sign
// convention is decided. THEY_PAID reduces what they owe us; WE_PAID
// reduces what we owe them. Reuse this everywhere instead of re-deriving it.
export function settlementSignedAmount(settlement) {
  return settlement.direction === "THEY_PAID" ? settlement.amount : -settlement.amount;
}

collabSettlementSchema.index({ clinic: 1, date: -1 });

export default mongoose.models.CollabSettlement ||
  mongoose.model("CollabSettlement", collabSettlementSchema);
