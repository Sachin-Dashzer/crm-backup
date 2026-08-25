import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { fetchOpenReceivablesForPatient } from "@/lib/receivableAllocation";

// Read-only preview for the revenue create/edit forms — "this patient has these open
// receivables, in FIFO order, with this much pending on each" — so the allocation preview in
// ReceivableLinkField can render before the transaction is even saved. Deliberately NOT
// admin-gated like /api/receivables/list: every role that can create a revenue transaction
// (reception, sales, stocks, collab, admin) needs to see this, not just admin/super-admin who
// manage the receivables ledger itself. Returns only what the preview needs, not the full
// receivables-page payload (no branch/purpose filters, no pagination).
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId") || "";
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return NextResponse.json({ success: true, receivables: [] });
    }

    const receivables = await fetchOpenReceivablesForPatient(patientId, null);

    return NextResponse.json({
      success: true,
      receivables: receivables.map((r) => ({
        _id: r._id,
        purpose: r.purpose,
        totalAmount: r.totalAmount,
        received: r.received,
        pending: r.pending,
        dueDate: r.dueDate || null,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching open receivables:", error);
    return NextResponse.json({ error: "Failed to fetch open receivables" }, { status: 500 });
  }
}
