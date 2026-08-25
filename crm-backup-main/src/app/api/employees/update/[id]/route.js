import { NextResponse } from "next/server";
import Employee from "@/models/Employee";
import dbConnect from "@/lib/db";

export async function PUT(request, { params }) {
  try {
    await dbConnect();
    
    const { id } = await params;
    const data = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Employee ID is required" },
        { status: 400 }
      );
    }
    
    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return NextResponse.json(
        { success: false, message: "Employee name is required" },
        { status: 400 }
      );
    }
    
    if (!data.role) {
      return NextResponse.json(
        { success: false, message: "Employee role is required" },
        { status: 400 }
      );
    }
    
    // Validate role is from allowed enum values
    const allowedRoles = ["Agent", "Counsellor", "Doctor", "Technician", "Implanter", "Others"];
    if (!allowedRoles.includes(data.role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role specified. Must be one of: " + allowedRoles.join(", ") },
        { status: 400 }
      );
    }
    
    // Validate email format if provided
    if (data.email && data.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        return NextResponse.json(
          { success: false, message: "Invalid email format" },
          { status: 400 }
        );
      }
    }
    
    // Validate phone format if provided (10 digits)
    if (data.phone && data.phone.trim()) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(data.phone)) {
        return NextResponse.json(
          { success: false, message: "Phone number must be exactly 10 digits" },
          { status: 400 }
        );
      }
    }
    
    // Prepare update data
    const updateData = {
      name: data.name.trim(),
      phone: data.phone?.trim() || undefined,
      email: data.email?.trim() || undefined,
      role: data.role,
      isactive: data.isactive !== undefined ? data.isactive : true,
      salaryStructure: data.salaryStructure || undefined,
      incentiveRate: data.incentiveRate !== undefined ? data.incentiveRate : undefined,
    };
    
    // Update employee
    const employee = await Employee.findByIdAndUpdate(
      id,
      updateData,
      { 
        new: true, // Return the updated document
        runValidators: true // Run model validators
      }
    );
    
    if (!employee) {
      return NextResponse.json(
        { success: false, message: "Employee not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        success: true, 
        data: employee,
        message: "Employee updated successfully"
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating employee:", error);
    
    // Handle invalid ObjectId format
    if (error.name === "CastError") {
      return NextResponse.json(
        { success: false, message: "Invalid employee ID format" },
        { status: 400 }
      );
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { success: false, message: `An employee with this ${field} already exists` },
        { status: 409 }
      );
    }
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(err => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, message: "Failed to update employee. Please try again." },
      { status: 500 }
    );
  }
}