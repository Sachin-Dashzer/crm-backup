import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

const receiptSchema = new mongoose.Schema(
  {
    url: String,
    publicId: String,
    fileName: String,
    fileType: String,
  },
  { _id: false },
);

const accountTransferSchema = new mongoose.Schema(
  {
    fromAccount: { type: String, enum: ACCOUNTS, required: true, index: true },
    toAccount: { type: String, enum: ACCOUNTS, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true },
branch: {
      type: String,
      enum: ALL_BRANCHES,
      default: null,
      index: true,
    },
    reference: String,
    remarks: String,
    receipts: [receiptSchema],

    // Set ONLY when this transfer was created by settling a specific loan-financing transaction
    // (LoanSettlementModal — Bajaj Loan/Fibe Loan -> a real bank account). Lets a later loan
    // cancellation find the exact settlement transfer to reverse, instead of guessing by amount
    // and date. Optional and additive: every transfer created before this field existed, and
    // every ordinary manual transfer, simply has it as null.
    sourceTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transactions",
      default: null,
      index: true,
    },

    // Discriminates WHY a transfer exists, so a lookup by sourceTransactionId is never
    // ambiguous. Before this field, a settlement and the cancellation that later reversed it
    // both carried the SAME sourceTransactionId — an unsorted findOne({sourceTransactionId, ...})
    // could return either one, and a second cancellation attempt could reverse the reversal
    // instead of refusing. Always query by (sourceTransactionId, transferKind) together now, not
    // sourceTransactionId alone. Defaults to MANUAL so every pre-existing transfer (and every
    // ordinary contra entry going forward) is unambiguous without a migration.
    transferKind: {
      type: String,
      enum: ["MANUAL", "LOAN_SETTLEMENT", "LOAN_CANCELLATION"],
      default: "MANUAL",
      index: true,
    },
    // Set ONLY on a LOAN_CANCELLATION transfer — points at the specific LOAN_SETTLEMENT transfer
    // it undoes. Lets "is this settlement already reversed?" be answered by existence of a
    // transfer with THIS reversesTransferId, rather than by sourceTransactionId collision.
    reversesTransferId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountTransfer",
      default: null,
    },
    createdBy: {
      name: String,
      email: String,
      branch: String,
      date: { type: Date, default: Date.now },
    },
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
    isCancelled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Reject rather than silently correct — a transfer to the same account is always a mistake,
// and quietly dropping or rewriting it would hide a data-entry error the user needs to see.
//
// Throws rather than taking a `next` callback: Mongoose 9 no longer passes one to document
// middleware, so a next-style hook receives undefined and dies with "next is not a function"
// on EVERY save — which silently made contra entries impossible to create at all. Same
// throw-based style as the collabSplit hooks in Transactions.js.
accountTransferSchema.pre("validate", function () {
  if (this.fromAccount && this.toAccount && this.fromAccount === this.toAccount) {
    throw new Error("A contra entry must move money between two different accounts.");
  }
  if (!(this.amount > 0)) {
    throw new Error("Contra entry amount must be greater than zero.");
  }
});

// The balance aggregation filters one side at a time over a date range, then sums. These two
// compounds cover both directions; isCancelled leads because cancelled rows are excluded from
// every balance query, so it is the most selective first key.
accountTransferSchema.index({ isCancelled: 1, fromAccount: 1, date: 1 });
accountTransferSchema.index({ isCancelled: 1, toAccount: 1, date: 1 });

export default mongoose.models.AccountTransfer ||
  mongoose.model("AccountTransfer", accountTransferSchema);
