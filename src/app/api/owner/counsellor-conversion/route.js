// src/app/api/owner/counsellor-conversion/route.js
//
// Per-counsellor rollup, aggregated over Patient.counselling.counsellor:
//   visits   — every patient ever assigned to this counsellor
//   plans    — of those, how many have a final package set (counselling.finlpackage > 0)
//   tokens   — how many have paid something (payments.amountReceived > 0)
//   surgeries— how many are fully closed (ops.status === "CLOSED")
//   revenue  — sum of payments.totalAmount across the counsellor's whole patient set
//   avgDiscount — average payments.discount across the same set (zero-discount patients
//                 included, so this is "average discount given per patient", not "average
//                 among patients who got one")

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All", from, to } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    const rows = await Patient.aggregate([
      {
        $match: {
          ...branchFilter,
          "counselling.counsellor": { $exists: true, $ne: null },
          "personal.visitDate": { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$counselling.counsellor",
          visits: { $sum: 1 },
          plans: { $sum: { $cond: [{ $gt: ["$counselling.finlpackage", 0] }, 1, 0] } },
          tokens: { $sum: { $cond: [{ $gt: ["$payments.amountReceived", 0] }, 1, 0] } },
          surgeries: { $sum: { $cond: [{ $eq: ["$ops.status", "CLOSED"] }, 1, 0] } },
          revenue: { $sum: { $ifNull: ["$payments.totalAmount", 0] } },
          avgDiscount: { $avg: { $ifNull: ["$payments.discount", 0] } },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "_id",
          foreignField: "_id",
          as: "counsellorDoc",
        },
      },
      { $unwind: { path: "$counsellorDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          counsellorId: "$_id",
          counsellorName: { $ifNull: ["$counsellorDoc.name", "(deleted employee)"] },
          visits: 1,
          plans: 1,
          tokens: 1,
          surgeries: 1,
          revenue: 1,
          avgDiscount: { $round: ["$avgDiscount", 0] },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    return NextResponse.json({ success: true, rows });
  } catch (err) {
    console.error("owner counsellor-conversion error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
