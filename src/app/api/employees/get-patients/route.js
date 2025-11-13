import Employee from "@/models/Employee";
import Patient from "@/models/Patient";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

const handler = async (req) => {
  try {
    const data = await Employee.find({})
      .populate({
        path: 'patient',
        select: 'personal.name surgery.technique surgery.graftsImplanted payments.amountReceived counselling.readyForSurgery ops.status createdAt',
        options: { sort: { createdAt: -1 } }
      })
      .sort({ name: 1 });

    const employeesByRole = data.reduce((acc, employee) => {
      const role = employee.role || "Other";

      if (!acc[role]) {
        acc[role] = [];
      }

      const patients = employee.patient || [];
      const patientCount = patients.length;

      // Calculate amount received
      const amountReceived = patients.reduce((total, patient) => {
        return total + (parseInt(patient.payments?.amountReceived) || 0);
      }, 0);

      // Convert role to lowercase for consistent comparison
      const normalizedRole = role.toLowerCase();
      
      let employeeData;

      if (normalizedRole === 'agent' || normalizedRole === 'counsellor') {
        // For agent and counsellor - use readyForSurgery
        const readyForSurgery = patients.filter(patient => 
          patient.counselling && patient.counselling.readyForSurgery === true
        ).length;

        employeeData = {
          name: employee.name,
          totalPatient: patientCount,
          readyForSurgery: readyForSurgery,
          amountReceived: amountReceived
        };
      } else {
        // For all other roles (doctor, implanter, technician, etc.) - use graftsImplanted
        const graftsImplanted = patients.reduce((total, patient) => {
          return total + (parseInt(patient.surgery?.graftsImplanted) || 0);
        }, 0);

        employeeData = {
          name: employee.name,
          totalPatient: patientCount,
          graftsImplanted: graftsImplanted,
          amountReceived: amountReceived
        };
      }

      acc[role].push(employeeData);
      return acc;
    }, {});

    return NextResponse.json(employeesByRole);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch employees" 
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler); 