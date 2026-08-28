import mongoose from 'mongoose';
import { ALL_BRANCHES } from '@/lib/branches';

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
  branch: {
    type: String,
    enum: ALL_BRANCHES,
    default: "Delhi"
  },
  patient: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient"  }],
  salaryStructure: {
    baseSalary: { type: Number, default: 0, min: 0 },
    salaryType: { type: String, enum: ["Monthly", "Daily", "Hourly"], default: "Monthly" },
    effectiveFrom: { type: Date, default: Date.now }
  },
  incentiveRate: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true
});

employeeSchema.index({ role: 1, isactive: 1, branch: 1 });
employeeSchema.index({ branch: 1 });

export default mongoose.models.Employee || mongoose.model('Employee', employeeSchema);