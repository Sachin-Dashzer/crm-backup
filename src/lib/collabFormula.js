
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

export function deriveCrystallisation({ clinicReceived = 0, clinicShare = 0 } = {}) {
  const C = round2(clinicReceived);
  const S = round2(clinicShare);
  if (C >= S) {
    return { kind: "CLINIC_RETAINS", pendingAfter: round2(C - S), payable: 0 };
  }
  return { kind: "WE_OWE", pendingAfter: 0, payable: round2(S - C), expenseFromRetained: C };
}
