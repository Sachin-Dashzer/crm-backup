// app/api/transactions/get-data/route.js
import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Audit from "@/models/Audit";

const handler = async (req) => {
  const data = await Audit.find({})
    .populate({
      path: "patient",
      select:
        "personal.name personal.phone surgery.technique payments.totalAmount payments.amountReceived payments.pendingAmount payments.medicineAmount payments.discount createdAt",
      options: { sort: { createdAt: -1 } },
    })
    .sort({ date: -1 });

  const finaldata = data.reduce((acc, transaction) => {
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
  });
};

export const GET = withDB(handler);