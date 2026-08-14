import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";

// The collab team enters the case in the first place, so they also record what the patient
// later paid the clinic directly — this only appends to clinicCollections and never creates a
// Transaction or touches Patient.payments (see the note below).
const ALLOWED_ROLES = ["collab", "admin", "super-admin"];

// Appends a clinicCollections entry — money the PATIENT paid DIRECTLY TO THE
// PARTNER CLINIC. Never touches Patient.payments or creates a Transaction;
// that money isn't ours until the clinic settles it (see CollabSettlement).
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
    const { amount, date, mode, reference, note, allowOverpayment } = await req.json();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Collection amount must be greater than 0" },
        { status: 400 },
      );
    }

    const collabCase = await CollabCase.findById(id);
    if (!collabCase) {
      return NextResponse.json({ error: "Collab case not found" }, { status: 404 });
    }
    if (collabCase.status === "CANCELLED") {
      return NextResponse.json({ error: "This case has been cancelled" }, { status: 400 });
    }

    // Read-only lookup — money paid to us, never written back to.
    const [revenueAgg] = await Transactions.aggregate([
      {
        $match: {
          patient: collabCase.patient,
          costType: "Revenue",
          approvalStatus: { $nin: ["PENDING", "REJECTED"] },
          method: { $nin: UNSETTLED_METHODS },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const collectedByUs = revenueAgg?.total || 0;
    const collectedByClinic = collabCase.clinicCollections.reduce((sum, c) => sum + c.amount, 0);
    const remaining = collabCase.packageAmount - collectedByUs - collectedByClinic;

    if (parsedAmount > remaining && !allowOverpayment) {
      return NextResponse.json(
        {
          error: `Collection (₹${parsedAmount}) exceeds the patient's remaining outstanding (₹${remaining}). Pass allowOverpayment to record it anyway.`,
        },
        { status: 400 },
      );
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    collabCase.clinicCollections.push({
      amount: parsedAmount,
      date: date ? new Date(date) : new Date(),
      mode,
      reference: reference || "",
      note: note || "",
      recordedBy: performedBy,
      recordedAt: new Date(),
    });

    collabCase.log.push({
      action: "Collection Added",
      newValue: String(parsedAmount),
      note,
      performedBy,
      performedAt: new Date(),
    });

    await collabCase.save();

    return NextResponse.json({ message: "Collection recorded", collabCase });
  } catch (error) {
    console.error("Error recording collab collection:", error);
    return NextResponse.json({ error: "Failed to record collection" }, { status: 500 });
  }
}
