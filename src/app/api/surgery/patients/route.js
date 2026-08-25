import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";

    let filter = {};
    if (branch !== "All") {
      filter["personal.branch"] = branch;
    }

    // Get patients with surgery information
    const patients = await Patient.find({
      ...filter,
      $or: [
        { "surgery.surgeryDate": { $exists: true } },
        { "counselling.readyForSurgery": true }
      ]
    })
      .select("personal surgery counselling medical ops")
      .sort({ "surgery.surgeryDate": -1 })
      .lean();

    return NextResponse.json({ patients });

  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}