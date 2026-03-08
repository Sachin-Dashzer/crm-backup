import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Leads from "@/models/Leads";

const handler = async (req) => {
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search")    || "";
  const location = searchParams.get("location")  || "";
  const visitPlan= searchParams.get("visitPlan") || "";
  const tag      = searchParams.get("tag")        || "";
  const from     = searchParams.get("from")       || "";
  const to       = searchParams.get("to")         || "";
  const page     = Math.max(1, parseInt(searchParams.get("page"))  || 1);
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get("limit")) || 10));
  const skip     = (page - 1) * limit;

  // Base query — used for tag-count aggregation (no tag filter so cards always show distribution)
  const baseQuery = {};

  if (search) {
    baseQuery.$or = [
      { name:  { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (location)  baseQuery.location  = { $regex: location,  $options: "i" };
  if (visitPlan) baseQuery.visitPlan = { $regex: visitPlan, $options: "i" };
  if (from || to) {
    baseQuery.createdAt = {};
    if (from) baseQuery.createdAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      baseQuery.createdAt.$lte = toDate;
    }
  }

  // Full query — includes tag filter for paginated results
  const query = tag ? { ...baseQuery, tag } : baseQuery;

  // Run all three DB operations in parallel
  const [leads, total, tagAgg] = await Promise.all([
    Leads.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),                      // lean() skips Mongoose document overhead (~30% faster reads)
    Leads.countDocuments(query),
    Leads.aggregate([
      { $match: baseQuery },        // tag counts always reflect base filters, not tag filter
      { $group: { _id: "$tag", count: { $sum: 1 } } },
    ]),
  ]);

  // Shape tag counts into a plain object
  const tagCounts = {};
  let aggTotal = 0;
  tagAgg.forEach(({ _id, count }) => {
    tagCounts[_id || "untagged"] = count;
    aggTotal += count;
  });
  tagCounts._total = aggTotal;

  return NextResponse.json({ leads, total, tagCounts, page, limit }, { status: 200 });
};

export const GET = withDB(handler);
