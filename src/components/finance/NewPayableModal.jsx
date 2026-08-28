"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { getExpenseTypes } from "@/constants/expenseCategories";
import { ALL_BRANCHES, COLLAB_BRANCHES } from "@/lib/branches";

const PURPOSES = [
  "SALARY",
  "INCENTIVE",
  "RENT",
  "ELECTRICITY",
  "COLLAB_CLINIC",
  "PATIENT_COMMISSION",
  "TAX",
  "MEDICAL_CONSUMABLES",
  "MEDICINE_PROCUREMENT",
  "PROFESSIONAL_EXPENSES",
  "LAB_EXPENSES",
  "INTEREST_EXPENSES",
  "SOFTWARE_RENTAL",
  "HARDWARE_RENTAL",
];
const GENERIC_SUBTYPE_PURPOSES = [
  "MEDICAL_CONSUMABLES",
  "MEDICINE_PROCUREMENT",
  "PROFESSIONAL_EXPENSES",
  "LAB_EXPENSES",
  "INTEREST_EXPENSES",
  "SOFTWARE_RENTAL",
  "HARDWARE_RENTAL",
];

const PURPOSE_LABELS = {
  SALARY: "Salary",
  INCENTIVE: "Incentive",
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  COLLAB_CLINIC: "Collab Clinic",
  PATIENT_COMMISSION: "Patient Commission",
  TAX: "Taxes",
  MEDICAL_CONSUMABLES: "Medical Consumables",
  MEDICINE_PROCUREMENT: "Medicine Procurement",
  PROFESSIONAL_EXPENSES: "Professional Expenses",
  LAB_EXPENSES: "Lab Expenses",
  INTEREST_EXPENSES: "Interest Expenses",
  SOFTWARE_RENTAL: "Software Rental",
  HARDWARE_RENTAL: "Hardware Rental",
};

const PURPOSE_TO_CATEGORY = {
  SALARY: "Salary",
  INCENTIVE: "Incentive",
  RENT: "Rent",
  ELECTRICITY: "Electricity Bill",
  COLLAB_CLINIC: "Collab Clinic Payment",
  PATIENT_COMMISSION: "Commision",
  TAX: "Taxes",
  MEDICAL_CONSUMABLES: "Medical Consumables",
  MEDICINE_PROCUREMENT: "Medicine Procurement",
  PROFESSIONAL_EXPENSES: "Professional Expenses",
  LAB_EXPENSES: "Lab Expenses",
  INTEREST_EXPENSES: "Interest Expenses",
  SOFTWARE_RENTAL: "Software Rental Expenses",
  HARDWARE_RENTAL: "Hardware Rental Expenses",
};

export default function NewPayableModal({ onClose, onSuccess, toast }) {
  const [purpose, setPurpose] = useState("");
  const [subType, setSubType] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [branch, setBranch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [collabBranch, setCollabBranch] = useState("");
  const [taxType, setTaxType] = useState("");

  const [patients, setPatients] = useState([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const patientDebounce = useRef(null);
  const [relatedPatient, setRelatedPatient] = useState("");

  const [employees, setEmployees] = useState([]);
  const [employeeSearching, setEmployeeSearching] = useState(false);
  const employeeDebounce = useRef(null);

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

  const needsPeriod = ["SALARY", "RENT", "ELECTRICITY", "COLLAB_CLINIC", "TAX"].includes(purpose);
  const needsPatient = ["INCENTIVE", "PATIENT_COMMISSION"].includes(purpose);

  const buildPayee = () => {
    if (purpose === "SALARY" || purpose === "INCENTIVE") {
      return { kind: "EMPLOYEE", refId: employeeId, label: employeeName };
    }
    if (purpose === "RENT") return { kind: "RENT_UNIT", refId: null, label: unitLabel };
    if (purpose === "ELECTRICITY") return { kind: "UTILITY_UNIT", refId: null, label: unitLabel };
    if (purpose === "COLLAB_CLINIC") return { kind: "COLLAB_CLINIC", refId: null, label: collabBranch };
    if (purpose === "PATIENT_COMMISSION") {
      const pat = patients.find((p) => p._id === relatedPatient);
      return { kind: "PATIENT", refId: relatedPatient, label: pat?.personal?.name || "Patient" };
    }
    if (purpose === "TAX") return { kind: "OTHER", refId: null, label: taxType };
    if (GENERIC_SUBTYPE_PURPOSES.includes(purpose)) {
      if (vendorId && vendorName) return { kind: "VENDOR", refId: vendorId, label: vendorName };
      return { kind: "OTHER", refId: null, label: subType };
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!purpose || !totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error("Purpose and a valid amount are required");
      return;
    }
    const payee = buildPayee();
    if (!payee?.label) {
      toast.error("Complete the payee details for this purpose");
      return;
    }
    if (GENERIC_SUBTYPE_PURPOSES.includes(purpose) && !subType) {
      toast.error("Select the expense sub-type");
      return;
    }
    if (needsPeriod && (!month || !year)) {
      toast.error("Select the month and year this payable is for");
      return;
    }
    if (needsPatient && !relatedPatient) {
      toast.error("Related patient is required for this purpose");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payables/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payee,
          purpose,
          expenseCategory: PURPOSE_TO_CATEGORY[purpose],
          expenseSubType: subType || (purpose === "SALARY" ? "Salary" : purpose === "COLLAB_CLINIC" ? "Collab Clinic Payment" : subType),
          period: needsPeriod ? { month: parseInt(month), year: parseInt(year) } : undefined,
          relatedPatient: needsPatient ? relatedPatient : undefined,
          totalAmount,
          dueDate: dueDate || undefined,
          branch: branch || undefined,
          remarks,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Payable created");
        onSuccess();
      } else {
        toast.error(data.error || "Failed to create payable");
      }
    } catch (error) {
      console.error("Error creating payable:", error);
      toast.error("Failed to create payable");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">New Payable</h3>
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
                setSubType("");
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

          {(purpose === "SALARY" || purpose === "INCENTIVE") && (
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

          {purpose === "INCENTIVE" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Incentive Type</label>
              <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">Select type…</option>
                {getExpenseTypes("Incentive").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "RENT" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rent Unit *</label>
              <select
                value={unitLabel}
                onChange={(e) => {
                  setUnitLabel(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select unit…</option>
                {getExpenseTypes("Rent").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "ELECTRICITY" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Utility Unit *</label>
              <select
                value={unitLabel}
                onChange={(e) => {
                  setUnitLabel(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select unit…</option>
                {getExpenseTypes("Electricity Bill").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {purpose === "COLLAB_CLINIC" && (
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

          {purpose === "PATIENT_COMMISSION" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Related Patient *</label>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Commission Type</label>
                <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select type…</option>
                  {getExpenseTypes("Commision").map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {purpose === "TAX" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Type *</label>
              <select
                value={taxType}
                onChange={(e) => {
                  setTaxType(e.target.value);
                  setSubType(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select type…</option>
                {getExpenseTypes("Taxes").map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {GENERIC_SUBTYPE_PURPOSES.includes(purpose) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {PURPOSE_LABELS[purpose]} Sub-type *
                </label>
                <select value={subType} onChange={(e) => setSubType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Select…</option>
                  {getExpenseTypes(PURPOSE_TO_CATEGORY[purpose]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vendor <span className="text-gray-400 font-normal">(optional)</span>
                </label>
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
                  Naming the vendor links this payable — and the expense it pays — to their
                  record. Leave blank to file it under the sub-type alone.{" "}
                  <a href="/admin/vendors/create" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                    Add a vendor
                  </a>
                </p>
              </div>
            </>
          )}

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
              <option value="">Select branch…</option>
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
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Payable"}
          </button>
        </div>
      </div>
    </div>
  );
}
