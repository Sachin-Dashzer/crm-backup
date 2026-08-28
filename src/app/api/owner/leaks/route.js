
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import { fetchCallby, CallbyError } from "@/lib/callby";

const DAY_MS = 24 * 60 * 60 * 1000;
const ageInDays = (date) => (date ? Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS) : null);

async function staleNewLeads(branch) {
  try {
    const data = await fetchCallby("/api/leads/funnel-data");
    const leads = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    const cutoff = Date.now() - DAY_MS;
    const stale = leads.filter((l) => l.status === "new" && l.createdAt && new Date(l.createdAt).getTime() < cutoff);
    return {
      items: stale.map((l) => ({
        id: l.id,
        name: l.name || "Unknown",
        phone: l.phone || "",
        branch: null,
        age: ageInDays(l.createdAt),
      })),
      error: null,
    };
  } catch (err) {
    return { items: [], error: err instanceof CallbyError ? err.message : "Failed to load lead data" };
  }
}

async function readyWithNoSurgeryDate(branchFilter) {
  const patients = await Patient.find({
    ...branchFilter,
    "counselling.readyForSurgery": true,
    $or: [{ "surgery.surgeryDate": null }, { "surgery.surgeryDate": { $exists: false } }],
  })
    .select("personal.name personal.phone personal.branch updatedAt")
    .lean();

  return patients.map((p) => ({
    id: String(p._id),
    name: p.personal?.name || "Unknown",
    phone: p.personal?.phone || "",
    branch: p.personal?.branch || "",
    age: ageInDays(p.updatedAt),
  }));
}

async function pendingWithNoRecentActivity(branchFilter) {
  const candidates = await Patient.find({ ...branchFilter, "payments.pendingAmount": { $gt: 0 } })
    .select("personal.name personal.phone personal.branch payments.pendingAmount createdAt")
    .lean();
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((p) => p._id);
  const cutoff = new Date(Date.now() - 30 * DAY_MS);

  const recentlyActiveIds = new Set(
    (
      await Transactions.distinct("patient", {
        patient: { $in: candidateIds },
        date: { $gte: cutoff },
      })
    ).map(String)
  );

  const stale = candidates.filter((p) => !recentlyActiveIds.has(String(p._id)));

  const lastTxByPatient = new Map(
    (
      await Transactions.aggregate([
        { $match: { patient: { $in: stale.map((p) => p._id) } } },
        { $group: { _id: "$patient", lastDate: { $max: "$date" } } },
      ])
    ).map((r) => [String(r._id), r.lastDate])
  );

  return stale.map((p) => ({
    id: String(p._id),
    name: p.personal?.name || "Unknown",
    phone: p.personal?.phone || "",
    branch: p.personal?.branch || "",
    pendingAmount: p.payments?.pendingAmount || 0,
    age: ageInDays(lastTxByPatient.get(String(p._id)) || p.createdAt),
  }));
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All" } = await req.json();
    const branchFilter = branch === "All" ? {} : { "personal.branch": branch };

    const [stale, ready, pending] = await Promise.all([
      staleNewLeads(branch),
      readyWithNoSurgeryDate(branchFilter),
      pendingWithNoRecentActivity(branchFilter),
    ]);

    return NextResponse.json({
      success: true,
      staleNewLeads: stale.items,
      staleNewLeadsError: stale.error,
      readyWithNoSurgeryDate: ready,
      pendingWithNoRecentActivity: pending,
    });
  } catch (err) {
    console.error("owner leaks error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
