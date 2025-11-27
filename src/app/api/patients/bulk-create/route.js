import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import { withDB } from "@/lib/withDB";
import { NextResponse } from "next/server";

const handler = async (req) => {
  const { patients } = await req.json();

  // Check if patients array exists and is not empty
  if (!patients || !Array.isArray(patients) || patients.length === 0) {
    return NextResponse.json(
      { error: "Please provide an array of patients" },
      { status: 400 }
    );
  }

  // Validate required fields for each patient
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    if (!patient.personal || !patient.personal.phone || !patient.personal.name) {
      return NextResponse.json(
        { error: `Patient at index ${i} is missing required fields (name and phone)` },
        { status: 400 }
      );
    }
  }

  try {
    // Check for existing patients by phone number
    const phoneNumbers = patients.map(p => p.personal.phone);
    const existingPatients = await Patient.find({
      'personal.phone': { $in: phoneNumbers }
    });

    if (existingPatients.length > 0) {
      const existingPhones = existingPatients.map(p => p.personal.phone);
      return NextResponse.json(
        { 
          error: "Some patients already exist", 
          existingPhones 
        },
        { status: 400 }
      );
    }

    // Prepare patients data for insertion
    const patientsToInsert = patients.map(patient => ({
      personal: {
        name: patient.personal.name,
        phone: patient.personal.phone,
        email: patient.personal.email || '',
        age: patient.personal.age || null,
        gender: patient.personal.gender || 'MALE',
        branch: patient.personal.branch || 'Delhi',
        address: patient.personal.address || '',
        profession: patient.personal.profession || '',
        visitDate: patient.personal.visitDate || new Date(),
        reference: patient.personal.reference || null,
        packageQuoted: patient.personal.packageQuoted || '',
        techniqueQuoted: patient.personal.techniqueQuoted || ''
      },
      medical: patient.medical || {},
      counselling: patient.counselling || {},
      surgery: patient.surgery || {},
      payments: patient.payments || {},
      documents: patient.documents || {},
      ops: patient.ops || {}
    }));

    // Insert all patients
    const savedPatients = await Patient.insertMany(patientsToInsert);

    // Collect all employee update operations for all patients
    const employeeUpdatePromises = [];

    // Helper function to add employee update promise
    const addEmployeeUpdate = (employeeId, fieldName, patientId) => {
      if (employeeId) {
        employeeUpdatePromises.push(
          Employee.findByIdAndUpdate(
            employeeId,
            { 
              $push: { 
                patient: patientId 
              } 
            }
          ).catch(error => {
            console.error(`Error updating employee ${fieldName} with ID ${employeeId} for patient ${patientId}:`, error);
            return null; // Don't fail other updates if one fails
          })
        );
      }
    };

    // Process each saved patient to update employee references
    savedPatients.forEach((savedPatient, index) => {
      const originalPatient = patients[index];
      
      // Check all reference fields and add update operations
      if (originalPatient.personal?.reference) {
        addEmployeeUpdate(originalPatient.personal.reference, 'reference', savedPatient._id);
      }

      if (originalPatient.counselling?.counsellor) {
        addEmployeeUpdate(originalPatient.counselling.counsellor, 'counsellor', savedPatient._id);
      }

      if (originalPatient.surgery) {
        if (originalPatient.surgery.doctor) addEmployeeUpdate(originalPatient.surgery.doctor, 'doctor', savedPatient._id);
        if (originalPatient.surgery.seniorTech) addEmployeeUpdate(originalPatient.surgery.seniorTech, 'seniorTech', savedPatient._id);
        if (originalPatient.surgery.implanterRight) addEmployeeUpdate(originalPatient.surgery.implanterRight, 'implanterRight', savedPatient._id);
        if (originalPatient.surgery.implanterLeft) addEmployeeUpdate(originalPatient.surgery.implanterLeft, 'implanterLeft', savedPatient._id);
        if (originalPatient.surgery.graftingPerson) addEmployeeUpdate(originalPatient.surgery.graftingPerson, 'graftingPerson', savedPatient._id);
        if (originalPatient.surgery.helper) addEmployeeUpdate(originalPatient.surgery.helper, 'helper', savedPatient._id);
      }
    });

    // Execute all employee updates in parallel
    if (employeeUpdatePromises.length > 0) {
      const updateResults = await Promise.all(employeeUpdatePromises);
      const successfulUpdates = updateResults.filter(result => result !== null).length;
      
    }

    return NextResponse.json(
      { 
        savedPatients, 
        success: true,
        count: savedPatients.length,
        message: `Successfully created ${savedPatients.length} patients and updated employee references`
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error inserting patients:", error);
    return NextResponse.json(
      { error: "Failed to create patients" },
      { status: 500 }
    );
  }
};

export const POST = withDB(handler);