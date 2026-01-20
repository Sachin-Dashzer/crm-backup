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
    const { stockId, price, date, vender, quantity } = body;

    if (!stockId || !price || !quantity) {
      return NextResponse.json(
        {
          success: false,
          message: "Stock ID, price, and quantity are required",
        },
        { status: 400 }
      );
    }

    // Find stock
    const stock = await Stock.findById(stockId);
    if (!stock) {
      return NextResponse.json(
        { success: false, message: "Stock not found" },
        { status: 404 }
      );
    }

    // Validate vendor if provided
    if (vender) {
      const vendorExists = await Vendor.findById(vender);
      if (!vendorExists) {
        return NextResponse.json(
          { success: false, message: "Vendor not found" },
          { status: 404 }
        );
      }
    }

    // Add purchase to stock
    const newPurchase = {
      price,
      date: date || new Date(),
      vender,
      quantity,
    };

    stock.purchase.push(newPurchase);

    // Recalculate total quantity
    const totalPurchased = stock.purchase.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    const totalSold = stock.sell.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    stock.totalQuantity = totalPurchased - totalSold;

    // Add editor info
    if (!stock.editors) {
      stock.editors = [];
    }
    stock.editors.push({
      name: session.user.name,
      email: session.user.email,
      branch: session.user.branch,
      date: new Date(),
      updatedFields: [
        {
          name: "purchase",
          previousValue: `${stock.purchase.length - 1} entries`,
          newValue: `${stock.purchase.length} entries (added ${quantity} units)`,
        },
      ],
    });

    await stock.save();

    // Populate and return
    const updatedStock = await Stock.findById(stockId)
      .populate("purchase.vender")
      .populate("sell.patient");

    return NextResponse.json(
      {
        success: true,
        message: "Purchase added successfully",
        data: updatedStock,
        addedQuantity: quantity,
        newTotalQuantity: stock.totalQuantity,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error adding purchase:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to add purchase",
        error: error.message,
      },
      { status: 500 }
    );
  }
}