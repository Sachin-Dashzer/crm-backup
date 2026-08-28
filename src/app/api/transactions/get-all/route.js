import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import { resolveBranchFilter } from "@/lib/branches";
import { UNSETTLED_METHODS, SETTLEMENT_EXCLUSION, NON_CASH_METHODS } from "@/constants/bankRouting";

function deriveEntryType(tx) {
  if (tx.reversalOf) return "REVERSAL";
  if (tx.isSettlement) {
    return tx.costType === "Revenue" ? "RECEIPT_SETTLEMENT" : "PAYMENT_SETTLEMENT";
  }
  if (UNSETTLED_METHODS.includes(tx.method)) {
    return tx.costType === "Revenue" ? "EXTERNAL_RECEIPT" : "EXTERNAL_PAYMENT";
  }
  if (NON_CASH_METHODS.includes(tx.method)) return "NON_CASH";
  return "REGULAR";
}
import "@/models/Stock";
import "@/models/Vendor";
import "@/models/Employee";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const UNTRACKED_FURTHER_MODE = "__UNTRACKED__";

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
    const furtherMode    = searchParams.get("furtherMode")    || "";
    const expenseCategory = searchParams.get("expenseCategory") || "";
    const expenseType    = searchParams.get("expenseType")    || "";
    const approvalStatus = searchParams.get("approvalStatus") || "";
    const payableId      = searchParams.get("payableId")      || "";
    const receivableId   = searchParams.get("receivableId")   || "";
    const entryType      = searchParams.get("entryType")      || "";
    const sortKey       = searchParams.get("sortKey")       || "date";
    const sortDir       = searchParams.get("sortDir") === "asc" ? 1 : -1;

    await connectDB();

    const branchFilter = resolveBranchFilter(session, branch);

    const query = { ...branchFilter };

    if (payableId) {
      query.payableId = payableId;
    }

    if (receivableId) {
      query.receivableId = receivableId;
    }

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

    if (approvalStatus === "PENDING" || approvalStatus === "REJECTED") {
      query.approvalStatus = approvalStatus;
    } else {
      query.approvalStatus = { $nin: ["PENDING", "REJECTED"] };
    }

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

    if (paymentMethod) {
      query.method = { $regex: new RegExp(`^${escapeRegex(paymentMethod)}$`, "i") };
    }

    if (procedure) {
      query.procedure = { $regex: new RegExp(`^${escapeRegex(procedure)}$`, "i") };
    }

    if (furtherMode === UNTRACKED_FURTHER_MODE) {
      query.furtherMode = { $in: ["", null] };
    } else if (furtherMode) {
      query.furtherMode = { $regex: new RegExp(`^${escapeRegex(furtherMode)}$`, "i") };
    }

    if (expenseCategory) {
      query.expense = { $regex: new RegExp(`^${escapeRegex(expenseCategory)}$`, "i") };
    }
    if (expenseType) {
      query.expenseType = { $regex: new RegExp(`^${escapeRegex(expenseType)}$`, "i") };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };

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

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchClause }];
        delete query.$or;
      } else {
        query.$or = searchClause;
      }
    }

    if (entryType === "REGULAR") {
      query.isSettlement = { $ne: true };
      query.reversalOf = null;
      query.$and = [...(query.$and || []), { method: { $nin: UNSETTLED_METHODS } }];
    } else if (entryType === "SETTLEMENT") {
      query.isSettlement = true;
    } else if (entryType === "EXTERNAL") {
      query.$and = [...(query.$and || []), { method: { $in: UNSETTLED_METHODS } }];
    } else if (entryType === "REVERSAL") {
      query.reversalOf = { $ne: null };
    }

    const statsQuery = {
      ...branchFilter,
      ...SETTLEMENT_EXCLUSION,
      approvalStatus: { $nin: ["PENDING", "REJECTED"] },
    };
    if (query.date)        statsQuery.date   = query.date;
    if (query.procedure)   statsQuery.procedure = query.procedure;
    if (query.furtherMode) statsQuery.furtherMode = query.furtherMode;
    if (query.expense)     statsQuery.expense = query.expense;
    if (query.expenseType) statsQuery.expenseType = query.expenseType;
    statsQuery.$and = [
      { method: { $nin: UNSETTLED_METHODS } },
      ...(query.method ? [{ method: query.method }] : []),
    ];

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
      entryType: deriveEntryType(tx),
      linkedDocId:
        tx.receivableId ||
        tx.payableId ||
        tx.externalParty?.linkedReceivableId ||
        tx.externalParty?.linkedPayableId ||
        null,
      linkedDocType:
        tx.receivableId || tx.externalParty?.linkedReceivableId
          ? "RECEIVABLE"
          : tx.payableId || tx.externalParty?.linkedPayableId
            ? "PAYABLE"
            : null,
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
