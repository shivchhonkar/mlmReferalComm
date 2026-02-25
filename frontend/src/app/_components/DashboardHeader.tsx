"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
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
  FolderOpen,
  BarChart3,
  CheckSquare,
  Image as ImageIcon,
  CreditCard,
  Mail,
  Scale,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useAppSelector } from "@/store/hooks";
import ProfileSection from "./ProfileSection";

const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  { href: "/dashboard/referrals", label: "Referrals", icon: Network },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/kyc", label: "KYC", icon: FileCheck },
];

const adminNavItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/dashboard/admin", label: "Admin", icon: Shield },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/services", label: "Services", icon: Package },
  { href: "/dashboard/admin/categories", label: "Categories", icon: FolderOpen },
  { href: "/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/admin/service-approval", label: "Approval", icon: CheckSquare },
  { href: "/dashboard/admin/slider", label: "Slider", icon: ImageIcon },
  { href: "/dashboard/admin/payment-settings", label: "Payments", icon: CreditCard },
  { href: "/dashboard/admin/kyc", label: "KYC", icon: FileCheck },
  { href: "/dashboard/admin/contacts", label: "Contacts", icon: Mail },
  { href: "/dashboard/admin/rules", label: "Rules", icon: Scale },
];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function DashboardHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const cartCount = useAppSelector((s) => s.cart.totalQuantity);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = ["super_admin", "admin", "moderator"].includes((user as { role?: string })?.role ?? "");
  const isSellerApproved =
    (user as { isSeller?: boolean; sellerStatus?: string })?.isSeller === true &&
    (user as { sellerStatus?: string })?.sellerStatus === "approved";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <Link className="flex items-center gap-2" href="/dashboard" prefetch={false}>
            <div className="relative h-9 w-[100px] sm:w-[110px]">
              <Image
                src="/brand/logo.png"
                alt="Sambhariya Marketing"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            {/* <span className="hidden text-sm font-semibold text-zinc-700 sm:inline">Dashboard</span> */}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {/* {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  isActive(href)
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))} */}
            {/* {isSellerApproved && (
              <Link
                href="/dashboard/seller/services"
                prefetch={false}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                  pathname.startsWith("/dashboard/seller")
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <Package className="h-4 w-4 shrink-0" />
                My Services
              </Link>
            )}
            {isAdmin && (
              <>
                <div className="mx-2 h-4 w-px bg-zinc-200" />
                {adminNavItems.slice(0, 4).map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive(href)
                        ? "bg-sky-50 text-sky-700"
                        : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                ))}
              </>
            )} */}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2">
            {/* <Link
              prefetch={false}
              className="relative p-2 rounded-lg hover:bg-zinc-100 transition-colors"
              href="/cart"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-zinc-600" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold px-1">
                  {cartCount}
                </span>
              )}
            </Link> */}
            {/* <Link
              prefetch={false}
              className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
              href="/services"
            >
              Services
            </Link> */}
            <ProfileSection />
          </div>

          {/* Mobile: Hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <Link
              prefetch={false}
              className="relative p-2 rounded-lg hover:bg-zinc-100"
              href="/cart"
              title="Cart"
            >
              <ShoppingCart className="w-5 h-5 text-zinc-600" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-zinc-100"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 bg-white">
          <nav className="px-4 py-4 space-y-1 max-h-[70vh] overflow-y-auto">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                  isActive(href) ? "bg-emerald-50 text-emerald-700" : "text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            ))}
            {isSellerApproved && (
              <Link
                href="/dashboard/seller/services"
                prefetch={false}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                  pathname.startsWith("/dashboard/seller")
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <Package className="h-5 w-5 shrink-0" />
                My Services
              </Link>
            )}
            {isAdmin && (
              <>
                <div className="pt-3 mt-3 border-t border-zinc-200">
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Admin</p>
                </div>
                {adminNavItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium",
                      isActive(href) ? "bg-sky-50 text-sky-700" : "text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </Link>
                ))}
              </>
            )}
            <div className="pt-3 mt-3 border-t border-zinc-200 space-y-1">
              <Link
                href="/services"
                prefetch={false}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Services
              </Link>
              <div className="px-4 py-2">
                <ProfileSection />
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
