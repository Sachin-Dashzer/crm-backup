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

console.log("=== INSPECTING ACTUAL DATABASE VALUES FOR 7 CARDS ===");

// 1. Check all ops.status distinct values in Patient collection
const distinctStatuses = await db.collection("patients").distinct("ops.status");
console.log("\nDistinct ops.status values:", distinctStatuses);

// 2. Count per status overall
const statusCounts = await db.collection("patients").aggregate([
  { $group: { _id: "$ops.status", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log("\nTotal counts by ops.status:", statusCounts);

// 3. In September 2026 (current month)
const septCounts = await db.collection("patients").aggregate([
  {
    $match: {
      "personal.visitDate": {
        $gte: new Date("2026-09-01T00:00:00.000Z"),
        $lte: new Date("2026-09-15T23:59:59.999Z")
      }
    }
  },
  { $group: { _id: "$ops.status", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
console.log("\nCounts by ops.status in Sept 2026:", septCounts);

// 4. Check BOOKING_DONE patients sample
const bookingDoneSample = await db.collection("patients").find({
  "ops.status": "BOOKING_DONE"
}).limit(3).toArray();
console.log("\nSample BOOKING_DONE patients:");
bookingDoneSample.forEach(p => console.log({
  id: p._id,
  name: p.personal?.name,
  branch: p.personal?.branch,
  visitDate: p.personal?.visitDate,
  status: p.ops?.status
}));

// 5. Check SURGERY_BOOKED patients sample
const surgeryBookedSample = await db.collection("patients").find({
  "ops.status": "SURGERY_BOOKED"
}).limit(3).toArray();
console.log("\nSample SURGERY_BOOKED patients:");
surgeryBookedSample.forEach(p => console.log({
  id: p._id,
  name: p.personal?.name,
  branch: p.personal?.branch,
  visitDate: p.personal?.visitDate,
  surgeryDate: p.surgery?.surgeryDate,
  status: p.ops?.status
}));

// 6. Check CLOSED patients sample
const closedSample = await db.collection("patients").find({
  "ops.status": "CLOSED"
}).limit(3).toArray();
console.log("\nSample CLOSED patients:");
closedSample.forEach(p => console.log({
  id: p._id,
  name: p.personal?.name,
  branch: p.personal?.branch,
  visitDate: p.personal?.visitDate,
  status: p.ops?.status
}));

// 7. Check NOT_CONVERTED patients sample
const notConvertedSample = await db.collection("patients").find({
  "ops.status": "NOT_CONVERTED"
}).limit(3).toArray();
console.log("\nSample NOT_CONVERTED patients:");
notConvertedSample.forEach(p => console.log({
  id: p._id,
  name: p.personal?.name,
  branch: p.personal?.branch,
  visitDate: p.personal?.visitDate,
  status: p.ops?.status
}));

// 8. Total appointments check
const totalSeptVisits = await db.collection("patients").countDocuments({
  "personal.visitDate": {
    $gte: new Date("2026-09-01T00:00:00.000Z"),
    $lte: new Date("2026-09-15T23:59:59.999Z")
  }
});
console.log("\nTotal appointments in Sept 2026 (personal.visitDate):", totalSeptVisits);

// 9. Revenue check
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "../src/constants/bankRouting.js";
const septRev = await db.collection("transactions").aggregate([
  {
    $match: {
      costType: "Revenue",
      method: { $nin: UNSETTLED_METHODS },
      ...SETTLEMENT_EXCLUSION,
      date: {
        $gte: new Date("2026-09-01T00:00:00.000Z"),
        $lte: new Date("2026-09-15T23:59:59.999Z")
      }
    }
  },
  { $group: { _id: null, total: { $sum: "$amount" } } }
]).toArray();
console.log("Total Settled Revenue in Sept 2026:", septRev[0]?.total);

// 10. Active agents check
const agentCount = await db.collection("employees").countDocuments({
  role: "Agent",
  isactive: true
});
console.log("Active agents count:", agentCount);

await mongoose.disconnect();
console.log("\nDone!");
