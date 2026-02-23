"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Seller requests are now on Admin → Users (Seller requests tab).
 * Redirect old /admin/sellers links to /admin/users?tab=sellers.
 */
export default function AdminSellersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/users?tab=sellers");
  }, [router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-600">Redirecting to Users &amp; Sellers…</p>
    </div>
  );
}
