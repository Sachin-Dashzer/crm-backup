
import mongoose from "mongoose";
import fs from "fs";
import User from "../src/models/User.js";

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
const RESET_PASSWORD = args.includes("--reset-password");

function argValue(flag, fallback) {
  const prefix = `--${flag}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const EMAIL = argValue("email", "owner@ryancrm.local").toLowerCase();
const PASSWORD = argValue("password", "Owner@12345");
const NAME = argValue("name", "Test Owner");

async function run() {
  console.log("=".repeat(90));
  console.log(APPLY ? "MODE: APPLY  <- will write to the database" : "MODE: DRY RUN  <- nothing will be written");
  console.log("=".repeat(90));
  console.log(`Email:  ${EMAIL}`);
  console.log(`Name:   ${NAME}`);
  console.log(`Role:   owner`);
  console.log(`Branch: All`);
  console.log(`Password: ${APPLY ? PASSWORD : "(hidden in dry run)"}\n`);

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const existing = await User.findOne({ email: EMAIL }).select("+password +sessionVersion");

  if (existing) {
    if (existing.role === "owner" && !RESET_PASSWORD) {
      console.log(`User "${EMAIL}" already exists with role "owner" — nothing to do.`);
    } else {
      console.log(
        existing.role === "owner"
          ? `User "${EMAIL}" already has role "owner" — resetting password (--reset-password).`
          : `User "${EMAIL}" exists with role "${existing.role}" — upgrading to "owner".`
      );
      if (APPLY) {
        existing.role = "owner";
        if (RESET_PASSWORD) existing.password = PASSWORD;
        await existing.save();
        console.log(`Updated user ${existing._id}.`);
      } else {
        console.log("(dry run — pass --apply to write this change)");
      }
    }
  } else {
    console.log(`No existing user for "${EMAIL}" — will create a new one.`);
    if (APPLY) {
      const user = new User({
        name: NAME,
        email: EMAIL,
        password: PASSWORD,
        role: "owner",
        branch: "All",
        sessionVersion: 0,
      });
      await user.save();
      console.log(`Created user ${user._id}.`);
    } else {
      console.log("(dry run — pass --apply to create this user)");
    }
  }

  if (APPLY) {
    console.log("\nLogin with:");
    console.log(`  email:    ${EMAIL}`);
    if (RESET_PASSWORD || !existing) console.log(`  password: ${PASSWORD}`);
    else console.log(`  password: (unchanged — existing password still applies)`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(async (err) => {
  console.error("\nFATAL:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
