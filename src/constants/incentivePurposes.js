// §3.1 — purposes a per-patient incentive can be recorded for. Overlaps Employee.role's enum
// values verbatim where a purpose corresponds to a role (Agent/Counsellor/Doctor/Technician/
// Implanter — see src/models/Employee.js) rather than inventing a parallel list. Referral/Other
// are incentive-specific and have no matching Employee.role.
export const INCENTIVE_PURPOSES = [
  "Agent",
  "Counsellor",
  "Doctor",
  "Technician",
  "Implanter",
  "Referral",
  "Other",
];

// Maps an Employee.role value onto the INCENTIVE_PURPOSES entry it corresponds to, for the "Add
// Incentive" picker's prefill (selecting an employee prefills purpose from their role). Roles
// with no direct match ("Others", "Hr") fall back to "Other" rather than leaving purpose blank.
const ROLE_TO_PURPOSE = {
  Agent: "Agent",
  Counsellor: "Counsellor",
  Doctor: "Doctor",
  Technician: "Technician",
  Implanter: "Implanter",
};

export function purposeForRole(role) {
  return ROLE_TO_PURPOSE[role] || "Other";
}
