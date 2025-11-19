import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Employee from "@/models/Employee";

const handler = async (req) => {
  try {
    // Get all employees
    const data = await Employee.find({});
    
    // Update each employee to set patient to null
    const updatePromises = data.map(async (employee) => {
      employee.patient = [];
      return await employee.save();
    });
    
    // Wait for all updates to complete
    await Promise.all(updatePromises);
    
    return NextResponse.json({ 
      message: "All employees updated successfully", 
      data: data 
    }, { status: 200 });
    
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update employees" }, 
      { status: 500 }
    );
  }
}

export const PUT = withDB(handler);