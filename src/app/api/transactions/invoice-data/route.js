import { NextResponse } from "next/server";
import { withDB } from "@/lib/withDB";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import mongoose from "mongoose";

const handler = async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const newId = searchParams.get("id");

    if (!newId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID is required" },
        { status: 400 },
      );
    }

    if (!mongoose.Types.ObjectId.isValid(newId)) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction or record ID" },
        { status: 400 },
      );
    }

    // 1. Check if newId is a Patient ID
    let patient = await Patient.findById(newId)
      .select("personal counselling payments")
      .populate({
        path: "payments.transactions",
        select: "date paymentType transactionCategory costType method amount discount paymentId branch procedure",
        model: "Transactions",
      })
      .populate({
        path: "counselling.counsellor",
        select: "name",
      });

    if (patient) {
      let transplantPayments = patient.payments?.transactions?.filter(
        (t) => t && (t.transactionCategory === "TRANSPLANT" || !t.transactionCategory)
      ) || [];

      // Fallback: if patient's embedded transactions array is empty, find in Transactions collection
      if (transplantPayments.length === 0) {
        transplantPayments = await Transactions.find({
          patient: patient._id,
          $or: [
            { transactionCategory: "TRANSPLANT" },
            { transactionCategory: { $exists: false } },
            { transactionCategory: null },
            { transactionCategory: "" },
          ],
        }).sort({ date: 1 });
      }

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
            _id: t._id?.toString(),
            date: t.date,
            method: t.method,
            amount: t.amount,
            discount: t.discount || 0,
            paymentId: t.paymentId,
            paymentType: t.paymentType,
            procedure: t.procedure || patient.counselling?.techniqueSuggested || patient.personal?.techniqueQuoted || "Hair Transplant",
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

    // 2. Lookup by Transaction ID
    const transaction = await Transactions.findById(newId)
      .populate({
        path: "patient",
        select: "personal counselling payments",
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
        { success: false, error: "Record not found" },
        { status: 404 },
      );
    }

    const category = transaction.transactionCategory || "GENERAL";
    const isBatch = !!transaction.batchId;

    // If TRANSPLANT transaction with an associated patient, return full transplant invoice
    if ((category === "TRANSPLANT" || !category) && transaction.patient) {
      const patientObj = transaction.patient;
      const patientId = patientObj._id || patientObj;

      let transplantPayments = await Transactions.find({
        patient: patientId,
        $or: [
          { transactionCategory: "TRANSPLANT" },
          { transactionCategory: { $exists: false } },
          { transactionCategory: null },
          { transactionCategory: "" },
        ],
      }).sort({ date: 1 });

      if (transplantPayments.length === 0) {
        transplantPayments = [transaction];
      }

      const branch = transaction.branch || transplantPayments[0]?.branch || patientObj.personal?.branch || "Delhi";

      return NextResponse.json({
        success: true,
        data: {
          category: "TRANSPLANT",
          branch: branch,
          isBatch: false,
          packageAmount: patientObj.payments?.totalAmount || patientObj.counselling?.finlpackage || transaction.amount || 0,
          packageDiscount: patientObj.payments?.discount || 0,
          transactions: transplantPayments.map((t) => ({
            _id: t._id?.toString(),
            date: t.date,
            method: t.method,
            amount: t.amount,
            discount: t.discount || 0,
            paymentId: t.paymentId,
            paymentType: t.paymentType,
            procedure: t.procedure || patientObj.counselling?.techniqueSuggested || patientObj.personal?.techniqueQuoted || "Hair Transplant",
          })),
          patient: {
            name: patientObj.personal?.name || "N/A",
            phone: patientObj.personal?.phone || "N/A",
            email: patientObj.personal?.email || "N/A",
            gender: patientObj.personal?.gender || "N/A",
            age: patientObj.personal?.age || "N/A",
            additionalbenefits: patientObj.counselling?.additionalbenefits || [],
          },
          consultant: patientObj.counselling?.counsellor?.name || "Dr. Ryan",
        },
      });
    }

    // For batch MEDICINE
    let transactions = [transaction];
    if (isBatch && category === "MEDICINE") {
      transactions = await Transactions.find({
        batchId: transaction.batchId,
      }).populate({
        path: "medicineId",
        select: "name category",
      });
    }

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
        packageAmount: transaction.amount || 0,
        packageDiscount: transaction.discount || 0,
        transactions: transactions.map((t) => ({
          _id: t._id?.toString(),
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
          expenseType: t.expenseType,
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