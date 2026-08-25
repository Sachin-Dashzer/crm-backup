// THE collab settlement formula, kept dependency-free so both the server
// (src/lib/collabDerivation.js) and the client form (src/components/CollabCaseForm.jsx)
// import the exact same function. The form's live preview therefore cannot drift
// from what the server actually creates — if this changes, both change together.
//
//   clinicOwesUs = clinicReceived - clinicShare
//
//   > 0  the clinic collected more than its share  -> it owes us  -> Receivable
//   < 0  the clinic collected less than its share  -> we owe it   -> Payable
//   = 0  the clinic collected exactly its share    -> settled     -> neither
//
// The UI's "paid us / paid clinic / split" selector is only a pre-fill shortcut for
// ourReceived+clinicReceived. There is deliberately no per-state branch: three
// parallel code paths would drift the moment one of them is edited.

// Rupee amounts can carry paise; keep comparisons off binary-float edges.
export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function deriveClinicSettlement({ clinicReceived = 0, clinicShare = 0 } = {}) {
  const clinicOwesUs = round2(clinicReceived - clinicShare);

  if (clinicOwesUs > 0) {
    return { kind: "RECEIVABLE", amount: clinicOwesUs, clinicOwesUs };
  }
  if (clinicOwesUs < 0) {
    return { kind: "PAYABLE", amount: Math.abs(clinicOwesUs), clinicOwesUs };
  }
  return { kind: "NONE", amount: 0, clinicOwesUs: 0 };
}
