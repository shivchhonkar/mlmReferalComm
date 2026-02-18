"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINR, formatNumber } from "@/lib/format";
import {
  Settings,
  List,
  Users,
  BarChart3,
  Mail,
  Image as ImageIcon,
  UserCheck,
  FolderOpen,
  CreditCard,
  FileCheck,
  ArrowLeft,
  LayoutDashboard,
  Package,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type DashboardStats = {
  totalUsers: number;
  totalBVGenerated: number;
  totalIncomeDistributed: number;
  activeServices: number;
};

type AdminSection = {
  title: string;
  cards: {
    href: string;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
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
      return {
        title: "Super Admin Panel",
        badgeText: "Super Admin",
        description: "Full system access and control.",
      };
    }
    if (role === "admin") {
      return {
        title: "Admin Panel",
        badgeText: "Admin",
        description: "Manage your platform settings and configurations.",
      };
    }
    return {
      title: "Admin Panel",
      badgeText: "Moderator",
      description: "Manage your platform settings and configurations.",
    };
  };

  const roleDisplay = getRoleDisplay();

  const sections: AdminSection[] = [
    {
      title: "Overview & Analytics",
      cards: [
        {
          href: "/admin/analytics",
          title: "Analytics Dashboard",
          desc: "View comprehensive platform analytics and insights",
          icon: BarChart3,
        },
      ],
    },
    {
      title: "Users & Compliance",
      cards: [
        { href: "/admin/users", title: "User Management", desc: "Create, manage and monitor user accounts and roles", icon: Users },
        // { href: "/admin/service-approval", title: "Service Approval", desc: "Review and approve or reject service listings", icon: UserCheck },
        { href: "/admin/kyc", title: "KYC Management", desc: "Review and approve user KYC submissions", icon: FileCheck },
      ],
    },
    {
      title: "Catalog & Content",
      cards: [
        { href: "/admin/services", title: "Services", desc: "Create and manage services, pricing and business volume", icon: Package },
        { href: "/admin/categories", title: "Categories & Subcategories", desc: "Manage service categories and subcategories", icon: FolderOpen },
        { href: "/admin/slider", title: "Manage Sliders", desc: "Control home page slider images and content", icon: ImageIcon },
      ],
    },
    {
      title: "Business & Support",
      cards: [
        { href: "/admin/rules", title: "Distribution Rules", desc: "Configure commission rules and distribution percentages", icon: List },
        { href: "/admin/payment-settings", title: "Payment Settings", desc: "Configure payment links and UPI settings", icon: CreditCard },
        { href: "/admin/contacts", title: "Contact Submissions", desc: "View and manage contact form submissions", icon: Mail },
      ],
    },
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-zinc-600">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 text-white">
                <Settings className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-800">{roleDisplay.badgeText}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              {roleDisplay.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">{roleDisplay.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              View as User
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Site
            </Link>
          </div>
        </div>

        {/* Quick Overview - real data */}
        <section className="mb-12 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50">
                <BarChart3 className="h-5 w-5 text-emerald-700" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">Quick Overview</h2>
            </div>
            {!statsLoading && (statsError || stats) && (
              <button
                type="button"
                onClick={loadDashboardStats}
                disabled={statsLoading}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {statsLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                  <div className="mx-auto mb-2 h-9 w-9 rounded-lg bg-zinc-200 animate-pulse" />
                  <div className="mx-auto h-3 w-20 rounded bg-zinc-200 animate-pulse" />
                  <div className="mt-3 h-8 w-16 rounded bg-zinc-200 animate-pulse" />
                </div>
              ))}
            </div>
          ) : statsError ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/50 p-8 text-center">
              <AlertCircle className="mx-auto mb-2 h-10 w-10 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Could not load overview</p>
              <p className="mt-1 text-xs text-amber-700">{statsError}</p>
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                <Users className="mx-auto mb-2 h-9 w-9 text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Total Users</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatNumber(stats.totalUsers)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                <Package className="mx-auto mb-2 h-9 w-9 text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Active Services</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatNumber(stats.activeServices)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                <BarChart3 className="mx-auto mb-2 h-9 w-9 text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Total BV Generated</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatNumber(stats.totalBVGenerated)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
                <TrendingUp className="mx-auto mb-2 h-9 w-9 text-emerald-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Income Distributed</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900">{formatINR(stats.totalIncomeDistributed)}</p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Sectioned cards */}
        {sections.map((section) => (
          <section key={section.title} className="mb-12">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((c) => {
                const Icon = c.icon;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className="group rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-5 flex items-start justify-between">
                      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-3">
                        <Icon className="h-6 w-6 text-emerald-700" />
                      </div>
                      <span className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200 transition group-hover:bg-white">
                        Open →
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-zinc-900">{c.title}</h4>
                    <p className="mt-2 text-sm text-zinc-600">{c.desc}</p>
                    <div className="mt-6 h-1 w-full rounded-full bg-gradient-to-r from-emerald-200/70 via-teal-200/70 to-sky-200/70 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
