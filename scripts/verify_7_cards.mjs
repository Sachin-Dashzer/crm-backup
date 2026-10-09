import mongoose from "mongoose";
import fs from "fs";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "../src/constants/bankRouting.js";
import { getISTStartOfDay, getISTEndOfDay } from "../src/lib/dateHelpers.js";

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

const CONVERTED_STATUSES = ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];

async function verifyKpiQuery(fromStr, toStr, branch = "All") {
  const fromDate = getISTStartOfDay(fromStr);
  const toDate = getISTEndOfDay(toStr);

  const daysDifference =
    Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const comparisonEnd = new Date(fromDate.getTime() - 1);
  const comparisonStart = new Date(
    fromDate.getTime() - daysDifference * 24 * 60 * 60 * 1000,
  );

  const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

  const facetRes = await db.collection("patients").aggregate([
    {
      $match: {
        ...branchFilter,
        $or: [
          { "personal.visitDate": { $gte: fromDate, $lte: toDate } },
          { "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd } },
        ],
      },
    },
    {
      $facet: {
        currentTotalLeads: [
          { $match: { "personal.visitDate": { $gte: fromDate, $lte: toDate } } },
          { $count: "count" },
        ],
        currentBookingDone: [
          {
            $match: {
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "ops.status": "BOOKING_DONE",
            },
          },
          { $count: "count" },
        ],
        currentSurgeryBooked: [
          {
            $match: {
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "ops.status": "SURGERY_BOOKED",
            },
          },
          { $count: "count" },
        ],
        currentConverted: [
          {
            $match: {
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "ops.status": { $in: CONVERTED_STATUSES },
            },
          },
          { $count: "count" },
        ],
        currentNotConverted: [
          {
            $match: {
              "personal.visitDate": { $gte: fromDate, $lte: toDate },
              "ops.status": "NOT_CONVERTED",
            },
          },
          { $count: "count" },
        ],
        comparisonTotalLeads: [
          {
            $match: {
              "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
            },
          },
          { $count: "count" },
        ],
        comparisonBookingDone: [
          {
            $match: {
              "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
              "ops.status": "BOOKING_DONE",
            },
          },
          { $count: "count" },
        ],
        comparisonSurgeryBooked: [
          {
            $match: {
              "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
              "ops.status": "SURGERY_BOOKED",
            },
          },
          { $count: "count" },
        ],
        comparisonConverted: [
          {
            $match: {
              "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
              "ops.status": { $in: CONVERTED_STATUSES },
            },
          },
          { $count: "count" },
        ],
        comparisonNotConverted: [
          {
            $match: {
              "personal.visitDate": { $gte: comparisonStart, $lte: comparisonEnd },
              "ops.status": "NOT_CONVERTED",
            },
          },
          { $count: "count" },
        ],
      },
    },
  ]).toArray();

  const r = facetRes[0];

  // Revenue
  const revRes = await db.collection("transactions").aggregate([
    {
      $match: {
        costType: "Revenue",
        ...(branch === "All" ? {} : { branch }),
        method: { $nin: UNSETTLED_METHODS },
        ...SETTLEMENT_EXCLUSION,
        date: { $gte: fromDate, $lte: toDate },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]).toArray();

  // Active agents
  const activeAgents = await db.collection("employees").countDocuments({
    role: "Agent",
    isactive: true,
    ...(branch === "All" ? {} : { branch }),
  });

  const totalAppts = r.currentTotalLeads[0]?.count || 0;
  const bookingDone = r.currentBookingDone[0]?.count || 0;
  const surgeryBooked = r.currentSurgeryBooked[0]?.count || 0;
  const converted = r.currentConverted[0]?.count || 0;
  const notConverted = r.currentNotConverted[0]?.count || 0;
  const revenue = revRes[0]?.total || 0;
  const conversionRate = totalAppts > 0 ? Math.round((converted / totalAppts) * 100) : 0;

  console.log(`\n=== Period: ${fromStr} to ${toStr} | Branch: ${branch} ===`);
  console.log({
    "Card 1 - Section A (Total Revenue)": revenue,
    "Card 1 - Section B (Conversion Rate)": `${conversionRate}%`,
    "Card 2 (Total Appointments)": totalAppts,
    "Card 3 (Booking Done)": bookingDone,
    "Card 4 (Surgery Booked)": surgeryBooked,
    "Card 5 (Converted)": converted,
    "Card 6 (Not Converted)": notConverted,
    "Card 7 (Active Agents)": activeAgents,
    "Comparison Booking Done": r.comparisonBookingDone[0]?.count || 0,
    "Comparison Surgery Booked": r.comparisonSurgeryBooked[0]?.count || 0,
    "Comparison Converted": r.comparisonConverted[0]?.count || 0,
    "Comparison Not Converted": r.comparisonNotConverted[0]?.count || 0,
  });
}

await verifyKpiQuery("2026-09-01", "2026-09-15", "All");
await verifyKpiQuery("2026-09-15", "2026-09-15", "All");
await verifyKpiQuery("2026-09-08", "2026-09-15", "All");
await verifyKpiQuery("2026-09-01", "2026-09-15", "Delhi");

await mongoose.disconnect();
