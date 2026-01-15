// scripts/migrateTransactionSchemaAdvanced.js
import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/";

async function migrateTransactionSchema() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    const transactionsCollection = db.collection("transactions");

    const totalDocs = await transactionsCollection.countDocuments();
    console.log(`📊 Total transaction documents: ${totalDocs}`);

    // Process in batches for better performance
    const batchSize = 100;
    let processed = 0;

    const cursor = transactionsCollection.find({
      $or: [
        { editors: { $exists: false } },
        { createdBy: { $exists: false } }
      ]
    });

    const documentsToUpdate = await cursor.toArray();
    console.log(`📝 Documents to update: ${documentsToUpdate.length}`);

    for (let i = 0; i < documentsToUpdate.length; i += batchSize) {
      const batch = documentsToUpdate.slice(i, i + batchSize);
      
      const bulkOps = batch.map(doc => ({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              editors: [],
              createdBy: {
                name: "Legacy Data",
                email: "legacy@system.com",
                branch: doc.branch || "Unknown",
                date: doc.date || doc.createdAt || new Date()
              }
            }
          }
        }
      }));

      const result = await transactionsCollection.bulkWrite(bulkOps);
      processed += result.modifiedCount;
      console.log(`🔄 Progress: ${processed}/${documentsToUpdate.length} documents updated`);
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`📊 Total documents updated: ${processed}`);

    // Verify
    const verifyCount = await transactionsCollection.countDocuments({
      editors: { $exists: true },
      createdBy: { $exists: true }
    });
    console.log(`✔️  Documents with new fields: ${verifyCount}`);

    // Show sample of migrated data
    const sample = await transactionsCollection.findOne({ editors: { $exists: true } });
    console.log("\n📋 Sample migrated document:");
    console.log(JSON.stringify({
      _id: sample._id,
      branch: sample.branch,
      createdBy: sample.createdBy,
      editors: sample.editors
    }, null, 2));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
}

migrateTransactionSchema();