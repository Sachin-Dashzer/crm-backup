import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getSession();
    
    if (!session.isAuthenticated) {
      return NextResponse.json(
        { authenticated: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: session.user,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { authenticated: false, message: 'Verification failed' },
      { status: 500 }
    );
  }
}