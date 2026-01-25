"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import { IndianRupee, BarChart3, TrendingUp, Link as LinkIcon, ShoppingCart, Copy, Check } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem } from "@/store/slices/cartSlice";

type MeResponse = {
  user: {
    id: string;
    email: string;
    role: "admin" | "user";
    referralCode: string;
    parent: string | null;
  };
};

type Service = {
  _id: string;
  name: string;
  price: number;
  businessVolume: number;
  status: "active" | "inactive";
};

type Income = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  fromUser?: { email: string; referralCode: string };
  createdAt: string;
};

export default function DashboardPage() {
  useAuth(); // Protect this page - require authentication
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const totalIncome = useMemo(
    () => incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0),
    [incomes]
  );

  async function loadAll() {
    setError(null);

    const [meRes, servicesRes, incomeRes] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/services"),
      apiFetch("/api/income"),
    ]);

    const meBody = await readApiBody(meRes);
    const meJson = meBody.json as any;
    if (!meRes.ok) throw new Error(meJson?.error ?? meBody.text ?? "Not logged in");

    const servicesBody = await readApiBody(servicesRes);
    const servicesJson = servicesBody.json as any;
    if (!servicesJson) throw new Error(servicesBody.text ?? "Invalid services response");

    const incomeBody = await readApiBody(incomeRes);
    const incomeJson = incomeBody.json as any;
    if (!incomeJson) throw new Error(incomeBody.text ?? "Invalid income response");

    setMe(meJson.user);
    setServices(servicesJson.services ?? []);
    setIncomes(incomeJson.incomes ?? []);

    const firstServiceId = (servicesJson.services?.[0]?._id as string | undefined) ?? "";
    setSelectedServiceId((prev) => prev || firstServiceId);
  }

  useEffect(() => {
    loadAll().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  async function buyService() {
    if (!selectedServiceId) return;
    setBusy(true);
    setError(null);

    try {
      const res = await apiFetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: selectedServiceId }),
      });
      const body = await readApiBody(res);
      const json = body.json as any;
      if (!res.ok) throw new Error(json?.error ?? body.text ?? "Purchase failed");

      await loadAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function addSelectedToCart() {
    if (!selectedServiceId) return;
    const service = services.find((s) => s._id === selectedServiceId);
    if (!service) return;

    dispatch(
      addItem({
        id: service._id,
        name: service.name,
        price: service.price,
        businessVolume: service.businessVolume,
        quantity: 1,
      })
    );

    setAddedToCart(true);
    window.setTimeout(() => setAddedToCart(false), 1500);
  }

  function copyReferralCode() {
    if (me?.referralCode) {
      navigator.clipboard.writeText(me.referralCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  if (error && !me) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
            {error} —{" "}
            <Link prefetch={false} className="font-semibold underline hover:text-red-800" href="/login">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
            {me ? (
              <p className="mt-2 text-sm text-gray-700">
                Welcome back, <span className="font-semibold text-blue-600">{me.email}</span> ({me.role})
              </p>
            ) : null}
          </div>
          <div className="flex gap-3">
            {me?.role === "admin" ? (
              <Link 
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:shadow-md transition-shadow" 
                prefetch={false}
                href="/admin/services"
              >
                <span className="text-blue-600">Manage Services</span>
              </Link>
            ) : null}
            <button
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium disabled:opacity-60 hover:shadow-md transition-shadow"
              onClick={logout}
              disabled={busy}
            >
              Logout
            </button>
            <Link
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:shadow-md transition-shadow"
              prefetch={false}
              href="/cart"
            >
              Cart ({cart.totalQuantity})
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {me ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="font-semibold text-lg text-gray-900">Referral Code</h2>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-blue-50 px-4 py-3 border border-blue-200">
                <code className="text-lg font-bold text-blue-600">{me.referralCode}</code>
                <button
                  onClick={copyReferralCode}
                  className="p-2 rounded-md hover:bg-blue-100 transition-colors"
                  title={copiedCode ? "Copied!" : "Copy code"}
                >
                  {copiedCode ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-700">
                Share this code to invite new users to your network
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="font-semibold text-lg text-gray-900">Total Income</h2>
              </div>
              <p className="mt-2 text-4xl font-bold text-blue-600">
                {formatINR(totalIncome)}
              </p>
              <p className="mt-3 text-xs text-gray-700">
                Cumulative BV income from your network
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="font-semibold text-lg text-gray-900">Quick Stats</h2>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Income Entries</span>
                  <span className="font-semibold text-gray-900">{incomes.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Available Services</span>
                  <span className="font-semibold text-gray-900">{services.length}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="glass-panel animate-fade-in rounded-2xl border border-blue-200 p-6 mb-6 transition-all hover:shadow-2xl" style={{animationDelay: '0.3s'}}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-gray-500 flex items-center justify-center text-white">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-lg">Purchase Service</h2>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              className="flex-1 glass-panel rounded-xl border border-blue-200 px-4 py-3 font-medium transition-all focus:ring-2 focus:ring-blue-500"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
            >
              <option value="" disabled>
                Select a service
              </option>
              {services.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} — {formatINR(s.price)} — BV {s.businessVolume}
                </option>
              ))}
            </select>
            <div className="flex gap-2 sm:flex-col">
              <button
                className="rounded-xl border border-blue-200 px-6 py-3 text-sm font-semibold transition-all hover:scale-105 hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
                onClick={addSelectedToCart}
                disabled={busy || !selectedServiceId}
                type="button"
              >
                {addedToCart ? "Added" : "Add to Cart"}
              </button>
              <button
                className="rounded-xl bg-linear-to-r from-blue-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-xl disabled:opacity-60 disabled:hover:scale-100"
                onClick={buyService}
                disabled={busy || !selectedServiceId}
                type="button"
              >
                {busy ? "Processing…" : "Buy Now"}
              </button>
            </div>
          </div>
          {services.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-600">
              No services available. Admin needs to create services first.
            </p>
          ) : null}
        </div>

        <div className="glass-panel animate-fade-in rounded-2xl border border-blue-200 p-6 transition-all hover:shadow-2xl" style={{animationDelay: '0.4s'}}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-lg">Income History</h2>
            </div>
            <Link 
              className="text-sm font-medium bg-linear-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent hover:underline transition-all hover:scale-105" 
              prefetch={false}
              href="/referrals"
            >
              View Referral Tree →
            </Link>
          </div>
          <div className="mt-4 overflow-auto rounded-xl border border-blue-200">
            <table className="w-full text-sm">
              <thead className="bg-linear-to-r from-blue-500/10 to-blue-500/10 text-left text-zinc-700">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold">From</th>
                  <th className="py-3 px-4 font-semibold">Level</th>
                  <th className="py-3 px-4 font-semibold">BV</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((inc) => (
                  <tr key={inc._id} className="border-t border-blue-200 hover:bg-blue-500/5 transition-colors">
                    <td className="py-3 px-4">{new Date(inc.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-4 font-medium">{inc.fromUser?.email ?? "—"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-700 text-xs font-semibold">
                        L{inc.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{inc.bv}</td>
                    <td className="py-3 px-4 font-bold text-green-600">
                      {formatINR(inc.amount)}
                    </td>
                  </tr>
                ))}
                {incomes.length === 0 ? (
                  <tr>
                    <td className="py-8 text-center text-zinc-600" colSpan={5}>
                      No income entries yet. Purchase services to start earning!
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
