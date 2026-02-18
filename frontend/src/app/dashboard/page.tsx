"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  IndianRupee,
  BarChart3,
  TrendingUp,
  Users,
  ShoppingCart,
  LogOut,
  Settings2,
  Package,
  Copy,
  Check,
  ExternalLink,
  ShoppingBag,
  UserCircle,
  Gift,
} from "lucide-react";
import { formatINR, formatNumber } from "@/lib/format";
import { useAppSelector } from "@/store/hooks";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import ReferralTreeCard from "./ReferralTreeCard";

type MeResponse = {
  user: {
    id?: string;
    _id?: string;
    email?: string;
    name?: string;
    role: "super_admin" | "admin" | "moderator" | "user";
    referralCode: string;
    parent: string | null;
  };
};

type Service = {
  _id: string;
  name: string;
  price: number;
  businessVolume: number;
  status: string;
};

type Income = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  fromUser?: { name?: string; email?: string; referralCode?: string };
  createdAt: string;
};

type ReferralStats = {
  directLeft: number;
  directRight: number;
  total: number;
  active: number;
  depth: number;
};

export default function DashboardPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const cart = useAppSelector((s) => s.cart);

  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0),
    [incomes]
  );

  // Chart data: Income trend over time
  const incomeChartData = useMemo(() => {
    const grouped = new Map<string, { dateStr: string; date: Date; amount: number }>();
    incomes.forEach((inc) => {
      const date = new Date(inc.createdAt);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const existing = grouped.get(dateStr);
      if (existing) {
        existing.amount += inc.amount ?? 0;
      } else {
        grouped.set(dateStr, { dateStr, date, amount: inc.amount ?? 0 });
      }
    });
    return Array.from(grouped.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-7)
      .map(({ dateStr, amount }) => ({ date: dateStr, amount })); // Last 7 days
  }, [incomes]);

  // Chart data: Network distribution (Left vs Right)
  const networkChartData = useMemo(() => {
    if (!referralStats) return [];
    return [
      { name: "Left", value: referralStats.directLeft, color: "#10b981" },
      { name: "Right", value: referralStats.directRight, color: "#0ea5e9" },
    ];
  }, [referralStats]);

  // Chart data: Income by level
  const incomeByLevelData = useMemo(() => {
    const levelMap = new Map<number, number>();
    incomes.forEach((inc) => {
      const level = inc.level ?? 0;
      levelMap.set(level, (levelMap.get(level) || 0) + (inc.amount ?? 0));
    });
    return Array.from(levelMap.entries())
      .map(([level, amount]) => ({ level: `L${level}`, amount }))
      .sort((a, b) => parseInt(a.level.slice(1)) - parseInt(b.level.slice(1)));
  }, [incomes]);

  const loadAll = useCallback(async () => {
    setError(null);
    setDataLoading(true);
    try {
      const [meRes, servicesRes, incomeRes, referralsRes, purchasesRes] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/services"),
        apiFetch("/api/income"),
        apiFetch("/api/referrals?depth=5"),
        apiFetch("/api/purchases"),
      ]);

      const meBody = await readApiBody(meRes);
      const meJson = meBody.json as { user?: MeResponse["user"]; error?: string };
      if (!meRes.ok) throw new Error(meJson?.error ?? (meBody.text as string) ?? "Not logged in");
      setMe(meJson.user ?? null);

      const servicesBody = await readApiBody(servicesRes);
      const servicesData = servicesBody.json as { services?: Service[] };
      setServices(servicesData?.services ?? []);

      const incomeBody = await readApiBody(incomeRes);
      const incomeData = incomeBody.json as { incomes?: Income[] };
      setIncomes(incomeData?.incomes ?? []);

      const refBody = await readApiBody(referralsRes);
      const refData = refBody.json as { stats?: ReferralStats };
      setReferralStats(refData?.stats ?? null);

      const purchBody = await readApiBody(purchasesRes);
      const purchData = purchBody.json as { purchases?: unknown[] };
      setPurchaseCount(Array.isArray(purchData?.purchases) ? purchData.purchases.length : 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    loadAll();
  }, [authLoading, loadAll]);

  const logout = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      showSuccessToast("Logged out successfully");
      window.location.href = "/login";
    } catch {
      showErrorToast("Failed to logout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyReferralCode = () => {
    const code = me?.referralCode ?? "";
    if (!code) return;
    navigator.clipboard.writeText(code).then(
      () => {
        setCopiedCode(true);
        showSuccessToast("Referral code copied");
        setTimeout(() => setCopiedCode(false), 2000);
      },
      () => showErrorToast("Could not copy")
    );
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-zinc-600">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error && !me) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
        <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
          <div className="mt-5 rounded-2xl border border-red-200 bg-white p-6 text-sm text-red-700 shadow-sm">
            {error} —{" "}
            <Link prefetch={false} className="font-medium underline hover:text-red-800" href="/login">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = me?.name || me?.email || "Member";
  const isAdmin = ["super_admin", "admin", "moderator"].includes(me?.role ?? "");

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              {isAdmin && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  {me?.role === "super_admin" ? "Super Admin" : me?.role === "admin" ? "Admin" : "Moderator"}
                </span>
              )}{" "}
              {me?.email && <span className="text-zinc-500">{me.email}</span>}
            </p>
            {me?.referralCode && (
          <div className="mt-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h5 className="text-lg font-semibold text-zinc-900">Your referral code</h5>
                <p className="text-[10px]">Share this code when someone joins — you earn when they purchase.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-xl border border-emerald-200 bg-white px-2 py-1 font-mono text-sm font-bold text-emerald-800 shadow-sm">
                  {me.referralCode}
                </code>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-2 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
            
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isAdmin && (
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                prefetch={false}
                href="/admin"
              >
                <Settings2 className="h-4 w-4" />
                Admin Panel
              </Link>
            )}
            <Link
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              prefetch={false}
              href="/cart"
            >
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              Cart <span className="text-zinc-500">({cart.totalQuantity})</span>
            </Link>
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
              onClick={logout}
              disabled={busy}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Referral code card - primary CTA for sharing */}
        {/* {me?.referralCode && (
          <section className="mb-8 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-sky-50/80 p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Your referral code</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Share this code when someone joins — you earn when they purchase.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-xl border border-emerald-200 bg-white px-4 py-3 font-mono text-lg font-semibold text-emerald-800 shadow-sm">
                  {me.referralCode}
                </code>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy code
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        )} */}

        {error && me && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}

        {/* Earn commission - prominent callout */}
        <section className="mb-8 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Earn commission</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  You earn when your referrals purchase. Commission is distributed by BV: Level 1 → 5%, Level 2 → 2.5%, Level 3 → 1.25%, Level 4 → 0.625%, Level 5+ → 50% of previous.
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Share your referral code — every order from your network generates commission for you.
                </p>
              </div>
            </div>
            <Link
              prefetch={false}
              href="/services"
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-50"
            >
              Browse services
            </Link>
          </div>
        </section>

        {/* Stats row */}
        <section className="mb-10">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Overview
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Team / Network */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-900">Team / Network</h4>
                  <p className="text-xs text-zinc-600">Your referral downline</p>
                </div>
              </div>
              {dataLoading ? (
                <div className="space-y-2">
                  <div className="h-6 w-20 rounded bg-zinc-200 animate-pulse" />
                  <div className="h-4 w-full rounded bg-zinc-100 animate-pulse" />
                </div>
              ) : referralStats ? (
                <>
                  <p className="text-2xl text-zinc-900">
                    {formatNumber(referralStats.total)} <span className="text-base font-normal text-zinc-500">total</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs mb-4">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">
                      L: {referralStats.directLeft} · R: {referralStats.directRight}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      {referralStats.active} active
                    </span>
                  </div>
                  {networkChartData.length > 0 && referralStats.directLeft + referralStats.directRight > 0 && (
                    <div className="mt-4 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={networkChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {networkChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend
                            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                            iconType="circle"
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-zinc-500">No referrals yet</p>
              )}
            </div>

            {/* Total income */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-teal-600 text-white shadow-sm">
                  <IndianRupee className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-900">Total income</h4>
                  <p className="text-xs text-zinc-600">Commission earned from referrals</p>
                </div>
              </div>
              {dataLoading ? (
                <div className="h-9 w-28 rounded bg-zinc-200 animate-pulse" />
              ) : (
                <>
                  <p className="text-2xl tracking-tight text-emerald-700 mb-4">
                    {formatINR(totalIncome)}
                  </p>
                  {incomeChartData.length > 0 ? (
                    <div className="h-32 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={incomeChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis
                            dataKey="date"
                            stroke="#71717a"
                            fontSize={10}
                            tick={{ fill: "#71717a" }}
                          />
                          <YAxis
                            stroke="#71717a"
                            fontSize={10}
                            tick={{ fill: "#71717a" }}
                            tickFormatter={(value) => `₹${value}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#fff",
                              border: "1px solid #e4e4e7",
                              borderRadius: "8px",
                              fontSize: "11px",
                            }}
                            formatter={(value: number | undefined) => formatINR(value ?? 0)}
                          />
                          <Line
                            type="monotone"
                            dataKey="amount"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: "#10b981", r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 mt-2">No income data yet</p>
                  )}
                </>
              )}
            </div>

            {/* Quick stats */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-sky-600 text-white shadow-sm">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-900">Activity</h4>
                  <p className="text-xs text-zinc-600">Counts</p>
                </div>
              </div>
              {dataLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-5 w-full rounded bg-zinc-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Income entries</span>
                    <span className="font-medium text-zinc-900">{incomes.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Services available</span>
                    <span className="font-medium text-zinc-900">{services.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600">Your purchases</span>
                    <span className="font-medium text-zinc-900">{purchaseCount}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions card */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                  <ExternalLink className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-zinc-900">Quick actions</h4>
                  <p className="text-xs text-zinc-600">Go to</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link
                  prefetch={false}
                  href="/services"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
                >
                  <Package className="h-4 w-4" />
                  Browse services
                </Link>
                <Link
                  prefetch={false}
                  href="/orders"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
                >
                  <ShoppingBag className="h-4 w-4" />
                  My orders
                </Link>
                <Link
                  prefetch={false}
                  href="/referrals"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
                >
                  <Users className="h-4 w-4" />
                  Referral tree
                </Link>
                <Link
                  prefetch={false}
                  href="/account"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
                >
                  <UserCircle className="h-4 w-4" />
                  Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Referral tree */}
        <section className="mb-10">
          <ReferralTreeCard onOpenFullTree={() => (window.location.href = "/referrals")} />
        </section>

        {/* Income history */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-teal-600 text-white shadow-sm">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Income history</h2>
                <p className="text-xs text-zinc-600">Commission earned from your referrals&apos; orders</p>
              </div>
            </div>
            <Link
              prefetch={false}
              href="/referrals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
            >
              View referral tree
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 overflow-auto rounded-2xl border border-zinc-200">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">BV</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-zinc-200">
                      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-10 rounded bg-zinc-100 animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-zinc-100 animate-pulse" /></td>
                      <td className="px-4 py-3 text-right"><div className="ml-auto h-4 w-16 rounded bg-zinc-100 animate-pulse" /></td>
                    </tr>
                  ))
                ) : incomes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                      <TrendingUp className="mx-auto mb-2 h-10 w-10 text-zinc-300" />
                      <p>No income yet. When your referrals make purchases, earnings appear here.</p>
                      <Link prefetch={false} href="/services" className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline">
                        Browse services →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  incomes.map((inc) => (
                    <tr
                      key={inc._id}
                      className="border-t border-zinc-200 transition hover:bg-zinc-50/80"
                    >
                      <td className="px-4 py-3 text-zinc-800">
                        {new Date(inc.createdAt).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {inc.fromUser?.name? <span className="text-zinc-500 text-bold">{inc.fromUser?.name+", "}</span> : ''}
                         {inc.fromUser?.email ? <span className="text-zinc-500 text-[13px]">{inc.fromUser?.email}</span> : ''}
                        {/* {inc.fromUser?.referralCode ? <span className="text-zinc-500">{inc.fromUser?.referralCode}</span> : ''} */}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                          L{inc.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-900">{formatNumber(inc.bv)}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-700">
                        {formatINR(inc.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
