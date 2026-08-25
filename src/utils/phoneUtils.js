/**
 * Returns the full phone number for admin/super-admin,
 * or a masked version (****XXXX) for all other roles.
 */
export function maskPhone(phone, role) {
  if (!phone) return "";
  if (role === "admin" || role === "super-admin") return phone;
  const str = String(phone);
  if (str.length <= 4) return str;
  return "****" + str.slice(-4);
}
