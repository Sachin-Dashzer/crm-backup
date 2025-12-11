import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

const handler = async (req) => {
  const { personal, medical, counselling, surgery, afterSurgery, payments, documents, ops } = await req.json();

  if (!personal || !personal.phone || !personal.name) {
    return NextResponse.json({ error: "Please fill all the required fields" }, { status: 400 });
  }

  const existingPatient = await Patient.findOne({ 'personal.phone': personal.phone });

  if (existingPatient) {
    return NextResponse.json({ error: "Patient already exists" }, { status: 400 });
  }

  try {
    const newPatient = new Patient({
      personal: {
        name: personal.name,
        phone: personal.phone,
        email: personal.email || '',
        age: personal.age || null,
        gender: personal.gender || 'MALE',
        branch: personal.branch || 'Delhi',
        address: personal.address || '',
        profession: personal.profession || '',
        visitDate: personal.visitDate || new Date(),
        reference: personal.reference || null,
        packageQuoted: personal.packageQuoted || '',
        techniqueQuoted: personal.techniqueQuoted || '',
        remarks: personal.remarks || ''
      },
      medical: medical || {},
      counselling: counselling || {},
      surgery: surgery || {},
      afterSurgery: afterSurgery || {},
      payments: payments || {},
      documents: documents || {},
      ops: ops || {}
    });

    const savedPatient = await newPatient.save();

    // Array to track all employee update operations
    const employeeUpdatePromises = [];

    // Helper function to add employee update promise
    const addEmployeeUpdate = (employeeId, fieldName) => {
      if (employeeId) {
        employeeUpdatePromises.push(
          Employee.findByIdAndUpdate(
            employeeId,
            { 
              $push: { 
                patient: savedPatient._id 
              } 
            },
            { new: true }
          ).catch(error => {
            console.error(`Error updating employee ${fieldName} with ID ${employeeId}:`, error);
            return null;
          })
        );
      }
    };

    // Check all reference fields and add update operations
    if (personal.reference) {
      addEmployeeUpdate(personal.reference, 'reference');
    }

    if (counselling && counselling.counsellor) {
      addEmployeeUpdate(counselling.counsellor, 'counsellor');
    }

    if (surgery) {
      // Handle all array fields in surgery
      const arrayFields = ['doctor', 'seniorTech', 'implanterRight', 'implanterLeft', 'graftingPerson', 'helper'];
      
      arrayFields.forEach(field => {
        if (surgery[field]) {
          if (Array.isArray(surgery[field])) {
            surgery[field].forEach((employeeId, index) => {
              addEmployeeUpdate(employeeId, `${field}[${index}]`);
            });
          } else {
            // Backward compatibility: handle if it's still a single ID
            addEmployeeUpdate(surgery[field], field);
          }
        }
      });
    }

    // Execute all employee updates in parallel
    if (employeeUpdatePromises.length > 0) {
      await Promise.all(employeeUpdatePromises);
    }

    return NextResponse.json({ 
      savedPatient, 
      success: true,
      message: `Patient created successfully and ${employeeUpdatePromises.length} employees updated`
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export const POST = withDB(handler);