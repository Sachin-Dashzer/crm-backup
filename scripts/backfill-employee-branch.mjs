
import mongoose from "mongoose";
import fs from "fs";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MONGODB_URI missing — checked .env.local and .env.");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DEFAULT_BRANCH = "Delhi";

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log("=".repeat(90) + "\n");

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({}, { strict: false, collection: "employees" }));

  const missingFilter = { $or: [{ branch: { $exists: false } }, { branch: null }, { branch: "" }] };

  const missingCount = await Employee.countDocuments(missingFilter);
  const totalCount = await Employee.countDocuments({});
  console.log(`Total employees: ${totalCount}`);
  console.log(`Missing branch:  ${missingCount}\n`);

  if (missingCount === 0) {
    console.log("Nothing to backfill — every employee already has a branch.");
    await mongoose.disconnect();
    return;
  }

  const sample = await Employee.find(missingFilter).select("name role isactive").limit(10).lean();
  console.log("Sample of affected employees:");
  sample.forEach((e) => console.log(`  ${e.name || "(no name)"} — ${e.role || "(no role)"} — id ${e._id}`));
  if (missingCount > sample.length) console.log(`  ...and ${missingCount - sample.length} more`);

  if (APPLY) {
    const result = await Employee.updateMany(missingFilter, { $set: { branch: DEFAULT_BRANCH } });
    console.log(`\nUpdated ${result.modifiedCount} employee(s) to branch: "${DEFAULT_BRANCH}".`);

    const stillMissing = await Employee.countDocuments(missingFilter);
    console.log(`Remaining without branch: ${stillMissing}`);
  } else {
    console.log(`\n(dry run — pass --apply to set branch: "${DEFAULT_BRANCH}" on all ${missingCount} of these)`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
