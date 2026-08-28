import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// Money received from a party (vendor/employee/patient/other) that must be repaid — a deposit,
// a loan, an advance. Two things happen when it arrives: cash goes up in one of our accounts,
// and a liability (the linked Payable) is created for what we owe back. Repaying it later moves
// cash back down and pays that same liability off.
//
// P&L IMPACT: none. Receiving borrowed money is not income; repaying it is not an expense. This
// collection is absent from every revenue/expense total by construction — only interest on the
// borrowing, if any, is a real expense, and that already has a home (INTEREST_EXPENSES). See the
// identical reasoning in src/models/SuspenseEntry.js and src/models/AccountTransfer.js for why
// this lives in its own collection rather than a new transactionCategory/costType: existing
// report and revenue queries filter those fields inconsistently, and a new enum value would leak
// into whichever query doesn't filter it, inflating a total somewhere subtle. A separate
// collection cannot contaminate a query that never names it. The cost is one $unionWith in the
// balance aggregation (accountBalances.js) and one extra $lookup in the payable aggregation
// (payableAggregation.js), both explicit.
//
// WHY NOT SuspenseEntry: SuspenseEntry is for money whose SOURCE is unknown and is expected to be
// resolved into a real transaction later. A borrowing is fully explained on day one (who, how
// much, repayable) and may sit on the books for a year — parking it in suspense would leave a
// permanent unresolved entry in the one report whose whole purpose is to be driven to zero.
//
// EVERY row — the original IN and every later repayment OUT — points at the SAME Payable via
// payableId, so paid/pending on that Payable is always computed live from these rows (see
// buildPayableAggregationStages' borrowing $lookup), never stored as a running balance here.

const receiptSchema = new mongoose.Schema(
  { url: String, publicId: String, fileName: String, fileType: String },
  { _id: false },
);

const PARTY_KINDS = ["VENDOR", "EMPLOYEE", "PATIENT", "OTHER"];

const borrowingSchema = new mongoose.Schema(
  {
    // IN  = money received from the party — the liability increases (and, for the first IN on a
    //       new loan, is what creates the Payable in the first place).
    // OUT = repayment made to the party — the liability decreases.
    direction: { type: String, enum: ["IN", "OUT"], required: true, index: true },

    // Which of our accounts the money landed in (IN) / left from (OUT). Required for the same
    // reason SuspenseEntry requires it — an unattributed row is invisible in the close book.
    account: { type: String, enum: ACCOUNTS, required: true, index: true },

    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true },

    party: {
      kind: { type: String, enum: PARTY_KINDS, required: true },
      // Vendor/Employee/Patient _id; null for OTHER.
      refId: { type: mongoose.Schema.Types.ObjectId, default: null },
      // Always set, for display without populate.
      label: { type: String, required: true },
    },

    // The Payable representing what is still owed on this loan. Every row (IN and OUT) against
    // one loan points at the SAME Payable — never store a running balance on this document.
    payableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payable",
      required: true,
      index: true,
    },

    // §4.2 — an existing, UNRELATED Receivable this borrowing offsets (e.g. money borrowed FROM a
    // party who also owes us something else, netted against what they owe) — distinct from
    // `payableId` above, which is the Payable THIS borrowing itself created. Only ever set on the
    // creating ("IN") row of a running loan — see the settle/unsettle actions in
    // src/app/api/borrowings/[id]/route.js. Never mutates the target Receivable's totalAmount;
    // only its live received/pending aggregation (src/lib/receivableAggregation.js) changes.
    settlesReceivableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receivable",
      default: null,
      index: true,
    },

    // Optional, same rule as AccountTransfer/SuspenseEntry: null means company-level, and a
    // branch-filtered view shows only rows tagged to that branch.
    branch: { type: String, enum: ALL_BRANCHES, default: null, index: true },

    reference: String,
    remarks: String,
    receipts: [receiptSchema],

    // Soft-close — never hard-deleted. A cancelled row stops counting toward both the account
    // balance and the linked Payable's paid/pending.
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

// Reject rather than silently correct — same throw-based style as SuspenseEntry/AccountTransfer.
// Mongoose 9 no longer passes a `next` callback to document middleware.
borrowingSchema.pre("validate", function () {
  if (!(this.amount > 0)) {
    throw new Error("Borrowing amount must be greater than zero.");
  }
});

// The balance aggregation filters open (non-cancelled) rows for an account over a date range;
// the payable aggregation filters open OUT rows for one payableId. isCancelled leads both
// compounds because it excludes a row from every query, making it the most selective first key.
borrowingSchema.index({ isCancelled: 1, account: 1, date: 1 });
borrowingSchema.index({ isCancelled: 1, payableId: 1, direction: 1 });

export const BORROWING_PARTY_KINDS = PARTY_KINDS;

export default mongoose.models.Borrowing || mongoose.model("Borrowing", borrowingSchema);
