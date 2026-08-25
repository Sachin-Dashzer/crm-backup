import mongoose from "mongoose";
import Transactions from "./Transactions";

const VendorSchema = new mongoose.Schema(
  {
    name: String,
    contact: Number,
    email: String,
    address: String,
    gstNumber: String,
    DealsIn: String,
    Transactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transactions",
    }],
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

export default mongoose.models.Vendor || mongoose.model("Vendor", VendorSchema);  