import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Employee from "@/models/Employee";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const handler = async (req) => {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    const isSales = session?.user?.role === "sales";
    const { name, phone, email, role, patient, salaryStructure, incentiveRate } = await req.json();

    if (!name || !phone || !role) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    // Role-based restrictions: Sales users can only register operational clinic staff, not HR/admin
    const allowedSalesRoles = ["Agent", "Counsellor", "Doctor", "Technician", "Implanter", "Others"];
    if (isSales && !allowedSalesRoles.includes(role)) {
      return NextResponse.json(
        { message: "Sales users cannot assign HR or administrative roles." },
        { status: 403 }
      );
    }

    const newEmployee = new Employee({
      name,
      phone,
      email,
      role,
      patient,
      salaryStructure: isSales ? undefined : salaryStructure,
      incentiveRate: isSales ? 0 : (incentiveRate || 0),
    });

    await newEmployee.save();

    return NextResponse.json(
      { message: "Employee created successfully", employee: newEmployee },
      { status: 201 }
    );
  
};

export const POST = withDB(handler);
