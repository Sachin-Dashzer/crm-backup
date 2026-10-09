import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions";
import Receivable from "@/models/Receivable";
import Payable from "@/models/Payable";
import CollabCase from "@/models/CollabCase";
import CollabSettlement from "@/models/CollabSettlement";
import SuspenseEntry from "@/models/SuspenseEntry";
import Audit from "@/models/Audit";
import DeleteLog from "@/models/DeleteLog";
import User from "@/models/User";
import { withDB } from "@/lib/withDB";

// ─── Cloudinary config (server-side only, mirrors the upload route) ────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SUPER_ADMIN_ROLES = ["super-admin", "owner"];

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts a Cloudinary publicId from a stored URL.
 * We prefer explicit publicId fields when available. This fallback handles
 * legacy documents that only stored a URL.
 */
function extractPublicIdFromUrl(url) {
  if (!url || !url.includes("cloudinary.com")) return null;
  const parts = url.split("/upload/");
  if (parts.length !== 2) return null;
  const pathPart = parts[1];
  // strip transformation segments (e.g. q_auto,f_auto, fl_attachment:false)
  const segments = pathPart.split("/");
  let foundPath = false;
  const publicIdParts = [];
  for (const seg of segments) {
    if (!foundPath && /^[a-z_]+[a-z0-9_]*:/.test(seg)) continue; // transformation or flag
    if (!foundPath && /^[a-z]+_/.test(seg)) continue;            // parameter like v1234
    foundPath = true;
    publicIdParts.push(seg);
  }
  const publicId = publicIdParts.join("/");
  return publicId.replace(/\.[^/.]+$/, "") || null; // strip file extension
}

/**
 * Deletes one Cloudinary asset, choosing the correct resource_type by extension.
 * Returns { publicId, result, error? }.
 */
async function deleteCloudinaryAsset(publicId) {
  if (!publicId) return { publicId, result: "skipped" };
  const isPdf = publicId.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "image";
  try {
    const r = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
      timeout: 30000,
    });
    return { publicId, result: r.result };
  } catch (err) {
    // If the first attempt fails and it's ambiguous, try the other resource type
    const fallbackType = resourceType === "raw" ? "image" : "raw";
    try {
      const r2 = await cloudinary.uploader.destroy(publicId, {
        resource_type: fallbackType,
        invalidate: true,
        timeout: 30000,
      });
      return { publicId, result: r2.result };
    } catch (err2) {
      return { publicId, result: "error", error: err2.message };
    }
  }
}

// ─── main handler ─────────────────────────────────────────────────────────────

const handler = async (req) => {
  // ── Parse request ────────────────────────────────────────────────────────
  let id = null;
  let adminEmail = "";
  let adminPassword = "";

  const { searchParams } = new URL(req.url);
  id = searchParams.get("id");

  if (req.method === "DELETE" || req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.id)            id            = body.id;
      if (body?.adminEmail)    adminEmail    = body.adminEmail;
      if (body?.adminPassword) adminPassword = body.adminPassword;
    } catch (_e) {
      // no json body
    }
  }

  // ── Validate ID ──────────────────────────────────────────────────────────
  if (!id) {
    return NextResponse.json(
      { success: false, message: "Patient ID is required" },
      { status: 400 }
    );
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { success: false, message: "Invalid patient ID format" },
      { status: 400 }
    );
  }

  // ── Validate credentials ─────────────────────────────────────────────────
  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { success: false, message: "Super Admin email and password are required to authorise deletion." },
      { status: 400 }
    );
  }

  try {
    // ─────────────────────────────────────────────────────────────────────
    // PHASE 1 — Authenticate Super Admin
    // ─────────────────────────────────────────────────────────────────────
    const cleanEmail = adminEmail.trim().toLowerCase();
    const superAdminUser = await User.findOne({
      $or: [
        { email: cleanEmail },
        { name: { $regex: new RegExp(`^${cleanEmail}$`, "i") } },
      ],
      role: { $in: SUPER_ADMIN_ROLES },
    }).select("+password");

    if (!superAdminUser) {
      return NextResponse.json(
        { success: false, message: "Super Admin account not found or insufficient privileges." },
        { status: 403 }
      );
    }

    const isValidPassword = await superAdminUser.correctPassword(
      adminPassword,
      superAdminUser.password
    );
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, message: "Incorrect Super Admin password. Deletion authorisation failed." },
        { status: 401 }
      );
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 2 — Load Patient (BEFORE any deletion)
    // ─────────────────────────────────────────────────────────────────────
    const patient = await Patient.findById(id).lean();
    if (!patient) {
      return NextResponse.json(
        { success: false, message: "Patient not found" },
        { status: 404 }
      );
    }

    const patientId  = patient._id;           // authoritative ObjectId
    const patientName = patient.personal?.name || "Unknown";

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 3 — Collect ALL Transaction IDs (before any deletion)
    // ─────────────────────────────────────────────────────────────────────
    const txIdSet = new Set(
      (patient.payments?.transactions || []).map((t) => t.toString())
    );

    const relatedTxs = await Transactions.find(
      {
        $or: [
          { patient: patientId },
          { "expenseGiver.refId": patientId },
          // externalParty: only when explicitly typed as PATIENT
          { "externalParty.partyKind": "PATIENT", "externalParty.partyRefId": patientId },
          // commissionReceiver: only when explicitly typed as Patient — GAP FIX
          { "commissionReceiver.type": "Patient", "commissionReceiver.refId": patientId },
        ],
      },
      "_id"
    ).lean();

    relatedTxs.forEach((t) => txIdSet.add(t._id.toString()));

    // Also pull in any reversals of the already-collected transactions
    if (txIdSet.size > 0) {
      const reversals = await Transactions.find(
        { reversalOf: { $in: Array.from(txIdSet) } },
        "_id"
      ).lean();
      reversals.forEach((r) => txIdSet.add(r._id.toString()));
    }

    const allTxIds = Array.from(txIdSet).map((s) => new mongoose.Types.ObjectId(s));

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 4 — Collect Receivables & Payables (IDs + Cloudinary publicIds)
    // ─────────────────────────────────────────────────────────────────────
    const receivables = await Receivable.find(
      {
        $or: [
          { relatedPatient: patientId },
          { "payer.kind": "PATIENT", "payer.refId": patientId },
        ],
      },
      "_id receipts"
    ).lean();

    const payables = await Payable.find(
      {
        $or: [
          { relatedPatient: patientId },
          { "payee.kind": "PATIENT", "payee.refId": patientId },
        ],
      },
      "_id receipts"
    ).lean();

    const receivableIds = receivables.map((r) => r._id);
    const payableIds    = payables.map((p) => p._id);

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 5 — Collect CollabCase IDs
    // ─────────────────────────────────────────────────────────────────────
    const collabCases = await CollabCase.find(
      { patient: patientId },
      "_id clinicSharePayable clinicShareReceivable"
    ).lean();

    const collabCaseIds = collabCases.map((c) => c._id);

    // Add any ColabCase-linked Payables/Receivables not already captured
    for (const cc of collabCases) {
      if (cc.clinicSharePayable) {
        const pid = cc.clinicSharePayable.toString();
        if (!payableIds.some((p) => p.toString() === pid)) {
          payableIds.push(cc.clinicSharePayable);
        }
      }
      if (cc.clinicShareReceivable) {
        const rid = cc.clinicShareReceivable.toString();
        if (!receivableIds.some((r) => r.toString() === rid)) {
          receivableIds.push(cc.clinicShareReceivable);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 6 — Collect Cloudinary publicIds (before deletion!)
    // ─────────────────────────────────────────────────────────────────────
    const cloudinaryAssets = new Set(); // { publicId, resourceType }
    const seenIds = new Set();

    const addAsset = (publicId, url) => {
      const id = publicId || extractPublicIdFromUrl(url);
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        cloudinaryAssets.add(id);
      }
    };

    // Patient documents
    const docs = patient.documents || {};
    [...(docs.images || []), ...(docs.consentForm || []),
     ...(docs.suregeryForm || []), ...(docs.consultForm || [])
    ].forEach((url) => addAsset(null, url));

    // Transaction receipts — must fetch full receipt subdocs
    if (allTxIds.length > 0) {
      const txWithReceipts = await Transactions.find(
        { _id: { $in: allTxIds } },
        "receipts"
      ).lean();
      txWithReceipts.forEach((t) =>
        (t.receipts || []).forEach((r) => addAsset(r.publicId, r.url))
      );
    }

    // Receivable receipts
    receivables.forEach((rec) =>
      (rec.receipts || []).forEach((r) => addAsset(r.publicId, r.url))
    );

    // Payable receipts — need to fetch the full payable docs for receipts
    const payablesWithReceipts = await Payable.find(
      { _id: { $in: payableIds } },
      "receipts"
    ).lean();
    payablesWithReceipts.forEach((p) =>
      (p.receipts || []).forEach((r) => addAsset(r.publicId, r.url))
    );

    const cloudinaryPublicIds = Array.from(cloudinaryAssets).filter(Boolean);

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 7 — MongoDB Transaction (atomic)
    // ─────────────────────────────────────────────────────────────────────
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    const summary = {
      deletedTransactions: 0,
      deletedReceivables:  0,
      deletedPayables:     0,
      deletedCollabCases:  0,
      updatedSettlements:  0,
      updatedSuspenseEntries: 0,
      updatedEmployees:    0,
      deletedAuditRecords: 0,
    };

    try {
      // ── 7A: SuspenseEntry cleanup ─────────────────────────────────────
      // Reopen any suspense entries whose resolvedTransactionId is being deleted.
      // We do NOT delete the SuspenseEntry — we just remove the dangling reference
      // and reopen it so the accounting team can investigate.
      if (allTxIds.length > 0) {
        const suspenseResult = await SuspenseEntry.updateMany(
          {
            resolvedTransactionId: { $in: allTxIds },
            isResolved: true,
          },
          {
            $set: {
              isResolved: false,
              resolvedTransactionId: null,
              resolvedAt: null,
              resolvedBy: null,
            },
            $push: {
              log: {
                action: "Reopened",
                note: `Reopened: the resolving transaction was deleted as part of a permanent patient deletion (patient _id: ${patientId}).`,
                performedBy: {
                  name:  superAdminUser.name,
                  email: superAdminUser.email,
                },
                performedAt: new Date(),
              },
            },
          },
          { session: dbSession }
        );
        summary.updatedSuspenseEntries = suspenseResult.modifiedCount || 0;
      }

      // ── 7B: CollabSettlement cleanup ──────────────────────────────────
      // Remove only the deleted patient's case/transaction references from settlements.
      // Do NOT delete the settlement if it still contains other patients' data.
      if (collabCaseIds.length > 0 || allTxIds.length > 0) {
        const settlementsToClean = await CollabSettlement.find(
          {
            $or: [
              { "coveredCases.case": { $in: collabCaseIds } },
              { generatedTransactions: { $in: allTxIds } },
            ],
          },
          "_id coveredCases generatedTransactions"
        ).session(dbSession).lean();

        for (const settlement of settlementsToClean) {
          const updateOps = {};

          // Remove only the patient's case entries
          const caseIdStrings = new Set(collabCaseIds.map((c) => c.toString()));
          const remainingCases = (settlement.coveredCases || []).filter(
            (cc) => !caseIdStrings.has(cc.case?.toString())
          );
          if (remainingCases.length !== (settlement.coveredCases || []).length) {
            updateOps.coveredCases = remainingCases;
          }

          // Remove only the patient's transaction entries
          const txIdStrings = new Set(allTxIds.map((t) => t.toString()));
          const remainingTxs = (settlement.generatedTransactions || []).filter(
            (t) => !txIdStrings.has(t?.toString())
          );
          if (remainingTxs.length !== (settlement.generatedTransactions || []).length) {
            updateOps.generatedTransactions = remainingTxs;
          }

          if (Object.keys(updateOps).length > 0) {
            await CollabSettlement.updateOne(
              { _id: settlement._id },
              { $set: updateOps },
              { session: dbSession }
            );
            summary.updatedSettlements++;
          }
        }
      }

      // ── 7C: Delete Transactions ───────────────────────────────────────
      if (allTxIds.length > 0) {
        const txRes = await Transactions.deleteMany(
          { _id: { $in: allTxIds } },
          { session: dbSession }
        );
        summary.deletedTransactions = txRes.deletedCount || 0;
      }

      // ── 7D: Delete Receivables ────────────────────────────────────────
      if (receivableIds.length > 0) {
        const recRes = await Receivable.deleteMany(
          { _id: { $in: receivableIds } },
          { session: dbSession }
        );
        summary.deletedReceivables = recRes.deletedCount || 0;
      }

      // ── 7E: Delete Payables ───────────────────────────────────────────
      if (payableIds.length > 0) {
        const payRes = await Payable.deleteMany(
          { _id: { $in: payableIds } },
          { session: dbSession }
        );
        summary.deletedPayables = payRes.deletedCount || 0;
      }

      // ── 7F: Delete CollabCases ────────────────────────────────────────
      if (collabCaseIds.length > 0) {
        const ccRes = await CollabCase.deleteMany(
          { patient: patientId },
          { session: dbSession }
        );
        summary.deletedCollabCases = ccRes.deletedCount || 0;
      }

      // ── 7G: Remove patient from Employee arrays ───────────────────────
      const empRes = await Employee.updateMany(
        { patient: patientId },
        { $pull: { patient: patientId } },
        { session: dbSession }
      );
      summary.updatedEmployees = empRes.modifiedCount || 0;

      // ── 7H: Delete legacy Audit records ──────────────────────────────
      const auditRes = await Audit.deleteMany(
        { patient: patientId },
        { session: dbSession }
      );
      summary.deletedAuditRecords = auditRes.deletedCount || 0;

      // ── 7I: Delete the Patient document (LAST) ────────────────────────
      const patientDeleteRes = await Patient.deleteOne(
        { _id: patientId },
        { session: dbSession }
      );
      if (patientDeleteRes.deletedCount !== 1) {
        throw new Error("Patient document was not deleted — aborting transaction.");
      }

      // ── 7J: Write DeleteLog ───────────────────────────────────────────
      try {
        await DeleteLog.create(
          [
            {
              entityType:    "Patient",
              entityId:      patientId.toString(),
              entityName:    patientName,
              entityDetails: {
                branch:                 patient.personal?.branch || null,
                deletedTransactions:    summary.deletedTransactions,
                deletedReceivables:     summary.deletedReceivables,
                deletedPayables:        summary.deletedPayables,
                deletedCollabCases:     summary.deletedCollabCases,
                updatedSettlements:     summary.updatedSettlements,
                updatedSuspenseEntries: summary.updatedSuspenseEntries,
                updatedEmployees:       summary.updatedEmployees,
                deletedAuditRecords:    summary.deletedAuditRecords,
                cloudinaryAssetsQueued: cloudinaryPublicIds.length,
              },
              deletedBy: {
                name:   superAdminUser.name,
                email:  superAdminUser.email,
                branch: superAdminUser.branch || "All",
              },
              branch:    patient.personal?.branch || superAdminUser.branch || "All",
              deletedAt: new Date(),
            },
          ],
          { session: dbSession }
        );
      } catch (logErr) {
        // Non-fatal — log but do not abort the main transaction
        console.warn("[Patient Delete] DeleteLog creation skipped:", logErr.message);
      }

      // ── COMMIT ────────────────────────────────────────────────────────
      await dbSession.commitTransaction();
    } catch (err) {
      await dbSession.abortTransaction();
      throw err;
    } finally {
      dbSession.endSession();
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 8 — Cloudinary cleanup (AFTER successful MongoDB commit)
    // ─────────────────────────────────────────────────────────────────────
    const cloudinaryResults = { deleted: [], failed: [], skipped: [] };

    if (cloudinaryPublicIds.length > 0) {
      const results = await Promise.allSettled(
        cloudinaryPublicIds.map((pid) => deleteCloudinaryAsset(pid))
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") {
          const { publicId, result, error } = r.value;
          if (result === "ok" || result === "not found") {
            cloudinaryResults.deleted.push(publicId);
          } else if (result === "skipped") {
            cloudinaryResults.skipped.push(publicId);
          } else {
            cloudinaryResults.failed.push({ publicId, error: error || result });
          }
        } else {
          cloudinaryResults.failed.push({ publicId: "unknown", error: r.reason?.message });
        }
      });

      if (cloudinaryResults.failed.length > 0) {
        console.error(
          `[Patient Delete] Cloudinary cleanup partial failure for patient ${patientId}:`,
          cloudinaryResults.failed
        );
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PHASE 9 — Build response
    // ─────────────────────────────────────────────────────────────────────
    const cloudinaryWarning =
      cloudinaryResults.failed.length > 0
        ? `Patient data deleted from CRM, but ${cloudinaryResults.failed.length} file(s) could not be removed from cloud storage. Check server logs.`
        : null;

    return NextResponse.json({
      success: true,
      message: cloudinaryWarning
        ? cloudinaryWarning
        : `Patient "${patientName}" and all associated records permanently deleted.`,
      deletedId:    patientId.toString(),
      summary: {
        ...summary,
        cloudinaryDeleted: cloudinaryResults.deleted.length,
        cloudinaryFailed:  cloudinaryResults.failed.length,
      },
      cloudinaryWarning,
    });
  } catch (error) {
    console.error("[Patient Delete] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete patient. No data was modified.",
        // Do not expose raw DB error messages to clients in production
        ...(process.env.NODE_ENV !== "production" && { details: error.message }),
      },
      { status: 500 }
    );
  }
};

export const DELETE = withDB(handler);
export const POST   = withDB(handler);
