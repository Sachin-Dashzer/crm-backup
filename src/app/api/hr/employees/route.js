import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Employee from "@/models/Employee";

export async function GET() {
  try {
    await dbConnect();
    const employees = await Employee.find({ role: "Hr", isactive: true })
      .select("_id name")
      .sort({ name: 1 })
      .lean();
    return NextResponse.json({ success: true, employees });
  } catch (err) {
    console.error("HR employees list error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
