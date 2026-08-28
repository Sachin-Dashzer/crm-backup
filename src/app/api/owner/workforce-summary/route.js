
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
    return NextResponse.json({
      success: true,
      generatedAt: result.data?.generatedAt,
      range: result.data?.range,
      agents: result.data?.agents || [],
      teamTotals: result.data?.teamTotals || [],
    });
  } catch (err) {
    if (err instanceof CallbyError) {
      console.error("workforce-summary callby error:", err.message);
      return NextResponse.json({ success: false, message: err.message }, { status: err.status === 500 ? 500 : 502 });
    }
    console.error("workforce-summary error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
