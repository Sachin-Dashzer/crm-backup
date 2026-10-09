import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Patient from "@/models/Patient";
import Employee from "@/models/Employee";
import Transactions from "@/models/Transactions.js";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION } from "@/constants/bankRouting";
import { maskPhone } from "@/utils/phoneUtils";

const ALLOWED_ROLES = ["sales", "admin", "super-admin", "owner"];

const CONVERTED_STATUSES = [
  "CONVERTED",
  "SURGERY_BOOKED",
  "SURGERY_DONE",
  "BOOKING_DONE",
  "COMPLETED",
];

const EXCLUDED_PENDING_STATUSES = [
  "CONVERTED",
  "SURGERY_BOOKED",
  "SURGERY_DONE",
  "BOOKING_DONE",
  "COMPLETED",
  "DISQUALIFIED",
  "LOST",
];

function toCSV(rows) {
  if (!rows || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    return str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const role = session?.user?.role;
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "summary";
    const branch = searchParams.get("branch");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const format = searchParams.get("format"); // "csv" or json (default)

    // Common date boundaries
    const dateQuery = {};
    let rangeStart = null;
    let rangeEnd = null;
    if (dateFrom || dateTo) {
      if (dateFrom) {
        rangeStart = new Date(dateFrom);
        dateQuery.$gte = rangeStart;
      }
      if (dateTo) {
        rangeEnd = new Date(dateTo);
        rangeEnd.setHours(23, 59, 59, 999);
        dateQuery.$lte = rangeEnd;
      }
    }

    const branchFilter = branch && branch !== "All" ? branch : null;

    let rows = [];
    let filename = `sales-${type}-report`;

    switch (type) {
      // 1. Appointments & Consultations Report
      case "appointments": {
        const query = {};
        if (Object.keys(dateQuery).length) {
          query["personal.visitDate"] = dateQuery;
        }
        if (branchFilter) {
          query["personal.branch"] = branchFilter;
        }

        const appointments = await Patient.find(query)
          .select("personal.name personal.phone personal.branch personal.visitDate personal.techniqueQuoted personal.packageQuoted ops.status personal.reference counselling.counsellor")
          .populate("personal.reference", "name")
          .populate("counselling.counsellor", "name")
          .sort({ "personal.visitDate": -1 })
          .limit(3000)
          .lean();

        rows = appointments.map((p) => ({
          "Appointment Date": p.personal?.visitDate
            ? new Date(p.personal.visitDate).toLocaleDateString("en-IN")
            : "—",
          "Patient Name": p.personal?.name || "—",
          "Contact Phone": maskPhone(p.personal?.phone, role),
          Branch: p.personal?.branch || "—",
          Status: p.ops?.status?.replace(/_/g, " ") || "NEW",
          "Quoted Technique": p.personal?.techniqueQuoted || "—",
          "Quoted Package (INR)": p.personal?.packageQuoted || 0,
          "Sales Agent / Reference": p.personal?.reference?.name || "—",
          Counsellor: p.counselling?.counsellor?.name || "—",
        }));
        filename = "appointments-schedule-report";
        break;
      }

      // 2. Sales Leads & Inquiries Report
      case "leads": {
        const query = {};
        if (Object.keys(dateQuery).length) {
          query.createdAt = dateQuery;
        }
        if (branchFilter) {
          query["personal.branch"] = branchFilter;
        }

        const leads = await Patient.find(query)
          .select("personal.name personal.phone personal.branch personal.visitDate personal.techniqueQuoted personal.packageQuoted ops.status personal.reference counselling.counsellor payments.amountReceived payments.totalAmount createdAt")
          .populate("personal.reference", "name")
          .populate("counselling.counsellor", "name")
          .sort({ createdAt: -1 })
          .limit(3000)
          .lean();

        rows = leads.map((p) => ({
          "Created Date": p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—",
          "Patient Name": p.personal?.name || "—",
          "Contact Phone": maskPhone(p.personal?.phone, role),
          Branch: p.personal?.branch || "—",
          "Visit Date": p.personal?.visitDate
            ? new Date(p.personal.visitDate).toLocaleDateString("en-IN")
            : "Not Scheduled",
          Status: p.ops?.status?.replace(/_/g, " ") || "NEW",
          "Quoted Technique": p.personal?.techniqueQuoted || "—",
          "Quoted Package": p.personal?.packageQuoted || 0,
          "Sales Agent / Reference": p.personal?.reference?.name || "—",
          Counsellor: p.counselling?.counsellor?.name || "—",
          "Total Billed": p.payments?.totalAmount || 0,
          "Amount Received": p.payments?.amountReceived || 0,
        }));
        filename = "sales-leads-report";
        break;
      }

      // 3. Patients Directory Report (Restored from Old)
      case "patients": {
        const query = {};
        if (Object.keys(dateQuery).length) {
          query.createdAt = dateQuery;
        }
        if (branchFilter) {
          query["personal.branch"] = branchFilter;
        }

        const patients = await Patient.find(query)
          .select("personal.name personal.age personal.gender personal.phone personal.branch ops.status surgery.surgeryDate personal.reference personal.techniqueQuoted payments.totalAmount payments.amountReceived createdAt")
          .populate("personal.reference", "name")
          .sort({ createdAt: -1 })
          .limit(3000)
          .lean();

        rows = patients.map((p) => {
          const isConverted = Boolean(
            p.surgery?.surgeryDate || CONVERTED_STATUSES.includes(p.ops?.status)
          );

          return {
            "Registration Date": p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—",
            "Patient Name": p.personal?.name || "—",
            Age: p.personal?.age ?? "—",
            Gender: p.personal?.gender || "—",
            "Contact Phone": maskPhone(p.personal?.phone, role),
            Branch: p.personal?.branch || "—",
            "Current Stage": p.ops?.status?.replace(/_/g, " ") || "NEW",
            "Conversion Status": isConverted ? "Converted" : "Pending",
            "Sales Agent": p.personal?.reference?.name || "—",
            "Quoted Technique": p.personal?.techniqueQuoted || "—",
            "Total Billed (INR)": p.payments?.totalAmount || 0,
            "Amount Received (INR)": p.payments?.amountReceived || 0,
          };
        });
        filename = "patients-directory-report";
        break;
      }

      // 4. Converted Patients Report (Restored from Old)
      case "converted-patients": {
        const query = {
          $or: [
            { "surgery.surgeryDate": { $ne: null } },
            { "ops.status": { $in: CONVERTED_STATUSES } },
          ],
        };

        if (Object.keys(dateQuery).length) {
          query.$or = [
            { "surgery.surgeryDate": dateQuery },
            { createdAt: dateQuery, "ops.status": { $in: CONVERTED_STATUSES } },
          ];
        }

        if (branchFilter) {
          query["personal.branch"] = branchFilter;
        }

        const convertedPatients = await Patient.find(query)
          .select("personal.name personal.phone personal.branch personal.visitDate personal.techniqueQuoted personal.packageQuoted ops.status surgery.surgeryDate personal.reference payments.amountReceived payments.totalAmount createdAt")
          .populate("personal.reference", "name")
          .sort({ "surgery.surgeryDate": -1, createdAt: -1 })
          .limit(3000)
          .lean();

        rows = convertedPatients.map((p) => {
          const conversionDate = p.surgery?.surgeryDate
            ? new Date(p.surgery.surgeryDate).toLocaleDateString("en-IN")
            : p.personal?.visitDate
              ? new Date(p.personal.visitDate).toLocaleDateString("en-IN")
              : p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("en-IN")
                : "—";

          return {
            "Patient Name": p.personal?.name || "—",
            "Contact Phone": maskPhone(p.personal?.phone, role),
            Branch: p.personal?.branch || "—",
            "Conversion Date": conversionDate,
            "Sales Agent / Telecaller": p.personal?.reference?.name || "—",
            "Quoted Technique": p.personal?.techniqueQuoted || "Hair Transplant",
            "Package Amount (INR)": p.payments?.totalAmount || p.personal?.packageQuoted || 0,
            "Revenue Generated (INR)": p.payments?.amountReceived || 0,
            "Current Status": p.ops?.status?.replace(/_/g, " ") || "CONVERTED",
          };
        });
        filename = "converted-patients-report";
        break;
      }

      // 5. Pending Leads Report (Restored from Old)
      case "pending-leads": {
        const query = {
          "surgery.surgeryDate": null,
          "ops.status": { $nin: EXCLUDED_PENDING_STATUSES },
        };

        if (Object.keys(dateQuery).length) {
          query.createdAt = dateQuery;
        }

        if (branchFilter) {
          query["personal.branch"] = branchFilter;
        }

        const now = new Date();
        const pendingLeads = await Patient.find(query)
          .select("personal.name personal.phone personal.branch personal.visitDate personal.techniqueQuoted personal.packageQuoted ops.status personal.reference createdAt")
          .populate("personal.reference", "name")
          .sort({ createdAt: -1 })
          .limit(3000)
          .lean();

        rows = pendingLeads.map((p) => {
          const daysOpen = p.createdAt
            ? Math.max(0, Math.floor((now - new Date(p.createdAt)) / (1000 * 60 * 60 * 24)))
            : 0;

          return {
            "Lead Name": p.personal?.name || "—",
            "Contact Phone": maskPhone(p.personal?.phone, role),
            Branch: p.personal?.branch || "—",
            "Days Open": daysOpen,
            "Created Date": p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—",
            "Visit Date": p.personal?.visitDate
              ? new Date(p.personal.visitDate).toLocaleDateString("en-IN")
              : "Not Scheduled",
            "Current Stage": p.ops?.status?.replace(/_/g, " ") || "NEW",
            "Sales Agent / Telecaller": p.personal?.reference?.name || "—",
            "Quoted Technique": p.personal?.techniqueQuoted || "—",
            "Quoted Package (INR)": p.personal?.packageQuoted || 0,
          };
        });
        filename = "pending-leads-report";
        break;
      }

      // 6. Sales Agent Performance Report (Preserved)
      case "agent-performance":
      case "agents": {
        // STRICT: Only role === "Agent" (Sales Agents / Telecallers)
        const agentQuery = { role: "Agent" };
        if (branchFilter) {
          agentQuery.branch = branchFilter;
        }

        const agents = await Employee.find(agentQuery)
          .select("name branch isactive patient")
          .populate({
            path: "patient",
            select: "personal.visitDate payments.amountReceived surgery.surgeryDate counselling.counsellor ops.status createdAt",
          })
          .sort({ name: 1 })
          .lean();

        rows = agents.map((agent) => {
          let patients = agent.patient || [];
          if (Object.keys(dateQuery).length) {
            patients = patients.filter((p) => {
              const d = p.createdAt || p.personal?.visitDate;
              if (!d) return false;
              const dt = new Date(d);
              if (dateQuery.$gte && dt < dateQuery.$gte) return false;
              if (dateQuery.$lte && dt > dateQuery.$lte) return false;
              return true;
            });
          }

          const totalLeads = patients.length;
          const visited = patients.filter((p) => p.counselling?.counsellor).length;
          const converted = patients.filter(
            (p) => p.surgery?.surgeryDate || CONVERTED_STATUSES.includes(p.ops?.status)
          ).length;
          const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : "0.0";
          const totalRevenue = patients.reduce(
            (sum, p) => sum + (parseInt(p.payments?.amountReceived) || 0),
            0
          );
          const avgRevenue = totalLeads > 0 ? Math.round(totalRevenue / totalLeads) : 0;

          return {
            "Agent Name": agent.name,
            Branch: agent.branch || "—",
            Status: agent.isactive ? "Active" : "Inactive",
            "Total Leads": totalLeads,
            "Consultations / Visited": visited,
            Converted: converted,
            "Conversion Rate (%)": `${conversionRate}%`,
            "Total Revenue (INR)": totalRevenue,
            "Avg Revenue Per Lead (INR)": avgRevenue,
          };
        });
        filename = "sales-agents-performance-report";
        break;
      }

      // 7. Revenue & Collections Ledger Report (Preserved)
      case "revenue": {
        const query = {
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS },
          ...SETTLEMENT_EXCLUSION,
        };
        if (Object.keys(dateQuery).length) {
          query.date = dateQuery;
        }
        if (branchFilter) {
          query.branch = branchFilter;
        }

        const transactions = await Transactions.find(query)
          .select("date branch transactionCategory procedure paymentType method amount paymentId remarks patient")
          .populate("patient", "personal.name personal.branch")
          .sort({ date: -1 })
          .limit(3000)
          .lean();

        rows = transactions.map((t) => ({
          Date: t.date ? new Date(t.date).toLocaleDateString("en-IN") : "—",
          "Patient Name": t.patient?.personal?.name || "Walk-in Customer",
          Branch: t.branch || "—",
          Category: t.transactionCategory || "TRANSPLANT",
          Procedure: t.procedure || "—",
          "Payment Type": t.paymentType || "Full-payment",
          Method: (t.method || "").replace(/_/g, " ").toUpperCase(),
          "Amount (INR)": t.amount || 0,
          "Transaction ID": t.paymentId || "—",
          Remarks: t.remarks || "—",
        }));
        filename = "sales-revenue-transactions-report";
        break;
      }

      // 8. Daily Summary Report (Restored from Old)
      case "daily-summary": {
        const txMatch = {
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS },
          ...SETTLEMENT_EXCLUSION,
        };
        if (Object.keys(dateQuery).length) txMatch.date = dateQuery;
        if (branchFilter) txMatch.branch = branchFilter;

        const patientMatch = {};
        if (Object.keys(dateQuery).length) patientMatch.createdAt = dateQuery;
        if (branchFilter) patientMatch["personal.branch"] = branchFilter;

        const visitMatch = { "personal.visitDate": { $ne: null } };
        if (Object.keys(dateQuery).length) visitMatch["personal.visitDate"] = dateQuery;
        if (branchFilter) visitMatch["personal.branch"] = branchFilter;

        // Perform parallel aggregations
        const [dailyTxs, dailyLeads, dailyVisits] = await Promise.all([
          Transactions.aggregate([
            { $match: txMatch },
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Kolkata" } },
                  branch: { $ifNull: ["$branch", "Delhi"] },
                },
                revenue: { $sum: { $toDouble: "$amount" } },
                txCount: { $sum: 1 },
              },
            },
          ]),

          Patient.aggregate([
            { $match: patientMatch },
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                  branch: { $ifNull: ["$personal.branch", "Delhi"] },
                },
                newLeads: { $sum: 1 },
                converted: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $ne: ["$surgery.surgeryDate", null] },
                          { $in: ["$ops.status", CONVERTED_STATUSES] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ]),

          Patient.aggregate([
            { $match: visitMatch },
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$personal.visitDate", timezone: "Asia/Kolkata" } },
                  branch: { $ifNull: ["$personal.branch", "Delhi"] },
                },
                contacted: { $sum: 1 },
              },
            },
          ]),
        ]);

        const map = new Map();
        const getKey = (d, b) => `${d}_${b}`;

        for (const t of dailyTxs) {
          if (!t._id?.date) continue;
          const key = getKey(t._id.date, t._id.branch);
          if (!map.has(key)) {
            map.set(key, { date: t._id.date, branch: t._id.branch, newLeads: 0, contacted: 0, converted: 0, revenue: 0 });
          }
          map.get(key).revenue = Math.round(t.revenue || 0);
        }

        for (const l of dailyLeads) {
          if (!l._id?.date) continue;
          const key = getKey(l._id.date, l._id.branch);
          if (!map.has(key)) {
            map.set(key, { date: l._id.date, branch: l._id.branch, newLeads: 0, contacted: 0, converted: 0, revenue: 0 });
          }
          const item = map.get(key);
          item.newLeads = l.newLeads || 0;
          item.converted += l.converted || 0;
        }

        for (const v of dailyVisits) {
          if (!v._id?.date) continue;
          const key = getKey(v._id.date, v._id.branch);
          if (!map.has(key)) {
            map.set(key, { date: v._id.date, branch: v._id.branch, newLeads: 0, contacted: 0, converted: 0, revenue: 0 });
          }
          map.get(key).contacted = v.contacted || 0;
        }

        const sortedDays = Array.from(map.values()).sort(
          (a, b) => b.date.localeCompare(a.date) || a.branch.localeCompare(b.branch)
        );

        rows = sortedDays.map((item) => ({
          Date: item.date,
          Branch: item.branch,
          "New Leads": item.newLeads,
          "Consultations / Contacted": item.contacted,
          Conversions: item.converted,
          "Revenue Collected (INR)": item.revenue,
        }));
        filename = "daily-sales-summary-report";
        break;
      }

      // 9. Executive Sales Summary Report (Preserved)
      case "summary":
      default: {
        const patientQuery = {};
        if (Object.keys(dateQuery).length) patientQuery.createdAt = dateQuery;
        if (branchFilter) patientQuery["personal.branch"] = branchFilter;

        const txQuery = {
          costType: "Revenue",
          method: { $nin: UNSETTLED_METHODS },
          ...SETTLEMENT_EXCLUSION,
        };
        if (Object.keys(dateQuery).length) txQuery.date = dateQuery;
        if (branchFilter) txQuery.branch = branchFilter;

        const [patients, txs, activeAgents] = await Promise.all([
          Patient.find(patientQuery).select("ops.status surgery.surgeryDate payments.amountReceived").lean(),
          Transactions.find(txQuery).select("amount").lean(),
          Employee.countDocuments({ role: "Agent", isactive: true, ...(branchFilter ? { branch: branchFilter } : {}) }),
        ]);

        const totalLeads = patients.length;
        const converted = patients.filter(
          (p) => p.surgery?.surgeryDate || CONVERTED_STATUSES.includes(p.ops?.status)
        ).length;
        const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : "0.0";
        const totalRevenue = txs.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

        rows = [
          {
            "Report Period": dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : "All Time",
            "Branch Filter": branchFilter || "All Branches",
            "Total Leads Generated": totalLeads,
            "Total Converted": converted,
            "Conversion Rate (%)": `${conversionRate}%`,
            "Total Revenue (INR)": totalRevenue,
            "Active Telecallers / Agents": activeAgents,
          },
        ];
        filename = "sales-executive-summary-report";
        break;
      }
    }

    const csvData = toCSV(rows);

    if (format === "csv") {
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      filename,
      count: rows.length,
      csvData,
      data: rows,
    });
  } catch (error) {
    console.error("Sales report generation error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to generate report", error: error.message },
      { status: 500 }
    );
  }
}
