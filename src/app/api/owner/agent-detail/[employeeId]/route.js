// src/app/api/owner/agent-detail/[employeeId]/route.js
//
// Proxy to callby's agent-detail lookup, used by Agent 360°'s row-click Modal.
//
// CORRECTION: an earlier version of this route translated employeeId into a query param
// (?employeeId=X) based on a live probe against the deployed CALLBY_API_URL, which 404'd on
// /api/leads/agent-detail/<id> and 401'd on the bare path — read at the time as "the route only
// accepts a query param". Reading the actual callby source (backend/routes/agentDetail.js)
// shows that's wrong: the real route is `/agent-detail/:employeeId`, a genuine path param. The
// deployed API most likely just lags the repo (or the probe's all-zero ObjectId hit an edge
// case). Fixed here to call it as a path param, matching the real source.
//
// Response shape (confirmed against backend/routes/agentDetail.js): callby returns
// { success, data: { employee, calls, leads, recentCalls, recentLeadChangelog } }, unwrapped
// here.
//   employee: { id, name, tlName, isActive, dailyTarget }
//   calls:    same shape as workforce-summary's per-agent calls
//   leads:    same shape as workforce-summary's per-agent leads
//   recentCalls:          [{ contactName, contactNumber, callType, duration, timestamp, callStatus }]
//   recentLeadChangelog:  [{ leadName, action, changedAt, details }]

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchCallby, CallbyError } from "@/lib/callby";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const { employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ success: false, message: "employeeId is required" }, { status: 400 });
    }

    const result = await fetchCallby(`/api/leads/agent-detail/${employeeId}`);
    return NextResponse.json({
      success: true,
      employee: result.data?.employee || null,
      calls: result.data?.calls || null,
      leads: result.data?.leads || null,
      recentCalls: result.data?.recentCalls || [],
      recentLeadChangelog: result.data?.recentLeadChangelog || [],
    });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("agent-detail callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("agent-detail error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
