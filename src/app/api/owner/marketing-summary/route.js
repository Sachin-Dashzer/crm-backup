
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import AdSpend from "@/models/AdSpend";
import Leads from "@/models/Leads";
import Patient from "@/models/Patient";
import { normalizePhone } from "@/lib/phone";

const PLATFORMS = ["Meta", "Google"];
const TAG_BY_PLATFORM = { Meta: "Meta Leads", Google: "Google Leads" };
const CONVERTED_STATUSES = ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["super-admin", "owner"].includes(session?.user?.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    await connectDB();

    const { branch = "All", from, to } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ success: false, message: "from and to are required" }, { status: 400 });
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const branchFilter = branch === "All" ? {} : { branch };
    const spendRows = await AdSpend.aggregate([
      {
        $match: {
          ...branchFilter,
          platform: { $in: PLATFORMS },
          date: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: { platform: "$platform", campaignName: "$campaignName" },
          spend: { $sum: "$amount" },
        },
      },
    ]);

    const spendByPlatform = { Meta: [], Google: [] };
    spendRows.forEach((r) => {
      spendByPlatform[r._id.platform].push({ campaignName: r._id.campaignName || "", spend: r.spend });
    });

    const leadsInRange = await Leads.find({
      tag: { $in: Object.values(TAG_BY_PLATFORM) },
      createdAt: { $gte: fromDate, $lte: toDate },
    })
      .select("phone tag")
      .lean();

    const platformPhones = { Meta: new Set(), Google: new Set() };
    const platformLeadCount = { Meta: 0, Google: 0 };

    for (const lead of leadsInRange) {
      const platform = lead.tag === TAG_BY_PLATFORM.Meta ? "Meta" : lead.tag === TAG_BY_PLATFORM.Google ? "Google" : null;
      if (!platform) continue;
      platformLeadCount[platform] += 1;
      const norm = normalizePhone(lead.phone);
      if (norm) platformPhones[platform].add(norm);
    }

    const allPhones = [...new Set([...platformPhones.Meta, ...platformPhones.Google])];
    const patients = allPhones.length
      ? await Patient.find({ "personal.phoneNormalized": { $in: allPhones } })
          .select("personal.phoneNormalized ops.status payments.totalAmount")
          .lean()
      : [];

    const patientByPhone = new Map();
    patients.forEach((p) => {
      if (p.personal?.phoneNormalized) patientByPhone.set(p.personal.phoneNormalized, p);
    });

    function conversionFor(platform) {
      const countedPatientIds = new Set();
      let converted = 0;
      let revenue = 0;
      for (const phone of platformPhones[platform]) {
        const patient = patientByPhone.get(phone);
        if (!patient || !CONVERTED_STATUSES.includes(patient.ops?.status)) continue;
        const pid = String(patient._id);
        if (countedPatientIds.has(pid)) continue;
        countedPatientIds.add(pid);
        converted += 1;
        revenue += patient.payments?.totalAmount || 0;
      }
      return { converted, revenue };
    }

    const rows = [];
    for (const platform of PLATFORMS) {
      const campaigns = spendByPlatform[platform];
      if (campaigns.length === 0) continue;

      const leadsCount = platformLeadCount[platform];
      const { converted, revenue } = conversionFor(platform);
      const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
      const cpl = leadsCount > 0 ? totalSpend / leadsCount : null;
      const cac = converted > 0 ? totalSpend / converted : null;
      const roas = totalSpend > 0 ? revenue / totalSpend : null;

      if (campaigns.length === 1) {
        rows.push({
          platform,
          campaignName: campaigns[0].campaignName || null,
          isPlatformTotal: false,
          spend: totalSpend,
          leads: leadsCount,
          cpl,
          converted,
          cac,
          revenue,
          roas,
        });
      } else {
        campaigns.forEach((c) => {
          rows.push({
            platform,
            campaignName: c.campaignName || "(unnamed)",
            isPlatformTotal: false,
            spend: c.spend,
            leads: null,
            cpl: null,
            converted: null,
            cac: null,
            revenue: null,
            roas: null,
          });
        });
        rows.push({
          platform,
          campaignName: null,
          isPlatformTotal: true,
          spend: totalSpend,
          leads: leadsCount,
          cpl,
          converted,
          cac,
          revenue,
          roas,
        });
      }
    }

    return NextResponse.json({
      success: true,
      branch,
      note:
        branch !== "All"
          ? `Spend is scoped to ${branch}. Leads/CPL/Converted/Revenue/CAC/ROAS reflect all branches — the Leads collection has no branch field to scope them by.`
          : null,
      rows,
    });
  } catch (err) {
    console.error("owner marketing-summary error:", err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
