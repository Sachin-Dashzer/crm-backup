import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";
    const dateRange = searchParams.get("dateRange") || "Today";

    // Date filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dateFilter = {};
    if (dateRange === "Today") {
      dateFilter = {
        $gte: today,
        $lt: tomorrow
      };
    }

    // Branch filtering
    let branchFilter = {};
    if (branch !== "All") {
      branchFilter = { "personal.branch": branch };
    }

    // Get today's upcoming surgeries (surgery date is today and not completed)
    const upcomingSurgeries = await Patient.find({
      ...branchFilter,
      "surgery.surgeryDate": dateFilter,
      $or: [
        { "surgery.graftsImplanted": { $exists: false } },
        { "surgery.graftsImplanted": null },
        { "surgery.graftsImplanted": 0 }
      ]
    })
      .select("personal surgery counselling")
      .limit(10)
      .lean();

    // Get today's performed surgeries (surgery date is today and completed)
    const performedSurgeries = await Patient.find({
      ...branchFilter,
      "surgery.surgeryDate": dateFilter,
      "surgery.graftsImplanted": { $gt: 0 }
    })
      .select("personal surgery")
      .limit(10)
      .lean();

    // Get counts for metrics
    const scheduledCount = await Patient.countDocuments({
      ...branchFilter,
      "surgery.surgeryDate": dateFilter
    });

    const completedCount = await Patient.countDocuments({
      ...branchFilter,
      "surgery.surgeryDate": dateFilter,
      "surgery.graftsImplanted": { $gt: 0 }
    });

    const pendingCount = scheduledCount - completedCount;

    const readyForSurgeryCount = await Patient.countDocuments({
      ...branchFilter,
      "counselling.readyForSurgery": true,
      "surgery.surgeryDate": { $exists: false }
    });

    // Get technique breakdown for today
    const techniqueBreakdown = {};
    const todaySurgeries = await Patient.find({
      ...branchFilter,
      "surgery.surgeryDate": dateFilter
    }).select("surgery.technique").lean();

    todaySurgeries.forEach(patient => {
      const technique = patient.surgery?.technique;
      if (technique) {
        techniqueBreakdown[technique] = (techniqueBreakdown[technique] || 0) + 1;
      }
    });

    // Get location breakdown for today
    const locationBreakdown = {};
    todaySurgeries.forEach(patient => {
      const location = patient.surgery?.location;
      if (location) {
        locationBreakdown[location] = (locationBreakdown[location] || 0) + 1;
      }
    });

    return NextResponse.json({
      metrics: {
        scheduledSurgeries: scheduledCount,
        completedSurgeries: completedCount,
        pendingSurgeries: pendingCount,
        readyForSurgery: readyForSurgeryCount,
        techniqueBreakdown,
        locationBreakdown
      },
      upcomingSurgeries,
      performedSurgeries
    });

  } catch (error) {
    console.error("Error fetching surgery dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}