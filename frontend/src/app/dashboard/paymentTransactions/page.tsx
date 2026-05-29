"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  RefreshCw,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Wallet,
  Calendar,
  Download,
  Printer,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINRPrecise } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type WithdrawalSummary = {
  totalEarnedAmount: number;
  withdrawalAmount: number;
  lifetimeWithdrawalCap: number | null;
  maxCumulativeWithdrawalAllowed: number;
  totalWithdrawn: number;
  totalPendingWithdrawals: number;
  nonWithdrawableEarnings: number;
};

type ReviewedBy = {
  fullName?: string;
  name?: string;
  email?: string;
};

type WithdrawalRow = {
  _id: string;
  amount: number;
  status: "pending" | "completed" | "rejected";
  createdAt: string;
  updatedAt?: string;
  reviewedAt?: string | null;
  rejectionReason?: string;
  paymentMethod?: string | null;
  paymentProofUrl?: string;
  payoutNote?: string;
  reviewedBy?: ReviewedBy | string | null;
};

type StatusKey = "all" | "pending" | "completed" | "rejected";

type PeriodKey = "weekly" | "monthly" | "yearly" | "custom";

type PeriodInfo = {
  key?: string;
  label?: string;
  start?: string;
  end?: string;
};

type PeriodSummary = {
  requestCount?: number;
  requestAmount?: number;
  paidAmount?: number;
  pendingAmount?: number;
  rejectedAmount?: number;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom" },
];

const STATUS_FILTERS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];

function getProofImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  let base = "";
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    base = "http://localhost:4000";
  } else {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBase) {
      try {
        const u = new URL(apiBase);
        base = u.origin;
      } catch {
        base = apiBase.replace(/\/api\/?$/, "") || apiBase;
      }
    }
    if (!base && typeof window !== "undefined") base = window.location.origin;
  }
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function statusLabel(status: string): string {
  if (status === "completed") return "Paid";
  if (status === "pending") return "Pending";
  if (status === "rejected") return "Rejected";
  return status;
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "pending") return "bg-amber-100 text-amber-900";
  if (status === "rejected") return "bg-red-100 text-red-800";
  return "bg-zinc-100 text-zinc-700";
}

function formatRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${new Date(start).toLocaleDateString("en-IN", opts)} – ${new Date(end).toLocaleDateString("en-IN", opts)}`;
}

function reviewerName(reviewedBy?: WithdrawalRow["reviewedBy"]): string {
  if (!reviewedBy || typeof reviewedBy === "string") return "—";
  return reviewedBy.fullName || reviewedBy.name || reviewedBy.email || "—";
}

function csvEscape(value: string): string {
  const s = String(value ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentInfo(w: WithdrawalRow): string {
  if (w.status === "completed" && w.paymentMethod) {
    return w.paymentMethod.toUpperCase();
  }
  return "—";
}

function withdrawalDetails(w: WithdrawalRow): string {
  const parts: string[] = [];
  if (w.status === "rejected" && w.rejectionReason) {
    parts.push(`Reason: ${w.rejectionReason}`);
  }
  if (w.payoutNote) parts.push(`Note: ${w.payoutNote}`);
  return parts.length ? parts.join("; ") : "—";
}

function exportTableRow(w: WithdrawalRow): string[] {
  return [
    new Date(w.createdAt).toLocaleString("en-IN"),
    (w.amount ?? 0).toFixed(2),
    statusLabel(w.status),
    paymentInfo(w),
    w.reviewedAt ? new Date(w.reviewedAt).toLocaleString("en-IN") : "—",
    reviewerName(w.reviewedBy),
    withdrawalDetails(w),
  ];
}

const EXPORT_HEADERS = [
  "Requested",
  "Amount (INR)",
  "Status",
  "Payment",
  "Reviewed",
  "Reviewer",
  "Details",
];

export default function PaymentTransactionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = ["super_admin", "admin", "moderator"].includes(
    (user as { role?: string })?.role ?? "",
  );

  const [status, setStatus] = useState<StatusKey>("all");
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [summary, setSummary] = useState<WithdrawalSummary | null>(null);
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<StatusKey, number>>({
    all: 0,
    pending: 0,
    completed: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const maxWithdrawable = summary?.withdrawalAmount ?? 0;

  const parsedWithdrawAmount = Number(withdrawAmount);
  const isWithdrawAmountValid = useMemo(
    () =>
      Number.isFinite(parsedWithdrawAmount) &&
      parsedWithdrawAmount > 0 &&
      parsedWithdrawAmount <= maxWithdrawable + 1e-9,
    [parsedWithdrawAmount, maxWithdrawable],
  );

  const openWithdrawModal = () => {
    setWithdrawAmount(maxWithdrawable > 0 ? String(maxWithdrawable) : "");
    setShowWithdrawModal(true);
  };

  const submitWithdrawalRequest = async () => {
    const available = maxWithdrawable;
    if (!isWithdrawAmountValid) {
      showErrorToast(
        available <= 0
          ? "No withdrawal amount available"
          : `Enter an amount greater than 0 and up to ${formatINRPrecise(available)}`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(withdrawAmount) }),
      });
      const body = await readApiBody(res);
      const data = body.json as { error?: string; summary?: WithdrawalSummary };
      if (!res.ok) {
        const errMsg =
          typeof data?.error === "string"
            ? data.error
            : (data?.error as { formErrors?: string[] })?.formErrors?.[0] ?? "Request failed";
        throw new Error(errMsg);
      }
      if (data.summary) setSummary(data.summary);
      showSuccessToast("Withdrawal request submitted. Admin will review and pay.");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      await load();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const load = useCallback(async () => {
    if (period === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      setError(null);
      setRows([]);
      setPeriodInfo(null);
      setPeriodSummary(null);
      setStatusCounts({ all: 0, pending: 0, completed: 0, rejected: 0 });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ status, limit: "200", period });
      if (period === "custom") {
        qs.set("from", customFrom);
        qs.set("to", customTo);
      }
      const res = await apiFetch(`/api/withdrawals?${qs}`);
      const body = await readApiBody(res);
      const data = body.json as {
        summary?: WithdrawalSummary;
        withdrawals?: WithdrawalRow[];
        statusCounts?: Record<StatusKey, number>;
        period?: PeriodInfo;
        periodSummary?: PeriodSummary;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Failed to load payment transactions");
        setSummary(null);
        setRows([]);
        return;
      }

      setSummary(data.summary ?? null);
      setRows(data.withdrawals ?? []);
      setPeriodInfo(data.period ?? null);
      setPeriodSummary(data.periodSummary ?? null);
      if (data.statusCounts) {
        setStatusCounts({
          all: data.statusCounts.all ?? 0,
          pending: data.statusCounts.pending ?? 0,
          completed: data.statusCounts.completed ?? 0,
          rejected: data.statusCounts.rejected ?? 0,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payment transactions");
      setSummary(null);
      setRows([]);
      setPeriodInfo(null);
      setPeriodSummary(null);
    } finally {
      setLoading(false);
    }
  }, [status, period, customFrom, customTo]);

  useEffect(() => {
    if (authLoading) return;
    if (isAdmin) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [authLoading, isAdmin, load, router]);

  const canExport =
    rows.length > 0 && !(period === "custom" && (!customFrom || !customTo));

  const reportFileBase = `payment-transactions-${period}-${new Date().toISOString().slice(0, 10)}`;

  const userDisplayName =
    (user as { fullName?: string; name?: string; email?: string })?.fullName ||
    (user as { name?: string })?.name ||
    (user as { email?: string })?.email ||
    "Customer";

  const buildReportMeta = (): { label: string; value: string }[] => {
    const meta: { label: string; value: string }[] = [
      { label: "Report", value: "Payment Transactions" },
      { label: "Customer", value: userDisplayName },
      { label: "Generated", value: new Date().toLocaleString("en-IN") },
      { label: "Period", value: periodInfo?.label ?? period },
    ];
    if (periodInfo?.start && periodInfo?.end) {
      meta.push({ label: "Date range", value: formatRange(periodInfo.start, periodInfo.end) });
    }
    if (period === "custom") {
      meta.push({ label: "Custom from", value: customFrom || "—" });
      meta.push({ label: "Custom to", value: customTo || "—" });
    }
    meta.push({
      label: "Status filter",
      value: status === "all" ? "All" : statusLabel(status),
    });
    if (summary) {
      meta.push(
        { label: "Total earned", value: summary.totalEarnedAmount.toFixed(2) },
        { label: "Available to withdraw", value: summary.withdrawalAmount.toFixed(2) },
        { label: "Total paid out", value: summary.totalWithdrawn.toFixed(2) },
        { label: "Pending requests", value: summary.totalPendingWithdrawals.toFixed(2) },
      );
    }
    if (periodSummary) {
      meta.push(
        { label: "Requests in period", value: String(periodSummary.requestCount ?? 0) },
        {
          label: "Period request amount",
          value: (periodSummary.requestAmount ?? 0).toFixed(2),
        },
        { label: "Period paid", value: (periodSummary.paidAmount ?? 0).toFixed(2) },
        { label: "Period pending", value: (periodSummary.pendingAmount ?? 0).toFixed(2) },
        { label: "Period rejected", value: (periodSummary.rejectedAmount ?? 0).toFixed(2) },
      );
    }
    return meta;
  };

  const downloadCsvReport = () => {
    if (!canExport) return;
    const metaLines = buildReportMeta().map(
      ({ label, value }) => `${csvEscape(label)},${csvEscape(value)}`,
    );
    const lines: string[] = [...metaLines, "", EXPORT_HEADERS.join(",")];
    rows.forEach((w) => {
      lines.push(exportTableRow(w).map((c) => csvEscape(c)).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportFileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = () => {
    if (!canExport) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Payment Transactions Report", 40, 40);
    doc.setFontSize(10);
    let y = 58;
    doc.text(`Customer: ${userDisplayName}`, 40, y);
    y += 14;
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, y);
    y += 14;
    const rangeText =
      periodInfo?.start && periodInfo?.end
        ? `${periodInfo.label ?? period} · ${formatRange(periodInfo.start, periodInfo.end)}`
        : String(periodInfo?.label ?? period);
    doc.text(`Period: ${rangeText}`, 40, y);
    y += 14;
    doc.text(`Status filter: ${status === "all" ? "All" : statusLabel(status)}`, 40, y);
    y += 14;
    if (summary) {
      doc.text(
        `Earned: ${formatINRPrecise(summary.totalEarnedAmount)}  Available: ${formatINRPrecise(summary.withdrawalAmount)}  Paid: ${formatINRPrecise(summary.totalWithdrawn)}  Pending: ${formatINRPrecise(summary.totalPendingWithdrawals)}`,
        40,
        y,
      );
      y += 14;
    }

    autoTable(doc, {
      startY: y + 8,
      head: [EXPORT_HEADERS],
      body: rows.map((w) => exportTableRow(w)),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`${reportFileBase}.pdf`);
  };

  const printReport = () => {
    if (!canExport) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      showErrorToast("Allow pop-ups to print the report");
      return;
    }

    const metaRows = buildReportMeta()
      .map(
        ({ label, value }) =>
          `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("");

    const tableRows = rows
      .map((w) => {
        const cols = exportTableRow(w);
        return `<tr>${cols.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
      })
      .join("");

    const rangeHtml =
      periodInfo?.start && periodInfo?.end
        ? `<p><strong>Range:</strong> ${escapeHtml(formatRange(periodInfo.start, periodInfo.end))}</p>`
        : "";

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Payment Transactions</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #18181b; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    .meta { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .meta th { text-align: left; padding: 4px 12px 4px 0; color: #52525b; font-weight: 600; vertical-align: top; }
    .meta td { padding: 4px 0; }
    table.data { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
    table.data th, table.data td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }
    table.data th { background: #ecfdf5; font-weight: 600; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Payment Transactions</h1>
  <p>${escapeHtml(userDisplayName)} · ${escapeHtml(new Date().toLocaleString("en-IN"))}</p>
  ${rangeHtml}
  <table class="meta">${metaRows}</table>
  <table class="data">
    <thead><tr>${EXPORT_HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  };

  if (authLoading || isAdmin) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-zinc-500">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
            <CreditCard className="h-6 w-6 text-emerald-600" />
            Payment Transactions
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Withdrawal requests, payout status, and your referral earnings balance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openWithdrawModal}
            disabled={!summary || maxWithdrawable <= 0 || submitting}
            title={
              maxWithdrawable <= 0
                ? "No withdrawal amount available"
                : `Request up to ${formatINRPrecise(maxWithdrawable)}`
            }
            className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IndianRupee className="h-4 w-4" />
            Request withdrawal
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-emerald-800/80">
              <Wallet className="h-3.5 w-3.5" />
              Total earned
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">
              {formatINRPrecise(summary.totalEarnedAmount)}
            </p>
            <p className="mt-1 text-xs text-emerald-800/70">Lifetime referral income credited</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-sky-800/80">
              <IndianRupee className="h-3.5 w-3.5" />
              Available to withdraw
            </p>
            <p className="mt-1 text-lg font-semibold text-sky-900">
              {formatINRPrecise(summary.withdrawalAmount)}
            </p>
            <p className="mt-1 text-xs text-sky-800/70">After paid & pending requests</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-800/80">
              Total paid out
            </p>
            <p className="mt-1 text-lg font-semibold text-violet-900">
              {formatINRPrecise(summary.totalWithdrawn)}
            </p>
            <p className="mt-1 text-xs text-violet-800/70">Completed withdrawal payouts</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-amber-800/80">
              <Clock className="h-3.5 w-3.5" />
              Pending requests
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-900">
              {formatINRPrecise(summary.totalPendingWithdrawals)}
            </p>
            <p className="mt-1 text-xs text-amber-800/70">
              {statusCounts.pending} request{statusCounts.pending !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
        </div>
      ) : null}

      {summary && summary.lifetimeWithdrawalCap != null ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
          <p>
            <span className="font-medium text-zinc-800">Withdrawal plan limit:</span>{" "}
            {formatINRPrecise(summary.lifetimeWithdrawalCap)} (based on your first order).{" "}
            <span className="font-medium text-zinc-800">Max you can ever withdraw:</span>{" "}
            {formatINRPrecise(summary.maxCumulativeWithdrawalAllowed)}.
            {summary.nonWithdrawableEarnings > 0 ? (
              <>
                {" "}
                <span className="font-medium text-zinc-800">Non-withdrawable earnings:</span>{" "}
                {formatINRPrecise(summary.nonWithdrawableEarnings)}.
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-zinc-900">Withdrawal request history</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Filter requests by when they were submitted
          </p>

          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Calendar className="h-3.5 w-3.5" />
              Period
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

          {periodInfo?.start && periodInfo?.end ? (
            <p className="mt-3 text-sm text-zinc-600">
              <strong>{periodInfo.label ?? period}</strong>
              <span> · {formatRange(periodInfo.start, periodInfo.end)}</span>
            </p>
          ) : period === "custom" && !customFrom && !customTo ? (
            <p className="mt-3 text-sm text-zinc-500">
              Select from and to dates, then click Apply range.
            </p>
          ) : null}

          {periodSummary && (period !== "custom" || (customFrom && customTo)) ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs">
                <span className="text-zinc-500">Requests in period</span>
                <p className="font-semibold text-zinc-900">
                  {periodSummary.requestCount ?? 0} ·{" "}
                  {formatINRPrecise(periodSummary.requestAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                <span className="text-emerald-700">Paid</span>
                <p className="font-semibold text-emerald-900">
                  {formatINRPrecise(periodSummary.paidAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs">
                <span className="text-amber-700">Pending</span>
                <p className="font-semibold text-amber-900">
                  {formatINRPrecise(periodSummary.pendingAmount ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs">
                <span className="text-red-700">Rejected</span>
                <p className="font-semibold text-red-900">
                  {formatINRPrecise(periodSummary.rejectedAmount ?? 0)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  status === key
                    ? "bg-sky-100 text-sky-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {label}
                {statusCounts[key] > 0 ? (
                  <span className="ml-1.5 text-xs opacity-80">({statusCounts[key]})</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadCsvReport}
              disabled={!canExport}
              title={canExport ? "Download CSV" : "No transactions to export"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={downloadPdfReport}
              disabled={!canExport}
              title={canExport ? "Download PDF" : "No transactions to export"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={printReport}
              disabled={!canExport}
              title={canExport ? "Print report" : "No transactions to print"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 sm:px-6">Requested</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Payment</th>
                <th className="px-3 py-3">Reviewed</th>
                <th className="px-3 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w._id} className="border-b border-zinc-100 align-top">
                  <td className="px-4 py-3 text-xs text-zinc-700 sm:px-6">
                    {new Date(w.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-900">
                    {formatINRPrecise(w.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(w.status)}`}
                    >
                      {w.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : w.status === "rejected" ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {statusLabel(w.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-700">
                    {w.status === "completed" && w.paymentMethod ? (
                      <div className="space-y-1">
                        <span className="font-medium uppercase">{w.paymentMethod}</span>
                        {w.paymentMethod === "upi" && w.paymentProofUrl ? (
                          <div>
                            <a
                              href={getProofImageUrl(w.paymentProofUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-emerald-700 hover:underline"
                            >
                              View UPI proof
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-600">
                    {w.reviewedAt ? new Date(w.reviewedAt).toLocaleString() : "—"}
                    {w.reviewedBy ? (
                      <div className="mt-0.5 text-zinc-500">By {reviewerName(w.reviewedBy)}</div>
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-3 text-xs text-zinc-600">
                    {w.status === "rejected" && w.rejectionReason ? (
                      <p>
                        <span className="font-medium text-red-700">Reason:</span>{" "}
                        {w.rejectionReason}
                      </p>
                    ) : null}
                    {w.payoutNote ? (
                      <p className={w.rejectionReason ? "mt-1" : ""}>
                        <span className="font-medium text-zinc-700">Note:</span> {w.payoutNote}
                      </p>
                    ) : null}
                    {!w.rejectionReason && !w.payoutNote ? "—" : null}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500 sm:px-6">
                    {period === "custom" && !customFrom && !customTo
                      ? "Select a date range to view transactions."
                      : status === "all"
                        ? "No withdrawal requests in this period."
                        : `No ${statusLabel(status === "completed" ? "completed" : status)} requests in this period.`}
                  </td>
                </tr>
              ) : null}
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showWithdrawModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900">Request withdrawal</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Withdrawal amount (max you can request):{" "}
              <strong className="text-sky-800">{formatINRPrecise(maxWithdrawable)}</strong>
            </p>
            {(summary?.totalPendingWithdrawals ?? 0) > 0 ? (
              <p className="mt-2 text-xs text-amber-700">
                You have {formatINRPrecise(summary?.totalPendingWithdrawals ?? 0)} in pending
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
                onClick={() =>
                  setWithdrawAmount(maxWithdrawable > 0 ? String(maxWithdrawable) : "")
                }
                className="mt-2 text-xs font-medium text-emerald-700 hover:underline"
              >
                Use full withdrawal amount
              </button>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
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
                disabled={submitting || !isWithdrawAmountValid}
                onClick={() => void submitWithdrawalRequest()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Submit request
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
