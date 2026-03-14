import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Interviewer from "@/models/Interviewer";

const ALLOWED_ROLES = ["hr", "super-admin", "admin"];

// PUT — update candidate
export async function PUT(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { id } = params;
    const body = await req.json();

    const candidate = await Interviewer.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!candidate) {
      return NextResponse.json({ success: false, message: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, candidate });
  } catch (err) {
    console.error("HR candidate PUT error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove candidate
export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !ALLOWED_ROLES.includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { id } = params;
    const candidate = await Interviewer.findByIdAndDelete(id);

    if (!candidate) {
      return NextResponse.json({ success: false, message: "Candidate not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Candidate deleted" });
  } catch (err) {
    console.error("HR candidate DELETE error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
