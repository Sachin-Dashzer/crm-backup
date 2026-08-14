import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import { COLLAB_BRANCHES } from "@/lib/branches";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

// Read-only listing — the collab panel needs it for its own settlement view. Money movements
// (creating or deleting a settlement) stay admin-only; see settlements/create and
// settlements/[id].
const ALLOWED_ROLES = ["collab", "admin", "super-admin"];

// Returns each case with derived numbers computed via a single aggregation
// (lookup into Transactions for collectedByUs, read-only) — no N+1 per row.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const clinic = searchParams.get("clinic") || "";
    const status = searchParams.get("status") || "";
    const patient = searchParams.get("patient") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const search = searchParams.get("search") || "";

    // Explicit collab-branch guard — never rely on the schema enum alone.
    const match = { clinic: { $in: COLLAB_BRANCHES } };
    if (clinic) {
      if (!COLLAB_BRANCHES.includes(clinic)) {
        return NextResponse.json({ error: "Invalid clinic" }, { status: 400 });
      }
      match.clinic = clinic;
    }
    if (status) match.status = status;
    if (patient) match.patient = new mongoose.Types.ObjectId(patient);
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        match.createdAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        match.createdAt.$lte = to;
      }
    }

    const txCollection = Transactions.collection.name;
    const patientCollection = Patient.collection.name;

    const basePipeline = [
      { $match: match },
      {
        // Read-only — the gross revenue Transaction this case generated, matched by
        // provenance link rather than by patient, so an unrelated direct-payment
        // transaction for the same patient can never be mistaken for collab money.
        // collabSplit records who physically COLLECTED what; the transaction's own
        // `amount` is the gross package and must not be read as "collected by us".
        $lookup: {
          from: txCollection,
          let: { caseId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$collabRef.caseId", "$$caseId"] },
                    { $eq: ["$costType", "Revenue"] },
                    { $not: [{ $in: ["$approvalStatus", ["PENDING", "REJECTED"]] }] },
                    { $not: [{ $in: ["$method", UNSETTLED_METHODS] }] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                ourReceived: { $sum: { $ifNull: ["$collabSplit.ourReceived", 0] } },
                clinicReceived: { $sum: { $ifNull: ["$collabSplit.clinicReceived", 0] } },
                grossRevenue: { $sum: "$amount" },
              },
            },
          ],
          as: "revenueAgg",
        },
      },
      {
        $lookup: {
          from: patientCollection,
          localField: "patient",
          foreignField: "_id",
          as: "patientDoc",
        },
      },
      {
        $addFields: {
          // New collab flow: authoritative split off the linked transaction.
          // Legacy fallback: cases created before collabSplit existed still carry
          // their money in clinicCollections[], so old rows keep displaying correctly.
          collectedByUs: { $ifNull: [{ $arrayElemAt: ["$revenueAgg.ourReceived", 0] }, 0] },
          collectedByClinic: {
            $ifNull: [
              { $arrayElemAt: ["$revenueAgg.clinicReceived", 0] },
              { $sum: "$clinicCollections.amount" },
            ],
          },
          patientInfo: { $arrayElemAt: ["$patientDoc", 0] },
        },
      },
      {
        $addFields: {
          patientOutstanding: {
            $subtract: ["$packageAmount", { $add: ["$collectedByUs", "$collectedByClinic"] }],
          },
          caseNet: { $subtract: ["$collectedByClinic", "$clinicShare"] },
          patientName: "$patientInfo.personal.name",
          patientPhone: "$patientInfo.personal.phone",
          // Drives the "Patient paid · ₹X with clinic" badge. The patient's own record
          // deliberately still shows this money as unpaid (collab money never touches
          // Patient.payments), so this flag is what stops staff chasing a patient who
          // has in fact already paid in full — just to the partner clinic.
          paidToClinic: {
            $ifNull: [{ $arrayElemAt: ["$revenueAgg.clinicReceived", 0] }, 0],
          },
        },
      },
      { $project: { revenueAgg: 0, patientDoc: 0, patientInfo: 0 } },
    ];

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      basePipeline.push({
        $match: {
          $or: [
            { patientName: searchRegex },
            { patientPhone: searchRegex },
            { remarks: searchRegex },
          ],
        },
      });
    }

    basePipeline.push({ $sort: { createdAt: -1 } });

    const [rows, totalAgg] = await Promise.all([
      CollabCase.aggregate([...basePipeline, { $skip: (page - 1) * limit }, { $limit: limit }]),
      CollabCase.aggregate([...basePipeline, { $count: "total" }]),
    ]);

    // Empirical guard, not just structural: fail loudly if a non-collab
    // branch ever slipped through.
    const leaked = rows.filter((r) => !COLLAB_BRANCHES.includes(r.clinic));
    if (leaked.length > 0) {
      console.error("Collab case query returned non-collab-branch rows:", leaked.map((r) => r._id));
    }

    return NextResponse.json({
      success: true,
      cases: rows,
      total: totalAgg[0]?.total || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error listing collab cases:", error);
    return NextResponse.json({ error: "Failed to fetch collab cases" }, { status: 500 });
  }
}
