import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    personal: {
      name: String,
      phone: {
        type: String,
        unique: true,
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
          type: { type: String, enum: ["PRP", "GFC"], default: "PRP" },
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

patientSchema.pre("save", function (next) {
  const patient = this;
  const currentDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const isVisitDatePast =
    patient.personal?.visitDate && patient.personal.visitDate < currentDate;

  if (!patient.ops) {
    patient.ops = {};
  }

  if (patient.counselling?.finlpackage) {
    patient.payments = patient.payments || {};
    patient.payments.totalAmount = patient.counselling.finlpackage;
  }
  if (patient.counselling?.finlpackage) {
    patient.payments = patient.payments || {};
    patient.payments.pendingAmount =
      patient.counselling.finlpackage -
      patient.payments.amountReceived -
      patient.payments.discount;
  }

  // Check if doctor array has any entries
  const hasDoctor =
    patient.surgery?.doctor && patient.surgery.doctor.length > 0;

  if (hasDoctor) {
    patient.ops.status = "CLOSED";
  } else if (
    patient.counselling?.counsellor &&
    patient.counselling?.readyForSurgery === false
  ) {
    patient.ops.status = "NOT_CONVERTED";
  } else if (patient.counselling?.counsellor && patient.surgery?.surgeryDate) {
    patient.ops.status = "SURGERY_BOOKED";
  } else if (patient.counselling?.counsellor) {
    patient.ops.status = "CONSULTED";
  } else if (isVisitDatePast) {
    patient.ops.status = "NOT_VISITED";
  } else {
    patient.ops.status = "NEW";
  }

  next();
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

export default mongoose.models.Patient ||
  mongoose.model("Patient", patientSchema);
