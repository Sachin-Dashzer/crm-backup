"use client";

import TransactionSectionCard from "@/components/TransactionSectionCard";
import PatientPicker from "@/components/PatientPicker";
import LineItemsEditor from "@/components/LineItemsEditor";
import MethodField from "@/components/MethodField";
import ReceivableLinkField from "@/components/ReceivableLinkField";
import ReceiptUpload from "@/components/ReceiptUpload";
import SearchableSelect from "@/components/SearchableSelect";
import TransactionSummaryPanel from "@/components/TransactionSummaryPanel";
import { ALL_BRANCHES } from "@/lib/branches";
import { Scissors, Heart, Pill, Wallet, Save, Loader2 } from "lucide-react";

const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;
const SERVICE_PROCEDURES = ["PRP", "GFC", "Alopecia", "Canacot", "Headwash", "Other"];

const CATEGORY_META = {
  TRANSPLANT: { icon: Scissors, label: "Transplant" },
  SERVICE: { icon: Heart, label: "Service (PRP/GFC)" },
  MEDICINE: { icon: Pill, label: "Medicine Sale" },
};

// The single shared implementation of the Transplant / Service / Medicine tabs — identical
// fields, identical components, across every panel that sells to a patient. TRANSPLANT is
// single-procedure-and-amount; SERVICE and MEDICINE are LineItemsEditor-driven, with the
// transaction amount computed from items minus discount. Restructured into the WHAT / MONEY
// / HOW grouping: patient+procedure (WHAT), amount+discount (MONEY), method and everything
// it reveals (HOW) — with TransactionSummaryPanel sticky alongside on desktop.
//
// `data` / `onChange` carry the full per-tab state object the parent page already owns
// (patient, procedure, paymentType, amount, discount, method, paymentId, branch, date,
// remarks, receiptMode, furtherMode, externalParty, receipts, receivableId, isWalkIn,
// patientName, patientPhone) — this component does not introduce a new state shape, so the
// existing create/update payload builders in each page keep working unchanged.
export default function RevenueSection({
  category, // "TRANSPLANT" | "SERVICE" | "MEDICINE"
  data,
  onChange,
  picker,
  items, // SERVICE/MEDICINE only: [{...}]
  onItemsChange,
  medicines, // MEDICINE only
  patientLabel, // resolved display name for the summary panel
  onSave,
  saving = false,
  saveLabel = "Save Transaction",
  methodOptions, // full override; prefer forEdit — see MethodField
  forEdit = false, // edit forms drop the create-only methods (paid_to_external etc.)
  // Edit forms operate on ONE saved Transaction document, which corresponds to exactly one
  // line item — a batch of N line items became N separate documents at create time, linked
  // by batchId, and editing acts on a single one of them. Create forms build a fresh batch,
  // so they use LineItemsEditor; edit forms carry the item's fields (procedure/quantity/rate
  // or medicineId/quantity/rate) directly on `data`, same as TRANSPLANT always has.
  singleItem = false,
  branches, // override for roles restricted to a subset (e.g. main-branch-only, collab-only)
}) {
  const meta = CATEGORY_META[category];
  const isLineItems = (category === "SERVICE" || category === "MEDICINE") && !singleItem;
  const isSingleServiceOrMedicine = (category === "SERVICE" || category === "MEDICINE") && singleItem;
  const rateField = category === "SERVICE" ? "perSessionCost" : "perUnitCost";
  const set = (patch) => onChange({ ...data, ...patch });

  const total = isLineItems
    ? items.reduce((sum, i) => sum + (parseFloat(i.totalAmount) || 0), 0) - (parseFloat(data.discount) || 0)
    : isSingleServiceOrMedicine
      ? (parseFloat(data.quantity) || 0) * (parseFloat(data[rateField]) || 0) - (parseFloat(data.discount) || 0)
      : parseFloat(data.amount) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* ── WHAT ── */}
        <TransactionSectionCard title="Patient Information" icon={meta.icon}>
          <PatientPicker
            picker={picker}
            value={data}
            onChange={onChange}
            allowWalkIn={category !== "TRANSPLANT"}
          />
        </TransactionSectionCard>

        {category === "TRANSPLANT" && (
          <TransactionSectionCard title="Procedure Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Procedure <span className="text-red-500">*</span>
                </label>
                <select
                  value={data.procedure}
                  onChange={(e) => set({ procedure: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Sapphire FUE">Sapphire FUE</option>
                  <option value="DHI">DHI</option>
                  <option value="Turkish DHI">Turkish DHI</option>
                  <option value="Beard Transplant">Beard Transplant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={data.paymentType}
                  onChange={(e) => set({ paymentType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Booking">Booking</option>
                  <option value="Pending">Pending</option>
                  <option value="Full-payment">Full Payment</option>
                </select>
              </div>
            </div>
          </TransactionSectionCard>
        )}

        {isLineItems && (
          <LineItemsEditor
            kind={category === "SERVICE" ? "service" : "medicine"}
            items={items}
            onChange={onItemsChange}
            medicines={medicines}
          />
        )}

        {isSingleServiceOrMedicine && (
          <TransactionSectionCard title={category === "SERVICE" ? "Service Details" : "Medicine Details"}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {category === "SERVICE" ? "Service Type" : "Medicine"} <span className="text-red-500">*</span>
                </label>
                {category === "SERVICE" ? (
                  <select
                    value={data.procedure}
                    onChange={(e) => set({ procedure: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {SERVICE_PROCEDURES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                ) : (
                  <SearchableSelect
                    options={medicines}
                    value={data.medicineId}
                    onChange={(v, obj) => set({ medicineId: v, medicineName: obj?.name || data.medicineName })}
                    placeholder="Select medicine"
                    valueKey="_id"
                    formatOption={(m) => `${m.name} (Stock: ${m.totalQuantity}) - MRP: ${formatCurrency(m.mrp)}`}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input
                  type="number"
                  value={data.quantity}
                  onChange={(e) => set({ quantity: Number(e.target.value) })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {category === "SERVICE" ? "Per Session Cost" : "Per Unit Cost"}
                </label>
                <input
                  type="number"
                  value={data[rateField]}
                  onChange={(e) => set({ [rateField]: e.target.value })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </TransactionSectionCard>
        )}

        {/* ── MONEY ── */}
        <TransactionSectionCard title="Transaction Details" icon={Wallet}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {category === "TRANSPLANT" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={data.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter amount"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Discount (₹)</label>
              <input
                type="number"
                value={data.discount}
                onChange={(e) => set({ discount: Number(e.target.value) })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {/* ── HOW ── */}
            <MethodField
              category={category}
              branch={data.branch}
              value={data}
              onChange={set}
              methodOptions={methodOptions}
              forEdit={forEdit}
            />
            {/* Money received from this patient auto-allocates against their oldest open
                receivable(s) server-side by default (see the three revenue create routes and
                src/lib/receivableAllocation.js) — no picker required for the common case. This
                field only previews that default and lets it be overridden. Create-only: the
                auto-allocator only runs on creation, so edit forms (forEdit) keep using the
                existing plain receivableId field on `data` instead — see the update routes. */}
            {!forEdit && !data.isWalkIn && data.patient && (
              <ReceivableLinkField
                patientId={data.patient}
                amount={total}
                method={data.method}
                value={data.receivableAllocationChoice}
                onChange={(choice) => set({ receivableAllocationChoice: choice })}
              />
            )}
          </div>
        </TransactionSectionCard>

        <TransactionSectionCard title="Branch, Date & Remarks">
          <BranchDateRemarks data={data} onChange={set} branches={branches} />
        </TransactionSectionCard>

        <TransactionSectionCard title="Receipts / Documents">
          {/* The prop is `receipts`, not `value`. Passing `value` silently fell back to the
              component's `receipts = []` default: previously-uploaded files were invisible when
              editing, and adding a new one replaced the array instead of appending to it.
              `section`/`patientId` drive the upload folder in /api/upload. */}
          <ReceiptUpload
            receipts={data.receipts || []}
            onChange={(receipts) => set({ receipts })}
            section={category.toLowerCase()}
            patientId={data.isWalkIn ? undefined : data.patient || undefined}
          />
        </TransactionSectionCard>
      </div>

      {/* Sticky on desktop; caller wraps this column in the mobile-collapsible bar. */}
      <div className="lg:col-span-1">
        <div className="lg:sticky lg:top-6">
          <TransactionSummaryPanel
            category={category}
            amount={
              isLineItems
                ? total + (parseFloat(data.discount) || 0)
                : isSingleServiceOrMedicine
                  ? (parseFloat(data.quantity) || 0) * (parseFloat(data[rateField]) || 0)
                  : data.amount
            }
            discount={data.discount}
            method={data.method}
            who={{ patientLabel }}
            externalParty={data.method === "paid_to_external" ? data.externalParty : undefined}
          />
          {onSave && (
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full mt-4 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Branch / Date / Remarks — identical three fields across every category and role, just
// with a different branch list depending on whether the caller is a main-branch or
// collab-branch context (passed via `branches`).
export function BranchDateRemarks({ data, onChange, branches }) {
  const list = branches || ALL_BRANCHES;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
        <select
          value={data.branch}
          onChange={(e) => onChange({ branch: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          {list.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
        <input
          type="date"
          value={data.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
        <input
          type="text"
          value={data.remarks}
          onChange={(e) => onChange({ remarks: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}
