import { NextResponse } from "next/server";

export function middleware(req) {
  const isLoggedIn = req.cookies.get("isLoggedIn")?.value === 'true';
  const userRole = req.cookies.get("userRole")?.value;
  const { pathname } = req.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/'];
  
  // If accessing public paths
  if (publicPaths.includes(pathname)) {
    // If already logged in, redirect to their dashboard
    if (isLoggedIn && userRole) {
      const roleRoutes = {
        admin: '/admin/dashboard',
        sales: '/sales/dashboard',
        reception: '/reception/dashboard',
        surgery: '/surgery/dashboard',
      };
      return NextResponse.redirect(new URL(roleRoutes[userRole] || '/login', req.url));
    }
    return NextResponse.next();
  }

  // Protected paths - require authentication
  if (!isLoggedIn || !userRole) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Role-based path access control
  const rolePrefix = {
    admin: '/admin',
    sales: '/sales',
    reception: '/reception',
    surgery: '/surgery',
  };

  // Admin has access to everything
  if (userRole === 'admin') {
    return NextResponse.next();
  }
  
  // Check if user is trying to access their allowed path
  const allowedPath = rolePrefix[userRole];
  if (!pathname.startsWith(allowedPath)) {
    // Redirect to their proper dashboard
    return NextResponse.redirect(new URL(allowedPath + '/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/', 
    '/login', 
    '/admin/:path*', 
    '/sales/:path*', 
    '/reception/:path*', 
    '/surgery/:path*'
  ]
};