import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Receivable, { RECEIVABLE_KIND_VALUES, RECEIVABLE_PURPOSE_VALUES } from "@/models/Receivable";
import { ALL_BRANCHES } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];
const PATIENT_REQUIRED_PURPOSES = ["PATIENT_DUE", "REFUND_DUE", "ADVANCE_RECOVERY"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const {
      payer, // { kind, refId, label }
      purpose,
      revenueCategory,
      period, // { month, year }
      relatedPatient,
      totalAmount,
      dueDate,
      branch,
      remarks,
    } = await req.json();

    if (!payer?.kind || !payer?.label || !purpose || !totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!RECEIVABLE_KIND_VALUES.includes(payer.kind)) {
      return NextResponse.json({ error: "Invalid payer.kind" }, { status: 400 });
    }
    if (!RECEIVABLE_PURPOSE_VALUES.includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }
    if (PATIENT_REQUIRED_PURPOSES.includes(purpose) && !relatedPatient) {
      return NextResponse.json(
        { error: "relatedPatient is required for this purpose" },
        { status: 400 },
      );
    }
    if (branch && !ALL_BRANCHES.includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    const receivable = new Receivable({
      payer: {
        kind: payer.kind,
        refId: payer.refId || null,
        label: payer.label,
      },
      purpose,
      revenueCategory,
      period: period?.month && period?.year ? period : undefined,
      relatedPatient: relatedPatient || undefined,
      totalAmount: parseFloat(totalAmount),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      branch: branch || session.user.branch,
      remarks: remarks || "",
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });

    receivable.log.push({
      action: "Created",
      newValue: String(receivable.totalAmount),
      performedBy,
      performedAt: new Date(),
    });

    await receivable.save();

    return NextResponse.json({ message: "Receivable created", receivable }, { status: 201 });
  } catch (error) {
    console.error("Error creating receivable:", error);
    return NextResponse.json({ error: "Failed to create receivable" }, { status: 500 });
  }
}
