/**
 * Back-dated transaction guard.
 *
 * Only `admin` / `super-admin` may create, edit, or delete a transaction whose
 * date falls before the start of today. Every other role (sales, reception,
 * collab, stock, etc.) is blocked from any back-dated transaction CRUD.
 */

export const BACK_DATE_PRIVILEGED_ROLES = ["admin", "super-admin"];

/** Start of "today" using the UTC-midnight convention used across the transaction routes. */
function todayStartUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** True when `date` resolves to a day earlier than today. */
export function isBackDated(date) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  d.setUTCHours(0, 0, 0, 0);
  return d < todayStartUTC();
}

/**
 * Returns an error descriptor `{ status, body }` when `role` may NOT perform a
 * back-dated transaction operation, otherwise `null`.
 *
 * Pass every date relevant to the operation:
 *  - create: the new transaction date
 *  - update: the stored date AND the incoming date (either being in the past counts)
 *  - delete: the stored date
 *
 * Usage:
 *   const backDateError = backDateGuard(session.user.role, existing.date, date);
 *   if (backDateError)
 *     return NextResponse.json(backDateError.body, { status: backDateError.status });
 */
export function backDateGuard(role, ...dates) {
  if (BACK_DATE_PRIVILEGED_ROLES.includes(role)) return null;
  if (!dates.some((d) => isBackDated(d))) return null;
  return {
    status: 403,
    body: {
      success: false,
      message:
        "Back-dated transactions can only be created, edited, or deleted by an admin.",
      error:
        "Back-dated transactions can only be created, edited, or deleted by an admin.",
    },
  };
}
