import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect base paths to their dashboards
    const baseDashboardRedirects = {
      '/admin': '/admin/dashboard',
      '/sales': '/sales/dashboard',
      '/counsellor': '/counsellor/patients',
      '/stocks': '/stocks/dashboard',
      '/reception': '/reception/dashboard',
      '/surgery': '/surgery/dashboard',
    };

    // Check if pathname matches exactly (with or without trailing slash)
    const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
      ? pathname.slice(0, -1) 
      : pathname;

    if (baseDashboardRedirects[normalizedPath]) {
      return NextResponse.redirect(
        new URL(baseDashboardRedirects[normalizedPath], req.url)
      );
    }

    const roleRoutes = {
      admin: ['/admin'],
      sales: ['/sales'],
      counsellor: ['/counsellor'],
      reception: ['/reception'],
      surgery: ['/surgery'],
      stock: ['/stocks'],
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
          stock: '/stocks/dashboard',
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
    '/stocks/:path*',
    '/reception/:path*',
    '/surgery/:path*',
  ],
};