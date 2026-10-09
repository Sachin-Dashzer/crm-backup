import Patient from "@/models/Patient";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const handler = async (req) => {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (session?.user?.role === "sales") {
    return NextResponse.json({ success: false, message: "Forbidden. Sales users are view-only." }, { status: 403 });
  }

  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const data = await req.json();

    const patient = new Patient({
      personal: data.personal,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await patient.save();

    return NextResponse.json({
      success: true,
      message: "Appointment booked successfully",
      data: patient
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to book appointment"
      },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);