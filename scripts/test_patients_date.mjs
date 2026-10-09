import fs from "fs";
import mongoose from "mongoose";

for (const f of [".env.local", ".env"]) {
  if (fs.existsSync(f)) {
    try { process.loadEnvFile(f); } catch {}
  }
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const istDateString = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const now = new Date();
const todayStr = istDateString(now);

const y = new Date(now);
y.setDate(y.getDate() - 1);
const yesterdayStr = istDateString(y);

const past7 = new Date(now);
past7.setDate(past7.getDate() - 7);
const past7Str = istDateString(past7);

const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
const monthStartStr = istDateString(monthStart);

console.log("Today:", todayStr);
console.log("Yesterday:", yesterdayStr);
console.log("Last 7 Days:", past7Str, "to", todayStr);
console.log("This Month:", monthStartStr, "to", todayStr);

const getStart = (str) => new Date(str + "T00:00:00.000+05:30");
const getEnd = (str) => new Date(str + "T23:59:59.999+05:30");

const countToday = await db.collection("patients").countDocuments({ "personal.visitDate": { $gte: getStart(todayStr), $lte: getEnd(todayStr) } });
const countYesterday = await db.collection("patients").countDocuments({ "personal.visitDate": { $gte: getStart(yesterdayStr), $lte: getEnd(yesterdayStr) } });
const count7Days = await db.collection("patients").countDocuments({ "personal.visitDate": { $gte: getStart(past7Str), $lte: getEnd(todayStr) } });
const countMonth = await db.collection("patients").countDocuments({ "personal.visitDate": { $gte: getStart(monthStartStr), $lte: getEnd(todayStr) } });

import { resolveDateRange, toDateQuery } from "../src/lib/dateHelpers.js";

function testGetPatientQuery(dateFrom, dateTo, all) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (all) params.set("all", "1");

  const dateRange = resolveDateRange(params);
  const visitDateQuery = toDateQuery(dateRange);
  return { dateRange, visitDateQuery };
}

console.log("resolveDateRange for This Month:", testGetPatientQuery("2026-09-01", "2026-09-16"));
console.log("resolveDateRange for Today:", testGetPatientQuery("2026-09-16", "2026-09-16"));

const sampleAssigned = await db.collection("patients").find({ "counselling.counsellor": { $ne: null } })
  .project({ "personal.name": 1, "personal.branch": 1, "counselling.counsellor": 1, "personal.visitDate": 1 })
  .limit(3)
  .toArray();

console.log("Raw assigned in Mongo:", sampleAssigned);

for (const p of sampleAssigned) {
  const emp = await db.collection("employees").findOne({ _id: p.counselling?.counsellor }, { projection: { name: 1 } });
  console.log(`Patient: ${p.personal?.name} -> Counsellor: ${emp?.name}`);
}

process.exit(0);
