"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import DebouncedDateInput from "@/components/finance/DebouncedDateInput";
import { formatCurrency } from "@/lib/financeUI";
import { ACCOUNTS } from "@/constants/bankRouting";
import { ALL_BRANCHES } from "@/lib/branches";
import { ADVANCE_TYPES } from "@/constants/advanceTypes";

const SUBTYPES = ADVANCE_TYPES;
const PARTY_KINDS = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "VENDOR", label: "Vendor" },
  { value: "PATIENT", label: "Patient" },
  { value: "OTHER", label: "Other" },
];

export default function RecordAdvanceModal({ open, onClose, onSuccess, mode, receivable = null, toast }) {
  const isRecovery = mode === "IN";
  const isFurther = mode === "OUT" && !!receivable;
  const isNewAdvance = mode === "OUT" && !receivable;
  const partyLocked = !!receivable;

  const [partyKind, setPartyKind] = useState(receivable?.payer?.kind || "EMPLOYEE");
  const [partyId, setPartyId] = useState(receivable?.payer?.refId || "");
  const [partyLabel, setPartyLabel] = useState(receivable?.payer?.label || "");
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [subType, setSubType] = useState(receivable?.revenueSubType || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [branch, setBranch] = useState(receivable?.branch || "");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [allowOverRecovery, setAllowOverRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [periodLocked, setPeriodLocked] = useState(false);

  const pending = receivable?.pending ?? 0;
  const overBalance = isRecovery && parseFloat(amount || 0) > pending;

  const fetchOptions = async (term = "") => {
    if (partyKind === "OTHER") return;
    setSearching(true);
    try {
      const endpoint =
        partyKind === "VENDOR"
          ? "/api/vendors/get"
          : partyKind === "EMPLOYEE"
            ? `/api/employees/get?limit=30${term ? `&search=${encodeURIComponent(term)}` : ""}`
            : `/api/patients/get-patient?limit=30${term ? `&search=${encodeURIComponent(term)}` : ""}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.data || data.vendors || data.employees || data.patients || []);
      }
    } catch {
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!partyLocked) fetchOptions("");
  }, [partyKind]);

  const handlePartySearch = (term) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(term), 350);
  };

  const formatOption = (o) =>
    partyKind === "VENDOR"
      ? o.DealsIn
        ? `${o.name} — ${o.DealsIn}`
        : o.name
      : partyKind === "EMPLOYEE"
        ? `${o.name} — ${o.role}`
        : `${o.personal?.name || "N/A"} — ${o.personal?.phone || "N/A"}`;

  const title = isRecovery ? "Record Recovery" : isFurther ? "Further Advance" : "Record Advance";

  const handleSubmit = async () => {
    setError("");
    setPeriodLocked(false);

    if (!account) return setError("Select which account this movement is through");
    const parsedAmount = parseFloat(amount);
    if (!(parsedAmount > 0)) return setError("Enter a valid amount");
    if (isNewAdvance) {
      if (!subType) return setError("Select what this advance is");
      if (partyKind !== "OTHER" && !partyId) return setError("Select the party");
      if (partyKind === "OTHER" && !partyLabel.trim()) return setError("Enter who this is to");
    }
    if (isRecovery && overBalance && !allowOverRecovery) {
      return setError("Amount exceeds the outstanding balance — check 'Allow over-recovery' to proceed anyway");
    }

    const party = partyLocked
      ? receivable.payer
      : partyKind === "OTHER"
        ? { kind: "OTHER", refId: null, label: partyLabel.trim() }
        : (() => {
            const obj = options.find((o) => o._id === partyId);
            const label =
              partyKind === "VENDOR" ? obj?.name : partyKind === "EMPLOYEE" ? obj?.name : obj?.personal?.name;
            return { kind: partyKind, refId: partyId, label: label || partyLabel };
          })();

    setSubmitting(true);
    try {
      const res = await fetch("/api/advances/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: isRecovery ? "IN" : "OUT",
          account,
          amount: parsedAmount,
          party,
          receivableId: receivable?._id || undefined,
          subType: isNewAdvance ? subType : undefined,
          branch: branch || undefined,
          date,
          reference,
          remarks,
          allowOverRecovery,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast?.success(
          isRecovery ? "Recovery recorded" : isFurther ? "Further advance recorded" : "Advance recorded",
        );
        onSuccess?.(data);
      } else if (res.status === 423) {
        setPeriodLocked(true);
        setError(data.error || "This period is closed");
      } else {
        setError(data.error || "Failed to save");
      }
    } catch {
      setError("Failed to save — check your connection and try again");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {receivable && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-semibold text-gray-900 truncate">{receivable.payer?.label}</p>
              <p className="text-gray-500 mt-1">
                {receivable.revenueSubType} · Outstanding:{" "}
                <span className="font-bold text-rose-600">{formatCurrency(pending)}</span>
              </p>
            </div>
          )}

          {!partyLocked && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Party kind *</label>
                <div className="grid grid-cols-4 gap-2">
                  {PARTY_KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => {
                        setPartyKind(k.value);
                        setPartyId("");
                        setPartyLabel("");
                      }}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border ${
                        partyKind === k.value
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>

              {partyKind === "OTHER" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={partyLabel}
                    onChange={(e) => setPartyLabel(e.target.value)}
                    placeholder="Who this money is going to"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Party *</label>
                  <SearchableSelect
                    options={options}
                    value={partyId}
                    onChange={(v, obj) => {
                      setPartyId(v);
                      setPartyLabel(
                        (partyKind === "PATIENT" ? obj?.personal?.name : obj?.name) || "",
                      );
                    }}
                    placeholder="Search and select..."
                    valueKey="_id"
                    formatOption={formatOption}
                    onSearch={partyKind !== "VENDOR" ? handlePartySearch : undefined}
                    searching={searching}
                  />
                </div>
              )}
            </>
          )}

          {isNewAdvance && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">This is a *</label>
              <select
                value={subType}
                onChange={(e) => setSubType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select…</option>
                {SUBTYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {isRecovery ? "Received in account *" : "Paid from account *"}
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select account…</option>
                {ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) *</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
              {isRecovery && (
                <p className="mt-1 text-xs text-gray-400">Outstanding: {formatCurrency(pending)}</p>
              )}
            </div>
          </div>

          {overBalance && (
            <label className="flex items-center gap-2 text-xs text-amber-700">
              <input
                type="checkbox"
                checked={allowOverRecovery}
                onChange={(e) => setAllowOverRecovery(e.target.checked)}
              />
              Amount exceeds outstanding balance — allow over-recovery
            </label>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
            <DebouncedDateInput
              value={date}
              onCommit={setDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {!partyLocked && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Company-level (no branch)</option>
                {ALL_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-400">
                Left blank, this row is company-level and won't appear in a branch-filtered view.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reference <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / cheque no."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
              placeholder="Optional"
            />
          </div>

          {error && (
            <div
              className={`rounded-lg p-3 text-sm ${
                periodLocked
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : title}
          </button>
        </div>
      </div>
    </div>
  );
}
