import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Employee from "@/models/Employee";

const handler = async (req) => {

    const { name, phone, email, role, patient } = await req.json();

    if (!name || !phone || !role) {
      return NextResponse.json(
        { message: "All fields are required" },
        { status: 400 }
      );
    }

    const newEmployee = new Employee({
      name,
      phone,
      email,
      role,
      patient,
    });

    await newEmployee.save();

    return NextResponse.json(
      { message: "Employee created successfully", employee: newEmployee },
      { status: 201 }
    );
  
};

export const POST = withDB(handler);
