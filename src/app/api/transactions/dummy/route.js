// app/api/admin/migrate-transactions/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Transactions from "@/models/Transactions";

export async function POST(req) {
  try {
    await connectDB();

    // Update all existing transactions to add paymentId field
    const result = await Transactions.updateMany(
      { paymentId: { $exists: false } }, // Only update documents without paymentId
      { $set: { paymentId: "" } } // Set empty string as default
    );

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Migration failed",
        error: error.message,
      },
      { status: 500 }
    );
  }
}