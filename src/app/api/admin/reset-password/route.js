import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { success: false, message: "User ID and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select('+sessionVersion');

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (user._id.toString() === session.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Use change password endpoint to update your own password"
        },
        { status: 400 }
      );
    }

    user.password = newPassword;
    await user.save();

    console.log(`Admin ${session.user.email} reset password for ${user.email}. SessionVersion: ${user.sessionVersion}. All sessions invalidated.`);

    return NextResponse.json({
      success: true,
      message: `Password reset successfully for ${user.name}. User will be logged out from all devices.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        sessionVersion: user.sessionVersion,
      }
    });

  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while resetting password" },
      { status: 500 }
    );
  }
}