// src/app/api/owner/staff-360/route.js
//
// All Staff 360° — name, role, branch (real since Step 6's backfill), isactive,
// incentiveRate, salaryStructure.baseSalary, and a derived "patients handled" count.
//
// "Patients handled" reuses Employee.patient[] rather than re-querying Patient across
// counselling.counsellor / surgery.doctor / surgery.seniorTech / etc. separately — that array
// is already the authoritative, kept-in-sync patient list for every role (confirmed in
// src/app/api/employees/get-patients/route.js's own comment: "the same field ... already
// treats as authoritative, covering every role, not just counsellors"). Re-deriving it from
// scratch here would be a second, possibly-drifting implementation of something that already
// exists.
//
// No Attendance/Productivity/Quality/Compliance/Deductions/Final Score columns — none of that
// data exists anywhere in this schema (see src/models/Employee.js), so showing them would mean
// inventing numbers.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Employee from "@/models/Employee";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const branch = searchParams.get("branch") || "All";
    const branchFilter = branch === "All" ? {} : { branch };

    const employees = await Employee.find(branchFilter)
      .select("name role branch isactive incentiveRate salaryStructure.baseSalary patient")
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      employees: employees.map((e) => ({
        id: String(e._id),
        name: e.name,
        role: e.role,
        branch: e.branch,
        isactive: e.isactive,
        incentiveRate: e.incentiveRate || 0,
        baseSalary: e.salaryStructure?.baseSalary || 0,
        patientsHandled: Array.isArray(e.patient) ? e.patient.length : 0,
      })),
    });
  } catch (err) {
    console.error("owner staff-360 error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
