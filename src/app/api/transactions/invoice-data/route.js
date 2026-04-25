import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const newId = searchParams.get("id");

    if (!newId) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    // Try to find as Patient first (for TRANSPLANT invoices)
    let patient = await Patient.findById(newId)
      .select("personal counselling payments")
      .populate({
        path: "payments.transactions",
        select: "date paymentType transactionCategory costType method amount discount paymentId branch",
        model: "Transactions",
      })
      .populate({
        path: "counselling.counsellor",
        select: "name",
      });

    if (patient) {
      // TRANSPLANT invoice - return patient with all payment history
      const transplantPayments = patient.payments?.transactions?.filter(
        (t) => t && (t.transactionCategory === "TRANSPLANT" || !t.transactionCategory)
      ) || [];

      // Get branch from first transaction or default
      const branch = transplantPayments[0]?.branch || patient.personal?.branch || "Delhi";

      return NextResponse.json({
        success: true,
        data: {
          category: "TRANSPLANT",
          branch: branch,
          isBatch: false,
          packageAmount: patient.payments?.totalAmount || patient.counselling?.finlpackage || 0,
          packageDiscount: patient.payments?.discount || 0,
          transactions: transplantPayments.map((t) => ({
            _id: t._id,
            date: t.date,
            method: t.method,
            amount: t.amount,
            discount: t.discount || 0,
            paymentId: t.paymentId,
            paymentType: t.paymentType,
            procedure: patient.counselling?.techniqueSuggested || patient.personal?.techniqueQuoted || "Hair Transplant",
          })),
          patient: {
            name: patient.personal?.name || "N/A",
            phone: patient.personal?.phone || "N/A",
            email: patient.personal?.email || "N/A",
            gender: patient.personal?.gender || "N/A",
            age: patient.personal?.age || "N/A",
            additionalbenefits: patient.counselling?.additionalbenefits || [],
          },
          consultant: patient.counselling?.counsellor?.name || "Dr. Ryan",
        },
      });
    }

    // Try to find as Transaction (for SERVICE/MEDICINE/EXPENSE)
    const transaction = await Transactions.findById(newId)
      .populate({
        path: "patient",
        select: "personal counselling",
        populate: {
          path: "counselling.counsellor",
          select: "name",
        },
      })
      .populate({
        path: "medicineId",
        select: "name category",
      });

    if (!transaction) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 },
      );
    }

    const category = transaction.transactionCategory || "GENERAL";
    const isBatch = !!transaction.batchId;

    // For batch transactions, fetch all transactions in the same batch
    let transactions = [transaction];
    if (isBatch && category === "MEDICINE") {
      transactions = await Transactions.find({
        batchId: transaction.batchId,
      }).populate({
        path: "medicineId",
        select: "name category",
      });
    }

    // Get patient details
    let patientDetails = {
      name: "Walk-in Customer",
      phone: "N/A",
      email: "N/A",
      gender: "N/A",
      age: "N/A",
    };

    if (transaction.patient && typeof transaction.patient === "object") {
      patientDetails = {
        name: transaction.patient.personal?.name || "Walk-in Customer",
        phone: transaction.patient.personal?.phone || "N/A",
        email: transaction.patient.personal?.email || "N/A",
        gender: transaction.patient.personal?.gender || "N/A",
        age: transaction.patient.personal?.age || "N/A",
      };
    } else if (transaction.patientName) {
      patientDetails.name = transaction.patientName;
      patientDetails.phone = transaction.patientPhone || "N/A";
    }

    const consultant =
      transaction.patient?.counselling?.counsellor?.name || "Dr. Ryan";

    return NextResponse.json({
      success: true,
      data: {
        category,
        branch: transaction.branch || "Delhi",
        isBatch,
        transactions: transactions.map((t) => ({
          _id: t._id,
          date: t.date,
          method: t.method,
          amount: t.amount,
          discount: t.discount || 0,
          paymentId: t.paymentId,
          procedure: t.procedure,
          quantity: t.quantity || 1,
          perSessionCost: t.perSessionCost,
          perUnitCost: t.perUnitCost,
          medicineName: t.medicineId?.name || "N/A",
          expense: t.expense,
        })),
        patient: patientDetails,
        consultant,
      },
    });
  } catch (error) {
    console.error("Error fetching record:", error);
    return NextResponse.json(
      { success: false, error: "Server Error", message: error.message },
      { status: 500 },
    );
  }
};

export const GET = withDB(handler);