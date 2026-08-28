import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Transactions from "@/models/Transactions";
import Patient from "@/models/Patient";
import vendor from "@/models/Vendor";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    const transaction = await Transactions.findById(id)
      .populate({
        path: "patient",
        select: "personal medical counselling surgery payments",
      })
      .populate({
        path: "medicineId",
        select: "name mrp purchaseAmt totalQuantity weight unit",
      })
      .populate({
        path: "stock",
        select: "name mrp purchaseAmt",
      })
      .populate({
        path: "expenseGiver.vendorId",
        select: "name contact email address",
      })
      .lean();

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (session.user.role !== "admin" && session.user.branch !== "All") {
      if (transaction.branch !== session.user.branch) {
        return NextResponse.json(
          { error: "Access denied to this transaction" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transaction",
        message: error.message,
      },
      { status: 500 }
    );
  }
}