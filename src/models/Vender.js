import mongoose from "mongoose";

const VendorSchema = new mongoose.Schema({
  name: String,
  contact: Number,
  email: String,
  address: String,
  gstNumber: String,
  DealsIn: String,
});

export default mongoose.Schema.Vendor || mongoose.model("Vendor", VendorSchema);
