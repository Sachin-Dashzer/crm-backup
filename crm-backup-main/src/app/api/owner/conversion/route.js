// src/app/api/owner/conversion/route.js
//
// Conversion Intelligence: Patient.ops.status distribution (the real funnel) + Leads.tag source
// breakdown. No callby dependency — everything here is our own DB. Deliberately excludes
// "CONSULTED" from ops.status enum: the Patient pre-save hook (src/models/Patient.js) never
// actually assigns it — every branch of that hook's if/else chain resolves to one of NEW /
// NOT_VISITED / NOT_CONVERTED / BOOKING_DONE / SURGERY_BOOKED / CLOSED — so it would always
// render as a permanent zero row.
//
// No "Best Contact Time Heatmap" here — that would need hour-of-day connect-rate data, which
// doesn't exist anywhere in this system (not in Patient/Leads, not in callby's current
// endpoints). Faking it was explicitly ruled out.
//
// Leads has no branch field (see src/app/api/owner/marketing-summary/route.js's identical
// note) — the source breakdown is date-scoped but not branch-scoped, and the response says so.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Leads from "@/models/Leads";

const FUNNEL_STATUSES = ["NEW", "NOT_VISITED", "NOT_CONVERTED", "BOOKING_DONE", "SURGERY_BOOKED", "CLOSED"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All", from, to } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    const statusAgg = await Patient.aggregate([
      { $match: { ...branchFilter, "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
      { $group: { _id: "$ops.status", count: { $sum: 1 } } },
    ]);
    const statusCounts = Object.fromEntries(statusAgg.map((r) => [r._id, r.count]));
    const funnel = FUNNEL_STATUSES.map((status) => ({ status, count: statusCounts[status] || 0 }));

    const tagAgg = await Leads.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      { $group: { _id: "$tag", count: { $sum: 1 } } },
    ]);
    const sources = tagAgg
      .map((r) => ({ tag: r._id || "(untagged)", count: r.count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      funnel,
      sources,
      note: branch !== "All" ? `Source breakdown is not branch-scoped — the Leads collection has no branch field.` : null,
    });
  } catch (err) {
    console.error("owner conversion error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
