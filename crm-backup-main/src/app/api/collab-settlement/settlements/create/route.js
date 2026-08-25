import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import CollabSettlement from "@/models/CollabSettlement";
import CollabCase from "@/models/CollabCase";
import Payable from "@/models/Payable";
import Receivable from "@/models/Receivable";
import Transactions from "@/models/Transactions";
import { COLLAB_BRANCHES } from "@/lib/branches";

const ALLOWED_ROLES = ["admin", "super-admin"];

// Receivable.revenueCategory mirrors the revenue taxonomy (prose OR the enum itself — collab
// receivables store it pre-enum-cased via collabDerivation.js's categoryForProcedure — both
// normalise through .toLowerCase() below). Same map /api/receivables/[id]/receipt uses, so a
// case settled here and one settled by hand from the Receivables page agree on category.
const CATEGORY_BY_REVENUE_CATEGORY = {
  transplant: "TRANSPLANT",
  service: "SERVICE",
  services: "SERVICE",
  medicine: "MEDICINE",
};

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
      coveredCases, // optional: [{ case: caseId, amount }] — either direction now (see below)
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

    // Every Transaction this settlement produces, across both branches — persisted onto
    // settlement.generatedTransactions once at the end (the schema's actual field; earlier code
    // wrote to linkedTransaction/linkedRevenueTransactions, which aren't declared paths and were
    // silently dropped by Mongoose's default strict mode).
    const generatedTransactionIds = [];
    // Cases an allocation named but couldn't actually be settled against (no Payable/Receivable
    // was ever created for that case — e.g. its own caseNet was 0 at creation). Reported back
    // rather than silently either dropping the money or inventing a transaction with nothing
    // real to link to.
    const skippedAllocations = [];

    try {
      if (direction === "WE_PAID") {
        // Money we send the clinic. Allocated cases each pay down their OWN clinicSharePayable
        // (mirrors RecordPaymentModal's payableId-carrying expense) so that payable's pending
        // actually decreases — previously nothing here ever did, so a payable stayed open
        // forever no matter how many settlements were recorded against it (see
        // balances/route.js's header comment, which already assumed this was wired up).
        for (const allocation of allocations) {
          const collabCase = await CollabCase.findById(allocation.case).select("clinic clinicSharePayable");
          if (!collabCase || collabCase.clinic !== clinic) continue;
          if (!collabCase.clinicSharePayable) {
            skippedAllocations.push({ case: allocation.case, reason: "This case has no payable to settle (nothing was owed to the clinic for it)." });
            continue;
          }
          const expenseTx = await Transactions.create({
            transactionCategory: "EXPENSE",
            costType: "Expenses",
            expense: "Collab Clinic Payment",
            expenseType: "Collab Clinic Payment",
            expenseGiver: { type: "MANUAL", name: clinic },
            amount: parseFloat(allocation.amount),
            method: mode,
            paymentId: reference || "",
            furtherMode: furtherMode || "",
            branch: clinic,
            date: settlement.date,
            remarks: remarks || `Collab settlement — ${clinic}`,
            approvalStatus: "APPROVED",
            payableId: collabCase.clinicSharePayable,
            collabRef: { settlementId: settlement._id, caseId: allocation.case },
            createdBy: { ...performedBy, date: new Date() },
          });
          generatedTransactionIds.push(expenseTx._id);
        }

        // Whatever wasn't allocated to a specific case is a lump payment not tied to any one
        // case's payable — same as before, just now also carrying collabRef for traceability.
        const unallocated = Math.round((parsedAmount - allocatedTotal) * 100) / 100;
        if (unallocated > 0.005) {
          const expenseTx = await Transactions.create({
            transactionCategory: "EXPENSE",
            costType: "Expenses",
            expense: "Collab Clinic Payment",
            expenseType: "Collab Clinic Payment",
            expenseGiver: { type: "MANUAL", name: clinic },
            amount: unallocated,
            method: mode,
            paymentId: reference || "",
            furtherMode: furtherMode || "",
            branch: clinic,
            date: settlement.date,
            remarks: remarks || `Collab settlement — ${clinic}`,
            approvalStatus: "APPROVED",
            collabRef: { settlementId: settlement._id },
            createdBy: { ...performedBy, date: new Date() },
          });
          generatedTransactionIds.push(expenseTx._id);
        }
      } else if (direction === "THEY_PAID" && allocations.length > 0) {
        // Money the clinic sends us. Each allocated case's Receivable already exists — created
        // by createCollabCaseAtomic at case-creation time, which ALSO already booked the case's
        // full package as gross revenue. So this must NOT recognise fresh revenue (that would
        // double-count it); it settles the existing Receivable exactly the way
        // /api/receivables/[id]/receipt does for every other receivable — isSettlement flags it
        // out of P&L when the receivable says the cost was already recognised.
        for (const allocation of allocations) {
          const collabCase = await CollabCase.findById(allocation.case).select("patient procedure clinic clinicShareReceivable");
          if (!collabCase || collabCase.clinic !== clinic) continue;
          if (!collabCase.clinicShareReceivable) {
            skippedAllocations.push({ case: allocation.case, reason: "This case has no receivable to settle (the clinic never collected more than its share for it)." });
            continue;
          }
          const receivable = await Receivable.findById(collabCase.clinicShareReceivable).select("revenueCategory costAlreadyRecognised isCancelled");
          if (!receivable || receivable.isCancelled) {
            skippedAllocations.push({ case: allocation.case, reason: "This case's receivable no longer exists or was cancelled." });
            continue;
          }

          const transactionCategory =
            CATEGORY_BY_REVENUE_CATEGORY[String(receivable.revenueCategory || "").toLowerCase()] || undefined;

          const revenueTx = await Transactions.create({
            transactionCategory,
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
            receivableId: receivable._id,
            isSettlement: receivable.costAlreadyRecognised === true,
            // Only caseId/settlementId here — collabRef.receivableId means "this transaction
            // CREATED that receivable" (provenance, set once by createCollabCaseAtomic), which
            // this settlement transaction did not do; the top-level receivableId above already
            // correctly says "this is a PAYMENT against" it.
            collabRef: { settlementId: settlement._id, caseId: allocation.case },
            createdBy: { ...performedBy, date: new Date() },
            remarks: remarks || `Collab settlement — ${clinic}`,
          });
          generatedTransactionIds.push(revenueTx._id);
        }
      }
      // THEY_PAID with no case allocation: pure balance-only settlement,
      // intentionally no transaction generated — we can't attribute
      // unallocated money to a patient or a specific receivable.

      if (generatedTransactionIds.length) {
        settlement.generatedTransactions = generatedTransactionIds;
        await settlement.save();
      }
      if (skippedAllocations.length) {
        console.warn("Collab settlement — some allocations had nothing to settle:", skippedAllocations);
      }
    } catch (txError) {
      console.error("Settlement saved, but linked transaction creation failed:", txError);
    }

    return NextResponse.json(
      { message: "Settlement recorded", settlement, skippedAllocations },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating collab settlement:", error);
    return NextResponse.json({ error: "Failed to create settlement" }, { status: 500 });
  }
}
