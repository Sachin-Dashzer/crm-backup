import mongoose from "mongoose";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";

// Shared atomic-linking logic for the two "someone else physically handled the cash"
// methods: paid_to_external (revenue) and paid_by_other (expense). Both sides book the
// full transaction amount as ours — the sale/cost happened — and separately create a
// Payable/Receivable for the debt with whoever actually touched the money. Used by
// transplant/service/medicine/expense create routes so the linking logic exists once.

// ATOMICITY: MongoDB session/transaction, same approach as the collab flow
// (src/lib/collabDerivation.js) — verified against this deployment there (replica set
// atlas-ool7b4-shard-0, commit + rollback both confirmed). Wrap exactly the main
// Transaction write(s) and the linked Payable/Receivable write in `fn`; nothing else.
export async function withExternalPartyLink(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// Generic alias — the implementation above has always been a plain session wrapper; only the
// name was scoped to the external-party flows that needed it first. Use this name for any other
// atomic session need (e.g. receivable auto-allocation) so the import doesn't imply an external
// party is involved.
export const withDbTransaction = withExternalPartyLink;

// expenseGiver's type/refId convention has no OTHER — MANUAL is its "no backing record"
// value. Payable.payee.kind / Receivable.payer.kind use OTHER for that instead. This is
// the one place that mapping happens.
function toDocKind(partyKind) {
  return partyKind === "MANUAL" ? "OTHER" : partyKind;
}

const REVENUE_CATEGORY_LABEL = {
  TRANSPLANT: "Transplant",
  SERVICE: "Services",
  MEDICINE: "Medicine",
};

// Money someone else collected on our behalf — they owe it to us.
export async function createExternalReceivable({
  session,
  amount,
  name,
  method,
  partyKind,
  partyRefId,
  branch,
  transactionCategory,
  relatedPatient,
  actor,
}) {
  const performedBy = { name: actor?.name, email: actor?.email };
  const [receivable] = await Receivable.create(
    [
      {
        payer: {
          kind: toDocKind(partyKind),
          refId: partyKind === "MANUAL" ? null : partyRefId,
          label: name,
        },
        purpose: "OTHER",
        revenueCategory: REVENUE_CATEGORY_LABEL[transactionCategory] || undefined,
        relatedPatient: relatedPatient || undefined,
        totalAmount: amount,
        branch,
        remarks: `Paid to external party — ${name} received ₹${amount} on our behalf (their method: ${method || "unspecified"}).`,
        createdBy: { ...actor, date: new Date() },
        log: [
          {
            action: "Created",
            newValue: String(amount),
            note: `Auto-created from a "Paid to External" revenue transaction`,
            performedBy,
            performedAt: new Date(),
          },
        ],
      },
    ],
    { session },
  );
  return receivable;
}

// Money someone else paid on our behalf — we owe it to them.
export async function createExternalPayable({
  session,
  amount,
  name,
  method,
  partyKind,
  partyRefId,
  branch,
  relatedPatient,
  actor,
}) {
  const performedBy = { name: actor?.name, email: actor?.email };
  const [payable] = await Payable.create(
    [
      {
        payee: {
          kind: toDocKind(partyKind),
          refId: partyKind === "MANUAL" ? null : partyRefId,
          label: name,
        },
        purpose: "OTHER",
        expenseCategory: "External Payment",
        expenseSubType: "Paid By Other",
        relatedPatient: relatedPatient || undefined,
        totalAmount: amount,
        branch,
        remarks: `Paid by external party — ${name} covered ₹${amount} on our behalf (their method: ${method || "unspecified"}).`,
        createdBy: { ...actor, date: new Date() },
        log: [
          {
            action: "Created",
            newValue: String(amount),
            note: `Auto-created from a "Paid by Other" expense transaction`,
            performedBy,
            performedAt: new Date(),
          },
        ],
      },
    ],
    { session },
  );
  return payable;
}

// How much has actually been settled against a linked Payable/Receivable, computed live under
// the same rule the payables/receivables pages use — never a stored figure that could disagree
// with what the user is looking at.
async function settledAgainst(kind, id, session) {
  const { default: Transactions } = await import("@/models/Transactions");
  const { UNSETTLED_METHODS } = await import("@/constants/bankRouting");

  const match =
    kind === "receivable"
      ? { receivableId: id, costType: "Revenue" }
      : { payableId: id, costType: "Expenses" };

  const [agg] = await Transactions.aggregate([
    { $match: { ...match, approvalStatus: "APPROVED", method: { $nin: UNSETTLED_METHODS } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).session(session || null);

  return agg?.total || 0;
}

// Keeps the linked Payable/Receivable in step when a transaction is EDITED into, out of, or
// within one of the external-party methods.
//
// The create routes have always done this; the update routes never did, which is why
// paid_to_external / paid_by_other were withheld from edit forms (see getMethodOptions). The
// failure they were avoiding is specific and bad: those methods are in UNSETTLED_METHODS, so
// they are excluded from revenue and expense totals on the understanding that a linked
// receivable/payable will later be settled by a transaction that DOES count. Switch a row to
// one of them without creating that document and the amount simply leaves the books — no
// total, no receivable, nothing to chase.
//
// Four transitions, all handled here so no update route re-implements them:
//   normal   -> external : create the document and link it
//   external -> normal   : cancel the document it created, then unlink
//   external -> external : keep the document's amount and payer in step with the edit
//   normal   -> normal   : nothing
//
// Refuses rather than silently corrupting when money has already moved against the linked
// document: cancelling or shrinking a receivable that has receipts against it would strand
// them, pointing at a document that no longer claims to be owed.
//
// Returns a patch to apply to the transaction, or null when nothing needs to change. Must run
// inside the caller's session so the document write and the transaction write commit together.
export async function syncExternalPartyOnUpdate({
  session,
  transaction,
  nextMethod,
  nextAmount,
  nextExternalParty,
  branch,
  transactionCategory,
  relatedPatient,
  actor,
}) {
  const isExpense =
    transaction.costType === "Expenses" || transaction.transactionCategory === "EXPENSE";
  const externalMethod = isExpense ? "paid_by_other" : "paid_to_external";
  const direction = isExpense ? "PAID_BY" : "RECEIVED_BY";
  const linkField = isExpense ? "linkedPayableId" : "linkedReceivableId";
  const kind = isExpense ? "payable" : "receivable";
  const Model = isExpense ? Payable : Receivable;
  const noun = isExpense ? "payable" : "receivable";

  const linkedId = transaction.externalParty?.[linkField] || null;
  const wasExternal = !!linkedId;
  const isExternalNow = nextMethod === externalMethod;
  const amount = Number(nextAmount);
  const performedBy = { name: actor?.name, email: actor?.email };

  if (!wasExternal && !isExternalNow) return null;

  // ── external -> normal : cancel the document this transaction created ──
  if (wasExternal && !isExternalNow) {
    const settled = await settledAgainst(kind, linkedId, session);
    if (settled > 0) {
      throw new Error(
        `₹${settled.toLocaleString("en-IN")} has already been settled against the ${noun} this transaction created. ` +
          `Reverse those entries before changing the payment method, or this edit would strand them against a cancelled ${noun}.`,
      );
    }
    await Model.updateOne(
      { _id: linkedId },
      {
        $set: { isCancelled: true },
        $push: {
          log: {
            action: "Cancelled",
            previousValue: "false",
            newValue: "true",
            note: "Source transaction changed away from an external-party method",
            performedBy,
            performedAt: new Date(),
          },
        },
      },
      { session },
    );
    // Cleared wholesale: a leftover name or direction on a row that is no longer external
    // reads as though an external party were still involved.
    return {
      externalParty: {
        direction: null,
        name: undefined,
        method: undefined,
        partyKind: null,
        partyRefId: null,
        linkedPayableId: null,
        linkedReceivableId: null,
      },
    };
  }

  const partyError = validateExternalParty(nextExternalParty, direction);
  if (partyError) throw new Error(partyError);

  const partyKind = nextExternalParty.partyKind || "MANUAL";
  const partyRefId = partyKind !== "MANUAL" ? nextExternalParty.partyRefId : null;

  // ── normal -> external : create the document ──
  if (!wasExternal && isExternalNow) {
    const create = isExpense ? createExternalPayable : createExternalReceivable;
    const doc = await create({
      session,
      amount,
      name: nextExternalParty.name,
      method: nextExternalParty.method,
      partyKind,
      partyRefId,
      branch,
      transactionCategory,
      relatedPatient,
      actor,
    });
    return {
      externalParty: {
        direction,
        name: nextExternalParty.name,
        method: nextExternalParty.method,
        partyKind,
        partyRefId,
        [linkField]: doc._id,
      },
    };
  }

  // ── external -> external : keep the existing document in step ──
  const existing = await Model.findById(linkedId).session(session || null);
  if (!existing) {
    throw new Error(
      `The ${noun} linked to this transaction no longer exists. Change the method to something else and re-enter it.`,
    );
  }

  const settled = await settledAgainst(kind, linkedId, session);
  if (amount < settled) {
    throw new Error(
      `This transaction cannot be reduced to ₹${amount.toLocaleString("en-IN")} — ₹${settled.toLocaleString("en-IN")} has already been settled against its ${noun}.`,
    );
  }

  if (existing.totalAmount !== amount) {
    existing.log.push({
      action: "Amount Revised",
      previousValue: String(existing.totalAmount),
      newValue: String(amount),
      note: "Source transaction amount edited",
      performedBy,
      performedAt: new Date(),
    });
    existing.totalAmount = amount;
  }

  const partySide = isExpense ? existing.payee : existing.payer;
  if (partySide && partySide.label !== nextExternalParty.name) {
    existing.log.push({
      action: "Note Added",
      note: `Party renamed from "${partySide.label}" to "${nextExternalParty.name}" on the source transaction`,
      performedBy,
      performedAt: new Date(),
    });
    partySide.label = nextExternalParty.name;
    partySide.kind = partyKind === "MANUAL" ? "OTHER" : partyKind;
    partySide.refId = partyRefId;
  }

  // A cancelled document being edited back into use is reinstated rather than left dangling.
  if (existing.isCancelled) {
    existing.isCancelled = false;
    existing.log.push({
      action: "Cancelled",
      previousValue: "true",
      newValue: "false",
      note: "Reinstated — source transaction is external again",
      performedBy,
      performedAt: new Date(),
    });
  }

  await existing.save({ session });

  return {
    externalParty: {
      direction,
      name: nextExternalParty.name,
      method: nextExternalParty.method,
      partyKind,
      partyRefId,
      [linkField]: existing._id,
    },
  };
}

// Shared request-body validation for both directions. Returns an error string, or null
// if the externalParty payload is well-formed. `direction` is "RECEIVED_BY" | "PAID_BY",
// purely for the error message wording.
export function validateExternalParty(externalParty, direction) {
  const who = direction === "RECEIVED_BY" ? "Receiver" : "Sender";
  if (!externalParty || typeof externalParty !== "object") {
    return `${who} details are required for this payment method`;
  }
  if (!externalParty.name || !String(externalParty.name).trim()) {
    return `${who} name is required`;
  }
  if (!externalParty.method) {
    return `${who} payment method is required`;
  }
  const kind = externalParty.partyKind || "MANUAL";
  if (!["VENDOR", "EMPLOYEE", "PATIENT", "MANUAL"].includes(kind)) {
    return "Invalid party type";
  }
  if (kind !== "MANUAL" && !externalParty.partyRefId) {
    return `Select a specific ${kind.toLowerCase()}, or switch to manual entry`;
  }
  return null;
}
