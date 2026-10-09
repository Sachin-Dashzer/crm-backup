import fs from "fs";
import mongoose from "mongoose";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const sample = await db.collection("patients").find({ "counselling.counsellor": { $ne: null } }).limit(5).toArray();
console.log("Sample patients with counsellor:");
for (const s of sample) {
  const emp = await db.collection("employees").findOne({ _id: s.counselling?.counsellor });
  console.log({
    patient: s.personal?.name,
    counsellorId: s.counselling?.counsellor,
    counsellorName: emp?.name,
    role: emp?.role
  });
}

const Patient = (await import("../src/models/Patient.js")).default;
const Employee = (await import("../src/models/Employee.js")).default;

const populatedSample = await Patient.find({ "counselling.counsellor": { $ne: null } })
  .select("personal.name counselling.counsellor")
  .populate("counselling.counsellor", "name")
  .limit(3)
  .lean();

console.log("Populated sample:", JSON.stringify(populatedSample, null, 2));

const unassignedSample = await Patient.find({ "counselling.counsellor": null })
  .select("personal.name counselling.counsellor")
  .populate("counselling.counsellor", "name")
  .limit(2)
  .lean();

console.log("Unassigned sample:", JSON.stringify(unassignedSample, null, 2));

process.exit(0);
