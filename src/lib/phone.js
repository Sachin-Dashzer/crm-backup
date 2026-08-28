export function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;

  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);

  return digits;
}
