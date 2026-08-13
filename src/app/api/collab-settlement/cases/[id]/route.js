import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabCase from "@/models/CollabCase";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Revises packageAmount / clinicShare, or cancels a case. Every change
// appends to log[]; existing log entries are never edited or removed.
export async function PATCH(req, { params }) {
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
    const { packageAmount, clinicShare, isCancelled, note } = await req.json();

    const collabCase = await CollabCase.findById(id);
    if (!collabCase) {
      return NextResponse.json({ error: "Collab case not found" }, { status: 404 });
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    if (packageAmount != null && parseFloat(packageAmount) !== collabCase.packageAmount) {
      collabCase.log.push({
        action: "Package Revised",
        previousValue: String(collabCase.packageAmount),
        newValue: String(parseFloat(packageAmount)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      collabCase.packageAmount = parseFloat(packageAmount);
    }

    if (clinicShare != null && parseFloat(clinicShare) !== collabCase.clinicShare) {
      collabCase.log.push({
        action: "Share Revised",
        previousValue: String(collabCase.clinicShare),
        newValue: String(parseFloat(clinicShare)),
        note,
        performedBy,
        performedAt: new Date(),
      });
      collabCase.clinicShare = parseFloat(clinicShare);
    }

    if (isCancelled === true && collabCase.status !== "CANCELLED") {
      collabCase.status = "CANCELLED";
      collabCase.log.push({
        action: "Cancelled",
        previousValue: collabCase.status,
        newValue: "CANCELLED",
        note,
        performedBy,
        performedAt: new Date(),
      });
    } else if (isCancelled === false && collabCase.status === "CANCELLED") {
      collabCase.status = "OPEN";
      collabCase.log.push({
        action: "Note Added",
        note: note || "Reinstated",
        performedBy,
        performedAt: new Date(),
      });
    }

    if (note && packageAmount == null && clinicShare == null && isCancelled === undefined) {
      collabCase.log.push({
        action: "Note Added",
        note,
        performedBy,
        performedAt: new Date(),
      });
    }

    await collabCase.save();

    return NextResponse.json({ message: "Collab case updated", collabCase });
  } catch (error) {
    console.error("Error updating collab case:", error);
    return NextResponse.json({ error: "Failed to update collab case" }, { status: 500 });
  }
}
