// Patient.ops.status is derived in Patient's pre-save hook, and that hook NEVER
// assigns the literal "CONSULTED" — consulted is "reached any stage past the
// initial ones", not a stored value. Filtering on the string finds nothing.
export const CONSULTED_FILTER = { $nin: ["NEW", "NOT_VISITED"] };
export const CONVERTED_FILTER = { $in: ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"] };

export function isConsulted(status) {
  return Boolean(status) && !CONSULTED_FILTER.$nin.includes(status);
}

export function isConverted(status) {
  return CONVERTED_FILTER.$in.includes(status);
}
