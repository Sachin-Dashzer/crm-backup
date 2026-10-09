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

// Let's test the exact query from super-admin dashboard for various ranges:
function buildDateRange(range, custom = {}) {
  const now = new Date();
  let from = new Date(), to = new Date();
  to.setHours(23, 59, 59, 999);

  if (range === "Today") {
    from.setHours(0, 0, 0, 0);
  } else if (range === "Yesterday") {
    from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0);
    to = new Date(from); to.setHours(23, 59, 59, 999);
  } else if (range === "Last 7 Days") {
    from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
  } else if (range === "Last 30 Days") {
    from = new Date(now); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
  } else if (range === "This Month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

console.log("Current system time:", new Date().toISOString());

const ranges = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month"];

for (const r of ranges) {
  const { from, to } = buildDateRange(r);
  const fromDate = new Date(from);
  const toDate = new Date(to);
  
  const countAll = await db.collection("patients").countDocuments({
    "surgery.surgeryDate": { $gte: fromDate, $lte: toDate }
  });

  const countDelhi = await db.collection("patients").countDocuments({
    "personal.branch": "Delhi",
    "surgery.surgeryDate": { $gte: fromDate, $lte: toDate }
  });

  const countHyd = await db.collection("patients").countDocuments({
    "personal.branch": "Hyderabad",
    "surgery.surgeryDate": { $gte: fromDate, $lte: toDate }
  });

  console.log(`Range: ${r} (${from} -> ${to})`);
  console.log(`  All: ${countAll}, Delhi: ${countDelhi}, Hyderabad: ${countHyd}`);
}

// Let's check surgeries for August 2026:
const augCount = await db.collection("patients").countDocuments({
  "surgery.surgeryDate": { 
    $gte: new Date("2026-08-01T00:00:00.000Z"), 
    $lte: new Date("2026-08-31T23:59:59.999Z") 
  }
});
console.log("\nTotal surgeries in August 2026:", augCount);

// Let's check surgery dates in August 2026:
const augSurgeries = await db.collection("patients").aggregate([
  {
    $match: {
      "surgery.surgeryDate": { 
        $gte: new Date("2026-08-01T00:00:00.000Z"), 
        $lte: new Date("2026-08-31T23:59:59.999Z") 
      }
    }
  },
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$surgery.surgeryDate", timezone: "Asia/Kolkata" } },
      count: { $sum: 1 },
      branches: { $addToSet: "$personal.branch" },
      locations: { $addToSet: "$surgery.location" }
    }
  },
  { $sort: { _id: -1 } }
]).toArray();
console.log("August 2026 surgeries by day (in Asia/Kolkata):", JSON.stringify(augSurgeries, null, 2));

await mongoose.disconnect();
