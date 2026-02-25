"use client";

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
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/referrals", label: "Referrals", icon: Network },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/kyc", label: "KYC", icon: FileCheck },
];

const adminNavItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard/admin", label: "Admin Overview", icon: Shield },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  // { href: "/dashboard/admin/sellers", label: "Sellers", icon: Store },
  { href: "/dashboard/admin/services", label: "Services", icon: Package },
  { href: "/dashboard/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/admin/service-approval", label: "Service Approval", icon: CheckSquare },
  { href: "/dashboard/admin/slider", label: "Slider", icon: ImageIcon },
  { href: "/dashboard/admin/payment-settings", label: "Payment Settings", icon: CreditCard },
  { href: "/dashboard/admin/kyc", label: "KYC", icon: FileCheck },
  { href: "/dashboard/admin/contacts", label: "Contacts", icon: Mail },
  { href: "/dashboard/admin/rules", label: "Rules", icon: Scale },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = ["super_admin", "admin", "moderator"].includes((user as { role?: string })?.role ?? "");
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
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200/80 bg-white/90 shadow-sm">
      <div className="flex h-12 items-center border-b border-zinc-200/80 px-4">
        <Link
          href="/dashboard"
          className="text-sm font-semibold tracking-tight text-zinc-900 hover:text-emerald-700"
          prefetch={false}
        >
          Dashboard
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-emerald-600" : "text-zinc-500")} />
              {label}
            </Link>
          );
        })}

        {isSellerApproved && (
          <Link
            href="/dashboard/seller/services"
            prefetch={false}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname.startsWith("/dashboard/seller")
                ? "bg-emerald-50 text-emerald-800"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <Package className="h-5 w-5 shrink-0 text-zinc-500" />
            My Services
          </Link>
        )}

        {isAdmin && (
          <>
            <div className="mt-4 mb-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-600">
              Admin
            </div>
            {adminNavItems.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard/admin" && pathname.startsWith(href + "/"));
              return (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-violet-50 text-violet-800"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active ? "text-violet-600" : "text-zinc-500")} />
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
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  );
}
