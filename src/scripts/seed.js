// Get MongoDB URI from environment
import mongoose from "mongoose";

const MONGODB_URI = "mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/";
// Transaction Schema (minimal for migration)
const transactionSchema = new mongoose.Schema({
  transactionCategory: String,
  costType: String,
  procedure: String,
  amount: Number,
  date: Date,
}, { timestamps: true });

const Transaction = mongoose.model("Transactions", transactionSchema);

/**
 * Migration script to update transactionCategory field
 * Based on existing costType and procedure fields
 */
async function migrateTransactionCategories(dryRun = false) {
  try {
    console.log("🚀 Starting Transaction Category Migration...");
    console.log(`Mode: ${dryRun ? "DRY RUN (no changes will be made)" : "LIVE UPDATE"}`);
    console.log("━".repeat(60));

    // Connect to MongoDB
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI not found in environment variables");
    }

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get total count
    const totalCount = await Transaction.countDocuments();
    console.log(`📊 Total transactions found: ${totalCount}`);
    console.log("━".repeat(60));

    const stats = {
      total: totalCount,
      expense: 0,
      medicine: 0,
      service: 0,
      transplant: 0,
      skipped: 0,
      errors: 0,
    };

    // Process in batches for better performance
    const batchSize = 100;
    let processed = 0;

    while (processed < totalCount) {
      const transactions = await Transaction.find()
        .skip(processed)
        .limit(batchSize)
        .lean();

      const bulkOps = [];

      for (const transaction of transactions) {
        let newCategory = null;

        // Determine the transaction category based on the logic
        if (transaction.costType === "Expenses") {
          newCategory = "EXPENSE";
          stats.expense++;
        } else if (transaction.costType === "Revenue") {
          if (transaction.procedure === "Medicine") {
            newCategory = "MEDICINE";
            stats.medicine++;
          } else if (["PRP", "GFC"].includes(transaction.procedure)) {
            newCategory = "SERVICE";
            stats.service++;
          } else {
            newCategory = "TRANSPLANT";
            stats.transplant++;
          }
        } else {
          // Skip if neither Revenue nor Expenses
          stats.skipped++;
          console.warn(`⚠️  Skipping transaction ${transaction._id}: Unknown costType "${transaction.costType}"`);
          continue;
        }

        // Add to bulk operations
        bulkOps.push({
          updateOne: {
            filter: { _id: transaction._id },
            update: {
              $set: { transactionCategory: newCategory }
            }
          }
        });
      }

      // Execute bulk update if not in dry run mode
      if (!dryRun && bulkOps.length > 0) {
        await Transaction.bulkWrite(bulkOps);
      }

      processed += transactions.length;
      const progress = ((processed / totalCount) * 100).toFixed(1);
      console.log(`⏳ Progress: ${processed}/${totalCount} (${progress}%)`);
    }

    console.log("━".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("━".repeat(60));
    console.log("📈 Summary:");
    console.log(`   Total Processed: ${stats.total}`);
    console.log(`   🏥 TRANSPLANT:   ${stats.transplant}`);
    console.log(`   💉 SERVICE:      ${stats.service}`);
    console.log(`   💊 MEDICINE:     ${stats.medicine}`);
    console.log(`   💰 EXPENSE:      ${stats.expense}`);
    console.log(`   ⏭️  Skipped:      ${stats.skipped}`);
    console.log(`   ❌ Errors:       ${stats.errors}`);
    console.log("━".repeat(60));

    if (dryRun) {
      console.log("⚠️  DRY RUN MODE - No changes were made to the database");
      console.log("   Run with 'npm run migrate:live' to apply changes");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  try {
    console.log("\n🔍 Verifying migration results...");
    console.log("━".repeat(60));

    await mongoose.connect(MONGODB_URI);

    const results = await Transaction.aggregate([
      {
        $group: {
          _id: "$transactionCategory",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log("Current distribution of transactionCategory:");
    results.forEach(result => {
      const category = result._id || "null/undefined";
      console.log(`   ${category}: ${result.count}`);
    });

    // Check for any transactions without transactionCategory
    const missingCategory = await Transaction.countDocuments({
      transactionCategory: { $exists: false }
    });

    const nullCategory = await Transaction.countDocuments({
      transactionCategory: null
    });

    console.log("━".repeat(60));
    console.log(`Transactions missing transactionCategory: ${missingCategory}`);
    console.log(`Transactions with null transactionCategory: ${nullCategory}`);

    if (missingCategory > 0 || nullCategory > 0) {
      console.log("⚠️  Some transactions still need category assignment!");
    } else {
      console.log("✅ All transactions have been categorized!");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || "dry-run";

// Run migration
if (mode === "verify") {
  verifyMigration();
} else {
  const isDryRun = mode !== "live";
  migrateTransactionCategories(isDryRun);
}