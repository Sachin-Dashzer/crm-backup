import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req, { params }) {
  try {
    await connectDB();
    
    const patient = await Patient.findById(params.id)
      .populate("personal.reference", "name")
      .populate("counselling.counsellor", "name")
      .populate("surgery.doctor", "name")
      .populate("surgery.seniorTech", "name")
      .lean();

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ patient });

  } catch (error) {
    console.error("Error fetching patient:", error);
    return NextResponse.json(
      { error: "Failed to fetch patient" },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    await connectDB();
    
    const data = await req.json();
    
    const updateData = {};
    if (data.surgery) updateData.surgery = data.surgery;
    if (data.medical) updateData.medical = data.medical;
    if (data.documents) updateData.documents = data.documents;

    const patient = await Patient.findByIdAndUpdate(
      params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return NextResponse.json(
        { error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      patient 
    });

  } catch (error) {
    console.error("Error updating patient:", error);
    return NextResponse.json(
      { error: "Failed to update patient" },
      { status: 500 }
    );
  }
}