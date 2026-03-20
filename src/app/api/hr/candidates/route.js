import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Interviewer from "@/models/Interviewer";

// ── CORS helper ────────────────────────────────────────────────────────────────
function withCORS(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// ── OPTIONS — preflight (required for cross-origin POST/GET with custom headers)
export async function OPTIONS() {
  return withCORS(new NextResponse(null, { status: 204 }));
}

// ── GET — list candidates with optional filters ────────────────────────────────
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status   = searchParams.get("status");
    const position = searchParams.get("position");
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const search   = searchParams.get("search");

    const query = {};

    if (status)   query.status   = status;
    if (position) query.position = { $regex: position, $options: "i" };

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const candidates = await Interviewer.find(query)
      .populate("assignedHr", "name")
      .sort({ createdAt: -1 });

    return withCORS(
      NextResponse.json({ success: true, candidates })
    );
  } catch (err) {
    console.error("Candidates GET error:", err);
    return withCORS(
      NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
    );
  }
}

// ── POST — create single candidate OR bulk import an array ────────────────────
export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    // ── Bulk import ────────────────────────────────────────────────────────────
    if (Array.isArray(body)) {
      if (body.length === 0) {
        return withCORS(
          NextResponse.json({ success: false, message: "Array is empty" }, { status: 400 })
        );
      }

      if (body.length > 2000) {
        return withCORS(
          NextResponse.json(
            { success: false, message: "Maximum 2000 candidates per request" },
            { status: 400 }
          )
        );
      }

      // Validate every item has name + position
      const invalid = body
        .map((item, i) => (!item.name || !item.position ? i : null))
        .filter((i) => i !== null);

      if (invalid.length > 0) {
        return withCORS(
          NextResponse.json(
            {
              success: false,
              message: `Missing name or position at indices: ${invalid.slice(0, 10).join(", ")}${invalid.length > 10 ? "…" : ""}`,
            },
            { status: 400 }
          )
        );
      }

      // Insert in chunks of 200 — ordered:false so one bad doc doesn't stop the rest
      const CHUNK_SIZE = 200;
      let inserted = 0;
      const errors = [];

      for (let i = 0; i < body.length; i += CHUNK_SIZE) {
        const chunk = body.slice(i, i + CHUNK_SIZE);
        try {
          const result = await Interviewer.insertMany(chunk, { ordered: false });
          inserted += result.length;
        } catch (err) {
          inserted += err.insertedDocs?.length ?? 0;
          err.writeErrors?.forEach((e) =>
            errors.push({ index: i + e.index, message: e.errmsg })
          );
        }
      }

      return withCORS(
        NextResponse.json(
          {
            success: true,
            inserted,
            skipped: body.length - inserted,
            ...(errors.length > 0 && { errors: errors.slice(0, 20) }),
          },
          { status: 201 }
        )
      );
    }

    // ── Single create ──────────────────────────────────────────────────────────
    if (!body.name || !body.position) {
      return withCORS(
        NextResponse.json(
          { success: false, message: "Name and position are required" },
          { status: 400 }
        )
      );
    }

    const VALID_STATUSES = ["Applied", "Interview Scheduled", "Selected", "Rejected", "On Hold"];
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      body.status = "Applied";
    }

    const candidate = await Interviewer.create(body);
    return withCORS(
      NextResponse.json({ success: true, candidate }, { status: 201 })
    );

  } catch (err) {
    console.error("Candidates POST error:", err);
    return withCORS(
      NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
    );
  }
}