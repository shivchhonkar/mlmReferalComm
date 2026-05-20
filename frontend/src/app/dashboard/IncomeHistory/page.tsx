"use client";

import { useEffect, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import VirtualizedIncomeTable from "./VirtualizedIncomeTable";

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

type IncomeSummary = {
  totalEarnedAmount: number;
  withdrawalAmount: number;
  nonWithdrawableEarnings: number;
  lifetimeWithdrawalCap: number | null;
};

type ApiResponse = {
  incomes: Income[];
  summary?: IncomeSummary;
  totalRecords?: number;
};

function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function IncomeHistoryPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
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
        setSummary(null);
        setTotalRecords(0);
        return;
      }

      setIncomes(data.incomes ?? []);
      setSummary(data.summary ?? null);
      setTotalRecords(Number(data.totalRecords ?? data.incomes?.length ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load income");
      setIncomes([]);
      setSummary(null);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, []);

  const totalEarnedDisplay =
    summary?.totalEarnedAmount ??
    incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0);
  const totalRecordsDisplay = totalRecords > 0 ? totalRecords : incomes.length;

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
        <div className="flex items-center gap-2">
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
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary != null && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">Total earned</p>
            <p className="text-lg font-semibold text-emerald-900">{formatINRPrecise(totalEarnedDisplay)}</p>
            <p className="mt-1 text-xs text-emerald-800/70">Full referral credits (not reduced by plan cap)</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-800/80">Withdrawal amount</p>
            <p className="text-lg font-semibold text-sky-900">{formatINRPrecise(summary.withdrawalAmount)}</p>
            <p className="mt-1 text-xs text-sky-800/70">
              {summary.lifetimeWithdrawalCap == null
                ? "Staff role: no withdrawal cap."
                : summary.nonWithdrawableEarnings > 0
                  ? `${formatINRPrecise(summary.nonWithdrawableEarnings)} earned above your withdrawable limit stays on record.`
                  : "Amount you can request to withdraw now (after plan limit and pending requests)."}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-50/80 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-zinc-800">
                Total income: {formatINRPrecise(totalEarnedDisplay)}
              </span>
            </div>
            <span className="text-sm text-zinc-500">
              {totalRecordsDisplay} total record{totalRecordsDisplay !== 1 ? "s" : ""}
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
            <VirtualizedIncomeTable incomes={incomes} />
          </div>
        )}
      </div>

    </div>
  );
}
