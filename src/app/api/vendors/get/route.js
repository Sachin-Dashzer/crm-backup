import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@/lib/db";
import vendor from "@/models/Vendor";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    // if (!session) {
    //   return NextResponse.json(
    //     { success: false, message: "Unauthorized" },
    //     { status: 401 }
    //   );
    // }

    await dbConnect();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const search = searchParams.get("search");
    const dealsIn = searchParams.get("dealsIn");
    const active = searchParams.get("active");

    // If ID is provided, fetch single vendor
    if (id) {
      try {
        // Named `found`, not `vendor` — a local `const vendor` shadows the imported model
        // for the whole block, so `vendor.findById` hit the temporal dead zone and this
        // path threw a ReferenceError on every call.
        const found = await vendor.findById(id).lean();

        if (!found) {
          return NextResponse.json(
            {
              success: false,
              message: "Vendor not found",
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            data: found,
            vendor: found, // For backward compatibility
          },
          { status: 200 }
        );
      } catch (error) {
        console.error("Error fetching vendor by ID:", error);
        return NextResponse.json(
          {
            success: false,
            message: "Invalid vendor ID",
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    // Build query for listing vendors
    const query = {};

    // Active filter
    if (active === "true") {
      query.isActive = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { DealsIn: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    // DealsIn filter (category filter)
    if (dealsIn) {
      query.DealsIn = { $regex: dealsIn, $options: "i" };
    }

    // Fetch vendors
    const vendors = await vendor.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: vendors,
        vendors: vendors, // For backward compatibility
        count: vendors.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vendors",
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
    const { id, search, dealsIn, active } = body;

    // If ID is provided, fetch single vendor
    if (id) {
      try {
        // See the GET handler above — same shadowing bug, same fix.
        const found = await vendor.findById(id).lean();

        if (!found) {
          return NextResponse.json(
            {
              success: false,
              message: "Vendor not found",
            },
            { status: 404 }
          );
        }

        return NextResponse.json(
          {
            success: true,
            data: found,
            vendor: found,
          },
          { status: 200 }
        );
      } catch (error) {
        console.error("Error fetching vendor by ID:", error);
        return NextResponse.json(
          {
            success: false,
            message: "Invalid vendor ID",
            error: error.message,
          },
          { status: 400 }
        );
      }
    }

    // Build query for listing vendors
    const query = {};

    // Active filter
    if (active === true) {
      query.isActive = true;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { DealsIn: { $regex: search, $options: "i" } },
        { gstNumber: { $regex: search, $options: "i" } },
      ];
    }

    // DealsIn filter (category filter)
    if (dealsIn) {
      query.DealsIn = { $regex: dealsIn, $options: "i" };
    }

    // Fetch vendors
    const vendors = await vendor.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      {
        success: true,
        data: vendors,
        vendors: vendors,
        count: vendors.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch vendors",
        error: error.message,
      },
      { status: 500 }
    );
  }
}