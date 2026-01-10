import mongoose from "mongoose";
import Patient from "./Patient";

const MedicineSchema = new mongoose.Schema(
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
        vendor: {
          type: mongoose.type.Schema,
          ref: Vendor,
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

        date: {
          type: Date,
        },
        patient: {
          type: mongoose.type.Schema,
          ref: Patient,
        },
        quantity: {
          type: Number,
        },
        otherPatient:{
            name : String,
            contact : number
        }
      },
    ],

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
  },
  { timestamps: true }
);

export default mongoose.models.Medicine ||
  mongoose.model("Medicine", MedicineSchema);
