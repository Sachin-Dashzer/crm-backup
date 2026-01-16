import mongoose from "mongoose";
import Transactions from "./Transactions";

const VendorSchema = new mongoose.Schema({
  name: String,
  contact: Number,
  email: String,
  address: String,
  gstNumber: String,
  DealsIn: String,
  Transactions: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transactions"
  }
});

export default mongoose.Schema.Vendor || mongoose.model("Vendor", VendorSchema);
