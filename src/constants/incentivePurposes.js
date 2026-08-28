export const INCENTIVE_PURPOSES = [
  "Agent",
  "Counsellor",
  "Doctor",
  "Technician",
  "Implanter",
  "Referral",
  "Other",
];

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
