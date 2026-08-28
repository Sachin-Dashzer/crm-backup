import mongoose from "mongoose";
import { normalizePhone } from "@/lib/phone";
import { ALL_BRANCHES } from "@/lib/branches";

const patientSchema = new mongoose.Schema(
  {
    personal: {
      name: String,
      phone: {
        type: String,
        unique: true,
      },
      // Canonical 10-digit form of personal.phone, maintained by the pre-save hook.
      // Sparse: patients predating the backfill have no value and must not collide
      // with each other on a shared null.
      phoneNormalized: {
        type: String,
        index: true,
        sparse: true,
      },
      email: String,
      age: Number,
      gender: {
        type: String,
      },
      branch: {
        type: String,
      },
      address: String,
      profession: String,
      visitDate: Date,
      reference: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
      purpose: String,
      packageQuoted: Number,
      techniqueQuoted: String,
      remarks: String,
    },
    counselling: {
      counsellor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
      },
      techniqueSuggested: {
        type: String,
      },
      finlpackage: Number,
      graftsSuggested: Number,
      readyForSurgery: { type: Boolean, default: false },
      notes: String,
      additionalbenefits: [String],
      medicines: [String],
      hairlossType: String,
      areaofConcern: String,
      hairlossreason: String,
      hairlossduration: String,
    },
    medical: {
      allergies: String,
      medicalHistory: {
        type: String,
      },
      bloodGroup: {
        type: String,
      },
      sugar: String,
      bp: String,
      pulse: String,
      weight: String,
      hiv: String,
      hcv: String,
    }, 
    surgery: {
      surgeryDate: Date,
      location: {
        type: String,
      },
      OT: Number,
      technique: {
        type: String,
      },
      graftsneed: Number,
      graftsImplanted: Number,
      donorCondition: String,
      doctor: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      seniorTech: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      implanterRight: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      implanterLeft: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      graftingPerson: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      helper: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
    },
    afterSurgery: {
      headwashDate: Date,
      bandageRemovalDate: Date,
      prp: [
        {
          prpNumber: Number,
          date: Date,
          type: { type: String, enum: ["PRP", "GFC", "Canacot", "Biotin"], default: "PRP" },
        },
      ],
    },
    payments: {
      amountReceived: { type: Number, default: 0 },
      pendingAmount: { type: Number, default: 0 },
      medicineAmount: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      transactions: [
        { type: mongoose.Schema.Types.ObjectId, ref: "Transactions" },
      ],
    },
    // §3 — money owed to an EMPLOYEE for this patient, not money the patient paid. Stored ONCE,
    // here, never duplicated onto Employee — the employee's own "incentives earned" view is a
    // live aggregation over patients (see src/app/api/employees/[id]/incentives/route.js), never
    // a second copy of the same rows. Each row is backed by a real Payable (payableId) — see
    // src/lib/incentiveDerivation.js — so an incentive is a real expense the moment it's added,
    // not a free-floating number. Cancelled rows are kept (isCancelled), never removed — the
    // audit trail is the point, same as every other money-adjacent subdocument in this codebase.
    incentives: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
          index: true,
        },
        employeeName: String, // denormalised label for display; the ref is the truth
        role: String, // the employee's role at the time (Agent/Counsellor/...)
        purpose: { type: String, required: true }, // INCENTIVE_PURPOSES, see src/constants/incentivePurposes.js
        amount: { type: Number, required: true, min: 0 },
        date: { type: Date, default: Date.now },
        branch: { type: String, enum: ALL_BRANCHES },
        // The Incentive Payable (one per employee per month — see findOrCreateIncentivePayable)
        // this row's amount is folded into. Never a second source of truth: the Payable's own
        // totalAmount is recomputed live from every non-cancelled row that points at it.
        payableId: { type: mongoose.Schema.Types.ObjectId, ref: "Payable", default: null },
        remarks: String,
        isCancelled: { type: Boolean, default: false },
        // Append-only audit trail of THIS row (creation, amount revision, cancellation) — mirrors
        // Payable/Receivable/CollabCase's own log[] convention.
        log: [
          {
            action: {
              type: String,
              enum: ["Created", "Amount Revised", "Cancelled", "Note Added"],
            },
            previousValue: String,
            newValue: String,
            note: String,
            performedBy: { name: String, email: String },
            performedAt: { type: Date, default: Date.now },
          },
        ],
        createdBy: {
          name: String,
          email: String,
          branch: String,
          date: { type: Date, default: Date.now },
        },
      },
    ],
    products: [{
      stocks : {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Stock"
      },
      quantity: Number,
      amount: Number,
    }],
    documents: {
      images: [String],
      consentForm: [String],
      suregeryForm: [String],
      consultForm: [String],
    },
    ops: {
      status: {
        type: String,
        enum: [
          "NEW",
          "NOT_VISITED",
          "NOT_CONVERTED",
          "CONSULTED",
          "SURGERY_BOOKED",
          "BOOKING_DONE",
          "CLOSED",
        ],
        default: "NEW",
      },
    },
    editors: [
      {
        name: String,
        email: String,
        branch: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
        name: String,
        email: String,
        branch: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
  },
  // virtuals: true — required for totalIncentives (below) to serialize onto every API response
  // that returns a patient document; purely additive, no existing field's shape changes.
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Live sum of every non-cancelled incentives[] row — NEVER stored (see the model's own rule on
// computed totals: this would drift the moment one entry is cancelled). The employee-side total
// is the mirror of this, computed the same way via aggregation — see
// src/app/api/employees/[id]/incentives/route.js.
patientSchema.virtual("totalIncentives").get(function () {
  return (this.incentives || [])
    .filter((i) => !i.isCancelled)
    .reduce((sum, i) => sum + (i.amount || 0), 0);
});

patientSchema.pre("save", async function () {
  const patient = this;
  const currentDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const isVisitDatePast =
    patient.personal?.visitDate && patient.personal.visitDate < currentDate;

  if (!patient.ops) {
    patient.ops = {};
  }

  if (patient.isModified("personal.phone")) {
    const normalized = normalizePhone(patient.personal?.phone);
    if (patient.personal) patient.personal.phoneNormalized = normalized;
  }

  // Only derive totalAmount from finlpackage when it wasn't explicitly set by the caller.
  // If the admin manually updates payments.totalAmount, isModified returns true and we skip.
  if (patient.counselling?.finlpackage && !patient.isModified("payments.totalAmount")) {
    patient.payments = patient.payments || {};
    patient.payments.totalAmount = patient.counselling.finlpackage;
  }
  // Same guard for pendingAmount — skip auto-calc when admin sets it directly.
  if (patient.counselling?.finlpackage && !patient.isModified("payments.pendingAmount")) {
    patient.payments = patient.payments || {};
    patient.payments.pendingAmount =
      (patient.payments.totalAmount || patient.counselling.finlpackage) -
      (patient.payments.amountReceived || 0) -
      (patient.payments.discount || 0);
  }

  const amountReceived = patient.payments?.amountReceived || 0;
  const totalAmount    = patient.payments?.totalAmount    || 0;
  const pendingAmount  = patient.payments?.pendingAmount;

  if (patient.surgery?.surgeryDate) {
    patient.ops.status = "CLOSED";
  } else if (totalAmount > 0 && pendingAmount != null && pendingAmount <= 0) {
    patient.ops.status = "SURGERY_BOOKED";
  } else if (amountReceived > 0) {
    patient.ops.status = "BOOKING_DONE";
  } else if (patient.counselling?.counsellor && amountReceived === 0) {
    patient.ops.status = "NOT_CONVERTED";
  } else if (isVisitDatePast) {
    patient.ops.status = "NOT_VISITED";
  } else {
    patient.ops.status = "NEW";
  }
});

patientSchema.index({ "personal.branch": 1, "ops.status": 1 });
patientSchema.index({ "personal.branch": 1, "personal.visitDate": -1 });
patientSchema.index({ "surgery.surgeryDate": -1 });
patientSchema.index({ "counselling.counsellor": 1 });
patientSchema.index({ "personal.reference": 1 });
patientSchema.index({ "personal.name": 1 });
// §3.1 — without this the employee-side aggregation ($match on incentives.employee before
// $unwind — see src/app/api/employees/[id]/incentives/route.js) scans every patient.
patientSchema.index({ "incentives.employee": 1, "incentives.isCancelled": 1 });
patientSchema.index({
  "personal.name": "text",
  "personal.phone": "text",
  "personal.email": "text",
});

// Reuse the compiled model rather than recompiling it, matching every other model in this
// directory. This previously did `delete mongoose.models["Patient"]` first, which threw away the
// model cache on each module evaluation and made Mongoose re-issue createIndexes for all seven
// indexes below (including the text index) against the hottest collection in the app.
export default mongoose.models.Patient || mongoose.model("Patient", patientSchema);
