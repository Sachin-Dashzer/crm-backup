import mongoose from "mongoose";
import Patient from "./Patient";

const stockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    totalQuantity: {
      type: Number,
      default: 0,
    },

    purchase: [
      {
        price: {
          type: Number,
          required: true,
        },

        date: {
          type: Date,
        },
        vender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        quantity: {
          type: Number,
        },
      },
    ],
    sell: [
      {
        price: {
          type: Number,
          required: true,
        },

        discount: {
          type: Number,
        },

        date: {
          type: Date,
        },
        patient: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Patient",
        },
        quantity: {
          type: Number,
        },
        otherPatient: {
          name: String,
          contact: Number,
        },
      },
    ],

    transactions: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transactions",
    },

    gstNo: {
      type: String,
    },

    weight: {
      type: Number,
    },

    unit: {
      type: String,
    },

    mrp: {
      type: Number,
      required: true,
    },

    expiry: {
      type: Date,
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
  { timestamps: true }
);

export default mongoose.models.Stock || mongoose.model("Stock", stockSchema);