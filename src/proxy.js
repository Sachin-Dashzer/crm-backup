// middleware.js - CREATE IN ROOT DIRECTORY (not in app/)
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    const roleRoutes = {
      admin: ['/admin'],
      sales: ['/sales'],
      counsellor: ['/counsellor'],
      reception: ['/reception'],
      surgery: ['/surgery'],
    };

    if (token?.role) {
      const allowedRoutes = roleRoutes[token.role] || [];
      
      if (token.role === 'admin') {
        return NextResponse.next();
      }

      const hasAccess = allowedRoutes.some(route => 
        pathname.startsWith(route)
      );

      if (!hasAccess) {
        const dashboardRoutes = {
          sales: '/sales/dashboard',
          counsellor: '/counsellor/patients',
          reception: '/reception/dashboard',
          surgery: '/surgery/dashboard',
        };
        
        return NextResponse.redirect(
          new URL(dashboardRoutes[token.role] || '/login', req.url)
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/sales/:path*',
    '/counsellor/:path*',
    '/reception/:path*',
    '/surgery/:path*',
  ],
};