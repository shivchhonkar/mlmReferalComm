"use client";

import { useEffect, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINR } from "@/lib/format";
import { BarChart3, RefreshCw, User, TrendingUp } from "lucide-react";

type FromUser = {
  _id?: string;
  email?: string;
  referralCode?: string;
  fullName?: string;
  fullname?: string;
  name?: string;
};

type Income = {
  _id: string;
  fromUser?: FromUser | string;
  toUser?: string;
  purchase?: unknown;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
};

type ApiResponse = {
  incomes: Income[];
};

function fromUserName(u: FromUser | string | undefined): string {
  if (!u || typeof u === "string") return "-";
  const n = u.fullName ?? u.fullname ?? u.name ?? u.email;
  return n || "-";
}

export default function IncomeHistoryPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/income");
      const body = await readApiBody(res);
      const data = (body.json ?? {}) as ApiResponse;

      if (!res.ok) {
        const err = (data as { error?: string }).error ?? "Failed to load income";
        setError(err);
        setIncomes([]);
        return;
      }

      setIncomes(data.incomes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load income");
      setIncomes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, []);

  const totalAmount = incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0);

  if (loading && incomes.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading income history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Income History</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Earnings from your referral network
          </p>
        </div>
        <button
          type="button"
          onClick={fetchIncomes}
          disabled={loading}
          className="inline-flex items-center hover:cursor-pointer gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-zinc-800">
                Total: {formatINR(totalAmount)}
              </span>
            </div>
            <span className="text-sm text-zinc-500">
              {incomes.length} record{incomes.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {incomes.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 py-12 text-zinc-500">
            <TrendingUp className="h-12 w-12 text-zinc-300" />
            <p>No income records yet</p>
            <p className="text-sm">
              Earnings will appear here when your referrals make purchases
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    From
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                    BV
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {incomes.map((inc) => (
                  <tr
                    key={inc._id}
                    className="transition hover:bg-zinc-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                      {inc.createdAt
                        ? new Date(inc.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        L{inc.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                    <div className="flex space-y-0.5 ">
                      <span className="flex items-center gap-2 text-sm text-zinc-700">
                        <User className="h-4 w-4 shrink-0 text-zinc-400" />
                        {fromUserName(inc.fromUser)}
                      </span>
                      {typeof inc.fromUser === "object" &&
                        inc.fromUser?.referralCode && (
                          <p className="ml-2 mt-0.5 text-xs text-zinc-500">
                            {inc.fromUser.referralCode}
                          </p>
                        )}
                    </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-600">
                      {inc.bv ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {formatINR(inc.amount ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
