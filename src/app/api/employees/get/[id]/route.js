import { NextResponse } from "next/server";
import Employee from "@/models/Employee";
import dbConnect from "@/lib/db";
export async function GET(request, { params }) {
  try {
    await dbConnect();
    
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Employee ID is required" },
        { status: 400 }
      );
    }
    
    const employee = await Employee.findById(id);
    
    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: true, 
        data: employee 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching employee:", error);
    
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return NextResponse.json(
        { success: false, message: "Invalid employee ID format" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: "Failed to fetch employee data" },
      { status: 500 }
    );
  }
}