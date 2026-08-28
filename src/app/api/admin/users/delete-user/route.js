import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";
import DeleteLog from "@/models/DeleteLog";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    const callerRole = session?.user?.role;
    if (!session || callerRole !== 'super-admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Super-admin access required." },
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

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    if (callerRole === 'admin' && ['admin', 'super-admin'].includes(user.role)) {
      return NextResponse.json(
        { success: false, message: "Admins cannot delete admin or super-admin accounts" },
        { status: 403 }
      );
    }
    if (callerRole === 'super-admin' && user.role === 'super-admin') {
      return NextResponse.json(
        { success: false, message: "Cannot delete another super-admin account" },
        { status: 403 }
      );
    }

    if (user._id.toString() === session.user.id) {
      return NextResponse.json(
        { success: false, message: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const userName = user.name;
    const userEmail = user.email;

    await DeleteLog.create({
      entityType: "Patient",
      entityId: userId,
      entityName: userName,
      entityDetails: {
        email: userEmail,
        role: user.role,
        branch: user.branch,
      },
      deletedBy: {
        name: session.user.name,
        email: session.user.email,
        branch: session.user.branch,
      },
      branch: user.branch,
    });

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