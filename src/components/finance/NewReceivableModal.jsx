"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";

const PURPOSES = ["PATIENT_DUE", "COLLAB_SETTLEMENT", "REFUND_DUE", "ADVANCE_RECOVERY", "OTHER"];

const PURPOSE_LABELS = {
  PATIENT_DUE: "Patient Due",
  COLLAB_SETTLEMENT: "Collab Settlement",
  REFUND_DUE: "Refund Due",
  ADVANCE_RECOVERY: "Advance Recovery",
  OTHER: "Other",
};

const PURPOSE_TO_FIXED_KIND = {
  PATIENT_DUE: "PATIENT",
  COLLAB_SETTLEMENT: "COLLAB_CLINIC",
  OTHER: "OTHER",
};

const REVENUE_CATEGORIES = ["Transplant", "Services", "Medicine"];

export default function NewReceivableModal({ onClose, onSuccess, toast }) {
  const [purpose, setPurpose] = useState("");
  const [kind, setKind] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [revenueCategory, setRevenueCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [collabBranch, setCollabBranch] = useState("");
  const [manualLabel, setManualLabel] = useState("");

  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientDebounce = useRef(null);
  const [relatedPatient, setRelatedPatient] = useState("");

  const [employees, setEmployees] = useState([]);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const employeeDebounce = useRef(null);
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [vendorName, setVendorName] = useState("");

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchPatients = async (term = "") => {
    setPatientSearching(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (term) params.set("search", term);
      const res = await fetch(`/api/patients/get-patient?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients || []);
      }
    } finally {
      setPatientSearching(false);
    }
  };
  const handlePatientSearch = (term) => {
    clearTimeout(patientDebounce.current);
    patientDebounce.current = setTimeout(() => fetchPatients(term), 350);
  };
  const formatPatientOption = (p) => `${p.personal?.name || "N/A"} — ${p.personal?.phone || "N/A"}`;

  const fetchEmployees = async (term = "") => {
    setEmployeeSearching(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (term) params.set("search", term);
      const res = await fetch(`/api/employees/get?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } finally {
      setEmployeeSearching(false);
    }
  };
  const handleEmployeeSearch = (term) => {
    clearTimeout(employeeDebounce.current);
    employeeDebounce.current = setTimeout(() => fetchEmployees(term), 350);
  };
  const formatEmployeeOption = (e) => `${e.name} — ${e.role}`;

  const fetchVendors = async () => {
    try {
      const res = await fetch("/api/vendors/get");
      if (res.ok) {
        const data = await res.json();
        setVendors(data.data || data.vendors || []);
      }
    } catch {
    }
  };
  const formatVendorOption = (v) => (v.DealsIn ? `${v.name} — ${v.DealsIn}` : v.name);

  useEffect(() => {
    fetchPatients("");
    fetchEmployees("");
    fetchVendors();
  }, []);

  const needsKindPicker = ["REFUND_DUE", "ADVANCE_RECOVERY"].includes(purpose);
  const effectiveKind = PURPOSE_TO_FIXED_KIND[purpose] || kind;
  const needsPeriod = purpose === "COLLAB_SETTLEMENT";
  const needsPatient = purpose === "PATIENT_DUE" || (needsKindPicker && effectiveKind === "PATIENT");

  const buildPayer = () => {
    if (effectiveKind === "PATIENT") {
      const pat = patients.find((p) => p._id === relatedPatient);
      return { kind: "PATIENT", refId: relatedPatient, label: pat?.personal?.name || "Patient" };
    }
    if (effectiveKind === "EMPLOYEE") {
      return { kind: "EMPLOYEE", refId: employeeId, label: employeeName };
    }
    if (effectiveKind === "COLLAB_CLINIC") {
      return { kind: "COLLAB_CLINIC", refId: null, label: collabBranch };
    }
    if (effectiveKind === "VENDOR") {
      return { kind: "VENDOR", refId: vendorId || null, label: vendorName };
    }
    if (effectiveKind === "OTHER") {
      return { kind: "OTHER", refId: null, label: manualLabel };
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!purpose || !totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error("Purpose and a valid amount are required");
      return;
    }
    const payer = buildPayer();
    if (!payer?.label) {
      toast.error("Complete the payer details for this purpose");
      return;
    }
    if (needsPeriod && (!month || !year)) {
      toast.error("Select the month and year this settlement is for");
      return;
    }
    if (purpose === "PATIENT_DUE" && !relatedPatient) {
      toast.error("Select the related patient first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/receivables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payer,
          purpose,
          revenueCategory: revenueCategory || undefined,
          period: needsPeriod ? { month: parseInt(month), year: parseInt(year) } : undefined,
          relatedPatient: relatedPatient || undefined,
          totalAmount,
          dueDate: dueDate || undefined,
          branch: branch || undefined,
          remarks,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Receivable created");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to create receivable");
      }
    } catch (error) {
      console.error("Error creating receivable:", error);
      toast.error("Failed to create receivable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">New Receivable</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Purpose *</label>
            <select
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                setKind("");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select purpose…</option>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {PURPOSE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {needsKindPicker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Who owes this? *</label>
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select…</option>
                <option value="PATIENT">Patient</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="VENDOR">Vendor</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}

          {needsPatient && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Patient *</label>
              <SearchableSelect
                options={patients}
                value={relatedPatient}
                onChange={(v) => setRelatedPatient(v)}
                placeholder="Search and select a patient..."
                valueKey="_id"
                formatOption={formatPatientOption}
                onSearch={handlePatientSearch}
                searching={patientSearching}
              />
            </div>
          )}

          {effectiveKind === "EMPLOYEE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Employee *</label>
              <SearchableSelect
                options={employees}
                value={employeeId}
                onChange={(v, obj) => {
                  setEmployeeId(v);
                  setEmployeeName(obj?.name || "");
                }}
                placeholder="Search and select an employee..."
                valueKey="_id"
                formatOption={formatEmployeeOption}
                onSearch={handleEmployeeSearch}
                searching={employeeSearching}
              />
            </div>
          )}

          {effectiveKind === "VENDOR" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vendor *</label>
              <SearchableSelect
                options={vendors}
                value={vendorId}
                onChange={(v, obj) => {
                  setVendorId(v);
                  setVendorName(obj?.name || "");
                }}
                placeholder="Search and select a vendor..."
                valueKey="_id"
                formatOption={formatVendorOption}
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Not listed?{" "}
                <a href="/admin/vendors/create" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  Add a vendor
                </a>
                , then reopen this form.
              </p>
            </div>
          )}

          {effectiveKind === "OTHER" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payer Label *</label>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Enter a name"
              />
            </div>
          )}

          {purpose === "COLLAB_SETTLEMENT" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Clinic *</label>
              <select
                value={collabBranch}
                onChange={(e) => setCollabBranch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select clinic…</option>
                {COLLAB_BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Revenue Category</label>
            <select
              value={revenueCategory}
              onChange={(e) => setRevenueCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Not specific to one category</option>
              {REVENUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {needsPeriod && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Month</label>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Amount (₹) *</label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="">Default (your branch)</option>
              {ALL_BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
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
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Receivable"}
          </button>
        </div>
      </div>
    </div>
  );
}
