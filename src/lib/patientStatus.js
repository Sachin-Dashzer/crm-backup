export const CONSULTED_FILTER = { $nin: ["NEW", "NOT_VISITED"] };
export const CONVERTED_FILTER = { $in: ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"] };

export function isConsulted(status) {
  return Boolean(status) && !CONSULTED_FILTER.$nin.includes(status);
}

export function isConverted(status) {
  return CONVERTED_FILTER.$in.includes(status);
}
