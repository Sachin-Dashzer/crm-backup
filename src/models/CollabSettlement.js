import mongoose from "mongoose";
import { COLLAB_BRANCHES } from "@/lib/branches";

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

    coveredCases: [
      {
        case: { type: mongoose.Schema.Types.ObjectId, ref: "CollabCase" },
        amount: { type: Number, min: 0 },
      },
    ],

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

export function settlementSignedAmount(settlement) {
  return settlement.direction === "THEY_PAID" ? settlement.amount : -settlement.amount;
}

collabSettlementSchema.index({ clinic: 1, date: -1 });

export default mongoose.models.CollabSettlement ||
  mongoose.model("CollabSettlement", collabSettlementSchema);
