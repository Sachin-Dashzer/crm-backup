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
      // Overall counts by status
      Interviewer.aggregate([
        { $match: dateFilter },
        {
          $facet: {
            total:     [{ $count: "count" }],
            selected:  [{ $match: { status: "Selected"  } }, { $count: "count" }],
            rejected:  [{ $match: { status: "Rejected"  } }, { $count: "count" }],
            scheduled: [{ $match: { status: "Interview Scheduled" } }, { $count: "count" }],
            onHold:    [{ $match: { status: "On Hold"   } }, { $count: "count" }],
            applied:   [{ $match: { status: "Applied"   } }, { $count: "count" }],
            byStatus:  [
              { $group: { _id: "$status", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
            perDay: [
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),

      // Positions applied for
      Interviewer.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$position", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // Recent 5 candidates
      Interviewer.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name position status interviewDate createdAt"),

      // Interviews by HR name
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

    // Fill per-day gaps
    const dayMs = 86400000;
    const perDayMap = {};
    (s.perDay || []).forEach(({ _id, count }) => { perDayMap[_id] = count; });
    const perDayFilled = [];
    for (let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime() + dayMs)) {
      const key = d.toISOString().slice(0, 10);
      perDayFilled.push({ date: key, count: perDayMap[key] || 0 });
    }

    return NextResponse.json({
      success: true,
      total:     s.total?.[0]?.count     ?? 0,
      selected:  s.selected?.[0]?.count  ?? 0,
      rejected:  s.rejected?.[0]?.count  ?? 0,
      scheduled: s.scheduled?.[0]?.count ?? 0,
      onHold:    s.onHold?.[0]?.count    ?? 0,
      applied:   s.applied?.[0]?.count   ?? 0,
      byStatus:  s.byStatus || [],
      perDay:    perDayFilled,
      positions: positionAgg,
      recentCandidates,
      byHr:      byHrAgg,
    });
  } catch (err) {
    console.error("HR dashboard error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
