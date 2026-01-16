// app/api/admin/users/route.js - CREATE THIS FILE
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    // Check if user is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    // Fetch all non-admin users
    const users = await User.find({})
      .select('name email role branch createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean();

    // Convert to plain objects
    const plainUsers = users.map(user => ({
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch || 'Not Assigned',
      createdAt: user.createdAt?.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      users: plainUsers,
      count: plainUsers.length,
    });

  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while fetching users" },
      { status: 500 }
    );
  }
}