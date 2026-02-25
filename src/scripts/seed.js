// Get MongoDB URI from environment
import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/";



async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    const collection = db.collection("patients");

    // Only update documents that don't already have the products field
    const result = await collection.updateMany(
      { products: { $exists: false } },
      { $set: { products: [] } }
    );

    console.log(`Migration complete!`);
    console.log(`Matched: ${result.matchedCount} documents`);
    console.log(`Modified: ${result.modifiedCount} documents`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

migrate();