"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Network,
  User,
  Settings,
  FileCheck,
  Package,
  Shield,
  LogOut,
  ShoppingCart,
  Users,
  Store,
  FolderOpen,
  BarChart3,
  CheckSquare,
  Image as ImageIcon,
  CreditCard,
  Mail,
  Scale,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

const navItems: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  customerOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/referrals", label: "Referrals", icon: Network },
  { href: "/dashboard/IncomeHistory", label: "Income History", icon: BarChart3 },
  {
    href: "/dashboard/paymentTransactions",
    label: "Payment Transactions",
    icon: CreditCard,
    customerOnly: true,
  },
  { href: "/dashboard/IncomeReports", label: "Income Reports", icon: BarChart3 },
  { href: "/dashboard/ServiceIncomeReports", label: "Service Income Reports", icon: BarChart3 },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  // { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/kyc", label: "KYC", icon: FileCheck },
];

const adminNavItems: { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; subItems?: { href: string; label: string }[] }[] = [
  { href: "/dashboard/admin", label: "Admin Overview", icon: Shield },
  {
    href: "/dashboard/admin/users/admins",
    label: "Users",
    icon: Users,
    subItems: [
      { href: "/dashboard/admin/users/admins", label: "Admins" },      
      { href: "/dashboard/admin/users/users", label: "Manage users" },
      { href: "/dashboard/admin/users/sellers", label: "Sellers" },
      { href: "/dashboard/admin/users/seller-requests", label: "Seller Requests" },
    ],
  },
  { href: "/dashboard/admin/services", label: "Services", icon: Package },
  { href: "/dashboard/admin/communication", label: "Communication", icon: Mail },
  { href: "/dashboard/admin/service-approval", label: "Service Approval", icon: CheckSquare },
  { href: "/dashboard/admin/categories", label: "Categories", icon: FolderOpen },
  {
    href: "/dashboard/admin/reports/ledger",
    label: "Reports",
    icon: BarChart3,
    subItems: [
      { href: "/dashboard/admin/reports/ledger", label: "Ledger" },
      { href: "/dashboard/admin/users/directory", label: "Users" },
      { href: "/dashboard/admin/reports/income-reports", label: "Admin Income & Payouts" },
      { href: "/dashboard/admin/reports/income-reports/payouts", label: "Payout queue" },
      { href: "/dashboard/admin/reports/income-reports/history", label: "Payment history" },
      { href: "/dashboard/admin/reports/income-reports/audit", label: "Payout audit log" },
      {
        href: "/dashboard/admin/reports/customers-income-reports",
        label: "Customers income list",
      },
    ],
  },
  // { href: "/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
  
  // { href: "/dashboard/admin/slider", label: "Slider", icon: ImageIcon },
  // { href: "/dashboard/admin/payment-settings", label: "Payment Settings", icon: CreditCard },
  { href: "/dashboard/admin/kyc", label: "Manage KYC", icon: FileCheck },
  { href: "/dashboard/admin/contacts", label: "Contacts", icon: Mail },
  // { href: "/dashboard/admin/rules", label: "Rules", icon: Scale },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [usersExpanded, setUsersExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);

  const isAdmin = ["super_admin", "admin", "moderator"].includes((user as { role?: string })?.role ?? "");

  // Auto-expand sections when on their sub-routes
  useEffect(() => {
    if (pathname.startsWith("/dashboard/admin/users")) {
      setUsersExpanded(true);
    }
    if (
      pathname.startsWith("/dashboard/admin/reports") ||
      pathname.startsWith("/dashboard/admin/users/directory")
    ) {
      setReportsExpanded(true);
    }
  }, [pathname]);
  const isSellerApproved =
    (user as { isSeller?: boolean; sellerStatus?: string })?.isSeller === true &&
    (user as { sellerStatus?: string })?.sellerStatus === "approved";

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      showSuccessToast("Logged out");
      window.location.href = "/login";
    } catch {
      showErrorToast("Failed to logout");
    }
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200/80 bg-green-700 shadow-sm">
      <div className="flex h-12 items-center border-b border-zinc-200/80 px-4">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-white-900 hover:text-emerald-700"
          prefetch={false}
        >
          Dashboard
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon, customerOnly }) => {
          if (customerOnly && isAdmin) return null;
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-white hover:bg-green-600 hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition", active ? "text-zinc-500" : "text-white group-hover:text-white")} />
              {label}
            </Link>
          );
        })}

        {isSellerApproved && (
          <Link
            href="/dashboard/seller/services"
            prefetch={false}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname.startsWith("/dashboard/seller")
               ? "bg-emerald-50 text-emerald-800"
                 : "text-white hover:bg-green-600 hover:text-white"
            )}
          >
            <Package className={cn("h-5 w-5 shrink-0 transition", pathname.startsWith("/dashboard/seller") ? "text-zinc-500" : "text-white group-hover:text-white")} />
            My Services
          </Link>
        )}

        {isAdmin && (
          <>
            <div className="mt-4 mb-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white-600 hover:cursor-pointer">
              Admin
            </div>
            {adminNavItems.map((item) => {
              const { href, label, icon: Icon, subItems } = item;
              const isReportsSection = href.startsWith("/dashboard/admin/reports");
              const active =
                pathname === href ||
                (href !== "/dashboard/admin" && pathname.startsWith(href + "/")) ||
                (subItems &&
                  subItems.some(
                    (s) =>
                      pathname === s.href ||
                      (s.href.startsWith("/dashboard/admin/reports/income-reports") &&
                        pathname.startsWith("/dashboard/admin/reports/income-reports")) ||
                      (s.href.includes("/customers-income-reports") &&
                        pathname.startsWith(
                          "/dashboard/admin/reports/customers-income-reports",
                        )),
                  ));

              if (subItems) {
                const expanded = isReportsSection ? reportsExpanded : usersExpanded;
                const toggleExpanded = isReportsSection
                  ? () => setReportsExpanded((e) => !e)
                  : () => setUsersExpanded((e) => !e);
                return (
                  <div key={href} className="space-y-0.5 hover:cursor-pointer">
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                        active
                          ? "bg-zinc-50 text-zinc-800"
                          : "text-white hover:bg-green-600 hover:text-white"
                      )}
                    >
                     
                      {Icon && <Icon className={cn("h-5 w-5 shrink-0", active ? "text-zinc-600" : "text-white group-hover:text-white")} />}
                      <span className="flex-1 text-left">{label}</span>  {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 transition hover:cursor-pointer" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 transition hover:cursor-pointer" />
                      )}
                    </button>
                    {expanded && (
                      <div className="ml-0 mt-0.5 space-y-0.5 border-l-1 border-white/30 pl-4">
                        {subItems.map((sub) => {
                          const subActive =
                            sub.href === "/dashboard/admin/reports/income-reports"
                              ? pathname === sub.href
                              : sub.href === "/dashboard/admin/reports/customers-income-reports"
                                ? pathname === sub.href ||
                                  /^\/dashboard\/admin\/reports\/customers-income-reports\/[a-f0-9]{24}$/i.test(
                                    pathname,
                                  )
                                : pathname === sub.href ||
                                  (sub.href.startsWith("/dashboard/admin/reports/income-reports") &&
                                    pathname.startsWith(sub.href));
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              prefetch={false}
                              className={cn(
                                "block rounded-lg py-2.5 px-3 text-sm font-medium leading-snug transition",
                                subActive
                                  ? "bg-emerald-50/95 text-emerald-900 font-semibold"
                                  : "text-white/95 hover:bg-white/15 hover:text-white"
                              )}
                            >
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-zinc-50 text-zinc-800"
                      : "text-white hover:bg-green-600 hover:text-white"
                  )}
                >
                  {Icon && <Icon className={cn("h-5 w-5 shrink-0 transition", active ? "text-zinc-600" : "text-white group-hover:text-white")} />}
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-zinc-200/80 p-3 space-y-0.5">
        {/* <Link
          href="/cart"
          prefetch={false}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          <ShoppingCart className="h-5 w-5 shrink-0 text-zinc-500" />
          Cart
        </Link> */}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-700 hover:cursor-pointer"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
