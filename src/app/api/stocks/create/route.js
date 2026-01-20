import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import Vendor from "@/models/Vender";
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
    const {
      name,
      totalQuantity,
      purchase,
      gstNo,
      weight,
      unit,
      mrp,
      expiry,
    } = body;

    // Validation
    if (!name || !mrp) {
      return NextResponse.json(
        { success: false, message: "Name and MRP are required" },
        { status: 400 }
      );
    }

    // If purchase data is provided, validate vendor exists
    if (purchase && purchase.length > 0) {
      for (const purchaseItem of purchase) {
        if (purchaseItem.vender) {
          const vendorExists = await Vendor.findById(purchaseItem.vender);
          if (!vendorExists) {
            return NextResponse.json(
              {
                success: false,
                message: `Vendor with ID ${purchaseItem.vender} not found`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Calculate total quantity from purchases
    let calculatedQuantity = totalQuantity || 0;
    if (purchase && purchase.length > 0) {
      calculatedQuantity = purchase.reduce(
        (sum, item) => sum + (item.quantity || 0),
        0
      );
    }

    // Create new stock
    const stock = await Stock.create({
      name,
      totalQuantity: calculatedQuantity,
      purchase: purchase || [],
      sell: [],
      gstNo,
      weight,
      unit,
      mrp,
      expiry,
      createdBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
        date: new Date(),
      },
    });

    // Populate vendor details
    const populatedStock = await Stock.findById(stock._id)
      .populate("purchase.vender")
      .populate("sell.patient");

    return NextResponse.json(
      {
        success: true,
        message: "Stock created successfully",
        data: populatedStock,
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