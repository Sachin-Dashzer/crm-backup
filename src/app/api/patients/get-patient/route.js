import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    /* ── Pagination & Sort ── */
    const page    = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    const limit   = Math.min(500, parseInt(searchParams.get("limit")) || 50);
    const skip    = (page - 1) * limit;
    const sortKey = searchParams.get("sortKey") || "personal.visitDate";
    const sortDir = searchParams.get("sortDir") === "asc" ? 1 : -1;

    /* ── Filter params ── */
    const search         = searchParams.get("search")         || "";
    const status         = searchParams.get("status")         || "";
    const branch         = searchParams.get("branch")         || "";
    const counsellorName = searchParams.get("counsellor")     || "";
    const agentName      = searchParams.get("agent")          || "";
    const technique      = searchParams.get("technique")      || "";
    const surgeryDate      = searchParams.get("surgeryDate")      || "";
    const surgeryLocations = (searchParams.get("surgeryLocations") || "").split(",").filter(Boolean);
    const dateFrom         = searchParams.get("dateFrom")         || "";
    const dateTo          = searchParams.get("dateTo")          || "";
    const visited         = searchParams.get("visited")         === "true";
    const readyForSurgery = searchParams.get("readyForSurgery") === "true";

    /* ── Build query ── */
    const query = {};
    const andClauses = [];

    // Branch: session-level restriction takes priority
    const userBranch = session.user.branch;
    if (userBranch && userBranch !== "All") {
      query["personal.branch"] = userBranch;
    } else if (branch) {
      query["personal.branch"] = branch;
    }

    if (status)          query["ops.status"]                    = status;
    if (readyForSurgery) query["counselling.readyForSurgery"]   = true;

    // Visit date range
    if (dateFrom || dateTo) {
      query["personal.visitDate"] = {};
      if (dateFrom) query["personal.visitDate"].$gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query["personal.visitDate"].$lte = to;
      }
    }

    if (surgeryLocations.length > 0) query["surgery.location"] = { $in: surgeryLocations };

    // Surgery date (exact day)
    if (surgeryDate) {
      const sd = new Date(surgeryDate);
      const start = new Date(sd); start.setHours(0, 0, 0, 0);
      const end   = new Date(sd); end.setHours(23, 59, 59, 999);
      query["surgery.surgeryDate"] = { $gte: start, $lte: end };
    }

    // Full-text search across name / phone / email
    if (search) {
      andClauses.push({
        $or: [
          { "personal.name":  { $regex: search, $options: "i" } },
          { "personal.phone": { $regex: search, $options: "i" } },
          { "personal.email": { $regex: search, $options: "i" } },
        ],
      });
    }

    // Technique (stored as string across 3 fields)
    if (technique) {
      andClauses.push({
        $or: [
          { "counselling.techniqueSuggested": technique },
          { "surgery.technique":              technique },
          { "personal.techniqueQuoted":       technique },
        ],
      });
    }

    if (andClauses.length > 0) query.$and = andClauses;

    /* ── Resolve employee name → ObjectId (only if filter provided) ── */
    const [counsellorDoc, agentDoc] = await Promise.all([
      counsellorName ? Employee.findOne({ name: counsellorName }, "_id").lean() : null,
      agentName      ? Employee.findOne({ name: agentName },      "_id").lean() : null,
    ]);

    if (counsellorName) {
      // If employee not found return empty
      if (!counsellorDoc) return NextResponse.json({ patients: [], total: 0, page, limit, filterOptions: {} }, { status: 200 });
      query["counselling.counsellor"] = counsellorDoc._id;
    } else if (visited) {
      // visited = has any counsellor assigned
      query["counselling.counsellor"] = { $exists: true, $ne: null };
    }

    if (agentName) {
      if (!agentDoc) return NextResponse.json({ patients: [], total: 0, page, limit, filterOptions: {} }, { status: 200 });
      query["personal.reference"] = agentDoc._id;
    }

    /* ── Run DB operations in parallel ── */
    const [patients, total, distinctLocations] = await Promise.all([
      Patient.find(query)
        .sort({ [sortKey]: sortDir })
        .skip(skip)
        .limit(limit)
        .populate("personal.reference",     "name")
        .populate("counselling.counsellor", "name")
        .populate("surgery.doctor",         "name")
        .populate("surgery.seniorTech",     "name")
        .populate("surgery.implanterRight", "name")
        .populate("surgery.implanterLeft",  "name")
        .lean(),
      Patient.countDocuments(query),
      Patient.distinct("surgery.location").then((vals) => vals.filter(Boolean).sort()),
    ]);

    return NextResponse.json({
      patients, total, page, limit, success: true,
      filterOptions: { surgeryLocations: distinctLocations },
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch patients" }, { status: 500 });
  }
};

export const GET = withDB(handler);
