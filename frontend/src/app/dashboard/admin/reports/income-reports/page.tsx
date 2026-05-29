"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast } from "@/lib/toast";
import { Calendar, RefreshCw } from "lucide-react";
import WithdrawalPayoutActions from "./_components/WithdrawalPayoutActions";
import ManualPayoutForm from "./_components/ManualPayoutForm";
import ReportExportButtons, { type ReportSection } from "./_components/ReportExportButtons";
import { customerLabel } from "./lib";

type PeriodKey = "weekly" | "monthly" | "yearly" | "custom";

type IncomeRow = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
  serviceName?: string;
  fromUser?: { name?: string; email?: string; mobile?: string; referralCode?: string } | null;
};

type PaymentRow = {
  _id: string;
  amount: number;
  paymentMethod?: string;
  paymentProofUrl?: string;
  payoutNote?: string;
  reviewedAt?: string;
  createdAt?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    upiLink?: string;
  } | null;
};

type PendingPaymentRow = {
  _id: string;
  requestedAmount: number;
  withdrawableBalance: number;
  payableAmount: number;
  totalEarned?: number;
  createdAt?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    upiLink?: string;
  } | null;
};

type ReportPayload = {
  period?: { key?: string; label?: string; start?: string; end?: string };
  summary?: {
    totalEarnedInPeriod?: number;
    totalPaidToCustomers?: number;
    payoutCount?: number;
    payoutsByMethod?: { cash?: number; upi?: number; other?: number };
    lifetimeEarned?: number;
    lifetimeWithdrawn?: number;
    lifetimeWithdrawable?: number;
    totalCustomerIncomeInPeriod?: number;
    customerIncomeEntriesInPeriod?: number;
    totalPendingPayoutRequests?: number;
    totalPendingRequestAmount?: number;
    totalPayablePending?: number;
    totalCustomersWithdrawable?: number;
  };
  incomes?: IncomeRow[];
  paymentsToCustomers?: PaymentRow[];
  pendingPayments?: PendingPaymentRow[];
  error?: string;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom" },
];

function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${new Date(start).toLocaleDateString("en-IN", opts)} – ${new Date(end).toLocaleDateString("en-IN", opts)}`;
}

export default function AdminIncomeReportsPage() {
  const { user: currentUser, loading: authLoading } = useAuth({ requireAdmin: true });
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === "custom" && (!customFrom || !customTo)) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ period });
      if (period === "custom") {
        qs.set("from", customFrom);
        qs.set("to", customTo);
      }
      const res = await apiFetch(`/api/admin/reports/my-income?${qs}`);
      const body = await readApiBody(res);
      const json = (body.json ?? {}) as ReportPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load report");
      setData(json);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      showErrorToast(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (!authLoading && currentUser) void load();
  }, [authLoading, currentUser, load]);

  const summary = data?.summary;
  const incomes = data?.incomes ?? [];
  const payments = data?.paymentsToCustomers ?? [];
  const pendingPayments = data?.pendingPayments ?? [];

  const exportMeta = useMemo(() => {
    const meta: { label: string; value: string }[] = [
      { label: "Period", value: data?.period?.label ?? period },
    ];
    if (data?.period?.start && data?.period?.end) {
      meta.push({ label: "Date range", value: formatRange(data.period.start, data.period.end) });
    }
    if (summary) {
      meta.push(
        {
          label: "Customer income (period)",
          value: formatINRPrecise(summary.totalCustomerIncomeInPeriod ?? 0),
        },
        { label: "Your earned (period)", value: formatINRPrecise(summary.totalEarnedInPeriod ?? 0) },
        {
          label: "Paid to customers (period)",
          value: formatINRPrecise(summary.totalPaidToCustomers ?? 0),
        },
        {
          label: "Pending payable (now)",
          value: formatINRPrecise(summary.totalPayablePending ?? 0),
        },
      );
    }
    return meta;
  }, [data?.period, period, summary]);

  const exportSections = useMemo((): ReportSection[] => {
    return [
      {
        title: "Pending customer payments",
        headers: [
          "Requested",
          "Customer",
          "UPI ID",
          "Email/Mobile",
          "Requested amt (INR)",
          "Withdrawable (INR)",
          "Payable (INR)",
          "Lifetime earned (INR)",
        ],
        rows: pendingPayments.map((row) => [
          row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN") : "—",
          customerLabel(row.customer),
          row.customer?.upiLink?.trim() || "—",
          row.customer?.email || row.customer?.mobile || "—",
          row.requestedAmount.toFixed(2),
          row.withdrawableBalance.toFixed(2),
          row.payableAmount.toFixed(2),
          (row.totalEarned ?? 0).toFixed(2),
        ]),
      },
      {
        title: "Your income (period)",
        headers: ["Date", "Level", "From", "Service", "BV", "Amount (INR)"],
        rows: incomes.map((row) => [
          new Date(row.createdAt).toLocaleString("en-IN"),
          `L${row.level}`,
          row.fromUser?.name || row.fromUser?.email || "—",
          row.serviceName || "—",
          String(row.bv),
          row.amount.toFixed(2),
        ]),
      },
      {
        title: "Payments made to customers",
        headers: ["Paid on", "Customer", "Email/Mobile", "Amount (INR)", "Method", "Note"],
        rows: payments.map((row) => [
          row.reviewedAt
            ? new Date(row.reviewedAt).toLocaleString("en-IN")
            : row.createdAt
              ? new Date(row.createdAt).toLocaleString("en-IN")
              : "—",
          customerLabel(row.customer),
          row.customer?.email || row.customer?.mobile || "—",
          row.amount.toFixed(2),
          row.paymentMethod?.toUpperCase() || "—",
          row.payoutNote || "—",
        ]),
      },
    ];
  }, [pendingPayments, incomes, payments]);

  const fileBase = `admin-income-overview-${period}-${new Date().toISOString().slice(0, 10)}`;
  const canExportOverview = period !== "custom" || Boolean(customFrom && customTo);

  if (authLoading || !currentUser) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-zinc-600">
        Checking access…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Calendar className="h-3.5 w-3.5" />
              Report period
            </p>
            <div className="flex flex-wrap gap-2">
              {PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    period === key
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <ReportExportButtons
              reportTitle="Admin Income — Overview"
              fileNameBase={fileBase}
              meta={exportMeta}
              sections={exportSections}
              disabled={loading || !canExportOverview}
            />
          </div>
        </div>

        {period === "custom" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={!customFrom || !customTo || loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Apply range
            </button>
          </div>
        ) : null}

        {data?.period ? (
          <p className="mt-3 text-sm text-zinc-600">
            <strong>{data.period.label}</strong>
            {data.period.start && data.period.end ? (
              <span> · {formatRange(data.period.start, data.period.end)}</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {period === "custom" && !customFrom && !customTo ? (
        <p className="text-sm text-zinc-500">Select a from and to date, then click Apply range.</p>
      ) : loading && !data ? (
        <p className="text-sm text-zinc-500">Loading report…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              {
                label: "Customer income (period)",
                value: summary?.totalCustomerIncomeInPeriod ?? 0,
                cls: "text-violet-800",
                hint: summary?.customerIncomeEntriesInPeriod
                  ? `${summary.customerIncomeEntriesInPeriod} entries`
                  : undefined,
              },
              {
                label: "Your earned (period)",
                value: summary?.totalEarnedInPeriod ?? 0,
                cls: "text-emerald-800",
              },
              {
                label: "Paid to customers (period)",
                value: summary?.totalPaidToCustomers ?? 0,
                cls: "text-sky-800",
              },
              {
                label: "Pending payable (now)",
                value: summary?.totalPayablePending ?? 0,
                cls: "text-amber-800",
                hint:
                  summary?.totalPendingPayoutRequests != null
                    ? `${summary.totalPendingPayoutRequests} request(s)`
                    : undefined,
              },
              {
                label: "Total customer withdrawable",
                value: summary?.totalCustomersWithdrawable ?? 0,
                cls: "text-zinc-900",
                hint: "Sum of balances customers can still withdraw",
              },
              { label: "Your payouts (period)", value: summary?.payoutCount ?? 0, cls: "text-zinc-700", money: false },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-zinc-500">{c.label}</p>
                <p className={`mt-1 text-lg font-semibold ${c.cls}`}>
                  {c.money === false ? String(c.value) : formatINRPrecise(Number(c.value))}
                </p>
                {"hint" in c && c.hint ? (
                  <p className="mt-0.5 text-[11px] text-zinc-500">{c.hint}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Pending customer payments</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Customers request withdrawals from their withdrawable balance. Reject invalid
                  requests, or use <strong>Approve &amp; pay</strong> (cash or UPI with screenshot
                  proof). Only withdrawable amounts are payable.
                </p>
              </div>
              <Link
                href="/dashboard/admin/reports/income-reports/payouts"
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Full payout queue →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-amber-200/80 text-xs uppercase text-zinc-600">
                    <th className="px-3 py-2">Requested</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Requested amt</th>
                    <th className="px-3 py-2">Withdrawable</th>
                    <th className="px-3 py-2">Payable</th>
                    <th className="px-3 py-2">Lifetime earned</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map((row) => (
                    <tr key={row._id} className="border-b border-amber-100/80 align-top">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium text-zinc-900">
                          {row.customer?.name || "—"}
                        </div>
                        {row.customer?.upiLink?.trim() ? (
                          <div
                            className="mt-0.5 break-all font-mono text-[11px] font-medium text-emerald-800"
                            title={row.customer.upiLink}
                          >
                            {row.customer.upiLink.trim()}
                          </div>
                        ) : null}
                        <div className="text-zinc-500">
                          {row.customer?.email || row.customer?.mobile || ""}
                        </div>
                        {row.customer?.id ? (
                          <Link
                            href={`/dashboard/admin/reports/income-reports/${row.customer.id}`}
                            className="text-emerald-700 hover:underline"
                          >
                            View income
                          </Link>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatINRPrecise(row.requestedAmount)}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {formatINRPrecise(row.withdrawableBalance)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-amber-900">
                        {formatINRPrecise(row.payableAmount)}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600">
                        {formatINRPrecise(row.totalEarned ?? 0)}
                      </td>
                      <td className="px-3 py-2">
                        <WithdrawalPayoutActions
                          withdrawalId={row._id}
                          disabled={loading}
                          compact
                          onDone={() => void load()}
                        />
                      </td>
                    </tr>
                  ))}
                  {!loading && pendingPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        No pending withdrawal requests
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {summary?.totalPendingRequestAmount != null &&
            summary.totalPendingRequestAmount > (summary.totalPayablePending ?? 0) ? (
              <p className="mt-2 text-xs text-amber-800">
                Total requested {formatINRPrecise(summary.totalPendingRequestAmount)} — payable{" "}
                {formatINRPrecise(summary.totalPayablePending ?? 0)} after withdrawable limits.
              </p>
            ) : null}
          </div>

          <div id="manual-payout">
            <ManualPayoutForm onSuccess={() => void load()} />
          </div>

          {summary?.payoutsByMethod ? (
            <p className="text-xs text-zinc-500">
              Payout methods in period: Cash {summary.payoutsByMethod.cash ?? 0}, UPI{" "}
              {summary.payoutsByMethod.upi ?? 0}
              {(summary.payoutsByMethod.other ?? 0) > 0
                ? `, Other ${summary.payoutsByMethod.other}`
                : ""}
            </p>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-zinc-900">Your income (period)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Level</th>
                    <th className="px-3 py-2">From</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">BV</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((row) => (
                    <tr key={row._id} className="border-b border-zinc-100">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">L{row.level}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.fromUser?.name || row.fromUser?.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.serviceName || "—"}</td>
                      <td className="px-3 py-2">{row.bv}</td>
                      <td className="px-3 py-2 font-medium text-emerald-800">
                        {formatINRPrecise(row.amount)}
                      </td>
                    </tr>
                  ))}
                  {!loading && incomes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No income in this period
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 text-base font-semibold text-zinc-900">
              Payments made to customers (by you)
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="px-3 py-2">Paid on</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Proof</th>
                    <th className="px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((row) => (
                    <tr key={row._id} className="border-b border-zinc-100">
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {row.reviewedAt
                          ? new Date(row.reviewedAt).toLocaleString()
                          : row.createdAt
                            ? new Date(row.createdAt).toLocaleString()
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-medium text-zinc-900">
                          {row.customer?.name || "—"}
                        </div>
                        <div className="text-zinc-500">{row.customer?.email || row.customer?.mobile || ""}</div>
                      </td>
                      <td className="px-3 py-2 font-medium">{formatINRPrecise(row.amount)}</td>
                      <td className="px-3 py-2 text-xs uppercase">{row.paymentMethod || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.paymentProofUrl ? (
                          <a
                            href={row.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-600">{row.payoutNote || "—"}</td>
                    </tr>
                  ))}
                  {!loading && payments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No customer payouts recorded by you in this period
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
