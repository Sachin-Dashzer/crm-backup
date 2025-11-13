import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";

const handler = async (req) => {
  try {
    // Fetch only required fields (for performance)
    const patients = await Patient.find({}, "_id personal.name");

    // Extract data you want to send
    const finaldata = patients.map((item) => ({
      id: item._id,
      name: item.personal?.name,
      phone: item.personal?.phone,
    }));

    return NextResponse.json(
      {
        success: true,
        patients: finaldata,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching patient list:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch patient list",
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
