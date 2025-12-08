import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(request) {
  try {
    // Connect to database
    await connectDB();

    // Get patient ID from query parameters
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("id");

    // Validate patient ID
    if (!patientId) {
      return NextResponse.json(
        {
          success: false,
          message: "Patient ID is required",
        },
        { status: 400 }
      );
    }

    // Fetch patient data with all populated fields
    const patient = await Patient.findById(patientId)
      .populate("counselling.counsellor", "name email phone role")
      .populate("surgery.doctor", "name email phone role")
      .populate("surgery.seniorTech", "name email phone role")
      .populate("surgery.implanterRight", "name email phone role")
      .populate("surgery.implanterLeft", "name email phone role")
      .populate("surgery.graftingPerson", "name email phone role")
      .populate("surgery.helpers", "name email phone role")
      .populate("personal.reference", "name")
      .lean();

    // Check if patient exists
    if (!patient) {
      return NextResponse.json(
        {
          success: false,
          message: "Patient not found",
        },
        { status: 404 }
      );
    }

    // Return patient data with all fields
    return NextResponse.json(
      {
        success: true,
        message: "Patient data fetched successfully",
        patient: {
          _id: patient._id,
          
          // Personal Information
          personal: {
            name: patient.personal?.name || "",
            age: patient.personal?.age || "",
            gender: patient.personal?.gender || "",
            phone: patient.personal?.phone || "",
            email: patient.personal?.email || "",
            address: patient.personal?.address || "",
            profession: patient.personal?.profession || "",
            branch: patient.personal?.branch || "",
            visitDate: patient.personal?.visitDate || null,
            packageQuoted: patient.personal?.packageQuoted || 0,
            reference: patient.personal?.reference || null,
            remarks: patient.personal?.remarks || "",
          },

          // Medical Information
          medical: {
            bloodGroup: patient.medical?.bloodGroup || "",
            bp: patient.medical?.bp || "",
            sugar: patient.medical?.sugar || "",
            pulse: patient.medical?.pulse || "",
            weight: patient.medical?.weight || "",
            allergies: patient.medical?.allergies || "",
            medicalHistory: patient.medical?.medicalHistory || "",
            hiv: patient.medical?.hiv || "",
            hcv: patient.medical?.hcv || "",
          },

          // Counselling Details
          counselling: {
            counsellor: patient.counselling?.counsellor || null,
            techniqueSuggested: patient.counselling?.techniqueSuggested || "",
            graftsSuggested: patient.counselling?.graftsSuggested || "",
            finlpackage: patient.counselling?.finlpackage || 0,
            readyForSurgery: patient.counselling?.readyForSurgery || false,
            hairlossType: patient.counselling?.hairlossType || "",
            areaofConcern: patient.counselling?.areaofConcern || "",
            hairlossreason: patient.counselling?.hairlossreason || "",
            hairlossduration: patient.counselling?.hairlossduration || "",
            medicines: patient.counselling?.medicines || [],
            additionalbenefits: patient.counselling?.additionalbenefits || [],
            notes: patient.counselling?.notes || "",
          },

          // Surgery Information
          surgery: {
            surgeryDate: patient.surgery?.surgeryDate || null,
            location: patient.surgery?.location || "",
            OT: patient.surgery?.OT || "",
            technique: patient.surgery?.technique || "",
            graftsneed: patient.surgery?.graftsneed || "",
            graftsImplanted: patient.surgery?.graftsImplanted || "",
            donorCondition: patient.surgery?.donorCondition || "",
            doctor: patient.surgery?.doctor || null,
            seniorTech: patient.surgery?.seniorTech || null,
            implanterRight: patient.surgery?.implanterRight || null,
            implanterLeft: patient.surgery?.implanterLeft || null,
            graftingPerson: patient.surgery?.graftingPerson || [],
            helpers: patient.surgery?.helpers || [],
            surgeryNotes: patient.surgery?.surgeryNotes || "",
          },

          // Payment Information
          payments: {
            totalAmount: patient.payments?.totalAmount || 0,
            amountReceived: patient.payments?.amountReceived || 0,
            discount: patient.payments?.discount || 0,
            pendingAmount: patient.payments?.pendingAmount || 0,
            medicineAmount: patient.payments?.medicineAmount || 0,
            transactions: patient.payments?.transactions || [],
          },

          // Documents
          documents: {
            images: patient.documents?.images || [],
            consentForm: patient.documents?.consentForm || [],
            suregeryForm: patient.documents?.suregeryForm || [],
            consultForm: patient.documents?.consultForm || [],
          },

          // Operations Status
          ops: {
            status: patient.ops?.status || "NEW",
            createdAt: patient.ops?.createdAt || patient.createdAt,
            updatedAt: patient.ops?.updatedAt || patient.updatedAt,
          },

          // Timestamps
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching patient data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching patient data",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

// Optional: Add POST method for updating patient data
export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Patient ID is required",
        },
        { status: 400 }
      );
    }

    // Update patient data
    const updatedPatient = await Patient.findByIdAndUpdate(
      id,
      {
        $set: updateData,
        "ops.updatedAt": new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate("counselling.counsellor", "name email phone role")
      .populate("surgery.doctor", "name email phone role")
      .populate("surgery.seniorTech", "name email phone role")
      .populate("surgery.implanterRight", "name email phone role")
      .populate("surgery.implanterLeft", "name email phone role")
      .populate("surgery.graftingPerson", "name email phone role")
      .populate("surgery.helpers", "name email phone role")
      .populate("personal.reference", "name");

    if (!updatedPatient) {
      return NextResponse.json(
        {
          success: false,
          message: "Patient not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Patient data updated successfully",
        patient: updatedPatient,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating patient data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error updating patient data",
        error: error.message,
      },
      { status: 500 }
    );
  }
}