/**
 * Migration script: backfill `location` field on all Stock documents
 * that have no location set, defaulting to "Hyderabad".
 *
 * Usage (from project root):
 *   node --env-file=.env src/scripts/seed.js
 *
 * Optional: override the default location via env var
 *   DEFAULT_LOCATION=Delhi node --env-file=.env src/scripts/seed.js
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const DEFAULT_LOCATION = process.env.DEFAULT_LOCATION || "Hyderabad";

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set. Run with: node --env-file=.env src/scripts/seed.js");
  process.exit(1);
}

// Minimal Stock schema — only the fields we need for this migration
const stockSchema = new mongoose.Schema({}, { strict: false });
const Stock = mongoose.models.Stock || mongoose.model("Stock", stockSchema);

async function migrate() {
  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("✅  Connected.\n");

  // Find stocks with no location (null, undefined, or empty string)
  const toUpdate = await Stock.countDocuments({
    $or: [
      { location: { $exists: false } },
      { location: null },
      { location: "" },
    ],
  });

  if (toUpdate === 0) {
    console.log("ℹ️   No stocks found without a location. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  console.log(`📦  Found ${toUpdate} stock(s) without a location.`);
  console.log(`🏷️   Setting location → "${DEFAULT_LOCATION}" for all of them...\n`);

  const result = await Stock.updateMany(
    {
      $or: [
        { location: { $exists: false } },
        { location: null },
        { location: "" },
      ],
    },
    {
      $set: { location: DEFAULT_LOCATION },
    }
  );

  console.log(`✅  Migration complete!`);
  console.log(`    • Matched : ${result.matchedCount}`);
  console.log(`    • Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
  console.log("\n🔌  Disconnected from MongoDB.");
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err.message);
  process.exit(1);
});
