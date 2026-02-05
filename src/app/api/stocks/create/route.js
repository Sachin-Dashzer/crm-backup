import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req) {
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
    const { name, gstNo, weight, unit, mrp, expiry , purchaseAmt , soldAmt } = body;

    // Validation
    if (!name || !mrp) {
      return NextResponse.json(
        { success: false, message: "Name and MRP are required" },
        { status: 400 }
      );
    }

    // Create new stock item
    const stock = await Stock.create({
      name,
      totalQuantity: 0,
      gstNo,
      weight,
      unit,
      mrp,
      expiry,
      purchaseAmt,
      soldAmt,
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Stock created successfully. You can now add purchases via transactions.",
        data: stock,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating stock:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create stock",
        error: error.message,
      },
      { status: 500 }
    );
  }
}