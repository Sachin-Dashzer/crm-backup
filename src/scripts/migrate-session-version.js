import mongoose from "mongoose";
import User from "../models/User.js";

const DEFAULT_BRANCH = "Mumbai";

async function migrate() {
  try {
    await mongoose.connect("mongodb+srv://sachindashzer:user8520@crm.hwjor1r.mongodb.net/");
    console.log("✅ MongoDB Connected");

    const result = await User.updateMany(
      { branch: { $exists: false } },
      { $set: { branch: DEFAULT_BRANCH } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
