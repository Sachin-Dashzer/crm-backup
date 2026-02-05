import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function PUT(req) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, name, gstNo, weight, unit, mrp, expiry, purchaseAmt , soldAmt , updatedFields } = body;

    // Validation
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Stock ID is required" },
        { status: 400 }
      );
    }

    if (!name || !mrp) {
      return NextResponse.json(
        { success: false, message: "Name and MRP are required" },
        { status: 400 }
      );
    }

    // Find existing stock
    const existingStock = await Stock.findById(id);
    if (!existingStock) {
      return NextResponse.json(
        { success: false, message: "Stock item not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData = {
      name,
      mrp,
      gstNo,
      weight,
      unit,
      expiry,
      soldAmt,
      purchaseAmt
    };

    // Add editor entry with tracked changes
    const editorEntry = {
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
      updatedFields: updatedFields || [],
    };

    // Update the stock item
    const updatedStock = await Stock.findByIdAndUpdate(
      id,
      {
        $set: updateData,
        $push: { editors: editorEntry },
      },
      { new: true, runValidators: true }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Stock updated successfully",
        data: updatedStock,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating stock:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update stock",
        error: error.message,
      },
      { status: 500 }
    );
  }
}