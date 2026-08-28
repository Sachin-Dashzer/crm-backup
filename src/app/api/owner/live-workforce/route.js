
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchCallby, CallbyError } from "@/lib/callby";

function bucketQueue(leads) {
  const buckets = { P0: [], P1: [], P2: [], P3: [], P4: [] };
  for (const lead of leads) {
    if (buckets[lead.priority]) buckets[lead.priority].push(lead);
  }
  return buckets;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const [agentsResult, queueResult] = await Promise.allSettled([
      fetchCallby("/api/leads/workforce-summary"),
      fetchCallby("/api/leads/retry-queue"),
    ]);

    const agents = agentsResult.status === "fulfilled" ? agentsResult.value.data?.agents || [] : [];
    const agentsError =
      agentsResult.status === "rejected"
        ? agentsResult.reason instanceof CallbyError
          ? agentsResult.reason.message
          : "Failed to load agent data"
        : null;

    const queueLeads = queueResult.status === "fulfilled" ? queueResult.value.data?.leads || [] : [];
    const queueError =
      queueResult.status === "rejected"
        ? queueResult.reason instanceof CallbyError
          ? queueResult.reason.message
          : "Failed to load retry-queue data"
        : null;

    return NextResponse.json({
      success: true,
      agents,
      agentsError,
      queue: bucketQueue(queueLeads),
      queueError,
    });
  } catch (err) {
    console.error("live-workforce error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
