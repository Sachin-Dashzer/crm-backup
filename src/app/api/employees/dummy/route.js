import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    console.log("Starting patient data migration...");

    // Define surgery fields array at the top level
    const surgeryFields = [
      "doctor",
      "seniorTech",
      "implanterRight",
      "implanterLeft",
      "graftingPerson",
      "helper",
    ];

    // Get all patients
    const patients = await Patient.find({});
    console.log(`Found ${patients.length} patients to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;
    const migrationDetails = [];

    // Process each patient
    for (const patient of patients) {
      try {
        let needsUpdate = false;
        const updates = {};

        // ========================================
        // Convert Surgery Team Fields to Arrays
        // ========================================
        surgeryFields.forEach((field) => {
          const fieldValue = patient.surgery?.[field];

          // Check if field is NOT already an array
          if (fieldValue !== undefined && fieldValue !== null) {
            if (!Array.isArray(fieldValue)) {
              // Convert single ObjectId to array
              updates[`surgery.${field}`] = [fieldValue];
              needsUpdate = true;
            }
          } else {
            // Set empty array if null/undefined
            updates[`surgery.${field}`] = [];
            needsUpdate = true;
          }
        });

        // ========================================
        // Handle afterSurgery Section
        // ========================================
        if (!patient.afterSurgery) {
          // afterSurgery doesn't exist at all - create it
          updates.afterSurgery = {
            headwashDate: null,
            bandageRemovalDate: null,
            prp: [],
          };
          needsUpdate = true;
        } else {
          // afterSurgery exists - check and fix each field

          // Check headwashDate
          if (patient.afterSurgery.headwashDate === undefined) {
            updates["afterSurgery.headwashDate"] = null;
            needsUpdate = true;
          }

          // Check bandageRemovalDate
          if (patient.afterSurgery.bandageRemovalDate === undefined) {
            updates["afterSurgery.bandageRemovalDate"] = null;
            needsUpdate = true;
          }

          // Check prp array
          if (!patient.afterSurgery.prp) {
            updates["afterSurgery.prp"] = [];
            needsUpdate = true;
          } else if (Array.isArray(patient.afterSurgery.prp)) {
            // Validate and fix prp array structure
            const validatedPRP = patient.afterSurgery.prp.map((session, index) => {
              return {
                prpNumber: session.prpNumber || index + 1,
                date: session.date || null,
              };
            });

            // Check if any session was invalid
            const hasInvalidSessions = patient.afterSurgery.prp.some(
              (session) => !session.prpNumber || !session.date
            );

            if (hasInvalidSessions) {
              updates["afterSurgery.prp"] = validatedPRP;
              needsUpdate = true;
            }
          } else {
            // prp is not an array, convert to array
            updates["afterSurgery.prp"] = [];
            needsUpdate = true;
          }
        }

        // ========================================
        // Apply Updates
        // ========================================
        if (needsUpdate) {
          await Patient.updateOne({ _id: patient._id }, { $set: updates });
          migratedCount++;

          migrationDetails.push({
            patientId: patient._id.toString(),
            name: patient.personal?.name || "N/A",
            phone: patient.personal?.phone || "N/A",
            updatedFields: Object.keys(updates),
          });
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error migrating patient ${patient._id}:`, error);
        migrationDetails.push({
          patientId: patient._id.toString(),
          name: patient.personal?.name || "N/A",
          error: error.message,
        });
      }
    }

    // ========================================
    // Update Employee References
    // ========================================
    console.log("Updating employee references...");
    const employees = await Employee.find({});
    let employeesUpdated = 0;

    for (const employee of employees) {
      try {
        // Find all patients referencing this employee
        const referencedPatients = await Patient.find({
          $or: [
            { "personal.reference": employee._id },
            { "counselling.counsellor": employee._id },
            { "surgery.doctor": employee._id },
            { "surgery.seniorTech": employee._id },
            { "surgery.implanterRight": employee._id },
            { "surgery.implanterLeft": employee._id },
            { "surgery.graftingPerson": employee._id },
            { "surgery.helper": employee._id },
          ],
        }).select("_id");

        const patientIds = referencedPatients.map((p) => p._id);

        // Update employee's patient array
        await Employee.updateOne(
          { _id: employee._id },
          { $set: { patient: patientIds } }
        );

        employeesUpdated++;
      } catch (error) {
        console.error(`Error updating employee ${employee._id}:`, error);
      }
    }

    // ========================================
    // Detailed Verification
    // ========================================
    console.log("Verifying migration...");
    const verificationResults = await Patient.find({}).select(
      "personal surgery afterSurgery"
    );

    let validCount = 0;
    let invalidCount = 0;
    const issues = [];

    verificationResults.forEach((patient) => {
      let hasIssues = false;
      const patientIssues = [];

      // Check if all surgery fields are arrays
      surgeryFields.forEach((field) => {
        if (
          patient.surgery?.[field] !== undefined &&
          patient.surgery?.[field] !== null &&
          !Array.isArray(patient.surgery[field])
        ) {
          hasIssues = true;
          patientIssues.push(`surgery.${field} is not an array`);
        }
      });

      // Check afterSurgery structure
      if (!patient.afterSurgery) {
        hasIssues = true;
        patientIssues.push("afterSurgery section missing");
      } else {
        // Check headwashDate exists (can be null, but should be defined)
        if (patient.afterSurgery.headwashDate === undefined) {
          hasIssues = true;
          patientIssues.push("afterSurgery.headwashDate is undefined");
        }

        // Check bandageRemovalDate exists (can be null, but should be defined)
        if (patient.afterSurgery.bandageRemovalDate === undefined) {
          hasIssues = true;
          patientIssues.push("afterSurgery.bandageRemovalDate is undefined");
        }

        // Check prp array
        if (!patient.afterSurgery.prp) {
          hasIssues = true;
          patientIssues.push("afterSurgery.prp is missing");
        } else if (!Array.isArray(patient.afterSurgery.prp)) {
          hasIssues = true;
          patientIssues.push("afterSurgery.prp is not an array");
        } else {
          // Validate prp array structure
          patient.afterSurgery.prp.forEach((session, index) => {
            if (typeof session !== "object" || session === null) {
              hasIssues = true;
              patientIssues.push(`prp[${index}] is not an object`);
            } else {
              if (
                session.prpNumber === undefined &&
                session.date === undefined
              ) {
                hasIssues = true;
                patientIssues.push(
                  `prp[${index}] missing prpNumber and date fields`
                );
              }
            }
          });
        }
      }

      if (hasIssues) {
        invalidCount++;
        issues.push({
          patientId: patient._id.toString(),
          patientName: patient.personal?.name || "N/A",
          issues: patientIssues,
        });
      } else {
        validCount++;
      }
    });

    // ========================================
    // Sample Data Check
    // ========================================
    const samplePatients = await Patient.find({})
      .limit(3)
      .select("personal afterSurgery surgery")
      .populate("surgery.doctor", "name")
      .populate("surgery.seniorTech", "name");

    const sampleData = samplePatients.map((p) => ({
      name: p.personal?.name,
      afterSurgery: {
        headwashDate: p.afterSurgery?.headwashDate,
        bandageRemovalDate: p.afterSurgery?.bandageRemovalDate,
        prpCount: p.afterSurgery?.prp?.length || 0,
        prpSample: p.afterSurgery?.prp?.[0] || null,
      },
      surgeryTeam: {
        doctors: p.surgery?.doctor?.map(d => d.name) || [],
        seniorTechs: p.surgery?.seniorTech?.map(t => t.name) || [],
        doctorCount: p.surgery?.doctor?.length || 0,
        seniorTechCount: p.surgery?.seniorTech?.length || 0,
      },
    }));

    // ========================================
    // Response
    // ========================================
    return NextResponse.json(
      {
        success: true,
        message: "Migration completed successfully",
        summary: {
          totalPatients: patients.length,
          migrated: migratedCount,
          skipped: skippedCount,
          employeesUpdated: employeesUpdated,
        },
        verification: {
          valid: validCount,
          invalid: invalidCount,
          totalIssues: issues.length,
          issues: issues.length > 0 ? issues.slice(0, 5) : [],
          note:
            issues.length > 5
              ? `Showing first 5 of ${issues.length} issues`
              : null,
        },
        sampleData: sampleData,
        migrationDetails:
          migrationDetails.length > 0 ? migrationDetails.slice(0, 10) : [],
        detailsNote:
          migrationDetails.length > 10
            ? `Showing first 10 of ${migrationDetails.length} migration details`
            : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Migration failed",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
};

export const GET = withDB(handler);
 