
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) {
      return NextResponse.json({ success: true, patients: [] });
    }

    const digitsOnly = q.replace(/\D/g, "");
    const isPhoneLike = digitsOnly.length >= 4 && digitsOnly.length === q.replace(/\s/g, "").length;

    const query = isPhoneLike
      ? { "personal.phone": { $regex: digitsOnly, $options: "i" } }
      : { "personal.name": { $regex: q, $options: "i" } };

    const patients = await Patient.find(query)
      .select("personal.name personal.phone personal.branch ops.status")
      .limit(20)
      .lean();

    return NextResponse.json({
      success: true,
      patients: patients.map((p) => ({
        id: String(p._id),
        name: p.personal?.name || "Unknown",
        phone: p.personal?.phone || "",
        branch: p.personal?.branch || "",
        status: p.ops?.status || "",
      })),
    });
  } catch (err) {
    console.error("owner patient-journey search error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
