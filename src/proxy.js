import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Default dashboard per role — redirect here when user hits a forbidden route
const ROLE_HOME = {
  "super-admin": "/super-admin/dashboard",
  admin:         "/admin/dashboard",
  sales:         "/sales/dashboard",
  reception:     "/reception/dashboard",
  surgery:       "/surgery/dashboard",
  counsellor:    "/counsellor/patients",
  stock:         "/stocks/dashboard",
  hr:            "/hr/dashboard",
};

// Which top-level paths each role is allowed to access
const ROLE_ALLOWED_PREFIXES = {
  "super-admin": ["/super-admin", "/admin", "/sales", "/reception", "/surgery", "/counsellor", "/stocks", "/hr"],
  admin:         ["/admin", "/stocks"],
  sales:         ["/sales"],
  reception:     ["/reception"],
  surgery:       ["/surgery"],
  counsellor:    ["/counsellor"],
  stock:         ["/stocks"],
  hr:            ["/hr"],
};

export default withAuth(
  function middleware(req) {
    const token    = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role     = token?.role;

    // Super-admin: unrestricted
    if (role === "super-admin") return NextResponse.next();

    const allowed = ROLE_ALLOWED_PREFIXES[role] || [];
    const canAccess = allowed.some((prefix) => pathname.startsWith(prefix));

    if (!canAccess) {
      const home = ROLE_HOME[role] || "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // If no token, next-auth will redirect to /login automatically
      authorized: ({ token }) => !!token,
    },
  }
);

// Protect all role-specific panel routes
export const config = {
  matcher: [
    "/admin/:path*",
    "/super-admin/:path*",
    "/sales/:path*",
    "/reception/:path*",
    "/surgery/:path*",
    "/counsellor/:path*",
    "/stocks/:path*",
    "/hr/:path*",
  ],
};
