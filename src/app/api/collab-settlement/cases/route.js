import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import { COLLAB_BRANCHES } from "@/lib/branches";

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
        // The live source of truth for what this case has actually collected — every
        // collabRef.caseId-linked Revenue transaction, both createCollabCaseAtomic's
        // at-creation collections and every later instalment recordCollabCollectionAtomic
        // records (see src/lib/collabDerivation.js). Matched by provenance link rather than by
        // patient, so an unrelated direct-payment transaction for the same patient can never be
        // mistaken for collab money.
        //
        // collectedBy is read off the transaction's own `method`, not a separate split field —
        // revenue is now recognised only when actually collected, so the gross package amount no
        // longer appears anywhere: "paid_to_external" is exactly the CLINIC-collected marker
        // (createCollectionTransaction's collectedBy:"CLINIC" branch); anything else collected by
        // this case's Revenue transactions was collected by US. collabSplit is never set by the
        // current write path, and clinicCollections[] is audit-log only (mixes both
        // collectedBy kinds without discriminating) — neither is a valid source for these totals
        // any more.
        //
        // receivableId excluded (must be null): crystalliseClinicShare's offset_settlement
        // transaction and a later real THEY_PAID settlement both carry receivableId and represent
        // the SAME money the paid_to_external row already counted here — counting them too would
        // double it.
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
                    { $eq: [{ $ifNull: ["$receivableId", null] }, null] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                ourReceived: {
                  $sum: { $cond: [{ $ne: ["$method", "paid_to_external"] }, "$amount", 0] },
                },
                clinicReceived: {
                  $sum: { $cond: [{ $eq: ["$method", "paid_to_external"] }, "$amount", 0] },
                },
                totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
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
          // Both figures now come straight from revenueAgg — the case's Transactions are the
          // sole source of truth (see the $lookup comment above). Nothing else to add:
          // clinicCollections[] no longer contributes, since it mixes collectedBy:"US" and
          // collectedBy:"CLINIC" entries without being discriminated the way this needs.
          collectedByUs: { $ifNull: [{ $arrayElemAt: ["$revenueAgg.ourReceived", 0] }, 0] },
          collectedByClinic: { $ifNull: [{ $arrayElemAt: ["$revenueAgg.clinicReceived", 0] }, 0] },
          // A waiver on a collection reduces what the patient owes without being money anyone
          // collected — read off the Transaction's own `discount` field (what createCollectionTransaction
          // actually records), not clinicCollections[]'s descriptive copy of it.
          totalDiscount: { $ifNull: [{ $arrayElemAt: ["$revenueAgg.totalDiscount", 0] }, 0] },
          patientInfo: { $arrayElemAt: ["$patientDoc", 0] },
        },
      },
      {
        $addFields: {
          patientOutstanding: {
            $subtract: [
              "$packageAmount",
              { $add: ["$collectedByUs", "$collectedByClinic", "$totalDiscount"] },
            ],
          },
          caseNet: { $subtract: ["$collectedByClinic", "$clinicShare"] },
          patientName: "$patientInfo.personal.name",
          patientPhone: "$patientInfo.personal.phone",
          // Drives the "Patient paid · ₹X with clinic" badge. Money collected by the CLINIC
          // never touches Patient.payments (see collabDerivation.js's §2.1 split — only
          // collectedBy:"US" money does), so this flag is what stops staff chasing a patient who
          // has, in fact, already paid the clinic in full even though their own record still
          // shows it pending.
          paidToClinic: "$collectedByClinic",
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
