// src/app/api/owner/leadership/route.js
//
// TL ranking for the "TL & Manager" screen — sourced entirely from callby's workforce-summary
// teamTotals. There's no real "Sales Manager" concept anywhere in this data model, so this
// route (and the page consuming it) only ever produces the TL table — no second, invented table.
//
// teamTotals is already grouped by tlName server-side (backend/routes/workforceSummary.js),
// each entry shaped { tlName, agentCount, calls: {total,connected,connectRate,...},
// leads: {assigned, byStatus:{...,converted,...}} } — one row per TL already, nothing left to
// merge on this side. Ranked by connectRate (call-quality), falling back to total calls handled.

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
    const teamTotals = result.data?.teamTotals || [];

    const tlRows = teamTotals
      .map((t) => ({
        tlName: t.tlName,
        agentCount: t.agentCount,
        totalCalls: t.calls?.total || 0,
        connected: t.calls?.connected || 0,
        connectRate: Math.round((t.calls?.connectRate || 0) * 100),
        leadsAssigned: t.leads?.assigned || 0,
        converted: t.leads?.byStatus?.converted || 0,
      }))
      .sort((a, b) => b.connectRate - a.connectRate || b.totalCalls - a.totalCalls);

    return NextResponse.json({ success: true, tlRows });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("leadership callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("leadership error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
