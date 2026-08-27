import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Advance from "@/models/Advance";
import { resolveBranchFilter } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Flat, filterable list of Advance rows — exact mirror of /api/borrowings/list. Mainly for
// export/audit; the Assets page's drill-down uses /api/advances/grouped instead, which rolls
// these up per document.
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const account = searchParams.get("account") || "";
    const direction = searchParams.get("direction") || "";
    const receivableId = searchParams.get("receivableId") || "";
    const branchFilterObj = resolveBranchFilter(session, searchParams.get("branch") || "");
    const branch = typeof branchFilterObj.branch === "string" ? branchFilterObj.branch : "";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const includeCancelled = searchParams.get("includeCancelled") === "true";
    const party = searchParams.get("party") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    const match = {};
    if (!includeCancelled) match.isCancelled = { $ne: true };
    if (party) match["party.label"] = { $regex: party, $options: "i" };
    if (account) match.account = account;
    if (direction && ["IN", "OUT"].includes(direction)) match.direction = direction;
    if (receivableId) match.receivableId = receivableId;
    if (branch) match.branch = branch;
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = new Date(from);
      if (to) match.date.$lte = new Date(`${to}T23:59:59.999Z`);
    }

    const [rows, total] = await Promise.all([
      Advance.find(match)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("receivableId", "revenueSubType totalAmount")
        .lean(),
      Advance.countDocuments(match),
    ]);

    return NextResponse.json({
      success: true,
      advances: rows,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("Error listing advances:", error);
    return NextResponse.json({ error: "Failed to list advances" }, { status: 500 });
  }
}
