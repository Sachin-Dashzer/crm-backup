import Employee from "@/models/Employee";
import Patient from "@/models/Patient";
import Interviewer from "@/models/Interviewer";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom  = searchParams.get("dateFrom");
    const dateTo    = searchParams.get("dateTo");
    const technique = searchParams.get("technique");

    const data = await Employee.find({})
      .populate({
        path: "patient",
        select:
          "personal.name personal.visitDate surgery.technique surgery.graftsImplanted payments.amountReceived counselling.readyForSurgery counselling.techniqueSuggested ops.status createdAt",
        options: { sort: { createdAt: -1 } },
      })
      .sort({ name: 1 });

    const employeesByRole = {};

    for (const employee of data) {
      const role = employee.role || "Other";
      if (!employeesByRole[role]) employeesByRole[role] = [];

      const normalizedRole = role.toLowerCase();

      if (normalizedRole === "hr") {
        // For HR employees: aggregate candidate performance stats
        const candidates = await Interviewer.find({ assignedHr: employee._id }).lean();
        const totalCandidates = candidates.length;
        const selected  = candidates.filter((c) => c.status === "Selected").length;
        const rejected  = candidates.filter((c) => c.status === "Rejected").length;
        const scheduled = candidates.filter((c) => c.status === "Interview Scheduled").length;
        const onHold    = candidates.filter((c) => c.status === "On Hold").length;
        const selectionRate = totalCandidates > 0
          ? parseFloat(((selected / totalCandidates) * 100).toFixed(1))
          : 0;

        employeesByRole[role].push({
          _id: employee._id,
          name: employee.name,
          isactive: employee.isactive,
          totalCandidates,
          selected,
          rejected,
          scheduled,
          onHold,
          selectionRate,
        });
      } else {
        let patients = employee.patient || [];

        if (dateFrom) {
          const from = new Date(dateFrom);
          patients = patients.filter(
            (p) => p.personal?.visitDate && new Date(p.personal.visitDate) >= from
          );
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          patients = patients.filter(
            (p) => p.personal?.visitDate && new Date(p.personal.visitDate) <= to
          );
        }
        if (technique) {
          patients = patients.filter(
            (p) =>
              p.surgery?.technique === technique ||
              p.counselling?.techniqueSuggested === technique
          );
        }

        const patientCount = patients.length;
        const amountReceived = patients.reduce(
          (total, patient) => total + (parseInt(patient.payments?.amountReceived) || 0),
          0
        );

        if (normalizedRole === "agent" || normalizedRole === "counsellor") {
          const readyForSurgery = patients.filter(
            (p) => p.counselling && p.counselling.readyForSurgery === true
          ).length;
          employeesByRole[role].push({
            _id: employee._id,
            isactive: employee.isactive,
            name: employee.name,
            totalPatient: patientCount,
            readyForSurgery,
            amountReceived,
          });
        } else {
          const graftsImplanted = patients.reduce(
            (total, patient) => total + (parseInt(patient.surgery?.graftsImplanted) || 0),
            0
          );
          employeesByRole[role].push({
            _id: employee._id,
            isactive: employee.isactive,
            name: employee.name,
            totalPatient: patientCount,
            graftsImplanted,
            amountReceived,
          });
        }
      }
    }

    return NextResponse.json(employeesByRole);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
