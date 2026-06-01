"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  Clock,
  Store,
  AlertCircle,
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

import ReferralsListView from "./components/ReferralsListView";

type MeResponse = {
  user: {
    id?: string;
    _id?: string;
    email?: string;
    name?: string;
    role: "super_admin" | "admin" | "moderator" | "user";
    referralCode: string;
    sellerStatus: "pending" | "rejected" | "approved";
    isSeller: boolean;
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

const INCOME_HISTORY_ROW_GRID =
  "grid grid-cols-[minmax(112px,1fr)_minmax(160px,1.6fr)_minmax(52px,0.45fr)_minmax(64px,0.55fr)_minmax(88px,0.75fr)] gap-x-2 items-center";

type IncomeSummary = {
  totalEarnedAmount: number;
  withdrawalAmount: number;
  lifetimeWithdrawalCap: number | null;
  maxCumulativeWithdrawalAllowed: number;
  totalWithdrawn: number;
  totalPendingWithdrawals: number;
  nonWithdrawableEarnings: number;
};

type ReferralStats = {
  directCount: number;
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
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummary | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [pendingSellers, setPendingSellers] = useState<unknown[]>([]);
  const [showAllIncomeModal, setShowAllIncomeModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const incomeHistoryScrollRef = useRef<HTMLDivElement>(null);

  const incomeHistoryVirtualizer = useVirtualizer({
    count: incomes.length,
    getScrollElement: () => incomeHistoryScrollRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  const formatINRPrecise = useCallback((value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  }, []);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0),
    [incomes]
  );

  const totalEarnedDisplay = incomeSummary?.totalEarnedAmount ?? totalIncome;

  const maxWithdrawable = incomeSummary?.withdrawalAmount ?? 0;

  const parsedWithdrawAmount = Number(withdrawAmount);
  const isWithdrawAmountValid =
    Number.isFinite(parsedWithdrawAmount) &&
    parsedWithdrawAmount > 0 &&
    parsedWithdrawAmount <= maxWithdrawable + 1e-9;

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

  // Chart data: Network distribution (Direct referrals)
  const networkChartData = useMemo(() => {
    if (!referralStats) return [];
    const direct = referralStats.directCount ?? referralStats.directLeft + referralStats.directRight;
    if (direct === 0) return [];
    return [{ name: "Direct referrals", value: direct, color: "#10b981" }];
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

  const allLevelUserIncome = useMemo(() => {
    const byLevel = new Map<number, Map<string, { id: string; name: string; amount: number }>>();
    const allLevels = new Set<number>();

    incomes.forEach((inc) => {
      const lvl = inc.level ?? 0;
      if (lvl < 1) return;
      allLevels.add(lvl);

      const fu = inc.fromUser ?? {};
      const id = fu.referralCode || fu.email || fu.name || "unknown";
      const name = fu.name || fu.email || fu.referralCode || "Unknown";

      if (!byLevel.has(lvl)) byLevel.set(lvl, new Map());
      const levelMap = byLevel.get(lvl)!;
      const existing = levelMap.get(id) ?? { id, name, amount: 0 };
      existing.amount += inc.amount ?? 0;
      levelMap.set(id, existing);
    });

    const sortedLevels = Array.from(allLevels).sort((a, b) => a - b);
    const levelsToRender = sortedLevels.length > 0 ? sortedLevels : [1, 2, 3, 4, 5];

    return levelsToRender.map((lvl) => {
      const users = Array.from(byLevel.get(lvl)?.values() ?? []);
      users.sort((a, b) => b.amount - a.amount);
      return { level: lvl, users };
    });
  }, [incomes]);

  const topFiveLevelIncome = useMemo(() => {
    const byLevel = new Map(allLevelUserIncome.map((entry) => [entry.level, entry]));
    return [1, 2, 3, 4, 5].map((level) => byLevel.get(level) ?? { level, users: [] });
  }, [allLevelUserIncome]);

  const loadAll = useCallback(async () => {
    setError(null);
    setDataLoading(true);
    try {
      const [meRes, servicesRes, incomeRes, referralsRes, purchasesRes, pendingSellersRes] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/services"),
        apiFetch("/api/income"),
        apiFetch("/api/referrals?depth=5"),
        apiFetch("/api/purchases"),
        apiFetch("/api/requests/pending-sellers"),
      ]);

      const meBody = await readApiBody(meRes);
      const meJson = meBody.json as { user?: MeResponse["user"]; error?: string };
      if (!meRes.ok) throw new Error(meJson?.error ?? (meBody.text as string) ?? "Not logged in");
      setMe(meJson.user ?? null);

      const pendingSellersBody = await readApiBody(pendingSellersRes);

      const pendingSellersData = pendingSellersBody.json as { pendingSellers?: unknown[] };
      setPendingSellers(pendingSellersData?.pendingSellers ?? []);

      const servicesBody = await readApiBody(servicesRes);
      const servicesData = servicesBody.json as { services?: Service[] };
      setServices(servicesData?.services ?? []);

      const incomeBody = await readApiBody(incomeRes);
      const incomeData = incomeBody.json as { incomes?: Income[]; summary?: IncomeSummary };
      setIncomes(incomeData?.incomes ?? []);
      setIncomeSummary(incomeData?.summary ?? null);

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

  const submitWithdrawalRequest = async () => {
    const available = maxWithdrawable;
    const amt = Number(withdrawAmount);
    if (!isWithdrawAmountValid) {
      showErrorToast(
        available <= 0
          ? "No withdrawal amount available"
          : `Enter an amount greater than 0 and up to ${formatINRPrecise(available)}`,
      );
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const body = await readApiBody(res);
      const data = body.json as {
        error?: string | { formErrors?: string[] };
        summary?: IncomeSummary;
      };
      if (!res.ok) {
        const err = data?.error;
        const errMsg =
          typeof err === "string"
            ? err
            : err && typeof err === "object" && Array.isArray(err.formErrors)
              ? err.formErrors[0] ?? "Request failed"
              : "Request failed";
        throw new Error(errMsg);
      }
      if (data.summary) setIncomeSummary(data.summary);
      showSuccessToast("Withdrawal request submitted. Admin will review and pay.");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      await loadAll();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
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

  const handleBecomeSeller = async () => {
    try {
      const response = await apiFetch("/api/requests/seller", { method: "POST" });
      const responseBody = await readApiBody(response);
      const data = responseBody.json as { error?: string };
      if (!response.ok) throw new Error(data?.error ?? responseBody.text ?? "Failed to submit seller request");
      showSuccessToast("Request sent for approval. You can manage services once approved.");
      await loadAll();
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : "Failed to submit seller request");
    }
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
            <Link prefetch={false} className="font-medium underline hover:text-red-800 hover:cursor-pointer" href="/login">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = me?.name || me?.email || "Member";
  const isAdmin = ["super_admin", "admin", "moderator"].includes(me?.role ?? "");
  const sellerStatus = me?.sellerStatus;
  const isSellerPending = sellerStatus === "pending";
  const isSellerApproved = me?.isSeller === true && sellerStatus === "approved";
  const isSellerRejected = sellerStatus === "rejected";
  const hasNotRequestedSeller = !isSellerPending && !isSellerRejected && !isSellerApproved;

  return (
    <div className="min-h-screen ">
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
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-600 px-2 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 hover:cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 hover:cursor-pointer" />
                      Copy code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
            
          </div>
          <div className="flex max-w-full flex-nowrap items-center justify-end gap-2 overflow-x-auto">
            {!isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setWithdrawAmount(maxWithdrawable > 0 ? String(maxWithdrawable) : "");
                  setShowWithdrawModal(true);
                }}
                disabled={busy || dataLoading || maxWithdrawable <= 0}
                title={
                  maxWithdrawable <= 0
                    ? "No withdrawal amount available"
                    : `Request up to ${formatINRPrecise(maxWithdrawable)}`
                }
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:bg-sky-50 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:py-2.5"
              >
                <IndianRupee className="h-4 w-4 shrink-0" />
                Request withdrawal
              </button>
            ) : null}
            {isAdmin ? (
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 hover:cursor-pointer"
                prefetch={false}
                href="/dashboard/admin"
              >
                <Settings2 className="h-4 w-4" />
                Admin Panel
              </Link>
            ) : isSellerApproved ? (
              <Link
                prefetch={false}
                href="dashboard/seller/services"
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 hover:cursor-pointer sm:px-4 sm:py-2.5"
              >
                <Package className="h-4 w-4 shrink-0" />
                Manage services
              </Link>
            ) : isSellerPending ? (
              <span
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 sm:px-4 sm:py-2.5"
                title="Admin will review your request"
              >
                <Package className="h-4 w-4 shrink-0 text-amber-600" />
                Seller pending
              </span>
            ) : isSellerRejected ? (
              <button
                type="button"
                onClick={handleBecomeSeller}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 hover:cursor-pointer disabled:opacity-60 sm:px-4 sm:py-2.5"
              >
                <Package className="h-4 w-4 shrink-0" />
                Re-request seller
              </button>
            ) : hasNotRequestedSeller ? (
              <button
                type="button"
                onClick={handleBecomeSeller}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-50 hover:cursor-pointer sm:px-4 sm:py-2.5"
              >
                <Package className="h-4 w-4 shrink-0" />
                Become a Seller
              </button>
            ) : null}
            {/* <Link
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              prefetch={false}
              href="/cart"
            >
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              Cart <span className="text-zinc-500">({cart.totalQuantity})</span>
            </Link> */}
            <button
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60 hover:cursor-pointer sm:px-4 sm:py-2.5"
              onClick={logout}
              disabled={busy}
              type="button"
            >
              <LogOut className="h-4 w-4 shrink-0" />
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
                  You earn when your referrals purchase. Commission is distributed by BV: Level 1 → 10%, Level 2 → 5%, Level 3 → 2.5%, Level 4 → 1.25%, Level 5+ → 50% of previous.
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Share your referral code — every order from your network generates commission for you.
                </p>
              </div>
            </div>
            {isSellerApproved && <Link
              prefetch={false}
              href="/dashboard/seller/services"
              className="shrink-0 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-50 hover:cursor-pointer"
            >
              Browse services
            </Link>}
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
                      Direct: {referralStats.directCount ?? referralStats.directLeft + referralStats.directRight}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      {referralStats.active} active
                    </span>
                  </div>
                  {networkChartData.length > 0 && (referralStats.directCount ?? referralStats.directLeft + referralStats.directRight) > 0 && (
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
                  <h4 className="text-base font-semibold text-zinc-900">Referral earnings</h4>
                  {/* <p className="text-xs text-zinc-600">Total earned (uncapped) and amount you can withdraw now</p> */}
                </div>
              </div>
              {dataLoading ? (
                <div className="h-9 w-28 rounded bg-zinc-200 animate-pulse" />
              ) : (
                <>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total earned</p>
                  <p className="text-2xl tracking-tight text-emerald-700 mb-3">
                    {formatINRPrecise(totalEarnedDisplay)}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Withdrawal amount</p>
                  <p className="text-lg tracking-tight text-sky-800 mb-1">
                    {formatINRPrecise(incomeSummary?.withdrawalAmount ?? 0)}
                  </p>
                  {incomeSummary != null && incomeSummary.nonWithdrawableEarnings > 0 ? (
                    <p className="text-[11px] text-zinc-500 mb-3">
                      {formatINRPrecise(incomeSummary.nonWithdrawableEarnings)} is not withdrawable under per-leg caps
                      but remains recorded as earned.
                    </p>
                  ) : (
                    <p className="text-[11px] text-zinc-500 mb-3">
                      {/* Earnings are uncapped; withdrawals follow your plan limit (staff roles have no limit). */}
                    </p>
                  )}
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
                {isSellerApproved && <Link
                  prefetch={false}
                  href="/dashboard/seller/services"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 hover:cursor-pointer"
                >
                  <Package className="h-4 w-4" />
                  Browse services
                </Link>}
                <Link
                  prefetch={false}
                  href="/dashboard/orders"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 hover:cursor-pointer"
                >
                  <ShoppingBag className="h-4 w-4" />
                  My orders
                </Link>
                <Link
                  prefetch={false}
                  href="/dashboard/referrals"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 hover:cursor-pointer"
                >
                  <Users className="h-4 w-4" />
                  Referrals
                </Link>
                <Link
                  prefetch={false}
                  href="/dashboard/profile"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 hover:cursor-pointer"
                >
                  <UserCircle className="h-4 w-4" />
                  Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Income by level (default: first 5 levels) */}
        <section className="mb-10 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-sm">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Income by level</h2>
                <p className="text-xs text-zinc-600">
                  Commission earned from your first 5 levels in the downline.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAllIncomeModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 hover:cursor-pointer"
            >
              View all income
            </button>
          </div>

          {dataLoading ? (
            <div className="flex gap-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-24 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 h-3 w-12 rounded bg-zinc-200 animate-pulse" />
                  <div className="mb-1 h-3 w-24 rounded bg-zinc-200 animate-pulse" />
                  <div className="h-3 w-full rounded bg-zinc-200 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topFiveLevelIncome.map(({ level, users }) => (
                <div
                  key={level}
                  className="flex flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-500">Level {level}</span>
                    <span className="font-semibold text-emerald-700">
                      {formatINRPrecise(users.reduce((sum, u) => sum + u.amount, 0))}
                    </span>
                  </div>
                  {users.length === 0 ? (
                    <p className="mt-2 text-[11px] text-zinc-400">No income yet.</p>
                  ) : (
                    <ul className="mt-1 space-y-1.5 max-h-28 overflow-y-auto">
                      {users.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="mr-2 truncate text-zinc-700" title={u.name}>
                            {u.name}
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {formatINRPrecise(u.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Referrals list */}
        <section className="mb-10">
          <ReferralsListView showLinkToFull viewerIsStaff={isAdmin} />
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
              href="/dashboard/referrals"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline hover:cursor-pointer"
            >
              View referrals
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            {dataLoading ? (
              <div className="min-w-[600px]">
                <div
                  className={`${INCOME_HISTORY_ROW_GRID} border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-700`}
                >
                  <div>Date</div>
                  <div>From</div>
                  <div>Level</div>
                  <div>BV</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="h-[min(420px,52vh)] space-y-0 border-t border-zinc-100 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${INCOME_HISTORY_ROW_GRID} border-b border-zinc-100 px-4 py-3`}
                    >
                      <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                      <div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" />
                      <div className="h-4 w-10 rounded bg-zinc-100 animate-pulse" />
                      <div className="h-4 w-12 rounded bg-zinc-100 animate-pulse" />
                      <div className="ml-auto h-4 w-16 rounded bg-zinc-100 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ) : incomes.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-zinc-500">
                <TrendingUp className="mx-auto mb-2 h-10 w-10 text-zinc-300" />
                <p>No income yet. When your referrals make purchases, earnings appear here.</p>
                <Link
                  prefetch={false}
                  href="/dashboard/seller/services"
                  className="mt-2 inline-block text-sm font-medium text-emerald-600 hover:underline hover:cursor-pointer"
                >
                  Browse services →
                </Link>
              </div>
            ) : (
              <div className="min-w-[600px]">
                <div
                  className={`${INCOME_HISTORY_ROW_GRID} border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-sm font-medium text-zinc-700`}
                >
                  <div>Date</div>
                  <div>From</div>
                  <div>Level</div>
                  <div>BV</div>
                  <div className="text-right">Amount</div>
                </div>
                <div
                  ref={incomeHistoryScrollRef}
                  className="h-[min(420px,52vh)] overflow-auto overscroll-contain"
                  style={{ contain: "strict" }}
                >
                  <div
                    className="relative w-full"
                    style={{ height: incomeHistoryVirtualizer.getTotalSize() }}
                  >
                    {incomeHistoryVirtualizer.getVirtualItems().map((vi) => {
                      const inc = incomes[vi.index];
                      return (
                        <div
                          key={inc._id}
                          data-index={vi.index}
                          ref={incomeHistoryVirtualizer.measureElement}
                          className={`${INCOME_HISTORY_ROW_GRID} absolute left-0 top-0 w-full border-b border-zinc-200 px-4 py-3 text-sm transition hover:bg-zinc-50/80`}
                          style={{ transform: `translateY(${vi.start}px)` }}
                        >
                          <div className="min-w-0 text-zinc-800">
                            {new Date(inc.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </div>
                          <div className="min-w-0 text-zinc-900">
                            {inc.fromUser?.name ? (
                              <span className="font-medium text-zinc-700">{inc.fromUser.name}, </span>
                            ) : null}
                            {inc.fromUser?.email ? (
                              <span className="text-[13px] text-zinc-500">{inc.fromUser.email}</span>
                            ) : null}
                          </div>
                          <div>
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                              L{inc.level}
                            </span>
                          </div>
                          <div className="text-zinc-900">{formatNumber(inc.bv)}</div>
                          <div className="text-right font-medium text-emerald-700">{formatINR(inc.amount)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Services snapshot (below Income history) */}
        <section className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-sm">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Services</h2>
                <p className="text-xs text-zinc-600">
                  A quick view of services available in the marketplace.
                </p>
              </div>
            </div>
            <Link
              prefetch={false}
              href="/services"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline hover:cursor-pointer"
            >
              View all services
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-zinc-200">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Business Volume</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-t border-zinc-200">
                      <td className="px-4 py-3">
                        <div className="h-4 w-40 rounded bg-zinc-100 animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-zinc-100 animate-pulse" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-4 w-20 rounded bg-zinc-100 animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : services.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                      <Store className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                      <p>No services available yet.</p>
                    </td>
                  </tr>
                ) : (
                  services.map((svc) => (
                    <tr
                      key={svc._id}
                      className="border-t border-zinc-200 transition hover:bg-zinc-50/80"
                    >
                      <td className="px-4 py-3 text-zinc-900">{svc.name}</td>
                      <td className="px-4 py-3 text-zinc-900">
                        {formatINR(svc.price ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-zinc-900">
                        {formatNumber(svc.businessVolume ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2 py-1 text-xs ",
                            svc.status === "active" || svc.status === "approved"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700",
                          ].join(" ")}
                        >
                          {svc.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showWithdrawModal && !isAdmin ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Request withdrawal</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Withdrawal amount (max you can request):{" "}
              <strong className="text-sky-800">{formatINRPrecise(maxWithdrawable)}</strong>
            </p>
            {(incomeSummary?.totalPendingWithdrawals ?? 0) > 0 ? (
              <p className="mt-2 text-xs text-amber-700">
                You have {formatINRPrecise(incomeSummary?.totalPendingWithdrawals ?? 0)} in pending
                requests. New requests must stay within your remaining withdrawable balance.
              </p>
            ) : null}
            <div className="mt-4">
              <label className="text-xs font-medium text-zinc-500">Amount (INR)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                max={maxWithdrawable > 0 ? maxWithdrawable : undefined}
                value={withdrawAmount}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || raw === ".") {
                    setWithdrawAmount(raw);
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  if (maxWithdrawable > 0 && n > maxWithdrawable) {
                    setWithdrawAmount(String(maxWithdrawable));
                    return;
                  }
                  setWithdrawAmount(raw);
                }}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                placeholder={`Max ${formatINRPrecise(maxWithdrawable)}`}
              />
              {withdrawAmount && !isWithdrawAmountValid ? (
                <p className="mt-1 text-xs text-red-600">
                  Amount must be greater than 0 and not more than your withdrawal amount (
                  {formatINRPrecise(maxWithdrawable)}).
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setWithdrawAmount(maxWithdrawable > 0 ? String(maxWithdrawable) : "")}
                className="mt-2 text-xs font-medium text-emerald-700 hover:underline"
              >
                Use full withdrawal amount
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount("");
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !isWithdrawAmountValid}
                onClick={() => void submitWithdrawalRequest()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Submit request
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAllIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">All levels income</h3>
                <p className="text-xs text-zinc-600">Commission breakdown across all downline levels</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllIncomeModal(false)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allLevelUserIncome.map(({ level, users }) => (
                  <div key={level} className="flex flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-500">Level {level}</span>
                      <span className="font-semibold text-emerald-700">
                        {formatINRPrecise(users.reduce((sum, u) => sum + u.amount, 0))}
                      </span>
                    </div>
                    {users.length === 0 ? (
                      <p className="mt-2 text-[11px] text-zinc-400">No income yet.</p>
                    ) : (
                      <ul className="mt-1 space-y-1.5 max-h-40 overflow-y-auto">
                        {users.map((u) => (
                          <li key={u.id} className="flex items-center justify-between text-[11px]">
                            <span className="mr-2 truncate text-zinc-700" title={u.name}>
                              {u.name}
                            </span>
                            <span className="font-semibold text-emerald-700">
                              {formatINRPrecise(u.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
