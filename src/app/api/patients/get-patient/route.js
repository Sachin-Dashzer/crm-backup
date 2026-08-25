import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { byName } from "@/lib/sortOptions";

const split = (v) => (v || "").split(",").filter(Boolean);

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

    /* ── Filter params (all multi-value via comma-separated) ── */
    const search          = searchParams.get("search") || "";
    const statuses        = split(searchParams.get("status"));
    const branches        = split(searchParams.get("branch"));
    const counsellorNames = split(searchParams.get("counsellor"));
    const agentNames      = split(searchParams.get("agent"));
    const techniques      = split(searchParams.get("technique"));
    const doctorNames     = split(searchParams.get("doctor"));
    const seniorTechNames = split(searchParams.get("seniorTech"));
    const implanterNames  = split(searchParams.get("implanter"));
    const surgeryLocations = split(searchParams.get("surgeryLocations"));
    const surgeryDate      = searchParams.get("surgeryDate")      || "";
    const dateFrom         = searchParams.get("dateFrom")         || "";
    const dateTo           = searchParams.get("dateTo")           || "";
    const visited          = searchParams.get("visited")          === "true";
    const readyForSurgery  = searchParams.get("readyForSurgery")  === "true";

    /* ── Build query ── */
    const query = {};
    const andClauses = [];

    // Branch: session-level restriction takes priority
    const userBranch = session.user.branch;
    if (userBranch === "Collab") {
      const requested = branches.filter((b) => COLLAB_BRANCHES.includes(b));
      query["personal.branch"] = { $in: requested.length ? requested : COLLAB_BRANCHES };
    } else if (userBranch && userBranch !== "All") {
      query["personal.branch"] = userBranch;
    } else if (branches.length) {
      query["personal.branch"] = branches.length === 1 ? branches[0] : { $in: branches };
    }

    if (statuses.length)   query["ops.status"] = statuses.length === 1 ? statuses[0] : { $in: statuses };
    if (readyForSurgery)   query["counselling.readyForSurgery"] = true;

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

    if (surgeryLocations.length) query["surgery.location"] = { $in: surgeryLocations };

    // Surgery date (exact day)
    if (surgeryDate) {
      const sd = new Date(surgeryDate);
      const start = new Date(sd); start.setHours(0, 0, 0, 0);
      const end   = new Date(sd); end.setHours(23, 59, 59, 999);
      query["surgery.surgeryDate"] = { $gte: start, $lte: end };
    }

    // Full-text search
    if (search) {
      andClauses.push({
        $or: [
          { "personal.name":  { $regex: search, $options: "i" } },
          { "personal.phone": { $regex: search, $options: "i" } },
          { "personal.email": { $regex: search, $options: "i" } },
        ],
      });
    }

    // Technique (stored across 3 fields)
    if (techniques.length) {
      const techMatch = techniques.length === 1 ? techniques[0] : { $in: techniques };
      andClauses.push({
        $or: [
          { "counselling.techniqueSuggested": techMatch },
          { "surgery.technique":              techMatch },
          { "personal.techniqueQuoted":       techMatch },
        ],
      });
    }

    if (andClauses.length) query.$and = andClauses;

    /* ── Resolve employee names → ObjectIds in parallel ── */
    const [counsellorDocs, agentDocs, doctorDocs, seniorTechDocs, implanterDocs] = await Promise.all([
      counsellorNames.length ? Employee.find({ name: { $in: counsellorNames } }, "_id").lean() : [],
      agentNames.length      ? Employee.find({ name: { $in: agentNames } },      "_id").lean() : [],
      doctorNames.length     ? Employee.find({ name: { $in: doctorNames } },     "_id").lean() : [],
      seniorTechNames.length ? Employee.find({ name: { $in: seniorTechNames } }, "_id").lean() : [],
      implanterNames.length  ? Employee.find({ name: { $in: implanterNames } },  "_id").lean() : [],
    ]);

    if (counsellorNames.length) {
      if (!counsellorDocs.length) return NextResponse.json({ patients: [], total: 0, page, limit, filterOptions: {} }, { status: 200 });
      const ids = counsellorDocs.map((d) => d._id);
      query["counselling.counsellor"] = ids.length === 1 ? ids[0] : { $in: ids };
    } else if (visited) {
      query["counselling.counsellor"] = { $exists: true, $ne: null };
    }

    if (agentNames.length) {
      if (!agentDocs.length) return NextResponse.json({ patients: [], total: 0, page, limit, filterOptions: {} }, { status: 200 });
      const ids = agentDocs.map((d) => d._id);
      query["personal.reference"] = ids.length === 1 ? ids[0] : { $in: ids };
    }

    if (doctorDocs.length) {
      const ids = doctorDocs.map((d) => d._id);
      query["surgery.doctor"] = ids.length === 1 ? ids[0] : { $in: ids };
    }

    if (seniorTechDocs.length) {
      const ids = seniorTechDocs.map((d) => d._id);
      query["surgery.seniorTech"] = ids.length === 1 ? ids[0] : { $in: ids };
    }

    if (implanterDocs.length) {
      const ids = implanterDocs.map((d) => d._id);
      query["surgery.implanterRight"] = ids.length === 1 ? ids[0] : { $in: ids };
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
      Patient.distinct("surgery.location").then((vals) => vals.filter(Boolean).sort(byName)),
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
