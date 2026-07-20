// app/api/admin/create-user/route.js - CREATE THIS FILE
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { MAIN_BRANCHES } from "@/lib/branches";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    // Only super-admin can manage users
    if (!session || session?.user?.role !== 'super-admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Super-admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { name, email, password, role: newRole, branch } = await req.json();

    // Validation
    if (!name || !email || !password || !newRole) {
      return NextResponse.json(
        { success: false, message: "Name, email, password, and role are required" },
        { status: 400 }
      );
    }

    // Prevent creating admin accounts through this endpoint
    // if (role === 'admin') {
    //   return NextResponse.json(
    //     { success: false, message: "Cannot create admin accounts through this interface" },
    //     { status: 400 }
    //   );
    // }

    // Valid roles for creation
    const validRoles = ['super-admin', 'admin', 'sales', 'reception', 'collab', 'surgery', 'counsellor', 'stock', 'hr'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 400 }
      );
    }

    // Valid branches: a main branch, "Collab" (shared account for the 8 collab-city panel), or "All"
    const validBranches = [...MAIN_BRANCHES, 'Collab', 'All'];
    if (branch && !validBranches.includes(branch)) {
      return NextResponse.json(
        { success: false, message: `Invalid branch. Must be one of: ${validBranches.join(', ')}` },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Create new user
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save hook
      role: newRole,
      branch: branch || 'All',
      sessionVersion: 0,
    });

    await newUser.save();

    console.log(`Admin ${session.user.email} created new user: ${newUser.email} (${newUser.role})`);

    return NextResponse.json({
      success: true,
      message: `User ${name} created successfully`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        branch: newUser.branch,
      }
    });

  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { success: false, message: "An error occurred while creating user" },
      { status: 500 }
    );
  }
}