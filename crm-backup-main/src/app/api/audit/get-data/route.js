// app/api/audit/get-data/route.js
import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Audit from "@/models/Audit";
import { resolveDateRange, toDateQuery } from "@/lib/dateHelpers";

// Safety ceiling. The /admin/deleted-data page filters and paginates in the browser, so it needs
// the rows it is going to page through — but "every audit row ever" is not a bounded request, and
// this route previously had no limit at all. With the default one-month window below, a normal
// month sits far under this; the cap only bites on a very wide explicit range, and `truncated` in
// the response tells the UI to say so rather than silently showing a partial log.
const MAX_ROWS = 2000;

const handler = async (req) => {
  const { searchParams } = new URL(req.url);

  // Defaults to the current calendar month. Previously this pulled the ENTIRE Audit collection —
  // hydrated into Mongoose documents, with every referenced Patient populated — on every page
  // load, which got monotonically slower forever. `?all=1` restores the old unbounded behaviour.
  const dateRange = resolveDateRange(searchParams);
  const dateQuery = toDateQuery(dateRange);
  const query = dateQuery ? { date: dateQuery } : {};

  const data = await Audit.find(query)
    // Only the fields the reducer below actually emits.
    .select(
      "costType patient branch procedure paymentType paymentId expense expenseType method amount discount date remarks createdBy editors",
    )
    .populate({
      path: "patient",
      select:
        "personal.name personal.phone surgery.technique payments.totalAmount payments.amountReceived payments.pendingAmount payments.medicineAmount payments.discount createdAt",
      options: { sort: { createdAt: -1 } },
    })
    .sort({ date: -1 })
    .limit(MAX_ROWS + 1)
    // .lean() — these are read-only rows reshaped into plain objects immediately below, so there
    // is no reason to pay for Mongoose document hydration on every one of them.
    .lean();

  const truncated = data.length > MAX_ROWS;
  const rows = truncated ? data.slice(0, MAX_ROWS) : data;

  const finaldata = rows.reduce((acc, transaction) => {
    const type = transaction.costType || "other";

    if (!acc[type]) {
      acc[type] = [];
    }

    acc[type].push({
      _id: transaction._id,
      patient: transaction.patient,
      branch: transaction.branch,
      procedure: transaction.procedure,
      paymentType: transaction.paymentType,
      paymentId: transaction.paymentId,
      expense: transaction.expense,
      expenseType: transaction.expenseType,
      method: transaction.method,
      amount: transaction.amount,
      discount: transaction.discount || 0,
      date: transaction.date,
      remarks: transaction.remarks,
      createdBy: transaction.createdBy || null,
      editors: transaction.editors || [],
      totalEdits: transaction.editors?.length || 0,
      lastEditedBy:
        transaction.editors?.length > 0
          ? transaction.editors[transaction.editors.length - 1]
          : null,
    });

    return acc;
  }, {});

  return NextResponse.json({
    success: true,
    data: finaldata,
    types: Object.keys(finaldata),
    truncated,
    dateWindow: {
      from: dateRange.start ? dateRange.start.toISOString() : null,
      to: dateRange.end ? dateRange.end.toISOString() : null,
      isDefault: dateRange.isDefault,
      isAll: dateRange.isAll,
    },
  });
};

export const GET = withDB(handler);
