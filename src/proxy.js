import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect bare base paths to their dashboards
    const baseDashboardRedirects = {
      "/admin":       "/admin/dashboard",
      "/super-admin": "/super-admin/dashboard",
      "/sales":       "/sales/dashboard",
      "/counsellor":  "/counsellor/patients",
      "/stocks":      "/stocks/dashboard",
      "/reception":   "/reception/dashboard",
      "/surgery":     "/surgery/dashboard",
      "/hr":          "/hr/dashboard",
    };

    const normalizedPath =
      pathname.endsWith("/") && pathname !== "/"
        ? pathname.slice(0, -1)
        : pathname;

    if (baseDashboardRedirects[normalizedPath]) {
      return NextResponse.redirect(
        new URL(baseDashboardRedirects[normalizedPath], req.url)
      );
    }

    // Role → allowed route prefixes
    const roleRoutes = {
      "super-admin": ["/super-admin", "/admin", "/sales", "/reception", "/surgery", "/counsellor", "/stocks", "/hr"],
      admin:         ["/admin"],
      sales:         ["/sales"],
      counsellor:    ["/counsellor"],
      reception:     ["/reception"],
      surgery:       ["/surgery"],
      stock:         ["/stocks"],
      hr:            ["/hr"],
    };

    // Home dashboard per role (redirect destination on unauthorized access)
    const roleDashboard = {
      "super-admin": "/super-admin/dashboard",
      admin:         "/admin/dashboard",
      sales:         "/sales/dashboard",
      counsellor:    "/counsellor/patients",
      reception:     "/reception/dashboard",
      surgery:       "/surgery/dashboard",
      stock:         "/stocks/dashboard",
      hr:            "/hr/dashboard",
    };

    if (token?.role) {
      const allowedPrefixes = roleRoutes[token.role] || [];
      const hasAccess = allowedPrefixes.some((prefix) =>
        pathname.startsWith(prefix)
      );

      if (!hasAccess) {
        const home = roleDashboard[token.role] || "/login";
        return NextResponse.redirect(new URL(home, req.url));
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
    "/admin/:path*",
    "/super-admin/:path*",
    "/sales/:path*",
    "/counsellor/:path*",
    "/stocks/:path*",
    "/reception/:path*",
    "/surgery/:path*",
    "/hr/:path*",
  ],
};
