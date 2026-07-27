// src/app/api/super-admin/lead-funnel/route.js
//
// POST body: { agentIds?: string[], teams?: string[], dateFrom?, dateTo?, leadNumber? }
//
// Flow:
//   1. Fetch matching leads live from the Callby backend (call-tracking CRM).
//   2. Fetch matching Patient docs from our own DB by phone.
//   3. Merge + bucket into the funnel tree, per-node with count + amount + lead list.
//
// Nothing here is cached or written to a DB collection — every request is a
// fresh live pull from both systems, per requirement.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";

const CALLBY_API_URL = process.env.CALLBY_API_URL; // e.g. https://api.learcrm.com
const CALLBY_SERVICE_TOKEN = process.env.CALLBY_SERVICE_TOKEN; // manager-role JWT, see setup notes

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

async function fetchCallbyLeads({ agentIds, teams, dateFrom, dateTo, leadNumber }) {
  const params = new URLSearchParams();
  if (agentIds?.length) params.set("agentIds", agentIds.join(","));
  if (teams?.length) params.set("teams", teams.join(","));
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (leadNumber) params.set("leadNumber", leadNumber);

  const res = await fetch(`${CALLBY_API_URL}/api/leads/funnel-data?${params.toString()}`, {
    headers: { Authorization: `Bearer ${CALLBY_SERVICE_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Callby leads fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

// Patient.ops.status: NEW | NOT_VISITED | NOT_CONVERTED | CONSULTED | SURGERY_BOOKED | BOOKING_DONE | CLOSED
const VISITED_STATUSES = ["CONSULTED", "NOT_CONVERTED", "SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];
const CONVERTED_STATUSES = ["SURGERY_BOOKED", "BOOKING_DONE", "CLOSED"];

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session?.user?.role !== "super-admin") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    if (!CALLBY_API_URL || !CALLBY_SERVICE_TOKEN) {
      return NextResponse.json(
        { success: false, message: "CALLBY_API_URL / CALLBY_SERVICE_TOKEN not configured" },
        { status: 500 }
      );
    }

    await connectDB();

    const body = await req.json();
    const { agentIds, teams, dateFrom, dateTo, leadNumber } = body;

    const leads = await fetchCallbyLeads({ agentIds, teams, dateFrom, dateTo, leadNumber });

    // Only leads that ever got connected AND weren't marked not-interested/lost
    // are worth checking against the clinic's patient records — no point
    // hitting the Patient collection for leads that were never even reached.
    const pursuableStatuses = ["interested", "follow_up", "booking_done", "converted"];
    const phonesToCheck = leads
      .filter((l) => pursuableStatuses.includes(l.status))
      .map((l) => normalizePhone(l.phone))
      .filter(Boolean);

    const patients = phonesToCheck.length
      ? await Patient.find({ "personal.phone": { $in: phonesToCheck } })
          .select("personal.phone personal.visitDate ops.status counselling.counsellor payments.amountReceived payments.totalAmount payments.pendingAmount surgery.surgeryDate")
          .lean()
      : [];

    const patientByPhone = new Map();
    patients.forEach((p) => {
      const phone = normalizePhone(p.personal?.phone);
      if (phone) patientByPhone.set(phone, p);
    });

    const tree = buildFunnelTree(leads, patientByPhone);

    return NextResponse.json({ success: true, tree });
  } catch (err) {
    console.error("lead-funnel route error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

function buildFunnelTree(leads, patientByPhone) {
  const bucket = (arr, label, extra = {}) => ({
    label,
    count: arr.length,
    leads: arr.map(slimLead),
    ...extra,
  });

  const attempted = leads.filter((l) => l.attempts > 0);
  const notAttempted = leads.filter((l) => !l.attempts);

  const connected = attempted.filter((l) => l.connectedCallCount > 0);
  const notConnected = attempted.filter((l) => !l.connectedCallCount);

  const interested = connected.filter((l) => l.status === "interested");
  const notInterested = connected.filter((l) => l.status === "not_interested");
  const followUp = connected.filter((l) => l.status === "follow_up");
  // Callby has no distinct "callback" status today — leads that connected but
  // haven't been dispositioned yet (still "contacted") land here. Rename the
  // status enum on the Callby side if a real separate bucket is wanted later.
  const callback = connected.filter((l) => l.status === "contacted");

  // Anyone who progressed past initial interest — this is the pool checked
  // against Patient records for visit/conversion.
  const pursuable = connected.filter((l) =>
    ["interested", "follow_up", "booking_done", "converted"].includes(l.status)
  );

  const withPatient = pursuable.map((l) => ({
    lead: l,
    patient: patientByPhone.get(normalizePhoneSafe(l.phone)) || null,
  }));

  const visited = withPatient.filter(
    ({ patient }) => patient && (VISITED_STATUSES.includes(patient.ops?.status) || patient.counselling?.counsellor)
  );
  const notVisited = withPatient.filter(
    ({ patient }) => !patient || (!VISITED_STATUSES.includes(patient.ops?.status) && !patient.counselling?.counsellor)
  );

  const converted = visited.filter(({ patient }) => CONVERTED_STATUSES.includes(patient.ops?.status));
  const notConverted = visited.filter(({ patient }) => !CONVERTED_STATUSES.includes(patient.ops?.status));

  const bookingDone = converted.filter(({ patient }) => patient.ops?.status === "BOOKING_DONE");
  const surgeryBooked = converted.filter(({ patient }) =>
    ["SURGERY_BOOKED", "CLOSED"].includes(patient.ops?.status)
  );

  const sumAmount = (arr, field) => arr.reduce((sum, { patient }) => sum + (patient?.payments?.[field] || 0), 0);

  return {
    label: "Total Leads",
    count: leads.length,
    leads: leads.map(slimLead),
    children: [
      {
        ...bucket(notAttempted, "Not Attempted"),
      },
      {
        ...bucket(attempted, "Attempted"),
        children: [
          { ...bucket(notConnected, "Not Connected") },
          {
            ...bucket(connected, "Connected"),
            children: [
              { ...bucket(interested, "Interested") },
              { ...bucket(notInterested, "Not Interested") },
              { ...bucket(followUp, "Follow Up") },
              { ...bucket(callback, "Callback / Pending Disposition") },
              // Visit/conversion drill-down sits alongside the 4 status
              // buckets as its own branch — a lead's visit status is
              // independent of which status bucket it's currently in, so
              // it's pooled from `pursuable` rather than nested under just one.
              {
                label: "Checked Against Clinic Records",
                count: pursuable.length,
                leads: pursuable.map(slimLead),
                children: [
                  {
                    label: "Not Visited",
                    count: notVisited.length,
                    leads: notVisited.map(({ lead }) => slimLead(lead)),
                  },
                  {
                    label: "Visited",
                    count: visited.length,
                    leads: visited.map(({ lead, patient }) => slimLead(lead, patient)),
                    children: [
                      {
                        label: "Not Converted",
                        count: notConverted.length,
                        leads: notConverted.map(({ lead, patient }) => slimLead(lead, patient)),
                      },
                      {
                        label: "Converted",
                        count: converted.length,
                        leads: converted.map(({ lead, patient }) => slimLead(lead, patient)),
                        children: [
                          {
                            label: "Booking Done",
                            count: bookingDone.length,
                            amount: sumAmount(bookingDone, "amountReceived"),
                            leads: bookingDone.map(({ lead, patient }) => slimLead(lead, patient)),
                          },
                          {
                            label: "Surgery Booked",
                            count: surgeryBooked.length,
                            amount: sumAmount(surgeryBooked, "totalAmount"),
                            leads: surgeryBooked.map(({ lead, patient }) => slimLead(lead, patient)),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function normalizePhoneSafe(phone) {
  return normalizePhone(phone) || phone;
}

function slimLead(lead, patient) {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    status: lead.status,
    agent: lead.agent?.name || null,
    team: lead.agent?.team || null,
    createdAt: lead.createdAt,
    ...(patient
      ? {
          patientStatus: patient.ops?.status || null,
          amountReceived: patient.payments?.amountReceived || 0,
          pendingAmount: patient.payments?.pendingAmount || 0,
        }
      : {}),
  };
}
