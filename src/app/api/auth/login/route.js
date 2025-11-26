import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import connectDB from '@/lib/db';
import User from '@/models/User';

export async function POST(req) {
  try {
    await connectDB();
    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user and include password field
    const user = await User.findOne({ email}).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    
    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Set secure cookies
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      sameSite: 'lax',
    };

    cookieStore.set('isLoggedIn', 'true', cookieOptions);
    cookieStore.set('userRole', user.role, cookieOptions);
    cookieStore.set('userId', user._id.toString(), cookieOptions);
    cookieStore.set('userName', encodeURIComponent(user.name), cookieOptions);
    cookieStore.set('userBranch', user.branch, cookieOptions);
    cookieStore.set('userEmail', user.email, cookieOptions);

    // Role-based redirect routes
    const roleRoutes = {
      admin: '/admin/dashboard',
      sales: '/sales/dashboard',
      sales: '/counsellor/patients',
      reception: '/reception/dashboard',
      surgery: '/surgery/dashboard',
    };

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch: user.branch,
      },
      redirectTo: roleRoutes[user.role] || '/login',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}