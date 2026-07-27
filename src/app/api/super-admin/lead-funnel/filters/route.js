// src/app/api/super-admin/lead-funnel/filters/route.js
//
// GET — returns { agents: [{id, name, team}], teams: [string] } for the
// filter bar's multiselects. Proxied live from Callby on every load — no
// caching, so a newly added agent shows up immediately.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const CALLBY_API_URL = process.env.CALLBY_API_URL;
const CALLBY_SERVICE_TOKEN = process.env.CALLBY_SERVICE_TOKEN;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    if (!CALLBY_API_URL || !CALLBY_SERVICE_TOKEN) {
      return NextResponse.json(
        { success: false, message: "CALLBY_API_URL / CALLBY_SERVICE_TOKEN not configured" },
        { status: 500 }
      );
    }

    const authHeader = { Authorization: `Bearer ${CALLBY_SERVICE_TOKEN}` };

    const [employeesRes, teamsRes] = await Promise.all([
      fetch(`${CALLBY_API_URL}/api/employees?limit=500`, { headers: authHeader, cache: "no-store" }),
      fetch(`${CALLBY_API_URL}/api/employees/tl-names`, { headers: authHeader, cache: "no-store" }),
    ]);

    if (!employeesRes.ok || !teamsRes.ok) {
      throw new Error("Failed to fetch filter options from Callby");
    }

    const employeesJson = await employeesRes.json();
    const teamsJson = await teamsRes.json();

    const agents = (employeesJson.data || []).map((e) => ({
      id: e._id,
      name: e.name,
      team: e.tlName || null,
    }));

    return NextResponse.json({ success: true, agents, teams: teamsJson.data || [] });
  } catch (err) {
    console.error("lead-funnel filters route error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
