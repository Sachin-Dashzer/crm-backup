import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import { UNSETTLED_METHODS } from "@/constants/bankRouting";
import { recordClinicCollectionAtomic } from "@/lib/collabDerivation";

// The collab team enters the case in the first place, so they also record what the patient
// later paid the clinic directly — this appends to clinicCollections AND keeps the case's own
// Payable/Receivable (the OBLIGATION between the clinic and us — see clinicSharePayable/
// clinicShareReceivable on CollabCase) resized to match, so "how much does this case still owe"
// is never stale. See recordClinicCollectionAtomic (src/lib/collabDerivation.js) for the actual
// resize/flip logic and why it deliberately never creates a SETTLING payment here — that's a
// separate real event (see settlements/create/route.js's "Settle" flow).
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
    const { amount, date, mode, reference, note, allowOverpayment } = await req.json();

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "Collection amount must be greater than 0" },
        { status: 400 },
      );
    }

    const collabCase = await CollabCase.findById(id).lean();
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
    const collectedByClinic = (collabCase.clinicCollections || []).reduce((sum, c) => sum + c.amount, 0);
    const remaining = collabCase.packageAmount - collectedByUs - collectedByClinic;

    if (parsedAmount > remaining && !allowOverpayment) {
      return NextResponse.json(
        {
          error: `Collection (₹${parsedAmount}) exceeds the patient's remaining outstanding (₹${remaining}). Pass allowOverpayment to record it anyway.`,
        },
        { status: 400 },
      );
    }

    const { collabCase: updated } = await recordClinicCollectionAtomic({
      caseId: id,
      amount: parsedAmount,
      date,
      mode,
      reference,
      note,
      actor: { name: session.user.name, email: session.user.email },
    });

    return NextResponse.json({ message: "Collection recorded", collabCase: updated });
  } catch (error) {
    console.error("Error recording collab collection:", error);
    return NextResponse.json({ error: error.message || "Failed to record collection" }, { status: 500 });
  }
}
