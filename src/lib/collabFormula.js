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

// PREVIEW ONLY — mirrors the branch decision src/lib/collabDerivation.js's crystalliseClinicShare
// makes when a case's running total first reaches its package amount, so the form can show which
// way a completing entry will go. The server's real decision always runs on live-aggregated
// totals (cumulative clinic-collected across every past instalment, not just this one screen's
// inputs), so this pure snapshot function is never itself the source of truth — it only produces
// the correct preview for a form that already has the true cumulative figures to hand.
//
//   C >= S  the clinic already holds enough to cover its own fee -> it keeps S, sends back C-S ->
//           no Payable, the Receivable's pending nets down to C-S
//   C <  S  the clinic holds less than its fee -> we owe it the shortfall S-C -> a Payable for
//           S-C is created; whatever the clinic already holds (C) is expensed immediately,
//           offsetting the Receivable down to 0
export function deriveCrystallisation({ clinicReceived = 0, clinicShare = 0 } = {}) {
  const C = round2(clinicReceived);
  const S = round2(clinicShare);
  if (C >= S) {
    return { kind: "CLINIC_RETAINS", pendingAfter: round2(C - S), payable: 0 };
  }
  return { kind: "WE_OWE", pendingAfter: 0, payable: round2(S - C), expenseFromRetained: C };
}
