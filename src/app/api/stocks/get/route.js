import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(req) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const search = searchParams.get("search");
    const lowStock = searchParams.get("lowStock"); // Filter for items with low stock
    const expired = searchParams.get("expired"); // Filter for expired items
    const threshold = parseInt(searchParams.get("threshold")) || 10; // Default low stock threshold

    // Get specific stock by ID
    if (id) {
      const stock = await Stock.findById(id)
        .populate("purchase.vender")
        .populate("sell.patient")
        .populate("transactions");

      if (!stock) {
        return NextResponse.json(
          { success: false, message: "Stock not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: stock,
        },
        { status: 200 }
      );
    }

    // Build query for filtering
    let query = {};

    // Search by name
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // Filter for low stock items
    if (lowStock === "true") {
      query.totalQuantity = { $lte: threshold };
    }

    // Filter for expired items
    if (expired === "true") {
      query.expiry = { $lte: new Date() };
    }

    // Get all stocks with optional filtering
    const stocks = await Stock.find(query)
      .populate("purchase.vender")
      .populate("sell.patient")
      .populate("transactions")
      .sort({ createdAt: -1 });

    // Calculate additional statistics
    const totalStockValue = stocks.reduce(
      (sum, stock) => sum + (stock.totalQuantity * stock.mrp),
      0
    );

    const lowStockItems = stocks.filter(
      (stock) => stock.totalQuantity <= threshold
    );

    const expiredItems = stocks.filter(
      (stock) => stock.expiry && new Date(stock.expiry) <= new Date()
    );

    return NextResponse.json(
      {
        success: true,
        count: stocks.length,
        data: stocks,
        statistics: {
          totalItems: stocks.length,
          totalStockValue,
          lowStockCount: lowStockItems.length,
          expiredCount: expiredItems.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch stocks",
        error: error.message,
      },
      { status: 500 }
    );
  }
}