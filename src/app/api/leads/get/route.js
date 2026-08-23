import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Leads from "@/models/Leads";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    // Only super-admin can access leads
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Super-admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search       = searchParams.get("search")       || "";
    const city         = searchParams.get("city")         || "";
    const tag          = searchParams.get("tag")          || "";
    const createdFrom  = searchParams.get("createdFrom")  || "";
    const createdTo    = searchParams.get("createdTo")    || "";
    const visitFrom    = searchParams.get("visitFrom")    || "";
    const visitTo      = searchParams.get("visitTo")      || "";
    const hasEmail     = searchParams.get("hasEmail")     || "";
    const hasRemarks   = searchParams.get("hasRemarks")   || "";
    const exportAll    = searchParams.get("export") === "true";
    const page         = Math.max(1, parseInt(searchParams.get("page"))  || 1);
    const limit        = Math.min(200, Math.max(1, parseInt(searchParams.get("limit")) || 25));
    const skip         = (page - 1) * limit;

    // Base query (used for tag-count aggregation without tag filter)
    const baseQuery = {};

    if (search) {
      baseQuery.$or = [
        { name:  { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (city) baseQuery.city = { $regex: city, $options: "i" };

    // Created At range (supports datetime-local ISO strings)
    if (createdFrom || createdTo) {
      baseQuery.createdAt = {};
      if (createdFrom) baseQuery.createdAt.$gte = new Date(createdFrom);
      if (createdTo) {
        const toDate = new Date(createdTo);
        if (!createdTo.includes("T")) toDate.setHours(23, 59, 59, 999);
        baseQuery.createdAt.$lte = toDate;
      }
    }

    // Visit Date range
    if (visitFrom || visitTo) {
      baseQuery.visitDate = {};
      if (visitFrom) baseQuery.visitDate.$gte = new Date(visitFrom);
      if (visitTo) {
        const vToDate = new Date(visitTo);
        if (!visitTo.includes("T")) vToDate.setHours(23, 59, 59, 999);
        baseQuery.visitDate.$lte = vToDate;
      }
    }

    // Has Email / Has Remarks toggles (frontend sends "true"/"false")
    if (hasEmail === "true")  baseQuery.email = { $exists: true, $nin: ["", null] };
    if (hasEmail === "false") {
      baseQuery.$and = [...(baseQuery.$and || []), {
        $or: [{ email: { $exists: false } }, { email: "" }, { email: null }],
      }];
    }
    if (hasRemarks === "true")  baseQuery.remarks = { $exists: true, $nin: ["", null] };
    if (hasRemarks === "false") baseQuery.remarks = { $in: ["", null] };

    // Full query includes tag filter for paginated results
    const query = tag ? { ...baseQuery, tag } : baseQuery;

    if (exportAll) {
      const [allLeads, total] = await Promise.all([
        Leads.find(query).sort({ createdAt: -1 }).lean(),
        Leads.countDocuments(query),
      ]);
      return NextResponse.json({ leads: allLeads, total }, { status: 200 });
    }

    const [leads, total, tagAgg] = await Promise.all([
      Leads.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Leads.countDocuments(query),
      Leads.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$tag", count: { $sum: 1 } } },
      ]),
    ]);

    const tagCounts = {};
    let aggTotal = 0;
    tagAgg.forEach(({ _id, count }) => {
      tagCounts[_id || "untagged"] = count;
      aggTotal += count;
    });
    tagCounts._total = aggTotal;

    return NextResponse.json({ leads, total, tagCounts, page, limit }, { status: 200 });

  } catch (error) {
    console.error("Leads fetch error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching leads" },
      { status: 500 }
    );
  }
}
