import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import mongoose from "mongoose";





const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient ID is required",
        },
        { status: 400 }
      );
    }

    const patient = await Patient.findById(id);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    const data = await req.json();

    // Check for duplicate phone number
    if (
      data.personal?.phone &&
      data.personal.phone !== patient.personal.phone
    ) {
      const numberExisted = await Patient.findOne({
        "personal.phone": data.personal.phone,
      });

      if (numberExisted) {
        return NextResponse.json(
          { error: "Phone number already exists" },
          { status: 400 }
        );
      }
    }

    // Store original values for employee reference updates
    const originalValues = {
      personalReference: patient.personal?.reference?.toString(),
      counsellingCounsellor: patient.counselling?.counsellor?.toString(),
      surgery: {
        doctor: patient.surgery?.doctor?.toString(),
        seniorTech: patient.surgery?.seniorTech?.toString(),
        implanterRight: patient.surgery?.implanterRight?.toString(),
        implanterLeft: patient.surgery?.implanterLeft?.toString(),
        graftingPerson: patient.surgery?.graftingPerson?.toString(),
        helper: patient.surgery?.helper?.toString(),
      }
    };

    // Update patient fields manually
    const updateFields = (target, source) => {
      Object.keys(source).forEach(key => {
        if (source[key] !== undefined && source[key] !== null) {
          if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
            if (!target[key]) target[key] = {};
            updateFields(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      });
    };

    // Apply updates to the patient document
    updateFields(patient, data);

    // Save the patient - this will trigger the pre-save middleware
    const updatedPatient = await patient.save();

    // Populate the updated patient
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

    // Handle employee reference updates (your existing code)
    const employeeUpdatePromises = [];

    const addEmployeeUpdate = (employeeId, fieldName, operation) => {
      if (employeeId && mongoose.Types.ObjectId.isValid(employeeId)) {
        const updateOperation =
          operation === "add"
            ? { $addToSet: { patient: patient._id } }
            : { $pull: { patient: patient._id } };

        employeeUpdatePromises.push(
          Employee.findByIdAndUpdate(employeeId, updateOperation, {
            new: true,
          }).catch((error) => {
            console.error(
              `Error updating employee ${fieldName} with ID ${employeeId}:`,
              error
            );
            return null;
          })
        );
      }
    };

    // Check for reference changes
    if (data.personal?.reference !== originalValues.personalReference) {
      if (originalValues.personalReference) {
        addEmployeeUpdate(originalValues.personalReference, "reference", "remove");
      }
      if (data.personal?.reference) {
        addEmployeeUpdate(data.personal.reference, "reference", "add");
      }
    }

    // Check counselling counsellor changes
    if (data.counselling?.counsellor !== originalValues.counsellingCounsellor) {
      if (originalValues.counsellingCounsellor) {
        addEmployeeUpdate(originalValues.counsellingCounsellor, "counsellor", "remove");
      }
      if (data.counselling?.counsellor) {
        addEmployeeUpdate(data.counselling.counsellor, "counsellor", "add");
      }
    }

    // Check surgery team changes
    if (data.surgery) {
      const surgeryFields = [
        "doctor",
        "seniorTech",
        "implanterRight",
        "implanterLeft",
        "graftingPerson",
        "helper",
      ];

      surgeryFields.forEach((field) => {
        const newValue = data.surgery[field];
        const oldValue = originalValues.surgery[field];

        if (newValue !== oldValue) {
          if (oldValue) {
            addEmployeeUpdate(oldValue, field, "remove");
          }
          if (newValue) {
            addEmployeeUpdate(newValue, field, "add");
          }
        }
      });
    }

    // Execute all employee updates
    if (employeeUpdatePromises.length > 0) {
      await Promise.all(employeeUpdatePromises);
      console.log(
        `Updated ${employeeUpdatePromises.length} employee records for patient reference changes`
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Patient updated successfully and ${employeeUpdatePromises.length} employee records updated`,
        data: populatedPatient,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating patient:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
};









export const PUT = withDB(handler);
