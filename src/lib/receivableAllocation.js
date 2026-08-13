import mongoose from "mongoose";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";

// FIFO auto-allocation of a revenue transaction's amount against a patient's open receivables —
// see the "Receivables don't update when a patient pays" spec. Money received from a patient
// reduces their outstanding automatically; nobody has to remember to pick a receivable for the
// books to be right. Must run INSIDE the same session/transaction the caller uses to write the
// resulting Transaction document(s) — see src/lib/externalPartyDerivation.js's withDbTransaction
// for the wrapper — so the "what's still open" read and the write that consumes it are atomic.

// Fetches this patient's open (pending > 0, not cancelled) receivables, oldest-due-first,
// falling back to createdAt when dueDate is unset. Scoped to payer.kind === "PATIENT" &&
// payer.refId === patientId — the same filter the (previously unused) ReceivableLinkField
// always used; a COLLAB_SETTLEMENT receivable owed by a partner clinic is a different debt and
// must never absorb a patient's own payment even when relatedPatient happens to match.
//
// Reuses buildReceivableAggregationStages so "pending" here is computed by the exact same rule
// the receivables page shows — never a second implementation to drift out of sync.
export async function fetchOpenReceivablesForPatient(patientId, session) {
  if (!patientId) return [];
  const pipeline = [
    {
      $match: {
        "payer.kind": "PATIENT",
        "payer.refId": new mongoose.Types.ObjectId(patientId),
        isCancelled: false,
      },
    },
    ...buildReceivableAggregationStages(Transactions.collection.name),
    { $match: { pending: { $gt: 0 } } },
    { $addFields: { _sortKey: { $ifNull: ["$dueDate", "$createdAt"] } } },
    { $sort: { _sortKey: 1 } },
  ];
  return Receivable.aggregate(pipeline).session(session || null);
}

// A queue of {receivableId, remaining} consumed left-to-right across one or more amounts (one
// per line item in a SERVICE/MEDICINE batch, or a single entry for TRANSPLANT / manual mode) —
// so a batch payment spills across receivables in the same left-to-right order it would if it
// were one transaction, instead of restarting the FIFO cursor for every line item.
function makeAllocationQueue(entries) {
  const queue = entries
    .map((e) => ({ receivableId: e.receivableId, remaining: Number(e.remaining) || 0 }))
    .filter((e) => e.remaining > 0);
  let idx = 0;
  return function consume(amountNeeded) {
    let remaining = Math.max(0, Number(amountNeeded) || 0);
    const allocations = [];
    // 0.005 tolerance — rupee amounts carry paise, and repeated float subtraction across a
    // batch can leave a sub-paise remainder that should count as "fully consumed".
    while (remaining > 0.005 && idx < queue.length) {
      const bucket = queue[idx];
      if (bucket.remaining <= 0.005) {
        idx++;
        continue;
      }
      const take = Math.min(remaining, bucket.remaining);
      allocations.push({ receivableId: bucket.receivableId, amount: take });
      bucket.remaining -= take;
      remaining -= take;
    }
    return allocations;
  };
}

function firstIdOf(allocations) {
  return allocations[0]?.receivableId || null;
}

// Records that these receivables were just allocated against, inside the same session as the
// Transaction write. Pure concurrency fence (see Receivable.allocationFence) — a genuine field
// mutation forces MongoDB to treat two concurrent transactions touching the same receivable as
// a write conflict, so the loser retries (session.withTransaction retries
// TransientTransactionError automatically) instead of both reading the same "pending" snapshot
// and over-allocating the same headroom.
async function fenceReceivables(receivableIds, session) {
  const unique = [...new Set(receivableIds.filter(Boolean).map(String))];
  if (unique.length === 0) return;
  await Receivable.updateMany(
    { _id: { $in: unique } },
    { $inc: { allocationFence: 1 } },
    { session },
  );
}

// Validates an explicit client-chosen allocation against this patient's LIVE open receivables
// (read inside the same session as the eventual write, for the same race-safety reason as the
// auto path). Rejects a receivable that isn't actually open for this patient, and — unless
// allowOverpayment is set — an amount that exceeds that receivable's outstanding balance,
// mirroring the guard already used for payables (expense/create) and manual receivable receipts
// (receivables/[id]/receipt).
async function resolveManualQueue({ patientId, allocations, allowOverpayment, session }) {
  const open = await fetchOpenReceivablesForPatient(patientId, session);
  const byId = new Map(open.map((r) => [String(r._id), r]));
  const entries = [];
  for (const a of allocations) {
    const r = byId.get(String(a.receivableId));
    if (!r) {
      throw new Error("One of the selected receivables is no longer open for this patient");
    }
    const amount = Number(a.amount);
    if (!(amount > 0)) {
      throw new Error("Each receivable allocation amount must be greater than zero");
    }
    if (amount > r.pending + 0.01 && !allowOverpayment) {
      throw new Error(
        `Allocating ₹${amount} to this receivable exceeds its outstanding balance of ₹${r.pending}. Pass allowOverpayment to record it anyway.`,
      );
    }
    entries.push({ receivableId: r._id, remaining: amount });
  }
  return entries;
}

// Core entry point. `itemAmounts` is one amount per Transaction document about to be created —
// a single-element array for TRANSPLANT, one entry per line item for SERVICE/MEDICINE. Returns
// one { receivableId, receivableAllocations } per entry, in the same order, ready to spread
// directly into each Transaction doc.
//
// choice:
//   undefined / { mode: "auto" }                                            -> FIFO across open receivables (default)
//   { mode: "none" }                                                        -> no allocation at all
//   { mode: "manual", allocations: [{receivableId,amount}], allowOverpayment? } -> exactly as given
export async function resolveReceivableAllocations({
  patientId,
  method,
  itemAmounts,
  choice,
  session,
}) {
  const empty = itemAmounts.map(() => ({ receivableId: null, receivableAllocations: [] }));

  // Money recorded as "paid to external" isn't actually collected — it must never auto-settle
  // an existing receivable. It gets its own auto-created Receivable via createExternalReceivable
  // (see externalPartyDerivation.js) instead, a separate mechanism entirely.
  if (method === "paid_to_external") return empty;

  const mode = choice?.mode || "auto";
  if (mode === "none") return empty;
  if (!patientId) return empty;

  let queueEntries;
  if (mode === "manual") {
    if (!Array.isArray(choice.allocations) || choice.allocations.length === 0) return empty;
    queueEntries = await resolveManualQueue({
      patientId,
      allocations: choice.allocations,
      allowOverpayment: !!choice.allowOverpayment,
      session,
    });
  } else {
    const open = await fetchOpenReceivablesForPatient(patientId, session);
    if (open.length === 0) return empty;
    queueEntries = open.map((r) => ({ receivableId: r._id, remaining: r.pending }));
  }

  const consume = makeAllocationQueue(queueEntries);
  const results = itemAmounts.map((amount) => {
    const allocations = consume(amount);
    return { receivableId: firstIdOf(allocations), receivableAllocations: allocations };
  });

  const touched = results.flatMap((r) => r.receivableAllocations.map((a) => a.receivableId));
  await fenceReceivables(touched, session);

  return results;
}
