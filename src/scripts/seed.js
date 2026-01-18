import mongoose from "mongoose";

// Load environment variables

const MONGODB_URI = "mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/";
// const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in your .env.local file");
}

async function addPurposeField() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    const db = mongoose.connection.db;
    const patientsCollection = db.collection("patients");

    // Find all patients that don't have the purpose field
    const patientsWithoutPurpose = await patientsCollection.countDocuments({
      "personal.purpose": { $exists: false },
    });

    console.log(
      `Found ${patientsWithoutPurpose} patients without purpose field`
    );

    if (patientsWithoutPurpose === 0) {
      console.log("All patients already have the purpose field. No updates needed.");
      await mongoose.disconnect();
      return;
    }

    // Update all patients to add the purpose field with empty string as default
    const result = await patientsCollection.updateMany(
      { "personal.purpose": { $exists: false } },
      { 
        $set: { 
          "personal.purpose": "" // Set to empty string, or use null if you prefer
        } 
      }
    );

    console.log(`Migration completed successfully!`);
    console.log(`Matched: ${result.matchedCount} documents`);
    console.log(`Modified: ${result.modifiedCount} documents`);

    // Verify the update
    const remainingWithoutPurpose = await patientsCollection.countDocuments({
      "personal.purpose": { $exists: false },
    });

    console.log(
      `Remaining patients without purpose field: ${remainingWithoutPurpose}`
    );

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the migration
addPurposeField();