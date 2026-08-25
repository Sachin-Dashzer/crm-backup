// Shared fetch helper for the callby (call-tracking CRM) service API. Every owner cross-system
// screen that pulls live call/lead-tracking data goes through this, so the missing-config /
// non-2xx / network-failure handling only lives in one place — src/app/api/super-admin/
// lead-funnel/route.js predates this and inlines its own copy; new routes should use this one
// instead of adding a third.

const CALLBY_API_URL = process.env.CALLBY_API_URL;
const CALLBY_SERVICE_TOKEN = process.env.CALLBY_SERVICE_TOKEN;

export class CallbyError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CallbyError";
    this.status = status;
  }
}

// path is one of the routes under callby's /api/leads/* namespace — e.g. "/api/leads/workforce-summary".
export async function fetchCallby(path, { params } = {}) {
  if (!CALLBY_API_URL || !CALLBY_SERVICE_TOKEN) {
    throw new CallbyError("CALLBY_API_URL / CALLBY_SERVICE_TOKEN not configured", 500);
  }

  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const res = await fetch(`${CALLBY_API_URL}${path}${qs}`, {
    headers: { Authorization: `Bearer ${CALLBY_SERVICE_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Callby request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new CallbyError(message, res.status);
  }

  return res.json();
}
