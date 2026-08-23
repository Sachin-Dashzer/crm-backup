// src/app/api/owner/retry-queue/route.js
//
// Thin proxy to callby's GET /api/leads/retry-queue — shared by Live Workforce & Queue (for the
// P0–P4 bucketing) and Retry & Recovery (straight table). Returns callby's response unchanged.

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

    const data = await fetchCallby("/api/leads/retry-queue");
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("retry-queue callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("retry-queue error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
