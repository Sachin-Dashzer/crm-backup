import mongoose from "mongoose";
import { normalizePhone } from "@/lib/phone";

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
  { timestamps: true }
);

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
