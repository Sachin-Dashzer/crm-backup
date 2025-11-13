import { NextResponse } from "next/server";
import Transactions from "@/models/Transactions";
import dbConnect from "@/lib/db";

export async function DELETE(request) {
  try {
    // Connect to database
    await dbConnect();

    // Parse request body
    const body = await request.json();
    const { _id } = body;

    // Validate _id
    if (!_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Transactions ID is required",
        },
        { status: 400 }
      );
    }

    console.log("Attempting to delete transactions with ID:", _id);

    // Find and delete the transactions
    const deletedTransactions = await Transactions.findByIdAndDelete(_id);

    // Check if transactions was found and deleted
    if (!deletedTransactions) {
      return NextResponse.json(
        {
          success: false,
          message: "Transactions not found",
        },
        { status: 404 }
      );
    }

    console.log("Successfully deleted transactions:", deletedTransactions);

    return NextResponse.json(
      {
        success: true,
        message: "Transactions deleted successfully",
        data: deletedTransactions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting transactions:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid transactions ID format",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete transactions",
        error: error.message,
      },
      { status: 500 }
    );
  }
}