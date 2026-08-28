import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Employee from "@/models/Employee";
import Interviewer from "@/models/Interviewer";

const ALLOWED_ROLES = ["hr", "super-admin", "admin"];

function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status");

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    let csvData = "";
    let filename = "report";

    switch (type) {
      case "employees": {
        const employees = await Employee.find(dateFilter).lean();
        const rows = employees.map((e) => ({
          Name: e.name,
          Phone: e.phone || "",
          Email: e.email || "",
          Role: e.role,
          Status: e.isactive ? "Active" : "Inactive",
          "Linked Patients": e.patient?.length || 0,
          "Created At": e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "",
        }));
        csvData = toCSV(rows);
        filename = "employees-report";
        break;
      }

      case "candidates": {
        const query = { ...dateFilter };
        if (status) query.status = status;
        const candidates = await Interviewer.find(query).sort({ createdAt: -1 }).lean();
        const rows = candidates.map((c) => ({
          Name: c.name,
          Position: c.position,
          Phone: c.phone || "",
          Email: c.email || "",
          Status: c.status,
          "Experience Type": c.experienceType || "",
          "Years of Experience": c.yearsOfExperience || 0,
          "Expected Salary": c.expectedSalary || 0,
          "Final Salary": c.finalSalary || 0,
          "Previous Salary": c.previousSalary || 0,
          "Previous Company": c.previousCompany || "",
          "Previous Position": c.previousPosition || "",
          Source: c.source || "",
          Reference: c.reference || "",
          "Interview Date": c.interviewDate ? new Date(c.interviewDate).toLocaleDateString("en-IN") : "",
          "HR Comments": c.hrComments || "",
          "Final Remarks": c.finalRemarks || "",
          "Applied On": c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "",
        }));
        csvData = toCSV(rows);
        filename = `candidates${status ? `-${status.toLowerCase().replace(/ /g, "-")}` : ""}`;
        break;
      }

      case "interview-schedule": {
        const candidates = await Interviewer.find({
          status: "Interview Scheduled",
          ...dateFilter,
        })
          .sort({ interviewDate: 1 })
          .lean();
        const rows = candidates.map((c) => ({
          Name: c.name,
          Position: c.position,
          Phone: c.phone || "",
          Email: c.email || "",
          "Interview Date": c.interviewDate ? new Date(c.interviewDate).toLocaleDateString("en-IN") : "",
          "Experience Type": c.experienceType || "",
          "Years of Experience": c.yearsOfExperience || 0,
          "Expected Salary": c.expectedSalary || 0,
          Source: c.source || "",
        }));
        csvData = toCSV(rows);
        filename = "interview-schedule";
        break;
      }

      case "employees-by-role": {
        const employees = await Employee.find(dateFilter).lean();
        const roleMap = {};
        employees.forEach((e) => {
          if (!roleMap[e.role]) roleMap[e.role] = { role: e.role, total: 0, active: 0, inactive: 0 };
          roleMap[e.role].total++;
          if (e.isactive) roleMap[e.role].active++;
          else roleMap[e.role].inactive++;
        });
        const rows = Object.values(roleMap).sort((a, b) => a.role.localeCompare(b.role));
        csvData = toCSV(rows);
        filename = "employees-by-role";
        break;
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json({ success: true, csvData, filename });
  } catch (error) {
    console.error("HR report error:", error);
    return NextResponse.json({ success: false, message: "Failed to generate report" }, { status: 500 });
  }
}
