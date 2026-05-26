import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    transactionCategory: {
      type: String,
      enum: ["TRANSPLANT", "SERVICE", "MEDICINE", "EXPENSE"],
    },

    batchId: {
      type: String,
      index: true,
    },

    patientName: {
      type: String,
    },
    patientPhone: {
      type: String,
    },

    quantity: {
      type: Number,
    },
    perSessionCost: {
      type: Number,
    },

    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stock",
    },
    perUnitCost: {
      type: Number,
    },

    expenseGiver: {
      type: {
        type: String,
        enum: ["VENDOR", "MANUAL"],
      },
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
      },
      name: String,
    },

    costType: {
      type: String,
      required: true,
      enum: ["Revenue", "Expenses"],
    },

    method: {
      type: String,
      enum: ["upi", "cash", "card", "banking", "Loan", "other"],
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },

    procedure: {
      type: String,
      enum: [
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
      ],
    },

    paymentType: {
      type: String,
      enum: ["Booking", "Pending", "Full-payment", "Other"],
    },

    paymentId: String,

    branch: {
      type: String,
      enum: ["Delhi", "Mumbai", "Hyderabad"],
    },

    expense: String,

    discount: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    expenseGiverOld: String,

    remarks: String,

    stock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stock",
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
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
        updatedFields: [
          {
            name: String,
            previousValue: String,
            newValue: String,
          },
        ],
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
  { timestamps: true },
);

transactionSchema.pre("save", async function () {
  if (!this.transactionCategory) {
    if (this.costType === "Revenue") {
      if (
        ["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"].includes(
          this.procedure,
        )
      ) {
        this.transactionCategory = "TRANSPLANT";
      } else if (["PRP", "GFC" , "Alopecia", "Headwash", "Canacot",].includes(this.procedure)) {
        this.transactionCategory = "SERVICE";
      } else if (this.procedure === "Medicine") {
        this.transactionCategory = "MEDICINE";
      }
    } else if (this.costType === "Expenses") {
      this.transactionCategory = "EXPENSE";
    }
  }

  if (this.transactionCategory === "EXPENSE" && this.expenseGiver) {
    this.costType = "Expenses";
    this.expenseGiverOld =
      this.expenseGiver.type === "VENDOR"
        ? `Vendor: ${this.expenseGiver.name}`
        : this.expenseGiver.name;
  } else if (this.transactionCategory !== "EXPENSE") {
    this.costType = "Revenue";
  }
});

transactionSchema.virtual("medicineDetails", {
  ref: "Stock",
  localField: "medicineId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("patientDetails", {
  ref: "Patient",
  localField: "patient",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.virtual("vendorDetails", {
  ref: "Vendor",
  localField: "expenseGiver.vendorId",
  foreignField: "_id",
  justOne: true,
});

transactionSchema.set("toJSON", { virtuals: true });
transactionSchema.set("toObject", { virtuals: true });

transactionSchema.index({ date: -1 });
transactionSchema.index({ costType: 1, date: -1 });
transactionSchema.index({ branch: 1, date: -1 });
transactionSchema.index({ branch: 1, costType: 1, date: -1 });
transactionSchema.index({ patient: 1 });

export default mongoose.models.Transactions ||
  mongoose.model("Transactions", transactionSchema);
