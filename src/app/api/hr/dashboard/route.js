import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Interviewer from "@/models/Interviewer";

const ALLOWED_ROLES = ["hr", "super-admin", "admin"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { from, to } = await req.json();

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const dateFilter = { createdAt: { $gte: fromDate, $lte: toDate } };

    const [statsAgg, positionAgg, recentCandidates, byHrAgg] = await Promise.all([
      Interviewer.aggregate([
        { $match: dateFilter },
        {
          $facet: {
            total:        [{ $count: "count" }],
            selected:     [{ $match: { status: "Selected"  } }, { $count: "count" }],
            rejected:     [{ $match: { status: "Rejected"  } }, { $count: "count" }],
            scheduled:    [{ $match: { status: "Interview Scheduled" } }, { $count: "count" }],
            onHold:       [{ $match: { status: "On Hold"   } }, { $count: "count" }],
            applied:      [{ $match: { status: "Applied"   } }, { $count: "count" }],
            visitedCount: [{ $match: { source: "qr"     } }, { $count: "count" }],
            appliedCount: [{ $match: { source: "direct" } }, { $count: "count" }],
            byStatus:  [
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            bySource: [
              { $group: {
                _id:       "$source",
                count:     { $sum: 1 },
                selected:  { $sum: { $cond: [{ $eq: ["$status", "Selected"] }, 1, 0] } },
                rejected:  { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
                scheduled: { $sum: { $cond: [{ $eq: ["$status", "Interview Scheduled"] }, 1, 0] } },
              }},
              { $sort: { count: -1 } },
            ],
            perDay: [
              {
                $group: {
                  _id:     { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  count:   { $sum: 1 },
                  visited: { $sum: { $cond: [{ $eq: ["$source", "qr"]     }, 1, 0] } },
                  applied: { $sum: { $cond: [{ $eq: ["$source", "direct"] }, 1, 0] } },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      Interviewer.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$position", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      Interviewer.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name position status interviewDate createdAt"),

      Interviewer.aggregate([
        { $match: dateFilter },
        {
          $lookup: {
            from: "employees",
            localField: "assignedHr",
            foreignField: "_id",
            as: "hrData",
          },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $gt: [{ $size: "$hrData" }, 0] },
                { $arrayElemAt: ["$hrData.name", 0] },
                "Unassigned",
              ],
            },
            total:     { $sum: 1 },
            selected:  { $sum: { $cond: [{ $eq: ["$status", "Selected"] }, 1, 0] } },
            rejected:  { $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] } },
            scheduled: { $sum: { $cond: [{ $eq: ["$status", "Interview Scheduled"] }, 1, 0] } },
            onHold:    { $sum: { $cond: [{ $eq: ["$status", "On Hold"] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const s = statsAgg[0] || {};

    const dayMs = 86400000;
    const perDayMap = {};
    (s.perDay || []).forEach(({ _id, count, visited, applied }) => {
      perDayMap[_id] = { count, visited, applied };
    });
    const perDayFilled = [];
    for (let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime() + dayMs)) {
      const key = d.toISOString().slice(0, 10);
      const entry = perDayMap[key] || { count: 0, visited: 0, applied: 0 };
      perDayFilled.push({ date: key, count: entry.count, visited: entry.visited, applied: entry.applied });
    }

    return NextResponse.json({
      success: true,
      total:        s.total?.[0]?.count        ?? 0,
      selected:     s.selected?.[0]?.count     ?? 0,
      rejected:     s.rejected?.[0]?.count     ?? 0,
      scheduled:    s.scheduled?.[0]?.count    ?? 0,
      onHold:       s.onHold?.[0]?.count       ?? 0,
      applied:      s.applied?.[0]?.count      ?? 0,
      visitedCount: s.visitedCount?.[0]?.count ?? 0,
      appliedCount: s.appliedCount?.[0]?.count ?? 0,
      byStatus:     s.byStatus || [],
      bySource:     s.bySource || [],
      perDay:       perDayFilled,
      positions:    positionAgg,
      recentCandidates,
      byHr:         byHrAgg,
    });
  } catch (err) {
    console.error("HR dashboard error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
