import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum : ["Agent", "Counsellor" , "Doctor" , "Technician" , "Implanter" , "Others", "Hr"],
    trim: true
  },
  isactive : {
    type: Boolean,
    default: true
  },
  patient: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"  }],
  // Current base-pay info, used to pre-fill the expense form's Salary section.
  // NOT where individual salary payments/history live — see Payable + Transactions.
  salaryStructure: {
    baseSalary: { type: Number, default: 0, min: 0 },
    salaryType: { type: String, enum: ["Monthly", "Daily", "Hourly"], default: "Monthly" },
    effectiveFrom: { type: Date, default: Date.now }
  },
  // Usual per-patient incentive amount, used to pre-fill the Incentive
  // sub-tab's amount field — overridable per entry.
  incentiveRate: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true
});


export default mongoose.models.Employee || mongoose.model('Employee', employeeSchema);