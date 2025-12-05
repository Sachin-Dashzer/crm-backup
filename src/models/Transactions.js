import mongoose from "mongoose";
import Patient from "./Patient";

const transactionSchema = new mongoose.Schema({
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
      "GFC",
      "Medicine",
      "Other",
    ],
  },
  paymentType: {
    type: String,
    enum: ["Booking", "Pending", "Full-payment", "Other"],
  },
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
    default: Date.now(),
  },
  expenseGiver: String,
  remarks: String,
});

export default mongoose.models.Transactions ||
  mongoose.model("Transactions", transactionSchema);
