import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Patient from "@/models/Patient";
import Transactions from "@/models/Transactions";
import Leads from "@/models/Leads";
import Stock from "@/models/Stock";
import Employee from "@/models/Employee";

export async function POST(req) {
  try {
    const { question, history = [] } = await req.json();
    if (!question?.trim()) return NextResponse.json({ answer: "Please ask something." });

    await dbConnect();

    // ── Time windows ──────────────────────────────────────────────
    const now            = new Date();
    const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd   = new Date(todayStart); yesterdayEnd.setMilliseconds(-1);
    const weekStart      = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // ── Reusable aggregate builders ───────────────────────────────
    const agentPerf = (dateFilter) => Patient.aggregate([
      { $match: { "personal.reference": { $exists: true, $ne: null }, ...dateFilter } },
      { $group: {
        _id:       "$personal.reference",
        referrals: { $sum: 1 },
        converted: { $sum: { $cond: [{ $in: ["$ops.status", ["SURGERY_BOOKED", "CLOSED"]] }, 1, 0] } },
        revenue:   { $sum: { $ifNull: ["$payments.amountReceived", 0] } },
      }},
      { $sort: { revenue: -1 } },
      { $lookup: { from: "employees", localField: "_id", foreignField: "_id", as: "emp" } },
      { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
    ]);

    const counsellorPerf = (dateFilter) => Patient.aggregate([
      { $match: { "counselling.counsellor": { $exists: true, $ne: null }, ...dateFilter } },
      { $group: {
        _id:       "$counselling.counsellor",
        total:     { $sum: 1 },
        converted: { $sum: { $cond: ["$counselling.readyForSurgery", 1, 0] } },
        totalPkg:  { $sum: { $ifNull: ["$counselling.finlpackage", 0] } },
      }},
      { $sort: { converted: -1 } },
      { $lookup: { from: "employees", localField: "_id", foreignField: "_id", as: "emp" } },
      { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
    ]);

    const txRevenue = (match) => Transactions.aggregate([
      { $match: { costType: "Revenue", ...match } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // ── Fire all queries in parallel ──────────────────────────────
    const [
      totalPatients, patientsByStatus, patientsByBranch, recentPatients,
      todayAppts, yesterdayAppts, monthAppts,

      agentToday, agentYesterday, agentThisMonth, agentAllTime,
      counsellorYesterday, counsellorThisMonth,

      doctorThisMonth,

      revAllTime, revToday, revYesterday, revThisMonth, revLastMonth,
      expThisMonth,
      revByBranch, revByCategory, revByProcedure, revByMethod,

      totalLeads, todayLeads, yesterdayLeads, weekLeads, monthLeads,
      leadsByTag, recentLeads,

      allStock, lowStock,
      allEmployees,
    ] = await Promise.all([
      // Patients
      Patient.countDocuments(),
      Patient.aggregate([{ $group: { _id: "$ops.status", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Patient.aggregate([{ $group: { _id: "$personal.branch", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Patient.find().sort({ createdAt: -1 }).limit(10)
        .select("personal.name personal.phone personal.branch personal.visitDate personal.purpose ops.status payments.amountReceived payments.pendingAmount counselling.finlpackage")
        .lean(),
      Patient.countDocuments({ "personal.visitDate": { $gte: todayStart } }),
      Patient.countDocuments({ "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      Patient.countDocuments({ "personal.visitDate": { $gte: monthStart } }),

      // Agent performance
      agentPerf({ "personal.visitDate": { $gte: todayStart } }),
      agentPerf({ "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      agentPerf({ "personal.visitDate": { $gte: monthStart } }),
      agentPerf({}),

      // Counsellor performance
      counsellorPerf({ "personal.visitDate": { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      counsellorPerf({ "personal.visitDate": { $gte: monthStart } }),

      // Doctor performance
      Patient.aggregate([
        { $match: { "surgery.surgeryDate": { $gte: monthStart }, "surgery.doctor": { $exists: true, $ne: [] } } },
        { $unwind: "$surgery.doctor" },
        { $group: { _id: "$surgery.doctor", surgeries: { $sum: 1 }, grafts: { $sum: { $ifNull: ["$surgery.graftsImplanted", 0] } }, revenue: { $sum: { $ifNull: ["$payments.amountReceived", 0] } } } },
        { $sort: { surgeries: -1 } },
        { $lookup: { from: "employees", localField: "_id", foreignField: "_id", as: "emp" } },
        { $unwind: { path: "$emp", preserveNullAndEmptyArrays: true } },
      ]),

      // Revenue
      txRevenue({}),
      txRevenue({ date: { $gte: todayStart } }),
      txRevenue({ date: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      txRevenue({ date: { $gte: monthStart } }),
      txRevenue({ date: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Transactions.aggregate([{ $match: { costType: "Expenses", date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Transactions.aggregate([{ $match: { costType: "Revenue" } }, { $group: { _id: "$branch", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Transactions.aggregate([{ $match: { costType: "Revenue" } }, { $group: { _id: "$transactionCategory", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Transactions.aggregate([{ $match: { costType: "Revenue", date: { $gte: monthStart } } }, { $group: { _id: "$procedure", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
      Transactions.aggregate([{ $match: { costType: "Revenue", date: { $gte: monthStart } } }, { $group: { _id: "$method", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),

      // Leads
      Leads.countDocuments(),
      Leads.countDocuments({ createdAt: { $gte: todayStart } }),
      Leads.countDocuments({ createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }),
      Leads.countDocuments({ createdAt: { $gte: weekStart } }),
      Leads.countDocuments({ createdAt: { $gte: monthStart } }),
      Leads.aggregate([{ $group: { _id: "$tag", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Leads.find().sort({ createdAt: -1 }).limit(15).select("name phone email location tag remarks createdAt").lean(),

      // Stock
      Stock.find().select("name totalQuantity unit mrp expiry location").lean(),
      Stock.find({ totalQuantity: { $lte: 5 } }).select("name totalQuantity unit").lean(),

      // Employees
      Employee.find({ isactive: true }).select("name role phone").lean(),
    ]);

    // ── Format helpers ─────────────────────────────────────────────
    const fmt    = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const ist    = (d) => d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";

    const fmtAgent = (arr) => arr.map((a) => ({
      name:      a.emp?.name || "Unknown",
      role:      a.emp?.role || "—",
      referrals: a.referrals,
      converted: a.converted,
      convRate:  a.referrals > 0 ? `${Math.round((a.converted / a.referrals) * 100)}%` : "0%",
      revenue:   fmt(a.revenue),
    }));

    const fmtCounsellor = (arr) => arr.map((c) => ({
      name:      c.emp?.name || "Unknown",
      consulted: c.total,
      converted: c.converted,
      convRate:  c.total > 0 ? `${Math.round((c.converted / c.total) * 100)}%` : "0%",
      totalPkg:  fmt(c.totalPkg),
    }));

    // ── CRM Context ───────────────────────────────────────────────
    const ctx = {
      reportTime: ist(now),

      patients: {
        total: totalPatients,
        today: todayAppts,
        yesterday: yesterdayAppts,
        thisMonth: monthAppts,
        byStatus: patientsByStatus.map((s) => ({ status: s._id, count: s.count })),
        byBranch: patientsByBranch.map((b) => ({ branch: b._id || "Unassigned", count: b.count })),
        recent10: recentPatients.map((p) => ({
          name: p.personal?.name, phone: p.personal?.phone, branch: p.personal?.branch,
          visitDate: ist(p.personal?.visitDate), purpose: p.personal?.purpose,
          status: p.ops?.status, package: fmt(p.counselling?.finlpackage),
          received: fmt(p.payments?.amountReceived), pending: fmt(p.payments?.pendingAmount),
        })),
      },

      agentPerformance: {
        note: "Agent = employee who referred the patient (personal.reference)",
        today:     fmtAgent(agentToday),
        yesterday: fmtAgent(agentYesterday),
        thisMonth: fmtAgent(agentThisMonth),
        allTime:   fmtAgent(agentAllTime),
      },

      counsellorPerformance: {
        yesterday: fmtCounsellor(counsellorYesterday),
        thisMonth: fmtCounsellor(counsellorThisMonth),
      },

      doctorPerformance: {
        thisMonth: doctorThisMonth.map((d) => ({
          name: d.emp?.name || "Unknown", surgeries: d.surgeries,
          grafts: d.grafts, revenue: fmt(d.revenue),
        })),
      },

      revenue: {
        allTime: fmt(revAllTime[0]?.total),
        today: fmt(revToday[0]?.total),
        yesterday: fmt(revYesterday[0]?.total),
        thisMonth: fmt(revThisMonth[0]?.total),
        lastMonth: fmt(revLastMonth[0]?.total),
        expensesThisMonth: fmt(expThisMonth[0]?.total),
        byBranch:    revByBranch.map((b) => ({ branch: b._id, revenue: fmt(b.total), count: b.count })),
        byCategory:  revByCategory.map((c) => ({ category: c._id, revenue: fmt(c.total), count: c.count })),
        byProcedure: revByProcedure.map((p) => ({ procedure: p._id, revenue: fmt(p.total), count: p.count })),
        byMethod:    revByMethod.map((m) => ({ method: m._id, revenue: fmt(m.total), count: m.count })),
      },

      leads: {
        total: totalLeads, today: todayLeads, yesterday: yesterdayLeads,
        thisWeek: weekLeads, thisMonth: monthLeads,
        bySource: leadsByTag.map((t) => ({ source: t._id || "Untagged", count: t.count })),
        recent15: recentLeads.map((l) => ({
          name: l.name, phone: l.phone, location: l.location || "—",
          source: l.tag || "Untagged", remarks: l.remarks || "—", date: ist(l.createdAt),
        })),
      },

      stock: {
        totalItems: allStock.length,
        lowStockAlert: lowStock.length > 0 ? `⚠️ ${lowStock.length} items critically low` : "✅ Stock OK",
        lowStockItems: lowStock.map((s) => ({ name: s.name, qty: s.totalQuantity, unit: s.unit })),
        allItems: allStock.map((s) => ({ name: s.name, qty: s.totalQuantity, unit: s.unit, mrp: fmt(s.mrp) })),
      },

      team: {
        totalActive: allEmployees.length,
        allEmployees: allEmployees.map((e) => ({ name: e.name, role: e.role, phone: e.phone || "—" })),
        byRole: allEmployees.reduce((acc, e) => { acc[e.role] = (acc[e.role] || 0) + 1; return acc; }, {}),
      },
    };

    // ── Call OpenAI ───────────────────────────────────────────────
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are Saniya — the AI assistant for Ryan Clinic (Ryan MediHub), a premium hair transplant clinic in Delhi, Mumbai, and Hyderabad.

You have FULL real-time CRM access. Answer every question directly from the data. NEVER say "data not available" if it's present in the context.

Key rules:
- "kal" = yesterday, "aaj" = today, "is month" = this month, "pichhle month" = last month
- For agent/counsellor/doctor name queries: search by name (case-insensitive, partial match ok). e.g. "aisha" matches "Aisha Khan"
- Agent performance = agentPerformance section (patients they referred + revenue collected)
- Counsellor performance = counsellorPerformance section
- Revenue, patients, leads all have today/yesterday/thisMonth breakdowns — use the right one
- Format: ₹ Indian style, clean tables for lists
- Language: match the admin's language (Hindi/English/Hinglish)
- Be sharp and direct — no filler, no excuses`,
          },
          ...history.slice(-6),
          {
            role: "user",
            content: `Live CRM Data:\n${JSON.stringify(ctx, null, 2)}\n\nQuestion: ${question}`,
          },
        ],
      }),
    });

    const openaiData = await openaiRes.json();
    if (!openaiRes.ok) {
      console.error("OpenAI error:", openaiData);
      return NextResponse.json({ answer: "OpenAI API error. Check OPENAI_API_KEY." }, { status: 500 });
    }

    const answer = openaiData.choices?.[0]?.message?.content || "Sorry, couldn't process that.";
    return NextResponse.json({ answer });

  } catch (err) {
    console.error("Saniya error:", err);
    return NextResponse.json({ answer: "Internal server error. Please try again." }, { status: 500 });
  }
}