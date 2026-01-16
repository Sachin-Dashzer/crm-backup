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

        discount: {
          type : Number,

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
    
    transactions: {
      type : mongoose.Schema.Types.ObjectId,
      ref: "Transactions"
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
  },
  { timestamps: true }
);

export default mongoose.models.Stock ||
  mongoose.model("Stock", stockSchema);
