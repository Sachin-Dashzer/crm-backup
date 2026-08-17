// Canonical 10-digit form for every phone comparison in the app. The same patient
// can arrive as "9876543210", "+919876543210" or "91 98765 43210"; all three must
// resolve to the same key or duplicate detection silently misses them.
export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;

  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);

  // Too short to be a real number — kept as-is rather than discarded so the raw
  // value stays greppable instead of collapsing every bad entry onto null.
  return digits;
}
