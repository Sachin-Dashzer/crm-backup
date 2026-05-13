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

    if (!question?.trim()) {
      return NextResponse.json({ answer: "Please ask something." });
    }

    await dbConnect();

    // ── Time windows (IST offset = +5:30 = 19800s) ────────────────
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    // ── All DB fetches in parallel ────────────────────────────────
    const [
      // Patients
      totalPatients,
      patientsByStatus,
      patientsByBranch,
      recentPatients,
      todayAppointments,
      monthAppointments,

      // Transactions
      revenueStats,
      expenseStats,
      todayRevenue,
      monthRevenue,
      revenueByBranch,
      revenueByCategory,

      // Leads
      totalLeads,
      todayLeads,
      weekLeads,
      monthLeads,
      leadsByTag,
      recentLeads,

      // Stock
      totalStock,
      lowStock,

      // Employees
      employeesByRole,
      totalActiveEmployees,

    ] = await Promise.all([

      // ── Patients ──
      Patient.countDocuments(),

      Patient.aggregate([
        { $group: { _id: "$ops.status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Patient.aggregate([
        { $group: { _id: "$personal.branch", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Patient.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select("personal.name personal.phone personal.branch personal.visitDate personal.purpose ops.status counselling.finlpackage payments.amountReceived payments.pendingAmount")
        .lean(),

      Patient.countDocuments({ "personal.visitDate": { $gte: todayStart } }),
      Patient.countDocuments({ "personal.visitDate": { $gte: monthStart } }),

      // ── Transactions - Revenue ──
      Transactions.aggregate([
        { $match: { costType: "Revenue" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      Transactions.aggregate([
        { $match: { costType: "Expenses" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),

      Transactions.aggregate([
        { $match: { costType: "Revenue", date: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Transactions.aggregate([
        { $match: { costType: "Revenue", date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Transactions.aggregate([
        { $match: { costType: "Revenue" } },
        { $group: { _id: "$branch", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),

      Transactions.aggregate([
        { $match: { costType: "Revenue" } },
        { $group: { _id: "$transactionCategory", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),

      // ── Leads ──
      Leads.countDocuments(),
      Leads.countDocuments({ createdAt: { $gte: todayStart } }),
      Leads.countDocuments({ createdAt: { $gte: weekStart } }),
      Leads.countDocuments({ createdAt: { $gte: monthStart } }),

      Leads.aggregate([
        { $group: { _id: "$tag", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Leads.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .select("name phone email location tag remarks createdAt")
        .lean(),

      // ── Stock ──
      Stock.countDocuments(),
      Stock.find({ totalQuantity: { $lte: 5 } })
        .select("name totalQuantity unit location")
        .lean(),

      // ── Employees ──
      Employee.aggregate([
        { $match: { isactive: true } },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Employee.countDocuments({ isactive: true }),
    ]);

    // ── Format context object ─────────────────────────────────────
    const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
    const istTime = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const crmContext = {
      reportTime: istTime(now),

      patients: {
        total: totalPatients,
        todayAppointments,
        monthAppointments,
        byStatus: patientsByStatus.map((s) => ({ status: s._id || "Unknown", count: s.count })),
        byBranch: patientsByBranch.map((b) => ({ branch: b._id || "Unassigned", count: b.count })),
        recent10: recentPatients.map((p) => ({
          name: p.personal?.name,
          phone: p.personal?.phone,
          branch: p.personal?.branch,
          visitDate: p.personal?.visitDate ? istTime(p.personal.visitDate) : "—",
          purpose: p.personal?.purpose,
          status: p.ops?.status,
          quotedPackage: fmt(p.counselling?.finlpackage),
          amountReceived: fmt(p.payments?.amountReceived),
          pendingAmount: fmt(p.payments?.pendingAmount),
        })),
      },

      revenue: {
        allTime: fmt(revenueStats[0]?.total),
        allTimeCount: revenueStats[0]?.count || 0,
        today: fmt(todayRevenue[0]?.total),
        thisMonth: fmt(monthRevenue[0]?.total),
        totalExpenses: fmt(expenseStats[0]?.total),
        byBranch: revenueByBranch.map((b) => ({
          branch: b._id || "Unknown",
          revenue: fmt(b.total),
          transactions: b.count,
        })),
        byCategory: revenueByCategory.map((c) => ({
          category: c._id || "Unknown",
          revenue: fmt(c.total),
          count: c.count,
        })),
      },

      leads: {
        total: totalLeads,
        today: todayLeads,
        thisWeek: weekLeads,
        thisMonth: monthLeads,
        byTag: leadsByTag.map((t) => ({ source: t._id || "Untagged", count: t.count })),
        recent15: recentLeads.map((l) => ({
          name: l.name,
          phone: l.phone,
          location: l.location || "—",
          source: l.tag || "Untagged",
          remarks: l.remarks || "—",
          date: istTime(l.createdAt),
        })),
      },

      stock: {
        totalItems: totalStock,
        lowStockItems: lowStock.map((s) => ({
          name: s.name,
          quantity: s.totalQuantity,
          unit: s.unit || "units",
          location: s.location || "—",
        })),
        lowStockAlert: lowStock.length > 0
          ? `⚠️ ${lowStock.length} items have stock ≤ 5 units`
          : "✅ All items sufficiently stocked",
      },

      team: {
        totalActiveEmployees,
        byRole: employeesByRole.map((r) => ({ role: r._id, count: r.count })),
      },
    };

    // ── Build OpenAI messages ─────────────────────────────────────
    const trimmedHistory = history.slice(-6);

    const messages = [
      {
        role: "system",
        content: `You are Saniya — the intelligent AI assistant for Ryan Clinic (Ryan MediHub), a premium hair transplant clinic with branches in Delhi, Mumbai, and Hyderabad, specializing in Turkey Sapphire FUE technique.

You have real-time access to the full CRM database. You answer the superadmin's questions about patients, revenue, transactions, leads, stock, and employees.

CRM Data Structures you know:
- Patient statuses: NEW, NOT_VISITED, NOT_CONVERTED, CONSULTED, SURGERY_BOOKED, CLOSED
- Transaction categories: TRANSPLANT, SERVICE, MEDICINE, EXPENSE
- Procedures: Sapphire FUE, DHI, Turkish DHI, Beard Transplant, PRP, Alopecia, Headwash, GFC, Medicine
- Lead sources/tags: Google Leads, Meta Leads, Form Leads, Collab Leads
- Branches: Delhi, Mumbai, Hyderabad
- Employee roles: Agent, Counsellor, Doctor, Technician, Implanter, Others, Hr

Rules:
- Be sharp, concise, and professional — like a smart senior employee who knows the business
- Format currency in Indian format (₹1,23,456)
- Format tables cleanly for lists (Name | Phone | Branch | Status)
- For revenue/count questions, always include today, this month, and all-time where relevant
- Always respond in the same language the admin uses (Hindi/English/Hinglish)
- Current time is IST`,
      },
      ...trimmedHistory,
      {
        role: "user",
        content: `Live CRM Data:\n${JSON.stringify(crmContext, null, 2)}\n\nQuestion: ${question}`,
      },
    ];

    // ── Call OpenAI ───────────────────────────────────────────────
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1000,
        messages,
      }),
    });

    const openaiData = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("OpenAI error:", openaiData);
      return NextResponse.json({ answer: "OpenAI API error. Check OPENAI_API_KEY in .env.local." }, { status: 500 });
    }

    const answer = openaiData.choices?.[0]?.message?.content || "Sorry, couldn't process that.";
    return NextResponse.json({ answer });

  } catch (err) {
    console.error("Saniya error:", err);
    return NextResponse.json({ answer: "Internal server error. Please try again." }, { status: 500 });
  }
}