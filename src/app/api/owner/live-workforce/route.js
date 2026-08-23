// src/app/api/owner/live-workforce/route.js
//
// Combines callby's workforce-summary (per-agent status/calls) and retry-queue (bucketed into
// P0–P4) for the Live Workforce & Queue screen. Both calls are independent — if one fails, the
// other's data still ships, with the failure surfaced per-section rather than failing the whole
// request (a callby outage on one endpoint shouldn't blank out data we successfully got from
// the other).
//
// NOTE ON FIELD NAMES: CALLBY_SERVICE_TOKEN is currently expired (confirmed live — every callby
// call in this app, including the pre-existing lead-funnel bridge, currently 401s), so the exact
// JSON shape of workforce-summary/retry-queue could not be verified against a real response.
// Field access below is defensive (multiple fallback names, safe on missing data) and modeled on
// the lead shape src/app/api/super-admin/lead-funnel/route.js already consumes from this same
// backend (status, attempts, connectedCallCount, agent.name, agent.team). Re-verify against a
// real payload once the token is refreshed.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchCallby, CallbyError } from "@/lib/callby";

function extractList(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

// Queue bucketing rule (verbatim from spec):
//   P0: status: 'interested' with followUpDate in the past
//   P1: status: 'contacted', connectedCallCount > 0, lastCallAt within 7 days
//   P2: status: 'new', attempts: 0
//   P3: status: 'not_connected', due for retry
//   P4: everything else still open
//
// "due for retry" (P3) isn't checked against a separate flag — this whole feed IS callby's
// retry-queue, i.e. already filtered to what's due. So P3 is every remaining not_connected item.
function bucketQueue(items) {
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const buckets = { P0: [], P1: [], P2: [], P3: [], P4: [] };

  for (const item of items) {
    const status = item.status;
    const isPastFollowUp = item.followUpDate && new Date(item.followUpDate).getTime() < now;
    const isRecentConnect = item.lastCallAt && now - new Date(item.lastCallAt).getTime() <= SEVEN_DAYS_MS;

    if (status === "interested" && isPastFollowUp) {
      buckets.P0.push(item);
    } else if (status === "contacted" && (item.connectedCallCount || 0) > 0 && isRecentConnect) {
      buckets.P1.push(item);
    } else if (status === "new" && (item.attempts || 0) === 0) {
      buckets.P2.push(item);
    } else if (status === "not_connected") {
      buckets.P3.push(item);
    } else {
      buckets.P4.push(item);
    }
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

    const agents =
      agentsResult.status === "fulfilled" ? extractList(agentsResult.value, ["agents", "data"]) : [];
    const agentsError =
      agentsResult.status === "rejected"
        ? agentsResult.reason instanceof CallbyError
          ? agentsResult.reason.message
          : "Failed to load agent data"
        : null;

    const queueItems =
      queueResult.status === "fulfilled" ? extractList(queueResult.value, ["leads", "queue", "data"]) : [];
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
      queue: bucketQueue(queueItems),
      queueError,
    });
  } catch (err) {
    console.error("live-workforce error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
