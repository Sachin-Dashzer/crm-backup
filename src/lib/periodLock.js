import AccountPeriod, { isOpeningSeed } from "@/models/AccountPeriod";
import { ACCOUNTS } from "@/constants/bankRouting";

// Edit/delete guard for closed periods. Imported by every transactions/*/update and
// transactions/*/delete route — the block lives at the API level, never only in the UI,
// because a UI-only block is trivially bypassed by calling the endpoint directly.
//
// SCOPE (confirmed): periods are per-account.
//   - A transaction carrying furtherMode is locked when THAT account's period covering its
//     date is closed.
//   - A transaction with no furtherMode belongs to no single account, so it is locked only
//     when EVERY account in ACCOUNTS is closed for the period covering its date — i.e. the
//     month is genuinely closed end to end. A partial close (say two accounts) locks only
//     transactions attributed to those two.
//
// NO ROLE BYPASS. Super-admin is blocked identically; the only way into a closed period is
// an explicit, logged reopen. A lock that privileged users can walk through is advisory, and
// an advisory lock on financial data is worse than none — it reads as a control while
// silently permitting the snapshot to drift from the transactions beneath it.

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// Closed, non-seed periods for an account covering a given date.
//
// branch: null is load-bearing — only company-level rows lock anything. A branch opening seed is
// a reference figure for the branch-filtered ledger, not a close, and must never freeze edits.
async function closedPeriodsCovering(account, date) {
  const rows = await AccountPeriod.find({
    account,
    branch: null,
    isClosed: true,
    periodStart: { $lte: new Date(date) },
    periodEnd: { $gte: new Date(date) },
  }).lean();
  return rows.filter((p) => !isOpeningSeed(p));
}

// Returns a blocking reason string, or null when the (account, date) pair is editable.
async function blockReasonFor(account, date) {
  if (!date) return null;

  if (account && ACCOUNTS.includes(account)) {
    const [closed] = await closedPeriodsCovering(account, date);
    if (closed) {
      return `${account} is closed for ${fmt(closed.periodStart)} – ${fmt(closed.periodEnd)}. Reopen that period to change this transaction.`;
    }
    return null;
  }

  // Unattributed: locked only when every account is closed over this date.
  const perAccount = await Promise.all(
    ACCOUNTS.map(async (a) => ({ account: a, closed: (await closedPeriodsCovering(a, date))[0] })),
  );
  if (perAccount.every((r) => r.closed)) {
    const p = perAccount[0].closed;
    return `The books are closed for ${fmt(p.periodStart)} – ${fmt(p.periodEnd)} across all ${ACCOUNTS.length} accounts. Reopen the period to change this transaction.`;
  }
  return null;
}

// Guards a single transaction change.
//
// Checks BOTH the current (account, date) and, when the caller is moving them, the proposed
// (account, date). Checking only the current values would let an edit drag a transaction out
// of a closed period — or drop a new one into it — and silently invalidate a frozen figure
// on either side.
//
// `next` is optional: omit it for deletes, pass { date, furtherMode } for updates.
export async function checkPeriodLock(transaction, next = null) {
  if (!transaction) return null;

  const checks = [
    { account: transaction.furtherMode, date: transaction.date, side: "current" },
  ];

  if (next) {
    const nextDate = next.date !== undefined && next.date !== null ? next.date : transaction.date;
    const nextAccount =
      next.furtherMode !== undefined && next.furtherMode !== null
        ? next.furtherMode
        : transaction.furtherMode;
    const movedDate = new Date(nextDate).getTime() !== new Date(transaction.date).getTime();
    const movedAccount = nextAccount !== transaction.furtherMode;
    if (movedDate || movedAccount) {
      checks.push({ account: nextAccount, date: nextDate, side: "target" });
    }
  }

  for (const c of checks) {
    const reason = await blockReasonFor(c.account, c.date);
    if (reason) {
      return c.side === "target"
        ? `That change would move this transaction into a closed period. ${reason}`
        : reason;
    }
  }
  return null;
}

// Convenience wrapper for routes: returns a ready-to-return NextResponse-shaped payload, or
// null when the edit may proceed. 423 Locked is the accurate status — the resource exists and
// the request is well-formed, it is the period that forbids the write.
export async function periodLockResponse(transaction, next = null) {
  const reason = await checkPeriodLock(transaction, next);
  if (!reason) return null;
  return { status: 423, body: { success: false, error: reason, periodLocked: true } };
}
