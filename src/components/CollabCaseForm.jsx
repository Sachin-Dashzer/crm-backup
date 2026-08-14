"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import BankRoutingFields from "@/components/BankRoutingFields";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { deriveClinicSettlement } from "@/lib/collabFormula";
import { REVENUE_METHODS } from "@/constants/paymentMethods";
import { Building2, Loader2, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";

// THE single collab case entry form. Used by the collab panel and, unchanged, by the
// admin emergency-entry modal on /admin/collab-settlement. Do not fork this per caller —
// the whole point is that both entry points feed the same formula.
//
// The payment-source selector is a UI SHORTCUT that pre-fills ourReceived/clinicReceived.
// It is NOT an input to the derivation: whatever the two numbers end up as, they go
// through deriveClinicSettlement() exactly the same way in all three states. "Split"
// simply stops auto-filling and lets the user type both.

const PROCEDURE_OPTIONS = [
  "Sapphire FUE",
  "DHI",
  "Turkish DHI",
  "Beard Transplant",
  "PRP",
  "Alopecia",
  "Headwash",
  "Canacot",
  "GFC",
  "Medicine",
  "Other",
];

// A collab case records how the PATIENT paid — money coming in — so this is a revenue form.
const METHOD_OPTIONS = REVENUE_METHODS;

const PAYMENT_SOURCES = [
  { id: "us", label: "Patient paid us" },
  { id: "clinic", label: "Patient paid the clinic" },
  { id: "split", label: "Split" },
];

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;

const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function CollabCaseForm({
  // Pre-selected clinic for the collab panel; admin passes nothing and picks from the dropdown.
  defaultClinic = "",
  onSuccess,
  onCancel,
  submitLabel = "Create Collab Case",
}) {
  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [patientCache, setPatientCache] = useState({});
  const patientDebounceRef = useRef(null);

  const [patientId, setPatientId] = useState("");
  const [clinic, setClinic] = useState(defaultClinic);
  const [procedure, setProcedure] = useState("Sapphire FUE");
  const [clinicShare, setClinicShare] = useState(20000);
  const [discount, setDiscount] = useState(0);
  const [paymentSource, setPaymentSource] = useState("us");
  const [ourReceived, setOurReceived] = useState(0);
  const [clinicReceived, setClinicReceived] = useState(0);
  const [method, setMethod] = useState("cash");
  const [receiptMode, setReceiptMode] = useState("");
  const [furtherMode, setFurtherMode] = useState("");
  const [date, setDate] = useState(getTodayIST());
  const [remarks, setRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchPatients = async (term = "") => {
    setPatientSearching(true);
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (term) params.set("search", term);
      const res = await fetch(`/api/patients/get-patient?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } catch {
      /* search failures are non-fatal — the user can retype */
    } finally {
      setPatientSearching(false);
    }
  };

  useEffect(() => {
    fetchPatients("");
  }, []);

  const handlePatientSearch = (term) => {
    clearTimeout(patientDebounceRef.current);
    patientDebounceRef.current = setTimeout(() => fetchPatients(term), 350);
  };

  const patientOptions = useMemo(() => {
    const resultIds = new Set(patients.map((p) => p._id));
    const cached = Object.values(patientCache).filter((p) => !resultIds.has(p._id));
    return [...cached, ...patients];
  }, [patients, patientCache]);

  const selectedPatient = patientCache[patientId] || patients.find((p) => p._id === patientId);

  // Read-only: the package already lives on Patient.payments.totalAmount (derived from
  // counselling.finlpackage). Never written back to from here — a discount is applied on top
  // instead, so the patient's own package figure stays the single source of truth.
  const grossPackage = selectedPatient?.payments?.totalAmount || 0;
  const discountNum = Number(discount) || 0;
  // Everything downstream (split, collections, the settlement formula) works off the NET
  // figure — that is what is actually chargeable and therefore what gets booked as revenue.
  const totalPackage = Math.round((grossPackage - discountNum) * 100) / 100;
  const ourShare = Math.round((totalPackage - (Number(clinicShare) || 0)) * 100) / 100;
  const discountInvalid = discountNum < 0 || discountNum > grossPackage;

  // The selector only PRE-FILLS the two collected amounts. Split leaves them alone.
  useEffect(() => {
    if (!totalPackage) return;
    if (paymentSource === "us") {
      setOurReceived(totalPackage);
      setClinicReceived(0);
    } else if (paymentSource === "clinic") {
      setOurReceived(0);
      setClinicReceived(totalPackage);
    }
  }, [paymentSource, totalPackage]);

  // Live preview through the SAME function the server uses.
  const settlement = deriveClinicSettlement({
    clinicReceived: Number(clinicReceived) || 0,
    clinicShare: Number(clinicShare) || 0,
  });

  const totalCollected = (Number(ourReceived) || 0) + (Number(clinicReceived) || 0);
  const overCollected = totalPackage > 0 && totalCollected - totalPackage > 0.01;
  const shareMismatch = totalPackage > 0 && ourShare < 0;

  const formatPatientOption = (p) =>
    `${p.personal?.name || "N/A"} — Package: ${formatCurrency(p?.payments?.totalAmount)}`;

  // What the clinic keeps out of what it collected — mirrors the min() in
  // createCollabCaseAtomic, so the preview states exactly what will be booked.
  const clinicShareExpensed = Math.min(Number(clinicReceived) || 0, Number(clinicShare) || 0);

  const canSubmit =
    patientId &&
    clinic &&
    procedure &&
    totalPackage > 0 &&
    !overCollected &&
    !shareMismatch &&
    !discountInvalid &&
    !submitting;

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/collab-settlement/cases/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: patientId,
          clinic,
          clinicShare: Number(clinicShare) || 0,
          discount: discountNum,
          ourReceived: Number(ourReceived) || 0,
          clinicReceived: Number(clinicReceived) || 0,
          procedure,
          method,
          receiptMode,
          furtherMode,
          date,
          remarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Server invariant messages name the exact numbers that disagreed — show verbatim.
        setError(data.error || "Failed to create collab case");
        return;
      }
      onSuccess?.(data);
    } catch {
      setError("Failed to create collab case");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Patient + clinic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={patientOptions}
            value={patientId}
            onChange={(v, obj) => {
              if (obj) setPatientCache((prev) => ({ ...prev, [obj._id]: obj }));
              setPatientId(v);
            }}
            placeholder="Search and select a patient..."
            valueKey="_id"
            formatOption={formatPatientOption}
            onSearch={handlePatientSearch}
            searching={patientSearching}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Partner Clinic <span className="text-red-500">*</span>
          </label>
          {/* COLLAB_BRANCHES only — a main branch must never be selectable here. */}
          <select
            value={clinic}
            onChange={(e) => setClinic(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select clinic</option>
            {COLLAB_BRANCHES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Package (read-only, from the patient) */}
      {patientId && grossPackage <= 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          This patient has no final package set. Set the patient&apos;s package (counselling →
          final package) before creating a collab case.
        </div>
      )}

      {grossPackage > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Package</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(grossPackage)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Net Chargeable</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(totalPackage)}
                {discountNum > 0 && (
                  <span className="block text-[11px] font-medium text-amber-600">
                    after −{formatCurrency(discountNum)}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Our Share</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(ourShare)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Clinic Share</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(clinicShare)}</p>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3 text-center">
            Package is read from the patient record and never modified here — a discount is
            applied on top instead. Our share is always the remainder of the net, so the split
            always equals what is actually chargeable.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Clinic Share</label>
          <input
            type="number"
            min="0"
            value={clinicShare}
            onChange={(e) => setClinicShare(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {shareMismatch && (
            <p className="text-xs text-red-600 mt-1">
              Clinic share cannot exceed the net chargeable amount ({formatCurrency(totalPackage)}).
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Discount</label>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {discountInvalid && (
            <p className="text-xs text-red-600 mt-1">
              Discount must be between 0 and the package total ({formatCurrency(grossPackage)}).
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Procedure</label>
          <select
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {PROCEDURE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Payment source — a pre-fill shortcut, not a branch in the derivation */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Who did the patient pay?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PAYMENT_SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => setPaymentSource(src.id)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                paymentSource === src.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split reveals both as editable; the other two states show them read-only
          so the user can still see exactly what will be recorded. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collected by us
          </label>
          <input
            type="number"
            min="0"
            value={ourReceived}
            onChange={(e) => setOurReceived(e.target.value)}
            readOnly={paymentSource !== "split"}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
              paymentSource !== "split" ? "bg-gray-50 text-gray-500" : ""
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collected by clinic
          </label>
          <input
            type="number"
            min="0"
            value={clinicReceived}
            onChange={(e) => setClinicReceived(e.target.value)}
            readOnly={paymentSource !== "split"}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg ${
              paymentSource !== "split" ? "bg-gray-50 text-gray-500" : ""
            }`}
          />
        </div>
      </div>

      {overCollected && (
        <p className="text-xs text-red-600">
          Collected {formatCurrency(totalCollected)} exceeds the package{" "}
          {formatCurrency(totalPackage)}.
        </p>
      )}

      {/* Live preview through the same formula the server runs */}
      {totalPackage > 0 && (
        <div
          className={`rounded-lg border p-4 ${
            settlement.kind === "RECEIVABLE"
              ? "bg-emerald-50 border-emerald-200"
              : settlement.kind === "PAYABLE"
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {settlement.kind === "RECEIVABLE" ? (
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            ) : settlement.kind === "PAYABLE" ? (
              <TrendingDown className="w-4 h-4 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-gray-500" />
            )}
            <p className="text-sm font-semibold text-gray-900">
              {settlement.kind === "RECEIVABLE"
                ? `${clinic || "Clinic"} will owe us ${formatCurrency(settlement.amount)} — a Receivable will be created`
                : settlement.kind === "PAYABLE"
                  ? `We will owe ${clinic || "the clinic"} ${formatCurrency(settlement.amount)} — a Payable will be created`
                  : "Clinic collected exactly its share — no payable or receivable needed"}
            </p>
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5 font-mono">
            clinicOwesUs = collectedByClinic {formatCurrency(clinicReceived)} − clinicShare{" "}
            {formatCurrency(clinicShare)} = {formatCurrency(settlement.clinicOwesUs)}
          </p>
          <p className="text-[11px] text-gray-600 mt-1">
            Revenue is booked gross: {formatCurrency(totalPackage)} revenue
            {clinicShareExpensed > 0 && (
              <>
                , plus a {formatCurrency(clinicShareExpensed)} clinic-share expense for what{" "}
                {clinic || "the clinic"} kept out of its own collections
              </>
            )}
            , net margin {formatCurrency(ourShare)}.
          </p>
          {clinicShareExpensed < (Number(clinicShare) || 0) && (
            <p className="text-[11px] text-gray-500 mt-1">
              The remaining{" "}
              {formatCurrency((Number(clinicShare) || 0) - clinicShareExpensed)} of the clinic&apos;s
              share is still owed to them and is expensed when it is actually paid.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        {/* Which account the money we collected actually landed in. Collab branches have no
            entry in BANK_ROUTING_MAP by design (see bankRouting.js), so these start blank and
            are picked manually rather than pre-filled. Only meaningful when we collected
            something — if the clinic took all of it, no account of ours moved. */}
        <BankRoutingFields
          costType="Revenue"
          branch={clinic}
          transactionCategory={procedure === "Medicine" ? "MEDICINE" : undefined}
          method={method}
          receiptMode={receiptMode}
          furtherMode={furtherMode}
          onChange={(patch) => {
            if (patch.receiptMode !== undefined) setReceiptMode(patch.receiptMode);
            if (patch.furtherMode !== undefined) setFurtherMode(patch.furtherMode);
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4" /> {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
