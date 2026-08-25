// src/app/api/owner/retry-queue/route.js
//
// Thin proxy to callby's GET /api/leads/retry-queue — shared by Live Workforce & Queue (for the
// P0–P4 lanes) and Retry & Recovery (straight table).
//
// Response shape (confirmed against backend/routes/retryQueue.js): callby returns
// { success, data: { generatedAt, leads } }, unwrapped here. Each lead already carries a
// `priority` ("P0"–"P4") computed server-side by callby itself — see
// src/app/api/owner/live-workforce/route.js for why that field is used directly rather than
// re-derived on this side.
//   leads: [{ id, name, phone, status, attempts, lastCallAt, lastCallType, followUpDate,
//              assignedTo: { id, name, tlName } | null, ageHours, priority }]

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

    const result = await fetchCallby("/api/leads/retry-queue");
    return NextResponse.json({
      success: true,
      generatedAt: result.data?.generatedAt,
      leads: result.data?.leads || [],
    });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("retry-queue callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("retry-queue error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
