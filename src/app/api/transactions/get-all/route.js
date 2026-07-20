import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import { resolveBranchFilter } from "@/lib/branches";
import "@/models/Stock";
import "@/models/Vendor";
import "@/models/Employee";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized. Please login." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page          = Math.max(1, parseInt(searchParams.get("page")  || "1"));
    const limit         = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const category      = searchParams.get("category")      || "";
    const branch        = searchParams.get("branch")        || "";
    const dateFrom      = searchParams.get("dateFrom")      || "";
    const dateTo        = searchParams.get("dateTo")        || "";
    const search        = searchParams.get("search")        || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const procedure     = searchParams.get("procedure")     || "";
    const sortKey       = searchParams.get("sortKey")       || "date";
    const sortDir       = searchParams.get("sortDir") === "asc" ? 1 : -1;

    await connectDB();

    const branchFilter = resolveBranchFilter(session, branch);

    // Build the main query
    const query = { ...branchFilter };

    // Category filter
    if (category) {
      if (category === "TRANSPLANT") {
        query.$or = [
          { transactionCategory: "TRANSPLANT" },
          { transactionCategory: { $in: [null, "", undefined] } },
          { transactionCategory: { $exists: false } },
        ];
      } else {
        query.transactionCategory = category;
      }
    }

    // Date range
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        query.date.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.date.$lte = to;
      }
    }

    // Payment method
    if (paymentMethod) {
      query.method = { $regex: new RegExp(`^${paymentMethod}$`, "i") };
    }

    // Procedure
    if (procedure) {
      query.procedure = { $regex: new RegExp(`^${procedure}$`, "i") };
    }

    // Text search: look up matching Patient IDs first, then OR with direct fields
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };

      // Find patients whose name or phone matches — covers old transactions
      // that only store a Patient reference (no denormalized patientPhone)
      const matchingPatients = await Patient.find(
        { $or: [{ "personal.name": searchRegex }, { "personal.phone": searchRegex }] },
        { _id: 1 }
      ).lean();
      const patientIds = matchingPatients.map((p) => p._id);

      const searchClause = [
        { patientName: searchRegex },
        { patientPhone: searchRegex },
        { paymentId: searchRegex },
        { branch: searchRegex },
        { method: searchRegex },
        { remarks: searchRegex },
        { procedure: searchRegex },
        { expense: searchRegex },
        { expenseCategory: searchRegex },
        ...(patientIds.length ? [{ patient: { $in: patientIds } }] : []),
      ];

      // Merge with existing $or (e.g. from TRANSPLANT category filter) using $and
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchClause }];
        delete query.$or;
      } else {
        query.$or = searchClause;
      }
    }

    // Stats aggregation query: same filters except category (to show totals for all categories)
    const statsQuery = { ...branchFilter };
    if (query.date)        statsQuery.date   = query.date;
    if (query.method)      statsQuery.method = query.method;
    if (query.procedure)   statsQuery.procedure = query.procedure;

    const allowedSortKeys = new Set(["date", "amount", "method", "branch", "procedure", "patientName"]);
    const safeSortKey = allowedSortKeys.has(sortKey) ? sortKey : "date";

    const [transactions, total, statsAgg] = await Promise.all([
      Transactions.find(query)
        .populate({
          path: "patient",
          select: "personal.name personal.phone payments counselling.counsellor",
          populate: { path: "counselling.counsellor", select: "name" },
        })
        .populate("medicineId", "name")
        .populate("expenseGiver.vendorId", "name contact")
        .sort({ [safeSortKey]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Transactions.countDocuments(query),

      Transactions.aggregate([
        { $match: statsQuery },
        {
          $group: {
            _id: { $ifNull: ["$transactionCategory", "TRANSPLANT"] },
            count: { $sum: 1 },
            total: { $sum: { $toDouble: "$amount" } },
          },
        },
      ]),
    ]);

    const stats = {
      TRANSPLANT: { count: 0, total: 0 },
      SERVICE:    { count: 0, total: 0 },
      MEDICINE:   { count: 0, total: 0 },
      EXPENSE:    { count: 0, total: 0 },
    };
    for (const { _id, count, total: t } of statsAgg) {
      const cat = _id || "TRANSPLANT";
      if (stats[cat]) { stats[cat].count = count; stats[cat].total = t; }
    }

    const mappedTransactions = transactions.map((tx) => ({
      ...tx,
      transactionCategory: tx.transactionCategory || tx.category,
    }));

    return NextResponse.json({
      success: true,
      transactions: mappedTransactions,
      total,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error("❌ Error fetching all transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions", message: error.message },
      { status: 500 }
    );
  }
}
