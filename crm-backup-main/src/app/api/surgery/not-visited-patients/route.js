import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";

    let filter = {
      $or: [
        { "surgery.graftsImplanted": { $exists: false } },
        { "surgery.graftsImplanted": null },
        { "surgery.graftsImplanted": 0 }
      ],
      "ops.status": { $in: ["NEW", "CONSULTED", "SURGERY_BOOKED"] }
    };

    if (branch !== "All") {
      filter["personal.branch"] = branch;
    }

    const patients = await Patient.find(filter)
      .select("personal counselling ops")
      .sort({ "personal.visitDate": -1 })
      .lean();

    return NextResponse.json({ patients });

  } catch (error) {
    console.error("Error fetching not-visited patients:", error);
    return NextResponse.json(
      { error: "Failed to fetch not-visited patients" },
      { status: 500 }
    );
  }
}