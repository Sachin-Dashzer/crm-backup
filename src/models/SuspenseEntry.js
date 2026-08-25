import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// Suspense entries — money that HAS moved through one of our bank accounts but whose source
// (or destination) is unknown, so it cannot yet be recorded as a real sale or cost.
//
// The bank statement is the fact. The CRM disagreeing with the bank is the problem this solves:
// without somewhere to put an unexplained credit, the only options are inventing a transaction
// (which pollutes revenue with a guess) or ignoring it (which leaves the books permanently out
// of step with the bank). A suspense entry says "this much arrived, we don't know why, yet".
//
// WHY A SEPARATE COLLECTION, not a transactionCategory on Transactions:
// exactly the reasoning in src/models/AccountTransfer.js. Existing report and revenue queries
// filter costType/transactionCategory inconsistently — some match positively, some don't filter
// at all. A new enum value on the shared collection would leak into whichever don't, inflating
// a revenue figure somewhere subtle. A separate collection cannot contaminate a query that
// never names it. The cost is one $unionWith in the balance aggregation, which is explicit.
//
// P&L IMPACT: none. A suspense entry moves an account balance so the CRM reconciles with the
// bank, and is deliberately absent from every sales/revenue and expense total. It is not income
// until someone works out what it was.
//
// RESOLUTION: when the source is identified, the real transaction is created normally and this
// entry is marked resolved and linked to it. A RESOLVED ENTRY STOPS COUNTING toward the account
// balance — the real transaction now carries that money, and counting both would double it.
// The row is kept, never deleted, so the period where the books didn't match the bank stays
// auditable.

const receiptSchema = new mongoose.Schema(
  { url: String, publicId: String, fileName: String, fileType: String },
  { _id: false },
);

const suspenseEntrySchema = new mongoose.Schema(
  {
    // Which of our accounts the money actually landed in / left from. This is what ties the
    // entry to the close book, so it is required — an unattributed suspense entry would be
    // invisible in exactly the view it exists to correct.
    account: { type: String, enum: ACCOUNTS, required: true, index: true },

    // IN  = unexplained credit (money arrived), the common case
    // OUT = unexplained debit (money left) — just as real, and the balance maths needs it
    direction: { type: String, enum: ["IN", "OUT"], default: "IN", required: true },

    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true },

    // Optional, same rule as AccountTransfer: null means company-level, and a branch-filtered
    // view shows only entries tagged to that branch.
    branch: { type: String, enum: ALL_BRANCHES, default: null, index: true },

    // Whatever the bank statement calls it — UTR, cheque no., narration. The one thing that
    // usually lets someone identify it later, so it is worth capturing even though optional.
    reference: String,
    remarks: String,
    receipts: [receiptSchema],

    isResolved: { type: Boolean, default: false, index: true },
    resolvedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transactions",
      default: null,
    },
    resolvedAt: Date,
    resolvedBy: { name: String, email: String },

    // Soft-close for an entry raised in error (a duplicate, or a bank line that turned out to
    // already be recorded). Cancelled entries stop counting toward balances, like resolved ones,
    // but are distinguishable from them in the audit trail.
    isCancelled: { type: Boolean, default: false },

    log: [
      {
        action: {
          type: String,
          enum: ["Created", "Amount Revised", "Resolved", "Reopened", "Cancelled", "Note Added"],
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

// Reject rather than silently correct — both of these are data-entry errors the user needs to
// see. Throws rather than taking a `next` callback: Mongoose 9 no longer passes one to document
// middleware, and a next-style hook dies with "next is not a function" on every save. Same
// throw-based style as AccountTransfer and the collabSplit hooks.
suspenseEntrySchema.pre("validate", function () {
  if (!(this.amount > 0)) {
    throw new Error("Suspense amount must be greater than zero.");
  }
  if (this.isResolved && !this.resolvedTransactionId) {
    throw new Error(
      "A resolved suspense entry must link the transaction that explains it — otherwise the money leaves the balance with nothing taking its place.",
    );
  }
});

// The balance aggregation filters open entries for an account over a date range. isResolved and
// isCancelled lead because both exclude a row from every balance query, making them the most
// selective keys.
suspenseEntrySchema.index({ isResolved: 1, isCancelled: 1, account: 1, date: 1 });
suspenseEntrySchema.index({ isResolved: 1, date: -1 });

export default mongoose.models.SuspenseEntry ||
  mongoose.model("SuspenseEntry", suspenseEntrySchema);
