import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// Contra entries — money moved between our OWN accounts (Tally's term; see the section
// subtitle "Transfer between your own accounts").
//
// WHY A SEPARATE COLLECTION, not a new costType/transactionCategory on Transactions:
// existing report and revenue queries filter costType/transactionCategory inconsistently —
// some match positively ("Revenue"), some don't filter at all. A new enum value on the shared
// collection would leak into whichever of those don't filter, inflating a revenue or expense
// figure somewhere subtle. A separate collection cannot contaminate a query that never names
// it. The cost is one $unionWith in the balance aggregation, which is explicit and cheap.
//
// A contra entry has NO profit-and-loss impact. It is not revenue, not an expense; it only
// moves the cash book. The balance aggregation adds it to `toAccount` and subtracts it from
// `fromAccount`, so the sum across all accounts is unchanged by definition.

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

    // Which branch the transfer belongs to. OPTIONAL, and null means "company-level" — a move
    // between head-office accounts that no single branch owns.
    //
    // This is a branch from ALL_BRANCHES, not an account. "Cash ( backend )" is an ACCOUNT and
    // would be rejected here; the branch for a transfer into it is "Delhi".
    //
    // A branch-filtered close-book view shows transfers tagged with that branch and hides the
    // untagged ones, because company-level money cannot honestly be attributed to one branch.
    // So a branch view reconciles for the transfers it can see; the untagged ones only ever
    // appear in the unfiltered view. Tag a transfer to make it visible branch-side.
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
