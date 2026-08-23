// src/app/api/owner/agent-detail/[employeeId]/route.js
//
// Proxy to callby's agent-detail lookup, used by Agent 360°'s row-click Modal. Exposed here as
// a path param (/api/owner/agent-detail/:employeeId) to match how the rest of this app's
// dynamic routes read — callby's own route takes employeeId as a query param
// (/api/leads/agent-detail?employeeId=X), confirmed by probing the live API: a path-segment
// version 404'd with a routing-level "Route not found", while the bare path plus ?employeeId=
// hit auth middleware (401 "Invalid token") — i.e. the route exists, only the query-param shape
// does. Translated here so callers on our side don't need to know that detail.

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

    const data = await fetchCallby("/api/leads/agent-detail", { params: { employeeId } });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("agent-detail callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("agent-detail error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
