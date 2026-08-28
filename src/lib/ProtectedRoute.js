"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const userRole = document.cookie
        .split("; ")
        .find((row) => row.startsWith("userRole="))
        ?.split("=")[1];

      const isLoggedIn = document.cookie
        .split("; ")
        .find((row) => row.startsWith("isLoggedIn="))
        ?.split("=")[1] === 'true';

      if (!isLoggedIn || !userRole) {
        router.push("/login");
        return;
      }

      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        const roleRoutes = {
          admin: '/admin/dashboard',
          sales: '/sales/dashboard',
          reception: '/reception/dashboard',
          collab: '/collab/dashboard',
          surgery: '/surgery/dashboard',
        };
        router.push(roleRoutes[userRole] || '/login');
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error("Auth check error:", error);
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router, allowedRoles]);

  useEffect(() => {
    checkAuth();
  }, [pathname, checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}