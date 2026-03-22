import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Interviewer from "@/models/Interviewer";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const source   = searchParams.get("source");   // "qr" | "direct" | null (all)
    const status   = searchParams.get("status");
    const from     = searchParams.get("from");
    const to       = searchParams.get("to");
    const search   = searchParams.get("search");
    const page     = parseInt(searchParams.get("page")  || "1");
    const limit    = parseInt(searchParams.get("limit") || "25");
    const skip     = (page - 1) * limit;

    const query = {};
    if (source) query.source = source;
    if (status) query.status = status;
    if (from && to) {
      query.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }
    if (search) {
      query.$or = [
        { name:     { $regex: search, $options: "i" } },
        { phone:    { $regex: search, $options: "i" } },
        { email:    { $regex: search, $options: "i" } },
        { position: { $regex: search, $options: "i" } },
      ];
    }

    const [candidates, total, stats] = await Promise.all([
      Interviewer.find(query)
        .populate("assignedHr", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Interviewer.countDocuments(query),

      // Stats for current filter (excluding pagination)
      Interviewer.aggregate([
        { $match: query },
        { $group: {
          _id: null,
          total:        { $sum: 1 },
          visitedCount: { $sum: { $cond: [{ $eq: ["$source", "qr"] }, 1, 0] } },
          appliedCount: { $sum: { $cond: [{ $eq: ["$source", "direct"] }, 1, 0] } },
          selected:     { $sum: { $cond: [{ $eq: ["$status", "Selected"] }, 1, 0] } },
          rejected:     { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
          scheduled:    { $sum: { $cond: [{ $eq: ["$status", "Interview Scheduled"] }, 1, 0] } },
          onHold:       { $sum: { $cond: [{ $eq: ["$status", "On Hold"] }, 1, 0] } },
          applied:      { $sum: { $cond: [{ $eq: ["$status", "Applied"] }, 1, 0] } },
          avgExpected:  { $avg: "$expectedSalary" },
          avgFinal:     { $avg: { $cond: [{ $eq: ["$status", "Selected"] }, "$finalSalary", null] } },
        }},
      ]),
    ]);

    const s = stats[0] || {};

    return NextResponse.json({
      success: true,
      candidates,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      stats: {
        total:             s.total        || 0,
        visitedCount:      s.visitedCount || 0,
        appliedCount:      s.appliedCount || 0,
        selected:          s.selected     || 0,
        rejected:          s.rejected     || 0,
        scheduled:         s.scheduled    || 0,
        onHold:            s.onHold       || 0,
        applied:           s.applied      || 0,
        selectionRate:     s.total > 0 ? +((s.selected / s.total) * 100).toFixed(1) : 0,
        avgExpectedSalary: Math.round(s.avgExpected || 0),
        avgFinalSalary:    Math.round(s.avgFinal    || 0),
      },
    });
  } catch (error) {
    console.error("Interviews API error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
