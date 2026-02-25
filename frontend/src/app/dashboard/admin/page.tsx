"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINR, formatNumber } from "@/lib/format";
import {
  Settings,
  Users,
  BarChart3,
  Mail,
  Image as ImageIcon,
  FolderOpen,
  CreditCard,
  FileCheck,
  ArrowLeft,
  LayoutDashboard,
  Package,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Shield,
  Store,
  Cog,
  Headphones,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type DashboardStats = {
  totalUsers: number;
  totalBVGenerated: number;
  totalIncomeDistributed: number;
  activeServices: number;
};

type AdminSection = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "sky" | "amber" | "violet";
  cards: {
    href: string;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
};

const accentStyles = {
  emerald: {
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    border: "border-emerald-200/50",
    cardHover: "hover:border-emerald-300 hover:bg-emerald-50/30",
  },
  sky: {
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
    border: "border-sky-200/50",
    cardHover: "hover:border-sky-300 hover:bg-sky-50/30",
  },
  amber: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    border: "border-amber-200/50",
    cardHover: "hover:border-amber-300 hover:bg-amber-50/30",
  },
  violet: {
    iconBg: "bg-violet-100",
    iconColor: "text-violet-700",
    border: "border-violet-200/50",
    cardHover: "hover:border-violet-300 hover:bg-violet-50/30",
  },
};

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth({ requireAdmin: true });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadDashboardStats = useCallback(async () => {
    setStatsError(null);
    setStatsLoading(true);
    try {
      const res = await apiFetch("/api/admin/dashboard");
      const body = await readApiBody(res);
      if (!res.ok) {
        const err = (body.json as { error?: string })?.error ?? body.text ?? "Failed to load stats";
        setStatsError(err);
        setStats(null);
        return;
      }
      const data = body.json as DashboardStats;
      setStats(data);
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : "Network error");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDashboardStats();
  }, [user, loadDashboardStats]);

  const getRoleDisplay = () => {
    const role = (user as { role?: string })?.role;
    if (role === "super_admin") {
      return { title: "Super Admin Panel", badgeText: "Super Admin", description: "Full system access and control." };
    }
    if (role === "admin") {
      return { title: "Admin Panel", badgeText: "Admin", description: "Manage your platform settings and configurations." };
    }
    return { title: "Admin Panel", badgeText: "Moderator", description: "Manage your platform settings and configurations." };
  };

  const roleDisplay = getRoleDisplay();

  const sections: AdminSection[] = [
    {
      id: "analytics",
      title: "Analytics & Overview",
      description: "Platform metrics and performance insights",
      icon: BarChart3,
      accent: "emerald",
      cards: [
        { href: "/admin/analytics", title: "Analytics Dashboard", desc: "View comprehensive platform analytics, charts and trends", icon: BarChart3 },
      ],
    },
    {
      id: "users",
      title: "Users & Compliance",
      description: "Manage members, sellers and KYC verification",
      icon: Shield,
      accent: "sky",
      cards: [
        { href: "/admin/users", title: "Users & Sellers", desc: "Manage user accounts, roles, and seller applications", icon: Users },
        { href: "/admin/kyc", title: "KYC Management", desc: "Review and verify user KYC submissions", icon: FileCheck },
      ],
    },
    {
      id: "catalog",
      title: "Catalog & Content",
      description: "Services, categories and marketing content",
      icon: Store,
      accent: "violet",
      cards: [
        { href: "/admin/services", title: "Services", desc: "Create, edit and approve services. Manage pricing & BV", icon: Package },
        { href: "/admin/categories", title: "Categories", desc: "Manage service categories and subcategories", icon: FolderOpen },
        { href: "/admin/slider", title: "Sliders", desc: "Home page slider images and promotional content", icon: ImageIcon },
      ],
    },
    {
      id: "business",
      title: "Business & Support",
      description: "Commission rules, payments and customer inquiries",
      icon: Headphones,
      accent: "amber",
      cards: [
        { href: "/admin/rules", title: "Distribution Rules", desc: "Configure commission and BV distribution rules", icon: Cog },
        { href: "/admin/payment-settings", title: "Payment Settings", desc: "Payment links, UPI and checkout options", icon: CreditCard },
        { href: "/admin/contacts", title: "Contact Submissions", desc: "View and respond to contact form messages", icon: Mail },
      ],
    },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-slate-600">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{roleDisplay.title}</h1>
              <p className="text-xs text-slate-500">{roleDisplay.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline">
              {roleDisplay.badgeText}
            </span>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Site</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">Platform Overview</h2>
            {!statsLoading && (statsError || stats) && (
              <button
                type="button"
                onClick={loadDashboardStats}
                disabled={statsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-5">
                  <div className="mb-3 h-9 w-9 rounded-lg bg-slate-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                  <div className="mt-2 h-7 w-16 rounded bg-slate-200 animate-pulse" />
                </div>
              ))}
            </div>
          ) : statsError ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/50 py-12 text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Could not load overview</p>
              <p className="mt-1 max-w-sm text-xs text-amber-700">{statsError}</p>
              <button
                type="button"
                onClick={loadDashboardStats}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-slate-200">
                <Users className="mb-3 h-8 w-8 text-emerald-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Users</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(stats.totalUsers)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-slate-200">
                <Package className="mb-3 h-8 w-8 text-sky-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Services</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(stats.activeServices)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-slate-200">
                <BarChart3 className="mb-3 h-8 w-8 text-violet-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">BV Generated</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatNumber(stats.totalBVGenerated)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-slate-200">
                <TrendingUp className="mb-3 h-8 w-8 text-amber-600" />
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Income Distributed</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatINR(stats.totalIncomeDistributed)}</p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Grouped sections */}
        <div className="space-y-8">
          {sections.map((section) => {
            const StyleIcon = section.icon;
            const accent = accentStyles[section.accent];
            return (
              <section
                key={section.id}
                className={`rounded-2xl border ${accent.border} bg-white shadow-sm`}
              >
                <div className="border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconColor}`}>
                      <StyleIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{section.title}</h3>
                      <p className="text-xs text-slate-500">{section.description}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-3">
                  {section.cards.map((c) => {
                    const CardIcon = c.icon;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`group flex items-start gap-4 bg-white p-6 transition ${accent.cardHover}`}
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.iconBg} ${accent.iconColor}`}>
                          <CardIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-slate-900 group-hover:text-emerald-700">{c.title}</h4>
                          <p className="mt-0.5 text-sm text-slate-500">{c.desc}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
