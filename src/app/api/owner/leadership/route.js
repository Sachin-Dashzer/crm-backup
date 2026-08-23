// src/app/api/owner/leadership/route.js
//
// TL ranking for the "TL & Manager" screen — sourced entirely from callby's workforce-summary
// teamTotals, grouped by tlName (merging duplicate tlName entries if callby ever returns more
// than one row per TL, e.g. split by date). There's no real "Sales Manager" concept anywhere in
// this data model, so this route (and the page consuming it) only ever produces the TL table —
// no second, invented table.
//
// Field names for each teamTotals row are best-guess (see the note in live-workforce/route.js —
// the callby token is currently expired, so a real payload couldn't be inspected). Every numeric
// field is read defensively and just omitted from a TL's row if callby doesn't send it.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchCallby, CallbyError } from "@/lib/callby";

const METRIC_KEYS = ["leads", "connectedCallCount", "converted", "conversionRate"];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const data = await fetchCallby("/api/leads/workforce-summary");
    const teamTotals = Array.isArray(data?.teamTotals) ? data.teamTotals : [];

    const byTl = new Map();
    for (const row of teamTotals) {
      const tlName = row.tlName || row.tl || "Unassigned";
      if (!byTl.has(tlName)) byTl.set(tlName, { tlName });
      const acc = byTl.get(tlName);
      for (const key of METRIC_KEYS) {
        if (row[key] == null) continue;
        acc[key] = (acc[key] || 0) + Number(row[key]);
      }
    }

    // conversionRate doesn't sum meaningfully across merged rows — recompute it from the
    // merged converted/leads if both are present, rather than adding two percentages together.
    const tlRows = [...byTl.values()].map((r) => ({
      ...r,
      conversionRate: r.leads > 0 && r.converted != null ? Math.round((r.converted / r.leads) * 100) : r.conversionRate ?? null,
    }));

    tlRows.sort((a, b) => (b.conversionRate ?? -1) - (a.conversionRate ?? -1) || (b.leads ?? 0) - (a.leads ?? 0));

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
