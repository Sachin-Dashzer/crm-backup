import { NextResponse } from "next/server";

export function middleware(req) {
  // Get initial values from cookies
  let isLoggedIn = req.cookies.get("isLoggedIn")?.value === "true";
  let userRole = req.cookies.get("userRole")?.value;
  
  // Fallback to headers if cookies not working
  if (!isLoggedIn) {
    isLoggedIn = req.headers.get("x-is-loggedin") === "true";
    userRole = req.headers.get("x-user-role");
  }

  const { pathname } = req.nextUrl;


  // Public paths that don't require authentication
  const publicPaths = ["/login", "/", "/api/auth"];

  // If accessing public paths
  if (publicPaths.includes(pathname) || pathname.startsWith('/api/')) {
    if (isLoggedIn && userRole && pathname === "/login") {
      const roleRoutes = {
        admin: "/admin/dashboard",
        sales: "/sales/dashboard",
        counsellor: "/counsellor/patients",
        reception: "/reception/dashboard",
        surgery: "/surgery/dashboard",
      };
      const redirectUrl = roleRoutes[userRole] || "/login";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Protected paths - require authentication
  if (!isLoggedIn || !userRole) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Define allowed paths for each role
  const roleAllowedPaths = {
    admin: ["/admin", "/sales", "/counsellor", "/reception", "/surgery"],
    sales: ["/sales"],
    counsellor: ["/counsellor"],
    reception: ["/reception"],
    surgery: ["/surgery"],
  };

  // Check if user has access to the requested path
  const allowedPaths = roleAllowedPaths[userRole] || [];
  const hasAccess = allowedPaths.some(path => pathname.startsWith(path));

  if (!hasAccess) {
    const roleRoutes = {
      admin: "/admin/dashboard",
      sales: "/sales/dashboard",
      counsellor: "/counsellor/patients",
      reception: "/reception/dashboard",
      surgery: "/surgery/dashboard",
    };
    
    console.warn(`Access denied: User with role '${userRole}' attempted to access '${pathname}'`);
    
    const redirectUrl = roleRoutes[userRole] || "/login";
    return NextResponse.redirect(new URL(redirectUrl, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/admin/:path*",
    "/counsellor/:path*",
    "/sales/:path*",
    "/reception/:path*",
    "/surgery/:path*",
  ],
};