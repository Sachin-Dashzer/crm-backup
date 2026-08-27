import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import { ACCOUNTS } from "@/constants/bankRouting";
import {
  buildBalanceMatch,
  buildContraLedgerUnionStage,
  buildSuspenseLedgerUnionStage,
  buildBorrowingLedgerUnionStage,
  buildAdvanceLedgerUnionStage,
  SIGNED_AMOUNT,
  getOpeningBalance,
  round2,
} from "@/lib/accountBalances";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Account ledger: opening balance, every movement in the period in chronological order with
// a RUNNING BALANCE, and the closing balance.
//
// ONE aggregation does all of it. The running balance is computed with $setWindowFields
// BEFORE $skip/$limit, so page 3 shows the true cumulative balance rather than restarting
// from zero — paginating first and summing in JS would have silently produced a wrong
// running column on every page but the first.
//
// Deliberately not modelled on /api/transactions/get-data, which fetches everything and
// reduces in JS.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account") || "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const transactionCategory = searchParams.get("transactionCategory") || "";
    const method = searchParams.get("method") || "";
    const branch = searchParams.get("branch") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    if (!ACCOUNTS.includes(account)) {
      return NextResponse.json(
        { error: `account is required and must be one of: ${ACCOUNTS.join(", ")}` },
        { status: 400 },
      );
    }
    if (!from || !to) {
      return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
    }

    const match = buildBalanceMatch({
      account,
      from,
      to,
      transactionCategory,
      method,
      branch,
    });

    const started = Date.now();

    // Internal transfers are folded in as ordinary ledger rows so a contra entry is visible
    // from BOTH sides: the same 10,000 shows as an outflow in the source account's ledger and
    // an inflow in the destination's. Without this the ledger's closing balance also silently
    // disagreed with the balance sheet's for the same account and period, since that side has
    // always unioned contra in. Null under a branch/category/method filter — see the helper.
    const contraStage = buildContraLedgerUnionStage({
      account,
      from,
      to,
      branch,
      transactionCategory,
      method,
    });

    // Unexplained bank movement, folded in the same way. Only OPEN entries — a resolved one has
    // a real transaction carrying its money, already counted above.
    const suspenseStage = buildSuspenseLedgerUnionStage({
      account,
      from,
      to,
      branch,
      transactionCategory,
      method,
    });

    // Money received from (or repaid to) an outside party that must be repaid — a borrowing —
    // folded in the same way. Only OPEN (non-cancelled) rows count.
    const borrowingStage = buildBorrowingLedgerUnionStage({
      account,
      from,
      to,
      branch,
      transactionCategory,
      method,
    });

    // The mirror: money WE lent out (and its later recovery) — an advance. Same treatment.
    const advanceStage = buildAdvanceLedgerUnionStage({
      account,
      from,
      to,
      branch,
      transactionCategory,
      method,
    });

    const [opening, [result]] = await Promise.all([
      // Branch-filtered views open from that branch's own seed, not the company figure — see
      // getOpeningBalance. Unseeded branches open at 0 and the UI says so.
      getOpeningBalance(account, from, branch || null),
      Transactions.aggregate([
        { $match: match },
        {
          $addFields: {
            signedAmount: SIGNED_AMOUNT,
            isContra: { $literal: false },
            isSuspense: { $literal: false },
            // Task 3: explicit discriminator — a plain row here IS a real Transactions
            // document, so /admin/transactions/edit/[id] can resolve it and the ordinary
            // DELETE_ENDPOINTS lookup applies. See buildContraLedgerUnionStage /
            // buildSuspenseLedgerUnionStage in accountBalances.js for the other two values.
            sourceKind: { $literal: "TRANSACTION" },
          },
        },
        ...(contraStage ? [contraStage] : []),
        ...(suspenseStage ? [suspenseStage] : []),
        ...(borrowingStage ? [borrowingStage] : []),
        ...(advanceStage ? [advanceStage] : []),
        // Cumulative running total across the WHOLE filtered period, computed before
        // pagination. _id breaks ties so same-day rows have a stable, repeatable order.
        {
          $setWindowFields: {
            sortBy: { date: 1, _id: 1 },
            output: {
              runningDelta: {
                $sum: "$signedAmount",
                window: { documents: ["unbounded", "current"] },
              },
            },
          },
        },
        {
          $facet: {
            rows: [
              { $skip: (page - 1) * limit },
              { $limit: limit },
              // A transaction carries its patient one of TWO ways and neither covers the
              // ledger on its own: TRANSPLANT rows always set the `patient` ref and almost
              // never the denormalized `patientName`, while MEDICINE rows are the reverse.
              // Reading only patientName left every transplant row — the largest revenue in
              // the book — blank on screen and in the export.
              //
              // Joined AFTER $skip/$limit so at most one page of rows is looked up, never the
              // whole period. Contra and suspense rows have no `patient` field, so $$pid is
              // missing, matches nothing, and they fall through with an empty name.
              {
                $lookup: {
                  from: "patients",
                  let: { pid: "$patient" },
                  pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$pid"] } } },
                    { $project: { "personal.name": 1, "personal.phone": 1 } },
                  ],
                  as: "patientDoc",
                },
              },
              {
                $addFields: {
                  // The row's own string wins when it has one — it is what was recorded at the
                  // time of payment, and a patient later renamed shouldn't silently rewrite
                  // history. The linked patient is the fallback, not the override.
                  patientName: {
                    $let: {
                      vars: { linked: { $arrayElemAt: ["$patientDoc", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $cond: [
                              { $gt: [{ $strLenCP: { $ifNull: ["$patientName", ""] } }, 0] },
                              "$patientName",
                              { $ifNull: ["$$linked.personal.name", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                  patientPhone: {
                    $let: {
                      vars: { linked: { $arrayElemAt: ["$patientDoc", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $cond: [
                              { $gt: [{ $strLenCP: { $ifNull: ["$patientPhone", ""] } }, 0] },
                              "$patientPhone",
                              { $ifNull: ["$$linked.personal.phone", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                $project: {
                  date: 1,
                  transactionCategory: 1,
                  costType: 1,
                  amount: 1,
                  signedAmount: 1,
                  runningDelta: 1,
                  method: 1,
                  branch: 1,
                  furtherMode: 1,
                  receiptMode: 1,
                  procedure: 1,
                  expense: 1,
                  expenseType: 1,
                  patientName: 1,
                  patientPhone: 1,
                  // The Patient _id, so the ledger can link back to the patient record.
                  patient: 1,
                  paymentId: 1,
                  remarks: 1,
                  // So a caller can tell a reversal row from an original, and hide
                  // Settle/Cancel Loan actions accordingly (e.g. LoanSettlementModal /
                  // CancelLoanModal on the Assets page's loan-account ledger).
                  reversalOf: 1,
                  reversalReason: 1,
                  isReversed: 1,
                  // Contra / suspense / borrowing-only fields; absent on transaction rows.
                  isContra: 1,
                  isSuspense: 1,
                  isBorrowing: 1,
                  isAdvance: 1,
                  fromAccount: 1,
                  toAccount: 1,
                  direction: 1,
                  reference: 1,
                  payableId: 1,
                  receivableId: 1,
                  sourceKind: 1,
                },
              },
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  // Direction is read off signedAmount rather than costType so contra rows —
                  // which have no costType — total correctly alongside ordinary movements.
                  // Equivalent to the previous costType test for every row with a positive
                  // amount, which is every real row.
                  totalIn: {
                    $sum: { $cond: [{ $gt: ["$signedAmount", 0] }, "$signedAmount", 0] },
                  },
                  totalOut: {
                    $sum: {
                      $cond: [{ $lt: ["$signedAmount", 0] }, { $abs: "$signedAmount" }, 0],
                    },
                  },
                  transactionCount: {
                    $sum: {
                      $cond: [
                        { $or: ["$isContra", "$isSuspense", "$isBorrowing", "$isAdvance"] },
                        0,
                        1,
                      ],
                    },
                  },
                  contraCount: { $sum: { $cond: ["$isContra", 1, 0] } },
                  suspenseCount: { $sum: { $cond: ["$isSuspense", 1, 0] } },
                  borrowingCount: { $sum: { $cond: ["$isBorrowing", 1, 0] } },
                  advanceCount: { $sum: { $cond: ["$isAdvance", 1, 0] } },
                },
              },
            ],
          },
        },
      ]).allowDiskUse(true),
    ]);

    const elapsedMs = Date.now() - started;

    const summary = result?.summary?.[0] || {
      totalIn: 0,
      totalOut: 0,
      transactionCount: 0,
      contraCount: 0,
      suspenseCount: 0,
      borrowingCount: 0,
      advanceCount: 0,
    };
    const openingBalance = round2(opening.openingBalance);
    const totalIn = round2(summary.totalIn);
    const totalOut = round2(summary.totalOut);
    const closingBalance = round2(openingBalance + totalIn - totalOut);
    // Pagination counts every ROW the ledger renders, contra included — counting only
    // transactions would drop the last page's worth of rows once transfers exist.
    const movementCount =
      summary.transactionCount +
      summary.contraCount +
      (summary.suspenseCount || 0) +
      (summary.borrowingCount || 0) +
      (summary.advanceCount || 0);

    // runningDelta is cumulative movement; the displayed running balance starts from the
    // opening balance. closingBalance therefore always equals the last row's running
    // balance — asserted by the verification script.
    // Task 3: only real Transaction rows are ever edit/delete-locked — a contra transfer or
    // suspense entry has its own actions (see DrillDownTable's leafActions), so checking the
    // lock for them would be dead weight. Bounded by `limit` (<=200), same cost as the
    // identical per-row check payables/grouped and receivables/grouped already do.
    const rows = await Promise.all(
      (result?.rows || []).map(async (r) => ({
        ...r,
        runningBalance: round2(openingBalance + r.runningDelta),
        lockReason:
          r.sourceKind === "TRANSACTION"
            ? await checkPeriodLock({ furtherMode: account, date: r.date })
            : null,
      })),
    );

    return NextResponse.json({
      success: true,
      account,
      period: { from, to },
      openingBalance,
      openingBalanceSeeded: opening.seeded,
      // How the opening figure was arrived at: the anchored number, plus everything that has
      // moved since it. Surfaced so the UI can explain a balance nobody typed in.
      openingAnchorBalance: opening.anchorBalance ?? openingBalance,
      openingCarriedForward: opening.carriedForward ?? 0,
      totalIn,
      totalOut,
      closingBalance,
      transactionCount: summary.transactionCount,
      contraCount: summary.contraCount,
      suspenseCount: summary.suspenseCount || 0,
      borrowingCount: summary.borrowingCount || 0,
      advanceCount: summary.advanceCount || 0,
      movementCount,
      // True when a filter suppressed contra entries, so the UI can say the ledger won't
      // reconcile with the unfiltered view rather than leaving the gap unexplained.
      contraExcludedByFilter: !contraStage,
      rows,
      pagination: {
        page,
        limit,
        total: movementCount,
        totalPages: Math.max(1, Math.ceil(movementCount / limit)),
      },
      elapsedMs,
    });
  } catch (error) {
    console.error("Error building account ledger:", error);
    return NextResponse.json({ error: "Failed to build account ledger" }, { status: 500 });
  }
}
