import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

const handler = async (req) => {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.name || !session?.user?.email || !session?.user?.branch) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Patient ID is required" },
        { status: 400 }
      );
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      return NextResponse.json(
        { success: false, message: "Patient not found" },
        { status: 404 }
      );
    }

    const data = await req.json();

    // Check for duplicate phone number
    if (data.personal?.phone && data.personal.phone !== patient.personal.phone) {
      const numberExisted = await Patient.findOne({
        "personal.phone": data.personal.phone,
      });

      if (numberExisted) {
        return NextResponse.json(
          { success: false, message: "Phone number already exists" },
          { status: 400 }
        );
      }
    }

    // Helper to extract IDs from array
    const extractIds = (data) => {
      if (!Array.isArray(data)) return [];
      return data
        .map((item) =>
          typeof item === "object" && item?._id
            ? item._id.toString()
            : typeof item === "string"
            ? item
            : null
        )
        .filter(Boolean);
    };

    // Store original employee references
    const originalRefs = {
      reference: patient.personal?.reference?.toString(),
      counsellor: patient.counselling?.counsellor?.toString(),
      doctor: extractIds(patient.surgery?.doctor),
      seniorTech: extractIds(patient.surgery?.seniorTech),
      implanterRight: extractIds(patient.surgery?.implanterRight),
      implanterLeft: extractIds(patient.surgery?.implanterLeft),
      graftingPerson: extractIds(patient.surgery?.graftingPerson),
      helper: extractIds(patient.surgery?.helper),
    };

    // Update patient fields
    const updateFields = (target, source) => {
      Object.keys(source).forEach((key) => {
        if (source[key] !== undefined && source[key] !== null) {
          if (
            typeof source[key] === "object" &&
            !Array.isArray(source[key]) &&
            source[key] !== null
          ) {
            if (!target[key]) target[key] = {};
            updateFields(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      });
    };

    updateFields(patient, data);

    // Add editor entry
    patient.editors = patient.editors || [];
    patient.editors.push({
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
    });

    // Save patient
    const updatedPatient = await patient.save();

    // Populate the patient
    const populatedPatient = await Patient.findById(updatedPatient._id)
      .populate("personal.reference")
      .populate("counselling.counsellor")
      .populate("surgery.doctor")
      .populate("surgery.seniorTech")
      .populate("surgery.implanterRight")
      .populate("surgery.implanterLeft")
      .populate("surgery.graftingPerson")
      .populate("surgery.helper")
      .populate("payments.transactions");

    // Update employee references
    const updateEmployee = async (employeeId, operation) => {
      if (!employeeId || !mongoose.Types.ObjectId.isValid(employeeId)) return;
      
      try {
        await Employee.findByIdAndUpdate(
          employeeId,
          operation === "add"
            ? { $addToSet: { patient: patient._id } }
            : { $pull: { patient: patient._id } }
        );
      } catch (error) {
        console.error(`Error updating employee ${employeeId}:`, error);
      }
    };

    // Handle array field changes
    const updateArrayRefs = (oldIds, newIds) => {
      const removed = oldIds.filter((id) => !newIds.includes(id));
      const added = newIds.filter((id) => !oldIds.includes(id));
      
      removed.forEach((id) => updateEmployee(id, "remove"));
      added.forEach((id) => updateEmployee(id, "add"));
    };

    // Update single reference fields
    if (data.personal?.reference !== originalRefs.reference) {
      if (originalRefs.reference) {
        await updateEmployee(originalRefs.reference, "remove");
      }
      if (data.personal?.reference) {
        await updateEmployee(data.personal.reference, "add");
      }
    }

    if (data.counselling?.counsellor !== originalRefs.counsellor) {
      if (originalRefs.counsellor) {
        await updateEmployee(originalRefs.counsellor, "remove");
      }
      if (data.counselling?.counsellor) {
        await updateEmployee(data.counselling.counsellor, "add");
      }
    }

    // Update array reference fields
    const arrayFields = [
      "doctor",
      "seniorTech",
      "implanterRight",
      "implanterLeft",
      "graftingPerson",
      "helper",
    ];

    if (data.surgery) {
      arrayFields.forEach((field) => {
        if (data.surgery[field] !== undefined) {
          const newIds = extractIds(data.surgery[field]);
          updateArrayRefs(originalRefs[field], newIds);
        }
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Patient updated successfully",
        data: populatedPatient,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating patient:", error);

    if (error.name === "ValidationError") {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
};

export const PUT = withDB(handler);