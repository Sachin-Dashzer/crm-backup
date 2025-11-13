import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    const patients = await Patient.find({})
      .populate({
        path: "personal.reference",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "counselling.counsellor",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.doctor",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.seniorTech",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.implanterRight",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.implanterLeft",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.graftingPerson",
        select: "name",
        model: "Employee",
      })
      .populate({
        path: "surgery.helper",
        select: "name",
        model: "Employee",
      })
      .sort({ createdAt: -1 }); // Optional: sort by latest patients first

    // const patientsId = patients.map(patient => patient._id);

    return NextResponse.json(
      {
        patients,
        success: true,
        count: patients.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching patients:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch patients",
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
