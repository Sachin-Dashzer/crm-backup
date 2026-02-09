// app/api/admin/create-user/route.js - CREATE THIS FILE
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

    const { name, email, password, role, branch } = await req.json();

    // Validation
    if (!name || !email || !password || !role) {
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

    // Valid non-admin roles
    const validRoles = ['sales','admin', 'reception', 'surgery', 'counsellor', 'stock'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role. Must be: sales, reception, surgery, or counsellor" },
        { status: 400 }
      );
    }

    // Valid branches
    const validBranches = ['Delhi', 'Mumbai', 'Hyderabad', 'All'];
    if (branch && !validBranches.includes(branch)) {
      return NextResponse.json(
        { success: false, message: "Invalid branch. Must be: Delhi, Mumbai, Hyderabad, or All" },
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
      role,
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