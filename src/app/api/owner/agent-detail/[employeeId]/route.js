
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
