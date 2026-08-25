// src/app/api/owner/forecast/route.js
//
// Real 30-day averages to seed the Forecast & Staffing slider calculator's default positions —
// not hardcoded demo numbers.
//
//   leadsPerDay — Leads created in the last 30 days ÷ 30 (internal, always available)
//   consultRate — of Patients whose visitDate falls in the last 30 days, the fraction whose
//                 ops.status is NOT NEW/NOT_VISITED (i.e. they were actually seen/counselled)
//                 (internal, always available)
//   agents, connectRate — from callby's workforce-summary. This is the same endpoint
//                 src/app/api/owner/workforce-summary/route.js proxies, called directly here
//                 rather than through that route since we only need two aggregate numbers, not
//                 the full per-agent payload. If callby is unreachable (it currently is —
//                 CALLBY_SERVICE_TOKEN is expired, see the note in
//                 src/app/api/owner/live-workforce/route.js), these two fall back to round
//                 placeholder numbers and `liveDataAvailable: false` tells the client so the UI
//                 can say so rather than presenting a guess as if it were measured.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Leads from "@/models/Leads";
import Patient from "@/models/Patient";
import { fetchCallby } from "@/lib/callby";

const FALLBACK_AGENTS = 10;
const FALLBACK_CONNECT_RATE = 40;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leadsCount, visitedCount, consultedCount] = await Promise.all([
      Leads.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Patient.countDocuments({ "personal.visitDate": { $gte: thirtyDaysAgo } }),
      Patient.countDocuments({
        "personal.visitDate": { $gte: thirtyDaysAgo },
        "ops.status": { $nin: ["NEW", "NOT_VISITED"] },
      }),
    ]);

    const leadsPerDay = Math.round((leadsCount / 30) * 10) / 10;
    const consultRate = visitedCount > 0 ? Math.round((consultedCount / visitedCount) * 100) : FALLBACK_CONNECT_RATE;

    let agents = FALLBACK_AGENTS;
    let connectRate = FALLBACK_CONNECT_RATE;
    let liveDataAvailable = false;

    try {
      const workforce = await fetchCallby("/api/leads/workforce-summary");
      const agentList = workforce?.data?.agents || [];
      if (agentList.length > 0) {
        agents = agentList.length;
        const totalCalls = agentList.reduce((s, a) => s + (a.calls?.total || 0), 0);
        const totalConnected = agentList.reduce((s, a) => s + (a.calls?.connected || 0), 0);
        if (totalCalls > 0) {
          connectRate = Math.round((totalConnected / totalCalls) * 100);
          liveDataAvailable = true;
        }
      }
    } catch {
      // callby unreachable — keep fallback defaults, liveDataAvailable stays false
    }

    return NextResponse.json({
      success: true,
      defaults: { leadsPerDay, connectRate, consultRate, agents },
      liveDataAvailable,
      note: liveDataAvailable
        ? null
        : "Agent count and connect rate couldn't be loaded from the live workforce system — using round placeholder defaults for those two only. Leads/day and consult rate are real 30-day figures.",
    });
  } catch (err) {
    console.error("owner forecast error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
