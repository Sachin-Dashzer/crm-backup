import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import Stock from "@/models/Stock";
import { NAME_COLLATION } from "@/lib/sortOptions";

async function buildResponse(query, threshold, restrictedLocation = null) {
  const stocks = await Stock.find(query).sort({ name: 1 }).collation(NAME_COLLATION).lean();
  const statsQuery = restrictedLocation ? { location: restrictedLocation } : {};
  const allStocks = await Stock.find(statsQuery).lean();

  const statistics = {
    totalItems: allStocks.length,
    totalStockValue: allStocks.reduce(
      (sum, s) => sum + (s.totalQuantity || 0) * (s.mrp || 0),
      0
    ),
    lowStockCount: allStocks.filter((s) => (s.totalQuantity || 0) <= threshold).length,
    expiredCount: allStocks.filter(
      (s) => s.expiry && new Date(s.expiry) <= new Date()
    ).length,
  };

  // Per-location breakdown (only stocks that have a location set)
  const locationMap = {};
  allStocks.forEach((s) => {
    const loc = s.location || "Unassigned";
    if (!locationMap[loc]) {
      locationMap[loc] = {
        location: loc,
        totalItems: 0,
        availableQty: 0,
        stockValue: 0,
        purchaseValue: 0,
        soldValue: 0,
        lowStockCount: 0,
        expiredCount: 0,
      };
    }
    const entry = locationMap[loc];
    entry.totalItems += 1;
    entry.availableQty += s.totalQuantity || 0;
    entry.stockValue += (s.totalQuantity || 0) * (s.mrp || 0);
    entry.purchaseValue += (s.totalQuantity || 0) * (s.purchaseAmt || 0);
    entry.soldValue += (s.totalQuantity || 0) * (s.soldAmt || 0);
    if ((s.totalQuantity || 0) <= threshold) entry.lowStockCount += 1;
    if (s.expiry && new Date(s.expiry) <= new Date()) entry.expiredCount += 1;
  });

  const locationStats = Object.values(locationMap);

  return { stocks, statistics, locationStats };
}

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
    const id        = searchParams.get("id");
    const location  = searchParams.get("location");
    const search    = searchParams.get("search");
    const lowStock  = searchParams.get("lowStock");
    const expired   = searchParams.get("expired");
    const threshold = parseInt(searchParams.get("threshold")) || 10;

    // Determine branch restriction (applies to all queries)
    const userBranch = session.user.branch;
    const isAdmin = ["admin", "super-admin"].includes(session.user.role);
    const branchRestricted = !isAdmin && userBranch;

    // Single stock by ID
    if (id) {
      const stock = await Stock.findById(id).lean();
      if (!stock) {
        return NextResponse.json(
          { success: false, message: "Stock not found" },
          { status: 404 }
        );
      }
      if (branchRestricted && stock.location !== userBranch) {
        return NextResponse.json(
          { success: false, message: "You can only view stock items for your branch" },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, data: stock }, { status: 200 });
    }

    // Build filter query
    const query = {};
    if (branchRestricted) {
      query.location = userBranch;
    } else if (location && location !== "All") {
      query.location = location;
    }
    if (search) {
      query.$or = [
        { name:     { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (lowStock === "true") query.totalQuantity = { $lte: threshold };
    if (expired  === "true") query.expiry        = { $lte: new Date() };

    const { stocks, statistics, locationStats } = await buildResponse(query, threshold, branchRestricted ? userBranch : null);

    return NextResponse.json(
      { success: true, data: stocks, statistics, locationStats, userBranch: userBranch || null, branchRestricted: !!branchRestricted },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stocks", error: error.message },
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
    const { id, location, search, lowStock, expired, threshold = 10 } = body;

    // Determine branch restriction
    const userBranch = session.user.branch;
    const isAdmin = ["admin", "super-admin"].includes(session.user.role);
    const branchRestricted = !isAdmin && userBranch;

    // Single stock by ID
    if (id) {
      const stock = await Stock.findById(id).lean();
      if (!stock) {
        return NextResponse.json(
          { success: false, message: "Stock not found" },
          { status: 404 }
        );
      }
      if (branchRestricted && stock.location !== userBranch) {
        return NextResponse.json(
          { success: false, message: "You can only view stock items for your branch" },
          { status: 403 }
        );
      }
      return NextResponse.json({ success: true, data: stock }, { status: 200 });
    }

    const query = {};
    if (branchRestricted) {
      query.location = userBranch;
    } else if (location && location !== "All") {
      query.location = location;
    }
    if (search) {
      query.$or = [
        { name:     { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }
    if (lowStock === true) query.totalQuantity = { $lte: threshold };
    if (expired  === true) query.expiry        = { $lte: new Date() };

    const { stocks, statistics, locationStats } = await buildResponse(query, threshold, branchRestricted ? userBranch : null);

    return NextResponse.json(
      { success: true, data: stocks, statistics, locationStats, userBranch: userBranch || null, branchRestricted: !!branchRestricted },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching stocks:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch stocks", error: error.message },
      { status: 500 }
    );
  }
}
