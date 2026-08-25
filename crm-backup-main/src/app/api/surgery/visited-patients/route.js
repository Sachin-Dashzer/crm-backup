import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";

    let filter = {
      "surgery.graftsImplanted": { $gt: 0 },
      "ops.status": "CLOSED"
    };

    if (branch !== "All") {
      filter["personal.branch"] = branch;
    }

    const patients = await Patient.find(filter)
      .select("personal surgery ops")
      .sort({ "surgery.surgeryDate": -1 })
      .lean();

    return NextResponse.json({ patients });

  } catch (error) {
    console.error("Error fetching visited patients:", error);
    return NextResponse.json(
      { error: "Failed to fetch visited patients" },
      { status: 500 }
    );
  }
}