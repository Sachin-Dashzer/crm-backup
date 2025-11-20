import { NextResponse } from "next/server";
import Transaction from "@/models/Transactions";
import dbConnect from "@/lib/db";

export async function GET(request) {
  try {
    await dbConnect();
    
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "Patient ID is required" },
        { status: 400 }
      );
    }

    const transactions = await Transaction.find({ patient: patientId })
      .sort({ date: -1 });

    return NextResponse.json({
      success: true,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}