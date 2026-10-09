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
const db = mongoose.connection.db;

// Let's check all patients with surgeryDate from 2026-08-20 onwards:
const recent = await db.collection("patients").find({
  "surgery.surgeryDate": { $gte: new Date("2026-08-20T00:00:00.000Z") }
}).toArray();

console.log(`Found ${recent.length} patients with surgeryDate >= 2026-08-20:`);
recent.forEach(p => {
  console.log({
    id: p._id,
    name: p.personal?.name,
    personalBranch: p.personal?.branch,
    surgeryLocation: p.surgery?.location,
    surgeryDate: p.surgery?.surgeryDate,
    readyForSurgery: p.counselling?.readyForSurgery,
    opsStatus: p.ops?.status,
    hasDoctor: !!(p.surgery?.doctor && p.surgery.doctor.length > 0),
    doctor: p.surgery?.doctor,
    graftsImplanted: p.surgery?.graftsImplanted,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  });
});

// Let's check if there are any patients with counselling.readyForSurgery === true created or updated recently
const readyPatients = await db.collection("patients").find({
  "counselling.readyForSurgery": true,
  updatedAt: { $gte: new Date("2026-08-20T00:00:00.000Z") }
}).limit(10).toArray();

console.log(`\nPatients readyForSurgery updated >= 2026-08-20: ${readyPatients.length}`);

// Let's check patients with ops.status === "SURGERY_BOOKED"
const bookedPatients = await db.collection("patients").find({
  "ops.status": "SURGERY_BOOKED"
}).countDocuments();
console.log(`\nTotal patients with ops.status === 'SURGERY_BOOKED': ${bookedPatients}`);

await mongoose.disconnect();
