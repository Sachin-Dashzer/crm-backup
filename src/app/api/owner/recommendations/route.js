// src/app/api/owner/recommendations/route.js
//
// Rule-based findings for the Owner Command Center's "AI Recommendations" panel — every
// finding here comes from an actual Patient query, never invented text.
//
// POST body: { branch?: string }
//
// Rule implemented: "stalled bookings" — a patient has paid something (payments.amountReceived
// > 0, i.e. at least a token/booking amount was collected) but has no surgery date scheduled
// yet, and their visit was 14+ days ago. That's real money collected with nothing booked —
// a genuine conversion leak, not a period-scoped metric, so `branch` is the only filter (no
// date range): this is a standing "is anything stuck right now" check, not a per-period stat.
//
// visitDate also has an upper bound (180 days). Without one this rule pulls in decades-old
// records with placeholder/garbage visitDate values (seen in production data as far back as
// 1995) that were never meaningfully populated — real fields, but not a real "stuck this
// quarter" signal. Bounding the window keeps every result something a manager can actually
// act on today.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

const STALLED_BOOKING_MIN_DAYS = 14;
const STALLED_BOOKING_MAX_DAYS = 180;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All" } = await req.json();
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    const minCutoff = new Date(Date.now() - STALLED_BOOKING_MAX_DAYS * 24 * 60 * 60 * 1000);
    const maxCutoff = new Date(Date.now() - STALLED_BOOKING_MIN_DAYS * 24 * 60 * 60 * 1000);

    const stalledBookingMatch = {
      ...branchFilter,
      "payments.amountReceived": { $gt: 0 },
      $or: [{ "surgery.surgeryDate": null }, { "surgery.surgeryDate": { $exists: false } }],
      "personal.visitDate": { $gte: minCutoff, $lte: maxCutoff },
    };

    const [stalledBookingsCount, stalledBookings] = await Promise.all([
      Patient.countDocuments(stalledBookingMatch),
      Patient.find(stalledBookingMatch)
        .select(
          "personal.name personal.phone personal.visitDate personal.branch payments.amountReceived payments.pendingAmount ops.status"
        )
        .sort({ "personal.visitDate": 1 })
        .limit(50)
        .lean(),
    ]);

    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    return NextResponse.json({
      success: true,
      stalledBookingsCount,
      stalledBookings: stalledBookings.map((p) => ({
        id: String(p._id),
        name: p.personal?.name || "Unknown",
        phone: p.personal?.phone || "",
        branch: p.personal?.branch || "",
        visitDate: p.personal?.visitDate,
        daysWaiting: p.personal?.visitDate
          ? Math.floor((now - new Date(p.personal.visitDate).getTime()) / dayMs)
          : null,
        amountReceived: p.payments?.amountReceived || 0,
        pendingAmount: p.payments?.pendingAmount || 0,
        status: p.ops?.status || "",
      })),
    });
  } catch (err) {
    console.error("owner recommendations error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
