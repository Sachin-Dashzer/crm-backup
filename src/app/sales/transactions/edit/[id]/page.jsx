"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sales panel: Transaction editing is not permitted.
 * This route permanently redirects to the read-only transactions list.
 */
export default function SalesTransactionEditRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/transactions");
  }, [router]);

  return null;
}
