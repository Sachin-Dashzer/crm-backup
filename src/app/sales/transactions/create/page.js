"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sales panel: Transaction creation is not permitted.
 * This route permanently redirects to the read-only transactions list.
 */
export default function SalesTransactionCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sales/transactions");
  }, [router]);

  return null;
}
