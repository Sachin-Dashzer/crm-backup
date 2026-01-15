import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    // const session = await getServerSession(authOptions);

    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: "Unauthorized. Please login.",
    //     },
    //     { status: 401 }
    //   );
    // }

    // const userBranch = session.user.branch;

    
    // let query = {};
     
    // if (userBranch && userBranch !== 'All') {
    //   query['personal.branch'] = userBranch;
    // } 

    // Fetch patients with branch filter
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
      .sort({ createdAt: -1 }); // Sort by latest patients first


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
