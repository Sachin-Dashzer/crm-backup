import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    // Only super-admin can manage users
    const callerRole = session?.user?.role;
    if (!session || callerRole !== 'super-admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Super-admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { userId, name, email, role, branch, password } = await req.json();

    // Validation
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User ID is required" },
        { status: 400 }
      );
    }

    // Find user
    const user = await User.findById(userId).select('+password +sessionVersion');

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Prevent updating admin accounts through this endpoint
    // if (user.role === 'admin') {
    //   return NextResponse.json(
    //     { success: false, message: "Cannot update admin accounts through this interface" },
    //     { status: 400 }
    //   );
    // }

    // Prevent changing user to admin role
    // if (role === 'admin') {
    //   return NextResponse.json(
    //     { success: false, message: "Cannot change user role to admin through this interface" },
    //     { status: 400 }
    //   );
    // }

    // Update fields
    if (name) {
      user.name = name;
    }

    if (email) {
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { success: false, message: "Invalid email format" },
          { status: 400 }
        );
      }

      // Check if email already exists (for different user)
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
      const validRoles = ['super-admin', 'admin', 'sales', 'reception', 'surgery', 'counsellor', 'stock', 'hr'];
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { success: false, message: "Invalid role" },
          { status: 400 }
        );
      }
      user.role = role;
    }

    if (branch) {
      const validBranches = ['Delhi', 'Mumbai', 'Hyderabad', 'All'];
      if (!validBranches.includes(branch)) {
        return NextResponse.json(
          { success: false, message: "Invalid branch" },
          { status: 400 }
        );
      }
      user.branch = branch;
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { success: false, message: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }
      user.password = password; // Will be hashed by pre-save hook and increment sessionVersion
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