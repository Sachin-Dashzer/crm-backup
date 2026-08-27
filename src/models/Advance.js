import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// Money WE paid out that must come back — an advance salary, an advance rent, a personal advance
// to an employee or vendor. The exact mirror of src/models/Borrowing.js, with the signs and the
// linked document flipped:
//
//   Borrowing  IN  -> cash up,   a Payable    (we owe them)
//   Advance    OUT -> cash down, a Receivable (they owe us)
//
// Two things happen when an advance goes out: cash goes down in one of our accounts, and a
// liability-in-reverse (the linked Receivable) is created for what we are owed back. Recovering
// it later moves cash back up and pays that same Receivable down.
//
// P&L IMPACT: none. Lending money is not an expense and getting it back is not income — only
// interest earned on it, if any, would be, and that is a separate ordinary revenue entry. This
// collection is absent from every revenue/expense total by construction, and the Receivable it
// creates carries excludeFromPnl: true so that close-book/pnl (which otherwise counts EVERY
// receivable raised as income) leaves the principal alone. See that field's comment on
// src/models/Receivable.js — the borrowing side has the identical flag on Payable.
//
// WHY A SEPARATE COLLECTION, not a transactionCategory on Transactions: exactly the reasoning in
// src/models/AccountTransfer.js, SuspenseEntry.js and Borrowing.js. Existing report and revenue
// queries filter costType/transactionCategory inconsistently — some match positively, some don't
// filter at all — so a new enum value on the shared collection would leak into whichever don't,
// inflating a figure somewhere subtle. A separate collection cannot contaminate a query that
// never names it. The cost is one $unionWith in the balance aggregation (accountBalances.js) and
// one extra $lookup in the receivable aggregation (receivableAggregation.js), both explicit.
//
// EVERY row — the original OUT and every later recovery IN — points at the SAME Receivable via
// receivableId, so received/pending on it is always computed live (see
// buildReceivableAggregationStages' advance $lookup), never stored as a running balance here.

const receiptSchema = new mongoose.Schema(
  { url: String, publicId: String, fileName: String, fileType: String },
  { _id: false },
);

const PARTY_KINDS = ["EMPLOYEE", "VENDOR", "PATIENT", "OTHER"];

const advanceSchema = new mongoose.Schema(
  {
    // OUT = money given to the party — the receivable increases (and, for the first OUT on a new
    //       advance, is what creates the Receivable in the first place).
    // IN  = recovery received back from them — the receivable decreases.
    //
    // NOTE the inversion versus Borrowing, where IN is the creating direction. Reading this field
    // as "which way the cash moved" keeps both models consistent: OUT always means our account
    // went down.
    direction: { type: String, enum: ["IN", "OUT"], required: true, index: true },

    // Which of our accounts the money left from (OUT) / landed in (IN). Required for the same
    // reason SuspenseEntry and Borrowing require it — an unattributed row is invisible in the
    // close book.
    account: { type: String, enum: ACCOUNTS, required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true },

    party: {
      kind: { type: String, enum: PARTY_KINDS, required: true },
      // Employee/Vendor/Patient _id; null for OTHER.
      refId: { type: mongoose.Schema.Types.ObjectId, default: null },
      // Always set, for display without populate.
      label: { type: String, required: true },
    },

    // The Receivable representing what is still owed back to us on this advance. Every row (OUT
    // and IN) against one advance points at the SAME Receivable — never store a running balance
    // on this document.
    receivableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receivable",
      required: true,
      index: true,
    },

    // Optional, same rule as AccountTransfer/SuspenseEntry/Borrowing: null means company-level,
    // and a branch-filtered view shows only rows tagged to that branch.
    branch: { type: String, enum: ALL_BRANCHES, default: null, index: true },

    reference: String,
    remarks: String,
    receipts: [receiptSchema],

    // Soft-close — never hard-deleted while active. A cancelled row stops counting toward both
    // the account balance and the linked Receivable's received/pending.
    isCancelled: { type: Boolean, default: false },

    log: [
      {
        action: {
          type: String,
          enum: ["Created", "Amount Revised", "Cancelled", "Note Added"],
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

// Reject rather than silently correct — same throw-based style as Borrowing/SuspenseEntry/
// AccountTransfer. Mongoose 9 no longer passes a `next` callback to document middleware.
advanceSchema.pre("validate", function () {
  if (!(this.amount > 0)) {
    throw new Error("Advance amount must be greater than zero.");
  }
});

// The balance aggregation filters open (non-cancelled) rows for an account over a date range;
// the receivable aggregation filters open IN rows for one receivableId. isCancelled leads both
// compounds because it excludes a row from every query, making it the most selective first key.
advanceSchema.index({ isCancelled: 1, account: 1, date: 1 });
advanceSchema.index({ isCancelled: 1, receivableId: 1, direction: 1 });

export const ADVANCE_PARTY_KINDS = PARTY_KINDS;

export default mongoose.models.Advance || mongoose.model("Advance", advanceSchema);
