// app/api/admin/delete-user/route.js - CREATE THIS FILE
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
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

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Prevent deleting admin accounts
    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, message: "Cannot delete admin accounts through this interface" },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === session.user.id) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const userName = user.name;
    const userEmail = user.email;

    // Delete user
    await User.findByIdAndDelete(userId);

    console.log(`Admin ${session.user.email} deleted user: ${userEmail} (${user.role})`);

    return NextResponse.json({
      success: true,
      message: `User ${userName} deleted successfully`,
    });

  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while deleting user" },
      { status: 500 }
    );
  }
}