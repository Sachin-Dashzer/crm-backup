// src/app/api/owner/workforce-summary/route.js
//
// Thin proxy to callby's GET /api/leads/workforce-summary — shared by three Owner screens
// (Live Workforce & Queue, Agent 360°, TL & Manager), so the fetch/error handling lives once
// here instead of three times. Returns callby's response body unchanged; each page reads
// whatever fields it needs (per-agent rows, teamTotals, etc.) from the same payload.

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

    const data = await fetchCallby("/api/leads/workforce-summary");
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("workforce-summary callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("workforce-summary error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
