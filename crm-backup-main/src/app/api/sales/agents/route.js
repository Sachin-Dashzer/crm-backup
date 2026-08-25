import Employee from "@/models/Employee";
import Patient from "@/models/Patient";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

const handler = async (req) => {
  try {
    const data = await Employee.find({
      role: { $regex: "agent", $options: "i" },
    })
      .populate({
        path: "patient",
        select:
          "personal.name personal.visitDate surgery.technique surgery.graftsImplanted surgery.surgeryDate payments.amountReceived counselling.readyForSurgery counselling.counsellor counselling.converted ops.status createdAt",
        options: { sort: { createdAt: -1 } },
      })
      .sort({ name: 1 });

    // Transform data to match frontend expectations
    const agentsData = data.map((employee) => {
      const patients = employee.patient || [];

      // Calculate metrics
      const totalRevenue = patients.reduce((total, patient) => {
        return total + (parseInt(patient.payments?.amountReceived) || 0);
      }, 0);

      const totalPatients = patients.length;
      
      // FIXED: Check for counsellor ObjectId
      const visitedPatients = patients.filter(
        (patient) => patient.counselling?.counsellor
      ).length;

      // FIXED: Check for surgeryDate Date object
      const readyForSurgery = patients.filter(
        (patient) => patient.surgery?.surgeryDate
      ).length;

      // Calculate conversion rate
      const conversionRate =
        totalPatients > 0 ? (readyForSurgery / totalPatients) * 100 : 0;

      // Calculate techniques sold
      const techniques = {};
      patients.forEach((patient) => {
        const technique = patient.surgery?.technique;
        if (technique) {
          techniques[technique] = (techniques[technique] || 0) + 1;
        }
      });

      const avgRevenue = totalPatients > 0 ? totalRevenue / totalPatients : 0;

      return {
        _id: employee._id,
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        totalPatients: totalPatients,
        visitedPatients: visitedPatients,
        readyForSurgery: readyForSurgery,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        totalRevenue: totalRevenue,
        avgRevenue: parseFloat(avgRevenue.toFixed(2)),
        techniques: techniques,
        graftsImplanted: patients.reduce((total, patient) => {
          return total + (parseInt(patient.surgery?.graftsImplanted) || 0);
        }, 0),
        // Include patient details for potential expansion
        patients: patients.map((patient) => ({
          id: patient._id,
          name: patient.personal?.name,
          visitDate: patient.personal?.visitDate,
          technique: patient.surgery?.technique,
          surgeryDate: patient.surgery?.surgeryDate,
          amountReceived: patient.payments?.amountReceived,
          readyForSurgery: patient.counselling?.readyForSurgery,
          counsellor: patient.counselling?.counsellor,
          converted: patient.counselling?.converted,
          status: patient.ops?.status,
          createdAt: patient.createdAt,
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: agentsData,
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch agents data",
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);