import mongoose from "mongoose";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";

// §3 — the single implementation of what happens to a linked Receivable/Payable when the
// transaction connected to it is deleted or its amount edited. All four delete routes call this;
// implementing it per-route is how the six duplicated transaction forms happened.
//
// TWO DIRECTIONS, and they are not symmetrical:
//
//   A. This transaction CREATED the linked document.
//      Recorded on externalParty.linkedReceivableId / linkedPayableId (the paid_to_external /
//      paid_by_other flows) or collabRef.receivableId / payableId (the collab flow).
//      -> BLOCK if any OTHER transaction is settling that document; cancelling it would strand
//         those payments against a document that no longer claims to be owed.
//      -> Otherwise SOFT-CANCEL it (isCancelled: true) with a log entry. Never hard-delete:
//         these models use soft-cancel by design and the audit trail is the point.
//
//   B. This transaction is a PAYMENT against a linked document.
//      Recorded on the top-level receivableId / payableId.
//      -> NO CASCADE. paid/pending is computed by aggregating transactions (see
//         lib/receivableAggregation.js, lib/payableAggregation.js), so deleting the row makes
//         the figures self-correct. Writing a sync here would break the exact property that
//         aggregate-don't-store was chosen for.
//
// A single transaction can be in BOTH directions at once (it created one document and pays
// another); each link is judged on its own.

// The two link shapes a transaction can carry, normalised.
function creatorLinks(transaction) {
  const links = [];
  const ep = transaction.externalParty || {};
  const cr = transaction.collabRef || {};
  if (ep.linkedReceivableId) links.push({ kind: "receivable", id: ep.linkedReceivableId, via: "externalParty" });
  if (ep.linkedPayableId) links.push({ kind: "payable", id: ep.linkedPayableId, via: "externalParty" });
  if (cr.receivableId) links.push({ kind: "receivable", id: cr.receivableId, via: "collabRef" });
  if (cr.payableId) links.push({ kind: "payable", id: cr.payableId, via: "collabRef" });
  return links;
}

const modelFor = (kind) => (kind === "payable" ? Payable : Receivable);
const linkFieldFor = (kind) => (kind === "payable" ? "payableId" : "receivableId");

/**
 * Read-only pre-check. Returns { blocked, reasons[], willCancel[] }.
 *
 * `blocked` true means the delete must not proceed — `reasons` explains which document and what
 * is settling it, so the caller can surface something actionable rather than "failed".
 * `willCancel` lists the documents that WOULD be soft-cancelled if the delete goes ahead.
 */
export async function checkCascadeOnDelete(transaction, session = null) {
  const reasons = [];
  const willCancel = [];

  for (const link of creatorLinks(transaction)) {
    const Model = modelFor(link.kind);
    const doc = await Model.findById(link.id).session(session || null);
    if (!doc) continue; // already gone — nothing to cascade to

    // Any OTHER transaction settling this document blocks the cascade.
    const others = await Transactions.countDocuments({
      [linkFieldFor(link.kind)]: link.id,
      _id: { $ne: transaction._id },
    }).session(session || null);

    if (others > 0) {
      const label = link.kind === "payable" ? doc.payee?.label : doc.payer?.label;
      reasons.push(
        `This transaction created a ${link.kind} (${label || link.id}, ` +
          `${(doc.totalAmount || 0).toLocaleString("en-IN")}) that already has ${others} ` +
          `${others === 1 ? "payment" : "payments"} recorded against it. Delete or re-link ` +
          `${others === 1 ? "that payment" : "those payments"} first — cancelling the ${link.kind} ` +
          `now would strand ${others === 1 ? "it" : "them"}.`,
      );
    } else {
      willCancel.push({ kind: link.kind, id: link.id, label: link.kind === "payable" ? doc.payee?.label : doc.payer?.label, totalAmount: doc.totalAmount });
    }
  }

  return { blocked: reasons.length > 0, reasons, willCancel };
}

/**
 * Applies the cascade. MUST run inside the caller's session so the transaction delete and the
 * document cancellation commit together (replica set confirmed live — see §0).
 *
 * Assumes checkCascadeOnDelete already passed; re-checks the blocking condition anyway, because
 * between check and apply is exactly where a concurrent payment would land.
 */
export async function applyCascadeOnDelete(transaction, session, actor = {}) {
  const cancelled = [];
  const performedBy = { name: actor?.name, email: actor?.email };

  for (const link of creatorLinks(transaction)) {
    const Model = modelFor(link.kind);
    const doc = await Model.findById(link.id).session(session || null);
    if (!doc || doc.isCancelled) continue;

    const others = await Transactions.countDocuments({
      [linkFieldFor(link.kind)]: link.id,
      _id: { $ne: transaction._id },
    }).session(session || null);
    if (others > 0) {
      throw new Error(
        `Cannot cancel the linked ${link.kind}: ${others} payment(s) were recorded against it. ` +
          `Re-run the delete — the pre-check will explain what is blocking.`,
      );
    }

    doc.isCancelled = true;
    doc.log.push({
      action: "Cancelled",
      previousValue: "false",
      newValue: "true",
      note: `Source transaction ${transaction._id} was deleted — nothing recognises this ${link.kind} any more.`,
      performedBy,
      performedAt: new Date(),
    });
    await doc.save({ session });
    cancelled.push({ kind: link.kind, id: String(link.id) });
  }

  return cancelled;
}

/**
 * §2.3 — the update-side counterpart of checkCascadeOnDelete, named to mirror it so all four
 * update routes call the same thing.
 *
 * `changes` is the proposed patch; only `amount` is consequential today, because that is the
 * only field a linked document's total mirrors. Returns null when nothing needs confirming.
 */
export async function checkCascadeOnUpdate(transaction, changes = {}, session = null) {
  if (changes.amount === undefined || changes.amount === null) return null;
  return checkCascadeOnAmountChange(transaction, changes.amount, session);
}

/**
 * §2.3 — applies the linked-total change once the caller has passed updateLinked:true. Thin
 * alias over applyLinkedAmountChange so the update routes read symmetrically with the delete
 * routes (check… then apply…).
 */
export async function applyCascadeOnUpdate(transaction, changes, session, actor = {}) {
  if (changes?.amount === undefined || changes?.amount === null) return [];
  return applyLinkedAmountChange(transaction, changes.amount, session, actor);
}

/**
 * §3.2 amount-edit guard. Returns null when the edit is unambiguous, or a warning payload when
 * the transaction CREATED a linked document whose total would now disagree with it.
 *
 * Deliberately does NOT rewrite the linked total on its own: an amount edit is ambiguous — it may
 * be fixing a typo (the obligation was always the new figure) or recording that the obligation
 * genuinely changed. Only the caller passing updateLinked:true resolves that.
 */
export async function checkCascadeOnAmountChange(transaction, nextAmount, session = null) {
  const next = Number(nextAmount);
  if (!Number.isFinite(next) || next === transaction.amount) return null;

  const affected = [];
  for (const link of creatorLinks(transaction)) {
    const doc = await modelFor(link.kind).findById(link.id).session(session || null);
    if (!doc || doc.isCancelled) continue;
    affected.push({
      kind: link.kind,
      id: String(link.id),
      label: link.kind === "payable" ? doc.payee?.label : doc.payer?.label,
      currentTotal: doc.totalAmount,
      transactionWas: transaction.amount,
      transactionNow: next,
    });
  }
  if (!affected.length) return null;

  return {
    requiresLinkedUpdateConfirmation: true,
    affected,
    message:
      `This transaction created ${affected.length === 1 ? "a linked document" : "linked documents"} ` +
      `whose total still reflects the old amount. Re-send with updateLinked:true to move ` +
      `${affected.length === 1 ? "it" : "them"} to ${next.toLocaleString("en-IN")}, or leave as-is ` +
      `if only this transaction was wrong.`,
  };
}

/** Applies the linked-total change, once the caller has explicitly opted in. */
export async function applyLinkedAmountChange(transaction, nextAmount, session, actor = {}) {
  const next = Number(nextAmount);
  const updated = [];
  const performedBy = { name: actor?.name, email: actor?.email };

  for (const link of creatorLinks(transaction)) {
    const doc = await modelFor(link.kind).findById(link.id).session(session || null);
    if (!doc || doc.isCancelled) continue;
    if (doc.totalAmount === next) continue;

    doc.log.push({
      action: "Amount Revised",
      previousValue: String(doc.totalAmount),
      newValue: String(next),
      note: `Source transaction ${transaction._id} amount changed with updateLinked:true.`,
      performedBy,
      performedAt: new Date(),
    });
    doc.totalAmount = next;
    await doc.save({ session });
    updated.push({ kind: link.kind, id: String(link.id) });
  }
  return updated;
}

/** True when this transaction is only a PAYMENT (Direction B) — no cascade applies. */
export function isPaymentOnly(transaction) {
  return (
    creatorLinks(transaction).length === 0 &&
    !!(transaction.receivableId || transaction.payableId)
  );
}

export { creatorLinks };
