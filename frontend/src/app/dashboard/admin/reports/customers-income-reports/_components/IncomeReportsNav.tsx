"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/admin/reports/customers-income-reports", label: "Income Overview", exact: true },
  { href: "/dashboard/admin/reports/customers-income-reports/payouts", label: "Payouts & Withdrawals" },
  { href: "/dashboard/admin/reports/customers-income-reports/history", label: "Payment History" },
  { href: "/dashboard/admin/reports/customers-income-reports/audit", label: "Audit Log" },
];

function cn(...c: (string | boolean | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export default function IncomeReportsNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
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
