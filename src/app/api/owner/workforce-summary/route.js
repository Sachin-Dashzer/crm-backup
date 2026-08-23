// src/app/api/owner/workforce-summary/route.js
//
// Thin proxy to callby's GET /api/leads/workforce-summary — shared by three Owner screens
// (Live Workforce & Queue, Agent 360°, TL & Manager), so the fetch/error handling lives once
// here instead of three times.
//
// Response shape (confirmed against the real callby source, backend/routes/workforceSummary.js
// + backend/lib/workforceStats.js — CALLBY_SERVICE_TOKEN is expired so this couldn't be
// confirmed against a live payload, but the route implementation is unambiguous):
//   callby returns { success, data: { generatedAt, range, agents, teamTotals } }. This route
//   unwraps that envelope so callers here just read `agents`/`teamTotals` directly.
//     agents:     [{ employeeId, name, tlName, isActive, dailyTarget,
//                     calls: { total, outgoing, incoming, missed, rejected, connected,
//                              connectRate, totalDurationSeconds },
//                     leads: { assigned, byStatus: { new, contacted, not_connected, interested,
//                              not_interested, follow_up, booking_done, converted, lost } } }]
//     teamTotals: [{ tlName, agentCount, calls: {...same shape...}, leads: {...same shape...} }]

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchCallby, CallbyError } from "@/lib/callby";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const result = await fetchCallby("/api/leads/workforce-summary");
    return NextResponse.json({
      success: true,
      generatedAt: result.data?.generatedAt,
      range: result.data?.range,
      agents: result.data?.agents || [],
      teamTotals: result.data?.teamTotals || [],
    });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("workforce-summary callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("workforce-summary error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
