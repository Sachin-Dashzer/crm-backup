
const CALLBY_API_URL = process.env.CALLBY_API_URL;
const CALLBY_SERVICE_TOKEN = process.env.CALLBY_SERVICE_TOKEN;

export class CallbyError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CallbyError";
    this.status = status;
  }
}

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
    }
    throw new CallbyError(message, res.status);
  }

  return res.json();
}
