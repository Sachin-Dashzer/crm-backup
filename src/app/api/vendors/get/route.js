import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Vendor from "@/models/Vender";
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
    const dealsIn = searchParams.get("dealsIn");

    // Get specific vendor by ID
    if (id) {
      const vendor = await Vendor.findById(id).populate("Transactions");
      
      if (!vendor) {
        return NextResponse.json(
          { success: false, message: "Vendor not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: vendor,
        },
        { status: 200 }
      );
    }

    // Build query for filtering
    let query = {};

    // Search by name, email, or contact
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by what they deal in
    if (dealsIn) {
      query.DealsIn = { $regex: dealsIn, $options: "i" };
    }

    // Get all vendors with optional filtering
    const vendors = await Vendor.find(query)
      .populate("Transactions")
      .sort({ createdAt: -1 });

    return NextResponse.json(
      {
        success: true,
        count: vendors.length,
        data: vendors,
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