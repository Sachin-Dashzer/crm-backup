import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Patient from "@/models/Patient";

const handler = async (req) => {
  try {
    // Find all patients with old 'helper' field
    const patientsToMigrate = await Patient.find({
      "surgery.helper": { $exists: true, $ne: null }
    });

    console.log(`Found ${patientsToMigrate.length} patients to migrate`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each patient
    for (const patient of patientsToMigrate) {
      try {
        // Convert single helper to array
        await Patient.updateOne(
          { _id: patient._id },
          {
            $set: {
              "surgery.helpers": [patient.surgery.helper]
            },
            $unset: {
              "surgery.helper": ""
            }
          }
        );
        
        successCount++;
        console.log(`✓ Migrated patient: ${patient.personal?.name} (${patient._id})`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = `Failed to migrate ${patient._id}: ${error.message}`;
        console.error(`✗ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Migration completed",
      totalFound: patientsToMigrate.length,
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 200 });

  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to run migration",
        details: error.message 
      },
      { status: 500 }
    );
  }
};

export const PUT = withDB(handler);