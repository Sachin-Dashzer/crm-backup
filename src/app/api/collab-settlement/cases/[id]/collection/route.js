import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import { recordCollabCollectionAtomic } from "@/lib/collabDerivation";

// Records a later instalment against a collab case — either the patient paying US more
// (collectedBy: "US") or the clinic collecting more directly (collectedBy: "CLINIC", the
// original and still most common case). Both now create a real revenue Transaction, exactly
// like the amounts recorded at case-creation time — see recordCollabCollectionAtomic
// (src/lib/collabDerivation.js) for why that's the fix: this route used to only append to
// clinicCollections[] and explicitly never created a Transaction, so every instalment after the
// first was invisible to revenue, to Patient.payments, and to the clinic's Receivable.
const ALLOWED_ROLES = ["collab", "admin", "super-admin"];

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { id } = await params;
    const {
      amount,
      discount,
      date,
      collectedBy = "CLINIC", // matches clinicCollections[].collectedBy's own default
      method, // "US" only
      mode, // "CLINIC" only
      reference,
      receiptMode,
      furtherMode,
      note,
      allowOverpayment,
    } = await req.json();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Collection amount must be greater than 0" },
        { status: 400 },
      );
    }
    const parsedDiscount = parseFloat(discount) || 0;
    if (parsedDiscount < 0) {
      return NextResponse.json({ error: "Discount cannot be negative" }, { status: 400 });
    }
    if (!["US", "CLINIC"].includes(collectedBy)) {
      return NextResponse.json({ error: 'collectedBy must be "US" or "CLINIC"' }, { status: 400 });
    }

    const collabCase = await CollabCase.findById(id).lean();
    if (!collabCase) {
      return NextResponse.json({ error: "Collab case not found" }, { status: 404 });
    }
    if (collabCase.status === "CANCELLED") {
      return NextResponse.json({ error: "This case has been cancelled" }, { status: 400 });
    }

    // How much of THIS case's package is already accounted for — every collabRef-linked revenue
    // transaction, both collected-by-us and collected-by-clinic (a paid_to_external transaction
    // still represents money genuinely off the patient's outstanding balance, even though it
    // hasn't reached one of our own accounts).
    //
    // FIXED: this used to match on `patient: collabCase.patient` with no collabRef filter at
    // all, so an unrelated direct payment by the same patient (e.g. a normal transplant payment
    // that has nothing to do with this collab case) silently reduced this case's remaining
    // balance. Scoped to this case's own transactions only.
    //
    // receivableId: null excludes two kinds of rows that are NOT a new collection off the
    // package: topUpClinicShare's own offset_settlement contra (see collabDerivation.js — it
    // pays down the collab Receivable for revenue already counted by the paid_to_external row
    // that raised it) and a real THEY_PAID settlement collecting against that same Receivable
    // later. Counting either here would double an amount already collected once.
    const [agg] = await Transactions.aggregate([
      {
        $match: {
          "collabRef.caseId": collabCase._id,
          costType: "Revenue",
          approvalStatus: { $nin: ["PENDING", "REJECTED"] },
          receivableId: null,
        },
      },
      { $group: { _id: null, totalCollected: { $sum: "$amount" }, totalDiscount: { $sum: "$discount" } } },
    ]);
    const totalCollected = agg?.totalCollected || 0;
    const totalDiscount = agg?.totalDiscount || 0;
    const remaining = round2(collabCase.packageAmount - totalCollected - totalDiscount);

    if (parsedAmount + parsedDiscount > remaining && !allowOverpayment) {
      return NextResponse.json(
        {
          error: `Collection + discount (₹${parsedAmount + parsedDiscount}) exceeds the patient's remaining outstanding (₹${remaining}). Pass allowOverpayment to record it anyway.`,
        },
        { status: 400 },
      );
    }

    const { collabCase: updated, transaction } = await recordCollabCollectionAtomic({
      caseId: id,
      amount: parsedAmount,
      discount: parsedDiscount,
      date,
      collectedBy,
      method,
      mode,
      reference,
      receiptMode,
      furtherMode,
      note,
      actor: { name: session.user.name, email: session.user.email },
    });

    return NextResponse.json({
      message: "Collection recorded",
      collabCase: updated,
      transactionId: transaction?._id || null,
    });
  } catch (error) {
    console.error("Error recording collab collection:", error);
    return NextResponse.json({ error: error.message || "Failed to record collection" }, { status: 500 });
  }
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
