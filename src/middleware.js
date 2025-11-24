import { NextResponse } from "next/server";

export function middleware(req) {
  const isLoggedIn = req.cookies.get("isLoggedIn")?.value === "true";
  const userRole = req.cookies.get("userRole")?.value;
  const { pathname } = req.nextUrl;

  // Public paths that don't require authentication
  const publicPaths = ["/login", "/"];

  // If accessing public paths
  if (publicPaths.includes(pathname)) {
    // If already logged in, redirect to their dashboard
    if (isLoggedIn && userRole) {
      const roleRoutes = {
        admin: "/admin/dashboard",
        sales: "/sales/dashboard",
        counsellor: "/counsellor/patients",
        reception: "/reception/dashboard",
        surgery: "/surgery/dashboard",
      };
      return NextResponse.redirect(
        new URL(roleRoutes[userRole] || "/login", req.url)
      );
    }
    return NextResponse.next();
  }

  // Protected paths - require authentication
  if (!isLoggedIn || !userRole) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Define allowed paths for each role
  const roleAllowedPaths = {
    admin: [
      "/admin",
      "/sales",
      "/counsellor", 
      "/reception",
      "/surgery"
    ],
    sales: ["/sales"],
    counsellor: ["/counsellor"],
    reception: ["/reception"],
    surgery: ["/surgery"],
  };

  // Check if user has access to the requested path
  const allowedPaths = roleAllowedPaths[userRole] || [];
  const hasAccess = allowedPaths.some(path => pathname.startsWith(path));

  if (!hasAccess) {
    // User doesn't have access to this path, redirect to their dashboard
    const roleRoutes = {
      admin: "/admin/dashboard",
      sales: "/sales/dashboard",
      counsellor: "/counsellor/patients",
      reception: "/reception/dashboard",
      surgery: "/surgery/dashboard",
    };
    
    console.warn(`Access denied: User with role '${userRole}' attempted to access '${pathname}'`);
    
    return NextResponse.redirect(new URL(roleRoutes[userRole] || "/login", req.url));
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