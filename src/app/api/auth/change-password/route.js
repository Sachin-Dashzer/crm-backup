import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login." },
        { status: 401 }
      );
    }

    await connectDB();

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "New passwords do not match" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await User.findById(session.user.id).select('+password +sessionVersion');

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const isPasswordCorrect = await user.correctPassword(currentPassword, user.password);

    if (!isPasswordCorrect) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect" },
        { status: 401 }
      );
    }

    user.password = newPassword;
    await user.save();

    console.log(`Password changed for user ${user.email}. SessionVersion: ${user.sessionVersion}. All sessions invalidated.`);

    return NextResponse.json({
      success: true,
      message: "Password changed successfully. All devices will be logged out.",
      sessionVersion: user.sessionVersion,
    });

  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while changing password" },
      { status: 500 }
    );
  }
}