import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const branch = searchParams.get("branch");
    const search = searchParams.get("search");
    const lowStock = searchParams.get("lowStock");
    const expired = searchParams.get("expired");
    const threshold = parseInt(searchParams.get("threshold")) || 10;

    // If ID is provided, fetch single stock
    if (id) {
      const stock = await Stock.findById(id).lean();

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

    // Otherwise, fetch multiple stocks with filters
    const query = {};

    // Branch filter - anyone can filter by branch
    if (branch && branch !== "All") {
      query.branch = branch;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Low stock filter
    if (lowStock === "true") {
      query.totalQuantity = { $lte: threshold };
    }

    // Expired filter
    if (expired === "true") {
      query.expiry = { $lte: new Date() };
    }

    // Fetch stocks
    const stocks = await Stock.find(query).sort({ name: 1 }).lean();

    // Calculate statistics for all stocks
    const allStocks = await Stock.find({}).lean();

    const statistics = {
      totalItems: allStocks.length,
      totalStockValue: allStocks.reduce(
        (sum, stock) => sum + (stock.totalQuantity || 0) * (stock.mrp || 0),
        0
      ),
      lowStockCount: allStocks.filter(
        (stock) => (stock.totalQuantity || 0) <= threshold
      ).length,
      expiredCount: allStocks.filter(
        (stock) => stock.expiry && new Date(stock.expiry) <= new Date()
      ).length,
    };

    return NextResponse.json(
      {
        success: true,
        data: stocks,
        statistics,
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

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await dbConnect();

    const body = await req.json();
    const { id, branch, search, lowStock, expired, threshold = 10 } = body;

    // If ID is provided, fetch single stock
    if (id) {
      const stock = await Stock.findById(id).lean();

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

    // Build query for multiple stocks
    const query = {};

    // Branch filter - anyone can filter by branch
    if (branch && branch !== "All") {
      query.branch = branch;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Low stock filter
    if (lowStock === true) {
      query.totalQuantity = { $lte: threshold };
    }

    // Expired filter
    if (expired === true) {
      query.expiry = { $lte: new Date() };
    }

    // Fetch stocks
    const stocks = await Stock.find(query).sort({ name: 1 }).lean();

    // Calculate statistics for all stocks
    const allStocks = await Stock.find({}).lean();

    const statistics = {
      totalItems: allStocks.length,
      totalStockValue: allStocks.reduce(
        (sum, stock) => sum + (stock.totalQuantity || 0) * (stock.mrp || 0),
        0
      ),
      lowStockCount: allStocks.filter(
        (stock) => (stock.totalQuantity || 0) <= threshold
      ).length,
      expiredCount: allStocks.filter(
        (stock) => stock.expiry && new Date(stock.expiry) <= new Date()
      ).length,
    };

    return NextResponse.json(
      {
        success: true,
        data: stocks,
        statistics,
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