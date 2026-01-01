import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";

const handler = async (req) => {
  const { id } = await req.json();

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid patient id" },
      { status: 400 }
    );
  }

  const patient = await Patient.findByIdAndDelete(id);

  if (!patient) {
    return NextResponse.json(
      { success: false, message: "Patient not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Patient deleted successfully" },
    { status: 200 }
  );
};

export const POST = withDB(handler);
