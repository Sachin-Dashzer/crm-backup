import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_HOME = {
  "super-admin": "/super-admin/dashboard",
  admin:         "/admin/dashboard",
  sales:         "/sales/dashboard",
  reception:     "/reception/dashboard",
  collab:        "/collab/dashboard",
  surgery:       "/surgery/dashboard",
  counsellor:    "/counsellor/patients",
  stock:         "/stocks/dashboard",
  hr:            "/hr/dashboard",
};

const ROLE_ALLOWED_PREFIXES = {
  "super-admin": ["/super-admin", "/admin", "/sales", "/reception", "/collab", "/surgery", "/counsellor", "/stocks", "/hr"],
  admin:         ["/admin", "/stocks"],
  sales:         ["/sales"],
  reception:     ["/reception"],
  collab:        ["/collab"],
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
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/super-admin/:path*",
    "/sales/:path*",
    "/reception/:path*",
    "/collab/:path*",
    "/surgery/:path*",
    "/counsellor/:path*",
    "/stocks/:path*",
    "/hr/:path*",
  ],
};
