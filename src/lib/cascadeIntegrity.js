import mongoose from "mongoose";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";

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

export async function checkCascadeOnDelete(transaction, session = null) {
  const reasons = [];
  const willCancel = [];

  for (const link of creatorLinks(transaction)) {
    const Model = modelFor(link.kind);
    const doc = await Model.findById(link.id).session(session || null);
    if (!doc) continue;

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

export async function checkCascadeOnUpdate(transaction, changes = {}, session = null) {
  if (changes.amount === undefined || changes.amount === null) return null;
  return checkCascadeOnAmountChange(transaction, changes.amount, session);
}

export async function applyCascadeOnUpdate(transaction, changes, session, actor = {}) {
  if (changes?.amount === undefined || changes?.amount === null) return [];
  return applyLinkedAmountChange(transaction, changes.amount, session, actor);
}

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

export function isPaymentOnly(transaction) {
  return (
    creatorLinks(transaction).length === 0 &&
    !!(transaction.receivableId || transaction.payableId)
  );
}

export { creatorLinks };
