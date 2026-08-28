import mongoose from "mongoose";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { buildReceivableAggregationStages } from "@/lib/receivableAggregation";

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

function makeAllocationQueue(entries) {
  const queue = entries
    .map((e) => ({ receivableId: e.receivableId, remaining: Number(e.remaining) || 0 }))
    .filter((e) => e.remaining > 0);
  let idx = 0;
  return function consume(amountNeeded) {
    let remaining = Math.max(0, Number(amountNeeded) || 0);
    const allocations = [];
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

async function fenceReceivables(receivableIds, session) {
  const unique = [...new Set(receivableIds.filter(Boolean).map(String))];
  if (unique.length === 0) return;
  await Receivable.updateMany(
    { _id: { $in: unique } },
    { $inc: { allocationFence: 1 } },
    { session },
  );
}

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

export async function resolveReceivableAllocations({
  patientId,
  method,
  itemAmounts,
  choice,
  session,
}) {
  const empty = itemAmounts.map(() => ({ receivableId: null, receivableAllocations: [] }));

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
