import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import { COLLAB_BRANCHES } from "@/lib/branches";

const handler = async (req) => {
  try {

    // Find patients who don't have a counsellor assigned (not visited),
    // scoped to the 8 collab-city set so collab users don't see main-branch patients.
    const patients = await Patient.find({
      "personal.branch": { $in: COLLAB_BRANCHES },
      $or: [
        { "counselling.counsellor": { $exists: false } },
        { "counselling.counsellor": null },
      ],
    })
      .select("personal ops createdAt")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      patients,
      count: patients.length,
    });
  } catch (error) {
    console.error("Not visited patients error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
