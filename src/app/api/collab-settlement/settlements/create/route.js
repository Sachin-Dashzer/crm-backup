import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabSettlement from "@/models/CollabSettlement";
import CollabCase from "@/models/CollabCase";
import Transactions from "@/models/Transactions";
import { COLLAB_BRANCHES } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Same TRANSPLANT/SERVICE/MEDICINE mapping used by Transactions.js's
// pre('save') hook — duplicated here (not imported) because this route sets
// transactionCategory explicitly, the same way the transplant/service create
// routes already do, rather than relying on the hook's inference fallback.
function deriveTransactionCategory(procedure) {
  if (["Sapphire FUE", "DHI", "Turkish DHI", "Beard Transplant"].includes(procedure)) {
    return "TRANSPLANT";
  }
  if (["PRP", "GFC", "Alopecia", "Headwash", "Canacot"].includes(procedure)) {
    return "SERVICE";
  }
  if (procedure === "Medicine") {
    return "MEDICINE";
  }
  return "SERVICE"; // "Other" / unmatched — generic fallback, never TRANSPLANT by default
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });
    }

    await connectDB();

    const {
      clinic,
      direction,
      amount,
      date,
      mode,
      reference,
      remarks,
      receiptMode,
      furtherMode,
      coveredCases, // optional: [{ case: caseId, amount }]
    } = await req.json();

    if (!clinic || !direction || !amount || amount <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!COLLAB_BRANCHES.includes(clinic)) {
      return NextResponse.json({ error: "Invalid clinic — must be a collab branch" }, { status: 400 });
    }
    if (!["WE_PAID", "THEY_PAID"].includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    const allocations = Array.isArray(coveredCases) ? coveredCases.filter((c) => c?.case && c.amount > 0) : [];
    const allocatedTotal = allocations.reduce((sum, a) => sum + parseFloat(a.amount), 0);
    if (allocatedTotal > parsedAmount) {
      return NextResponse.json(
        { error: "Allocated amounts across covered cases exceed the settlement amount" },
        { status: 400 },
      );
    }

    const performedBy = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
    };

    // Settlement is saved first and fully valid on its own — transaction
    // generation below is best-effort and never leaves this half-saved.
    const settlement = new CollabSettlement({
      clinic,
      direction,
      amount: parsedAmount,
      date: date ? new Date(date) : new Date(),
      mode,
      reference: reference || "",
      coveredCases: allocations.map((a) => ({ case: a.case, amount: parseFloat(a.amount) })),
      remarks: remarks || "",
      createdBy: { ...performedBy, date: new Date() },
    });

    await settlement.save();

    try {
      if (direction === "WE_PAID") {
        // Us paying the clinic their share — a normal expense transaction,
        // same shape the existing Collab tab of the expense form produces.
        const expenseTx = new Transactions({
          transactionCategory: "EXPENSE",
          costType: "Expenses",
          expense: "Collab Clinic Payment",
          expenseType: "Collab Clinic Payment",
          expenseGiver: { type: "MANUAL", name: clinic },
          amount: parsedAmount,
          method: mode,
          paymentId: reference || "",
          furtherMode: furtherMode || "",
          branch: clinic,
          date: settlement.date,
          remarks: remarks || `Collab settlement — ${clinic}`,
          approvalStatus: "APPROVED",
          collabSettlementId: settlement._id,
          createdBy: { ...performedBy, date: new Date() },
        });
        await expenseTx.save();
        settlement.linkedTransaction = expenseTx._id;
        await settlement.save();
      } else if (direction === "THEY_PAID" && allocations.length > 0) {
        // Revenue is recognised now, on settlement date — not when the
        // patient originally paid the clinic. One revenue transaction per
        // allocated case, attributed to that case's own patient/procedure.
        const linkedRevenueTransactions = [];
        for (const allocation of allocations) {
          const collabCase = await CollabCase.findById(allocation.case).select("patient procedure clinic");
          if (!collabCase || collabCase.clinic !== clinic) continue;

          const revenueTx = new Transactions({
            transactionCategory: deriveTransactionCategory(collabCase.procedure),
            procedure: collabCase.procedure,
            costType: "Revenue",
            patient: collabCase.patient,
            amount: parseFloat(allocation.amount),
            method: mode,
            paymentId: reference || "",
            receiptMode: receiptMode || "",
            furtherMode: furtherMode || "",
            branch: clinic,
            date: settlement.date,
            paymentType: "Other",
            approvalStatus: "APPROVED",
            collabSettlementId: settlement._id,
            createdBy: { ...performedBy, date: new Date() },
            remarks: remarks || `Collab settlement — ${clinic}`,
          });
          await revenueTx.save();
          linkedRevenueTransactions.push(revenueTx._id);
        }
        settlement.linkedRevenueTransactions = linkedRevenueTransactions;
        await settlement.save();
      }
      // THEY_PAID with no case allocation: pure balance-only settlement,
      // intentionally no transaction generated — we can't attribute
      // unallocated money to a patient.
    } catch (txError) {
      console.error("Settlement saved, but linked transaction creation failed:", txError);
    }

    return NextResponse.json({ message: "Settlement recorded", settlement }, { status: 201 });
  } catch (error) {
    console.error("Error creating collab settlement:", error);
    return NextResponse.json({ error: "Failed to create settlement" }, { status: 500 });
  }
}
