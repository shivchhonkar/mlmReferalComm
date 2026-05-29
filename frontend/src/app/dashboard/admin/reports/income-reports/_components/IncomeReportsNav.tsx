"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/admin/reports/income-reports", label: "Overview", exact: true },
  { href: "/dashboard/admin/reports/income-reports/payouts", label: "Payout queue" },
  { href: "/dashboard/admin/reports/income-reports/history", label: "Payment history" },
  { href: "/dashboard/admin/reports/income-reports/audit", label: "My audit log" },
  { href: "/dashboard/admin/reports/customers-income-reports", label: "All customers" },
];

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function IncomeReportsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      {tabs.map((t) => {
        const active =
          "exact" in t && t.exact
            ? pathname === t.href
            : t.href.includes("customers-income-reports")
              ? pathname.startsWith("/dashboard/admin/reports/customers-income-reports")
              : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch={false}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-emerald-100 text-emerald-900"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
