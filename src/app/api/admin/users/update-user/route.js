import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { MAIN_BRANCHES } from "@/lib/branches";

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

    const { userId, name, email, role, branch, password } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    const user = await User.findById(userId).select('+password +sessionVersion');

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }



    if (name) {
      user.name = name;
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, message: "Invalid email format" },
          { status: 400 }
        );
      }

      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return NextResponse.json(
          { success: false, message: "Email already in use by another user" },
          { status: 400 }
        );
      }

      user.email = email.toLowerCase();
    }

    if (role) {
      const validRoles = ['super-admin', 'admin', 'sales', 'reception', 'collab', 'surgery', 'counsellor', 'stock', 'hr'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, message: "Invalid role" },
          { status: 400 }
        );
      }
      user.role = role;
    }

    if (branch) {
      const validBranches = [...MAIN_BRANCHES, 'Collab', 'All'];
      if (!validBranches.includes(branch)) {
        return NextResponse.json(
          { success: false, message: "Invalid branch" },
          { status: 400 }
        );
      }
      user.branch = branch;
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      user.password = password;
    }

    await user.save();


    return NextResponse.json({
      success: true,
      message: `User ${user.name} updated successfully${password ? '. User will be logged out from all devices.' : ''}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
        sessionVersion: user.sessionVersion,
      }
    });

  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while updating user" },
      { status: 500 }
    );
  }
}