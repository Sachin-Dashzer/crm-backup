import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";
import { MAIN_BRANCHES } from "@/lib/branches";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session?.user?.role !== 'super-admin') {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Super-admin access required." },
        { status: 403 }
      );
    }

    await connectDB();

    const { name, email, password, role: newRole, branch } = await req.json();

    if (!name || !email || !password || !newRole) {
      return NextResponse.json(
        { success: false, message: "Name, email, password, and role are required" },
        { status: 400 }
      );
    }


    const validRoles = ['super-admin', 'admin', 'sales', 'reception', 'collab', 'surgery', 'counsellor', 'stock', 'hr'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { success: false, message: "Invalid role" },
        { status: 400 }
      );
    }

    const validBranches = [...MAIN_BRANCHES, 'Collab', 'All'];
    if (branch && !validBranches.includes(branch)) {
      return NextResponse.json(
        { success: false, message: `Invalid branch. Must be one of: ${validBranches.join(', ')}` },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "User with this email already exists" },
        { status: 400 }
      );
    }

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
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