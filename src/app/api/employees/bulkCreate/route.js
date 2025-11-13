import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Employee from "@/models/Employee";

const handler = async (req) => {
  const employees = await req.json();

  if (!Array.isArray(employees) || employees.length === 0) {
    return NextResponse.json(
      { message: "No employees found" },
      { status: 400 }
    );
  }

  for (const data of employees) {
    if (!data.name || !data.phone || !data.role) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }
  }

  const savedEmployees = await Employee.insertMany(employees);

  return NextResponse.json(
    {
      message: `${savedEmployees.length} employees added successfully`,
      employees: savedEmployees,
    },
    { status: 201 }
  );
};

export const POST = withDB(handler);
