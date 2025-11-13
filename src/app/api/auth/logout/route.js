import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const cookieStore = await cookies();
    
    // Clear all auth cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0, // Expire immediately
      path: '/',
    };

    cookieStore.set('isLoggedIn', '', cookieOptions);
    cookieStore.set('userRole', '', cookieOptions);
    cookieStore.set('userId', '', cookieOptions);
    cookieStore.set('userName', '', cookieOptions);
    cookieStore.set('userBranch', '', cookieOptions);
    cookieStore.set('userEmail', '', cookieOptions);

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Logout failed' },
      { status: 500 }
    );
  }
}
