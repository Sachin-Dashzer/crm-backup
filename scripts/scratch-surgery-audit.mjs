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
await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");

const db = mongoose.connection.db;

// 1. Total patients with surgery.surgeryDate
const totalWithSurgeryDate = await db.collection("patients").countDocuments({
  "surgery.surgeryDate": { $exists: true, $ne: null }
});
console.log("1. Total patients with non-null surgery.surgeryDate:", totalWithSurgeryDate);

// 2. Sample 5 surgery records
const sampleSurgeries = await db.collection("patients").find({
  "surgery.surgeryDate": { $exists: true, $ne: null }
}).sort({ "surgery.surgeryDate": -1 }).limit(5).toArray();

console.log("2. Sample 5 recent surgeries:", JSON.stringify(sampleSurgeries.map(p => ({
  _id: p._id,
  name: p.personal?.name,
  branch: p.personal?.branch,
  location: p.surgery?.location,
  surgeryDate: p.surgery?.surgeryDate,
  surgeryDateType: typeof p.surgery?.surgeryDate,
  isDateInstance: p.surgery?.surgeryDate instanceof Date,
  technique: p.surgery?.technique,
  doctor: p.surgery?.doctor,
  status: p.ops?.status
})), null, 2));

// 3. Check surgery dates distribution across recent dates
const recentSurgeries = await db.collection("patients").aggregate([
  { $match: { "surgery.surgeryDate": { $exists: true, $ne: null } } },
  { $project: {
      surgeryDate: "$surgery.surgeryDate",
      branch: "$personal.branch",
      location: "$surgery.location"
  }},
  { $sort: { surgeryDate: -1 } },
  { $limit: 15 }
]).toArray();
console.log("3. Most recent 15 surgery dates in DB:", JSON.stringify(recentSurgeries, null, 2));

// 4. Check if there is a separate surgeries collection
const collections = await db.listCollections().toArray();
const surgeryColls = collections.filter(c => c.name.toLowerCase().includes("surg"));
console.log("4. Surgery collections:", surgeryColls.map(c => c.name));

// 5. Check transactions for transplants / surgery
const transplantTxCount = await db.collection("transactions").countDocuments({
  transactionCategory: { $in: ["TRANSPLANT", "SURGERY"] }
});
console.log("5. Transactions with TRANSPLANT/SURGERY category:", transplantTxCount);

await mongoose.disconnect();
console.log("Done inspection.");
