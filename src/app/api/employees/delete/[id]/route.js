import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Employee from "@/models/Employee";

const ALLOWED_ROLES = ["hr", "super-admin", "admin"];

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { id } = params;

    const employee = await Employee.findByIdAndDelete(id);

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    if (error.name === "CastError") {
      return NextResponse.json({ success: false, message: "Invalid employee ID" }, { status: 400 });
    }
    console.error("Delete employee error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
