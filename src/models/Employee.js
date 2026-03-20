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
    ref: "Patient"  }]
}, {
  timestamps: true
});


export default mongoose.models.Employee || mongoose.model('Employee', employeeSchema);