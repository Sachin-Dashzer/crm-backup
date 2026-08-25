import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Payable, { PAYABLE_KIND_VALUES, PAYABLE_PURPOSE_VALUES } from "@/models/Payable";
import { getExpenseTypes, TDS_TAX_TYPES } from "@/constants/expenseCategories";
import { ALL_BRANCHES } from "@/lib/branches";
import { computeTaxBreakdown } from "@/lib/taxMath";
import { checkPeriodLock } from "@/lib/periodLock";

const ALLOWED_ROLES = ["admin", "super-admin"];
const PATIENT_REQUIRED_PURPOSES = ["INCENTIVE", "PATIENT_COMMISSION"];

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
      payee, // { kind, refId, label }
      purpose,
      expenseCategory,
      expenseSubType,
      period, // { month, year }
      relatedPatient,
      totalAmount,
      dueDate,
      branch,
      remarks,
      // Task 4 — whether the cost this payable represents has already been booked by another
      // transaction. Drives isSettlement on the eventual payment; see the model comment on
      // Payable.costAlreadyRecognised. Defaults false so every pre-existing caller (the old
      // NewPayableModal never sent this) keeps its current behaviour.
      costAlreadyRecognised,
      receipts,
      // "Include GST" / "Include TDS" — when either is set, totalAmount is the BASE
      // (net-of-GST) amount. GST is recorded for display and folded into the vendor
      // payable; TDS is split off into its own linked "Taxes" payable. Both payables are
      // created atomically. See src/lib/taxMath.js for the arithmetic.
      includeGST,
      gstRate,
      gstAmount,
      includeTDS,
      tdsCategory,
      tdsRate,
      tdsAmount,
    } = await req.json();

    if (!payee?.kind || !payee?.label || !purpose || !totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!PAYABLE_KIND_VALUES.includes(payee.kind)) {
      return NextResponse.json({ error: "Invalid payee.kind" }, { status: 400 });
    }
    if (!PAYABLE_PURPOSE_VALUES.includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }
    // Only these three kinds are ever backed by an actual record — RENT_UNIT/UTILITY_UNIT/
    // COLLAB_CLINIC/OTHER legitimately carry refId: null by design (see the model comment on
    // Payable.payee). An allowlist, not "anything but MANUAL/OTHER", or this would wrongly
    // reject every rent/electricity/collab-clinic payable that has always had no refId.
    const REFID_REQUIRED_KINDS = ["EMPLOYEE", "PATIENT", "VENDOR"];
    if (REFID_REQUIRED_KINDS.includes(payee.kind) && !payee.refId) {
      return NextResponse.json(
        { error: `payee.refId is required when payee.kind is "${payee.kind}"` },
        { status: 400 },
      );
    }
    if (PATIENT_REQUIRED_PURPOSES.includes(purpose) && !relatedPatient) {
      return NextResponse.json(
        { error: "relatedPatient is required for this purpose" },
        { status: 400 },
      );
    }
    if (branch && !ALL_BRANCHES.includes(branch)) {
      return NextResponse.json({ error: "Invalid branch" }, { status: 400 });
    }
    // A voucher has no account yet (that only exists once it's settled), so this exercises
    // periodLock.js's "every account closed" fallback — the right semantics for an accrual with
    // no cash side. Checked against the due date, or today when none is given.
    const lockReason = await checkPeriodLock({ furtherMode: null, date: dueDate || new Date() });
    if (lockReason) {
      return NextResponse.json({ error: lockReason, periodLocked: true }, { status: 423 });
    }
    if (expenseCategory) {
      const validTypes = getExpenseTypes(expenseCategory);
      if (validTypes.length > 0 && expenseSubType && !validTypes.includes(expenseSubType)) {
        return NextResponse.json(
          { error: "Invalid expense sub-type for this category" },
          { status: 400 },
        );
      }
    }

    // Resolve the whole GST/TDS breakdown up front — before anything is written — so a bad
    // input never leaves a lone vendor payable behind. totalAmount is the BASE amount.
    const baseAmount = parseFloat(totalAmount);

    if (includeTDS) {
      if (!tdsCategory || !TDS_TAX_TYPES.includes(tdsCategory)) {
        return NextResponse.json({ error: "Invalid TDS category" }, { status: 400 });
      }
      const hasTdsAmount = tdsAmount !== undefined && tdsAmount !== null && tdsAmount !== "";
      const hasTdsRate = tdsRate !== undefined && tdsRate !== null && tdsRate !== "";
      if (!hasTdsAmount && !hasTdsRate) {
        return NextResponse.json({ error: "Provide a TDS rate or a TDS amount" }, { status: 400 });
      }
    }
    if (includeGST) {
      const hasGstAmount = gstAmount !== undefined && gstAmount !== null && gstAmount !== "";
      const hasGstRate = gstRate !== undefined && gstRate !== null && gstRate !== "";
      if (!hasGstAmount && !hasGstRate) {
        return NextResponse.json({ error: "Provide a GST rate or a GST amount" }, { status: 400 });
      }
    }

    // Shared with the entry form's live breakdown — same function, same numbers.
    const tax = computeTaxBreakdown({
      baseAmount,
      includeGST,
      gstRate,
      gstAmount,
      includeTDS,
      tdsRate,
      tdsAmount,
      tdsCategory,
    });
    const resolvedTdsAmount = tax.tdsAmount;

    if (includeGST && !(tax.gstAmount > 0)) {
      return NextResponse.json({ error: "GST amount must be positive" }, { status: 400 });
    }
    // TDS is withheld out of what we owe, so it can never exceed the invoice.
    if (includeTDS && (!(resolvedTdsAmount > 0) || resolvedTdsAmount >= tax.invoiceTotal)) {
      return NextResponse.json(
        { error: "TDS amount must be positive and less than the invoice total" },
        { status: 400 },
      );
    }

    const performedBy = { name: session.user.name, email: session.user.email };

    // A Rent payable's obligation is recognised on the 1st of the month it's FOR, not whatever
    // day someone happened to enter it — dateFrom/dateTo filtering and the opening/closing
    // rollups on the Liabilities page both key off createdAt (see buildPayableGroupedStages'
    // raisedInRange/raisedBeforeRange), so a rent payable entered on the 20th would otherwise
    // land in the wrong month's "raised" bucket and be invisible to a filter for its actual
    // period. Mongoose's timestamps plugin only defaults createdAt when it isn't already set, so
    // passing it here is honoured rather than overwritten on save.
    const periodStartDate =
      purpose === "RENT" && period?.month && period?.year
        ? new Date(Date.UTC(period.year, period.month - 1, 1))
        : undefined;

    const commonFields = {
      period: period?.month && period?.year ? period : undefined,
      relatedPatient: relatedPatient || undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      branch: branch || session.user.branch,
      remarks: remarks || "",
      costAlreadyRecognised: costAlreadyRecognised === true,
      receipts: receipts || [],
      ...(periodStartDate ? { createdAt: periodStartDate } : {}),
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    };

    // The vendor is owed the invoice (base + GST) less whatever TDS we withhold on their
    // behalf. GST gets no payable of its own — it is already inside this figure.
    // Conservation: vendorPayableAmount + resolvedTdsAmount === tax.invoiceTotal, always.
    const vendorPayableAmount = tax.vendorPayable;
    const taxNote =
      includeGST || includeTDS
        ? `Base ${tax.baseAmount} + GST ${tax.gstAmount} = invoice ${tax.invoiceTotal}; TDS ${resolvedTdsAmount} on base`
        : undefined;

    const buildVendorPayable = () => {
      const doc = new Payable({
        ...commonFields,
        payee: {
          kind: payee.kind,
          refId: payee.refId || null,
          label: payee.label,
        },
        purpose,
        expenseCategory,
        expenseSubType: expenseSubType || "",
        totalAmount: vendorPayableAmount,
        ...(includeTDS
          ? {
              tdsLink: {
                role: "PARENT",
                tdsRate: tax.tdsRate,
                tdsAmount: resolvedTdsAmount,
                // grossAmount records the invoice this pair was split out of, so the pair
                // can be reconciled back to the original document.
                grossAmount: tax.invoiceTotal,
              },
            }
          : {}),
      });
      doc.log.push({
        action: "Created",
        newValue: String(doc.totalAmount),
        note: taxNote,
        performedBy,
        performedAt: new Date(),
      });
      return doc;
    };

    if (!includeTDS) {
      const payable = buildVendorPayable();
      await payable.save();
      return NextResponse.json({ message: "Payable created", payable }, { status: 201 });
    }

    // Both payables or neither. A half-created TDS pair is worse than no entry, so this
    // runs inside a real MongoDB transaction rather than a compensating delete — the
    // delete left a crash window between the two writes in which the vendor payable
    // could survive alone.
    const dbSession = await mongoose.startSession();
    let payable;
    let tdsPayable;
    try {
      await dbSession.withTransaction(async () => {
        payable = buildVendorPayable();
        await payable.save({ session: dbSession });

        tdsPayable = new Payable({
          ...commonFields,
          payee: { kind: "OTHER", refId: null, label: tdsCategory },
          purpose: "TAX",
          expenseCategory: "Taxes",
          expenseSubType: tdsCategory,
          totalAmount: resolvedTdsAmount,
          tdsLink: {
            role: "TDS",
            linkedId: payable._id,
            tdsRate: tax.tdsRate,
            tdsAmount: resolvedTdsAmount,
            grossAmount: tax.invoiceTotal,
          },
        });
        tdsPayable.log.push({
          action: "Created",
          newValue: String(tdsPayable.totalAmount),
          note: `TDS split from payable ${payable._id}. ${taxNote || ""}`.trim(),
          performedBy,
          performedAt: new Date(),
        });
        await tdsPayable.save({ session: dbSession });

        // Back-link so neither side can be found without the other.
        payable.tdsLink.linkedId = tdsPayable._id;
        await payable.save({ session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json(
      { message: "Payable created with linked TDS payable", payable, tdsPayable },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: "A payable already exists for this payee/purpose/period." },
        { status: 409 },
      );
    }
    console.error("Error creating payable:", error);
    return NextResponse.json({ error: "Failed to create payable" }, { status: 500 });
  }
}
