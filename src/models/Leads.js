import mongoose from "mongoose";

const leadsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      trim: true,
    },
    visitPlan: {
      type: String,
      trim: true,
    },
    visitDate: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      enum: ["Google Leads", "Meta Leads", "Form Leads", "Collab Leads", ""],
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

leadsSchema.index({ tag: 1, createdAt: -1 });
leadsSchema.index({ createdAt: -1 });
leadsSchema.index({ phone: 1 });

export default mongoose.models.Leads || mongoose.model("Leads", leadsSchema);
