// src/app/api/owner/live-workforce/route.js
//
// Combines callby's workforce-summary (per-agent status/calls) and retry-queue (bucketed into
// P0–P4) for the Live Workforce & Queue screen. Both calls are independent — if one fails, the
// other's data still ships, with the failure surfaced per-section rather than failing the whole
// request.
//
// Queue bucketing rule (verbatim from spec):
//   P0: status: 'interested' with followUpDate in the past
//   P1: status: 'contacted', connectedCallCount > 0, lastCallAt within 7 days
//   P2: status: 'new', attempts: 0
//   P3: status: 'not_connected', due for retry
//   P4: everything else still open
//
// This is NOT re-derived here. Reading callby's actual source (backend/routes/retryQueue.js,
// computePriority()) shows /api/leads/retry-queue already implements exactly this rule
// server-side and returns a `priority` field ("P0"–"P4") on every lead — including a detail
// this spec's prose glossed over: "due for retry" (P3) is specifically "no lastCallAt yet, OR
// more than 4 hours since the last call", not just "any not_connected item"; and a lead that
// doesn't satisfy ANY tier's condition is excluded from the feed entirely (not lumped into P4).
// An earlier version of this route re-implemented the rule from the prose spec alone (before
// the real source was available) and got both of those wrong. Grouping by callby's own
// `priority` field instead means this can never drift from their canonical implementation again.

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
