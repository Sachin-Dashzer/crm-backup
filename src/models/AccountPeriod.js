import mongoose from "mongoose";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";

// A STORED SNAPSHOT of one account's figures for one period.
//
// Why stored rather than always recomputed: once a month is closed its numbers must not
// shift because someone edited an old transaction. That is the entire point of closing
// books. Recomputing on every read would let a back-dated edit silently rewrite a period
// that has already been reported on.
//
// Two kinds of row live here:
//   1. SEED rows — the manually-entered opening balance for an account as of a start date
//      (totalIn/totalOut 0, openingBalance === closingBalance, isClosed true). These exist
//      because no historical transaction carries furtherMode, so per-account history before
//      this feature cannot be derived and is entered by hand instead.
//   2. CLOSED period rows — written by the close action in a later step.
//
// Both are read the same way: an account's opening balance for a period is the closing
// balance of the most recent closed row ending on or before that period's start.
//
// NOTE: this step is read-only with respect to closing. Nothing here sets isClosed on a
// real period yet — that, and edit-blocking, belong to the close step.

const accountPeriodSchema = new mongoose.Schema(
  {
    account: {
      type: String,
      enum: ACCOUNTS,
      required: true,
      index: true,
    },

    // NULL = a company-level row: the whole business's position in this account. This is what
    // every close and every unfiltered close-book view reads, and what all pre-branch rows are.
    //
    // A branch name = a branch-scoped OPENING SEED, read only by the branch-filtered ledger and
    // balance sheet. These are deliberately additive: they sit alongside the company row rather
    // than replacing it, so adding one cannot change a figure the books already report.
    //
    // The two are NOT forced to reconcile, and they genuinely cannot always: contra entries
    // carry no branch (see AccountTransfer), so an internal transfer moves the company position
    // without moving any branch's. Treat a mismatch as information, not corruption — the
    // opening-balances screen surfaces the difference rather than trying to resolve it.
    //
    // Closing a period never writes branch rows. Every query that drives a close, a reopen, a
    // recompute or the edit-lock filters `branch: null` explicitly, so branch seeds can never
    // be mistaken for a period to close or a lock to enforce.
    branch: {
      type: String,
      enum: ALL_BRANCHES,
      default: null,
      index: true,
    },

    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    openingBalance: { type: Number, required: true },
    totalIn: { type: Number, required: true },
    totalOut: { type: Number, required: true },
    closingBalance: { type: Number, required: true },
    transactionCount: { type: Number, default: 0 },
    // Internal transfers folded into totalIn/totalOut above, counted separately so a snapshot
    // shows how much of its movement was contra rather than trading activity. Defaults to 0 on
    // every snapshot written before contra was included in the figures.
    contraCount: { type: Number, default: 0 },

    isClosed: { type: Boolean, default: false },
    closedBy: { name: String, email: String },
    closedAt: Date,
    notes: String,

    // Append-only audit trail. Reopening requires a reason and it is recorded here, along
    // with every recompute the reopen cascaded into later periods — a period's figures must
    // never change without a record of who changed them and why.
    log: [
      {
        action: {
          type: String,
          enum: ["Closed", "Reopened", "Recomputed", "Seeded"],
        },
        reason: String,
        previousClosingBalance: Number,
        newClosingBalance: Number,
        performedBy: { name: String, email: String },
        performedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// A manually-entered opening balance is stored as a ZERO-LENGTH period (periodStart ===
// periodEnd). A real trading period always spans time, so this cleanly distinguishes the
// two without another field: a seed states an opening position, it does not close a period,
// and it therefore must never lock transactions.
export function isOpeningSeed(period) {
  return (
    !!period &&
    new Date(period.periodStart).getTime() === new Date(period.periodEnd).getTime()
  );
}

// One snapshot per account per branch per exact period — guards against a period being closed
// twice, while still allowing a company row (branch null) and a branch seed to coexist on the
// same account and date. A missing `branch` indexes as null, so pre-branch rows slot in as the
// company row without a migration.
//
// NOTE: this replaced a 3-key unique index on {account, periodStart, periodEnd}. That old index
// must be DROPPED — left in place it rejects a branch seed as a duplicate of the company row,
// which is exactly the pair this feature needs to allow. See scripts/sync-account-period-indexes.mjs.
accountPeriodSchema.index({ account: 1, branch: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

// Serves the opening-balance lookup: newest closed row for an account (and branch) ending at or
// before a given date.
accountPeriodSchema.index({ account: 1, branch: 1, isClosed: 1, periodEnd: -1 });

export default mongoose.models.AccountPeriod ||
  mongoose.model("AccountPeriod", accountPeriodSchema);
