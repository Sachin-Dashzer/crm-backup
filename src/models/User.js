import mongoose from "mongoose";
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: {
    type: String,
    enum: ['owner', 'super-admin', 'admin', 'sales', 'reception', 'collab', 'surgery', 'counsellor', 'stock', 'hr'],
    default: 'reception',
    lowercase: true,
  },
  branch: { type: String },
  lastLogin: Date,
  
  sessionVersion: { 
    type: Number, 
    default: 0,
    select: false
  },
  
  passwordChangedAt: Date,
  
}, { timestamps: true });

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);

  if (!this.isNew) {
    this.sessionVersion = (this.sessionVersion || 0) + 1;
    this.passwordChangedAt = Date.now();
  }
});

// Method to compare passwords
userSchema.methods.correctPassword = async function (candidatePass, userPass) {
  return await bcrypt.compare(candidatePass, userPass);
};

// Method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

export default mongoose.models.User || mongoose.model('User', userSchema);