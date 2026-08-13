// app/api/transactions/service/update/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import { periodLockResponse } from "@/lib/periodLock";
import { withDbTransaction, syncExternalPartyOnUpdate } from "@/lib/externalPartyDerivation";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";

// Helper: recalculate and save a patient's payment fields
async function recalculatePatientPayments(patient, session) {
  const allTransactions = await Transactions.find({
    _id: { $in: patient.payments.transactions },
    costType: "Revenue",
  });

  patient.payments.amountReceived = allTransactions.reduce(
    (sum, t) => sum + (t.amount || 0),
    0
  );
  patient.payments.discount = allTransactions.reduce(
    (sum, t) => sum + (t.discount || 0),
    0
  );

  const adjustedTotal = Math.max(
    0,
    patient.payments.totalAmount - patient.payments.discount
  );
  patient.payments.pendingAmount = Math.max(
    0,
    adjustedTotal - patient.payments.amountReceived
  );

  patient.editors = patient.editors || [];
  patient.editors.push({
    name: session.user.name,
    email: session.user.email,
    branch: session.user.branch,
    date: new Date(),
  });

  await patient.save();
}

export async function PUT(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const {
      transactionId,
      patientId,
      patientName,
      patientPhone,
      procedure,
      quantity,
      perSessionCost,
      discount,
      method,
      paymentId,
      branch,
      date,
      remarks,
      receiptMode,
      furtherMode,
      receipts,
      receivableId,
      externalParty,
    } = await req.json();

    // Find existing transaction
    const existingTransaction = await Transactions.findById(transactionId);
    if (!existingTransaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Closed-period guard — checks both the current position and where the edit moves it.
    const locked = await periodLockResponse(existingTransaction, { date, furtherMode });
    if (locked) {
      return NextResponse.json(locked.body, { status: locked.status });
    }

    // Validations
    if (!procedure || !quantity || !perSessionCost) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!patientId && (!patientName || !patientPhone)) {
      return NextResponse.json(
        { error: "Either select a patient or provide walk-in details" },
        { status: 400 }
      );
    }

    if (patientId) {
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return NextResponse.json(
          { error: "Patient not found" },
          { status: 404 }
        );
      }
    }

    // Capture old patient ID before overwriting
    const oldPatientId = existingTransaction.patient
      ? existingTransaction.patient.toString()
      : null;
    const newPatientId = patientId || null;
    const patientChanged = oldPatientId !== (newPatientId?.toString() || null);

    // Calculate new amounts
    const subtotal = quantity * parseFloat(perSessionCost);
    const finalAmount = subtotal - (discount || 0);

    // Track changes for audit
    const updatedFields = [];
    const trackChange = (fieldName, oldValue, newValue) => {
      if (String(oldValue ?? "") !== String(newValue ?? "")) {
        updatedFields.push({
          name: fieldName,
          previousValue: String(oldValue || ""),
          newValue: String(newValue || ""),
        });
      }
    };

    trackChange("patient", existingTransaction.patient, patientId);
    trackChange("patientName", existingTransaction.patientName, patientName);
    trackChange("patientPhone", existingTransaction.patientPhone, patientPhone);
    trackChange("procedure", existingTransaction.procedure, procedure);
    trackChange("quantity", existingTransaction.quantity, quantity);
    trackChange("perSessionCost", existingTransaction.perSessionCost, perSessionCost);
    trackChange("discount", existingTransaction.discount, discount);
    trackChange("method", existingTransaction.method, method);
    trackChange("paymentId", existingTransaction.paymentId, paymentId);
    trackChange("branch", existingTransaction.branch, branch);
    trackChange("remarks", existingTransaction.remarks, remarks);

    // Update transaction fields
    existingTransaction.patient = newPatientId;
    existingTransaction.patientName = patientName || "";
    existingTransaction.patientPhone = patientPhone || "";
    existingTransaction.procedure = procedure;
    existingTransaction.quantity = quantity;
    existingTransaction.perSessionCost = parseFloat(perSessionCost);
    existingTransaction.amount = finalAmount;
    existingTransaction.discount = discount || 0;
    existingTransaction.method = method;
    existingTransaction.paymentId = paymentId || "";
    existingTransaction.branch = branch;
    existingTransaction.date = date ? new Date(date) : existingTransaction.date;
    existingTransaction.remarks = remarks || "";
    if (receiptMode !== undefined) existingTransaction.receiptMode = receiptMode || "";
    if (furtherMode !== undefined) existingTransaction.furtherMode = furtherMode || "";
    if (receipts !== undefined) existingTransaction.receipts = receipts || [];
    if (receivableId !== undefined) existingTransaction.receivableId = receivableId || null;

    if (updatedFields.length > 0) {
      existingTransaction.editors.push({
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
        updatedFields,
      });
    }

    // Editing into / out of / within "Paid to External" has to move the linked Receivable with
    // it, or the amount leaves the books entirely — see syncExternalPartyOnUpdate. Session-wrapped
    // so the receivable write and this transaction write commit or roll back together.
    try {
      await withDbTransaction(async (dbSession) => {
        const patch = await syncExternalPartyOnUpdate({
          session: dbSession,
          transaction: existingTransaction,
          nextMethod: existingTransaction.method,
          nextAmount: existingTransaction.amount,
          nextExternalParty: externalParty,
          branch: existingTransaction.branch,
          transactionCategory: "SERVICE",
          relatedPatient: existingTransaction.patient,
          actor: { name: session.user.name, email: session.user.email, branch: session.user.branch },
        });
        if (patch) existingTransaction.set(patch);
        await existingTransaction.save({ session: dbSession });
      });
    } catch (syncError) {
      // A deliberate refusal (money already settled against the linked receivable), not a fault.
      return NextResponse.json({ error: syncError.message }, { status: 400 });
    }

    // ── Patient payment sync ──────────────────────────────────────────────────
    let updatedPatients = {};

    if (patientChanged) {
      // CASE 1: Patient was removed → strip transaction from old patient
      if (oldPatientId) {
        const oldPatient = await Patient.findById(oldPatientId);
        if (oldPatient?.payments) {
          oldPatient.payments.transactions = oldPatient.payments.transactions.filter(
            (id) => id.toString() !== transactionId.toString()
          );
          await recalculatePatientPayments(oldPatient, session);
          updatedPatients.oldPatient = {
            _id: oldPatient._id,
            payments: oldPatient.payments,
          };
        }
      }

      // CASE 2: New patient assigned → add transaction to new patient
      if (newPatientId) {
        const newPatient = await Patient.findById(newPatientId);
        if (newPatient) {
          newPatient.payments = newPatient.payments || {
            amountReceived: 0,
            pendingAmount: 0,
            medicineAmount: 0,
            discount: 0,
            totalAmount: 0,
            transactions: [],
          };
          // Avoid duplicate push
          const alreadyLinked = newPatient.payments.transactions.some(
            (id) => id.toString() === transactionId.toString()
          );
          if (!alreadyLinked) {
            newPatient.payments.transactions.push(transactionId);
          }
          await recalculatePatientPayments(newPatient, session);
          updatedPatients.newPatient = {
            _id: newPatient._id,
            payments: newPatient.payments,
          };
        }
      }
    } else if (newPatientId) {
      // CASE 3: Same patient, just amounts changed → recalculate in place
      const samePatient = await Patient.findById(newPatientId);
      if (samePatient?.payments) {
        await recalculatePatientPayments(samePatient, session);
        updatedPatients.updatedPatient = {
          _id: samePatient._id,
          payments: samePatient.payments,
        };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json({
      message: "Service transaction updated successfully",
      transaction: existingTransaction,
      updatedPatients,
    });
  } catch (error) {
    console.error("Error updating service transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 }
    );
  }
}