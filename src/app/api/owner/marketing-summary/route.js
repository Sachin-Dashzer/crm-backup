// src/app/api/owner/marketing-summary/route.js
//
// Marketing profitability: joins AdSpend (real, branch-scoped) against Leads.tag and the
// matching Patient's conversion outcome, to compute CPL / converted count / revenue / CAC / ROAS
// per platform (and per campaignName, where spend entries have one).
//
// ── Why "branch" only scopes Spend, not Leads/Converted/Revenue ──────────────────────────────
// AdSpend has a real `branch` field. Leads does not (see src/models/Leads.js) — it was never
// given one, so there is no honest way to say "these 40 leads belong to Delhi." Rather than
// fabricate an attribution (e.g. guessing branch from a converted lead's matched Patient, which
// would silently undercount every lead that never converted), this route scopes AdSpend by the
// requested branch but always computes Leads/CPL/Converted/Revenue/CAC/ROAS across ALL branches.
// When a specific branch is requested, the response carries `note` explaining this so the UI
// can surface it instead of presenting a branch-specific number that isn't one.
//
// ── Phone matching ────────────────────────────────────────────────────────────────────────────
// Uses the same normalizePhone() from src/lib/phone.js that Patient's own pre-save hook uses to
// maintain personal.phoneNormalized — normalizing each Lead's phone in JS and matching against
// that already-indexed field, rather than a second normalization implementation.
//
// ── Campaign attribution gap ──────────────────────────────────────────────────────────────────
// Leads carries a `tag` (platform-level: "Meta Leads" / "Google Leads"), not a campaign
// identifier — there is no field connecting a lead to a specific named campaign. So when a
// platform has more than one distinct campaignName in AdSpend, each campaign gets its own row
// with a real Spend figure but null Leads/CPL/Converted/Revenue/CAC/ROAS (not attributable at
// that granularity), and a separate isPlatformTotal row carries the real, fully-attributed
// numbers for the platform as a whole. When a platform has exactly one campaign group (including
// the common case of every entry having no campaignName), that single row already IS the
// platform total, so no separate total row is added.

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
// Same converted-status set src/app/api/super-admin/lead-funnel/route.js already uses.
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

    // ── Spend: real branch scoping ──────────────────────────────────────────────
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

    // ── Leads: global (see note above), bucketed by platform via tag ───────────────
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
        if (countedPatientIds.has(pid)) continue; // multiple leads resolving to the same patient
        countedPatientIds.add(pid);
        converted += 1;
        revenue += patient.payments?.totalAmount || 0;
      }
      return { converted, revenue };
    }

    // ── Assemble rows ────────────────────────────────────────────────────────────
    const rows = [];
    for (const platform of PLATFORMS) {
      const campaigns = spendByPlatform[platform];
      if (campaigns.length === 0) continue; // nothing spent here for this branch/date range

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
