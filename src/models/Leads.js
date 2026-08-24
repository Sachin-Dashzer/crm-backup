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

// No indexes existed on this collection at all until now — every tag/date-scoped query (the
// dashboard's totalLeads count, the marketing-summary and conversion-intelligence routes) was a
// full collection scan. This is the exact {tag, createdAt} shape those routes filter on, plus
// createdAt alone for date-range-only queries and phone for the marketing-summary lead→patient
// join.
leadsSchema.index({ tag: 1, createdAt: -1 });
leadsSchema.index({ createdAt: -1 });
leadsSchema.index({ phone: 1 });

export default mongoose.models.Leads || mongoose.model("Leads", leadsSchema);
