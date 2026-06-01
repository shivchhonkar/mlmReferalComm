"use client";

import { useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINRPrecise } from "@/lib/format";
import { useAuth } from "@/lib/useAuth";
import { showErrorToast } from "@/lib/toast";
import { BarChart3, Calendar, Download, Printer, RefreshCw, TrendingUp } from "lucide-react";
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

type PeriodKey = "weekly" | "monthly" | "yearly" | "custom";

type PeriodInfo = {
  key?: string;
  label?: string;
  start?: string;
  end?: string;
};

type PeriodSummary = {
  totalEarnedInPeriod?: number;
  recordCount?: number;
};

type ApiResponse = {
  incomes: Income[];
  summary?: IncomeSummary;
  totalRecords?: number;
  period?: PeriodInfo | null;
  periodSummary?: PeriodSummary;
  error?: string;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
  { key: "custom", label: "Custom" },
];

function formatRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${new Date(start).toLocaleDateString("en-IN", opts)} – ${new Date(end).toLocaleDateString("en-IN", opts)}`;
}

function fromUserName(u: FromUser | string | undefined): string {
  if (!u || typeof u === "string") return "—";
  const n = u.fullName ?? u.fullname ?? u.name ?? u.email;
  return n || "—";
}

function fromUserReferralCode(u: FromUser | string | undefined): string {
  if (!u || typeof u === "string") return "—";
  return u.referralCode?.trim() || "—";
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

function exportTableRow(inc: Income): string[] {
  return [
    inc.createdAt ? new Date(inc.createdAt).toLocaleString("en-IN") : "—",
    `L${inc.level ?? 0}`,
    fromUserName(inc.fromUser),
    fromUserReferralCode(inc.fromUser),
    String(inc.bv ?? 0),
    (inc.amount ?? 0).toFixed(2),
  ];
}

const EXPORT_HEADERS = [
  "Date",
  "Level",
  "From",
  "Referral code",
  "BV",
  "Amount (INR)",
];

export default function IncomeHistoryPage() {
  const { user } = useAuth();
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [summary, setSummary] = useState<IncomeSummary | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [periodInfo, setPeriodInfo] = useState<PeriodInfo | null>(null);
  const [periodSummary, setPeriodSummary] = useState<PeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomes = useCallback(async () => {
    if (period === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      setError(null);
      setIncomes([]);
      setPeriodInfo(null);
      setPeriodSummary(null);
      setTotalRecords(0);
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
      const res = await apiFetch(`/api/income?${qs}`);
      const body = await readApiBody(res);
      const data = (body.json ?? {}) as ApiResponse;

      if (!res.ok) {
        const err = data.error ?? "Failed to load income";
        setError(err);
        setIncomes([]);
        setSummary(null);
        setTotalRecords(0);
        setPeriodInfo(null);
        setPeriodSummary(null);
        return;
      }

      setIncomes(data.incomes ?? []);
      setSummary(data.summary ?? null);
      setTotalRecords(Number(data.totalRecords ?? data.incomes?.length ?? 0));
      setPeriodInfo(data.period ?? null);
      setPeriodSummary(data.periodSummary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load income");
      setIncomes([]);
      setSummary(null);
      setTotalRecords(0);
      setPeriodInfo(null);
      setPeriodSummary(null);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo]);

  useEffect(() => {
    void fetchIncomes();
  }, [fetchIncomes]);

  const totalEarnedLifetime = summary?.totalEarnedAmount ?? 0;
  const totalEarnedInPeriod =
    periodSummary?.totalEarnedInPeriod ??
    incomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0);
  const totalRecordsDisplay = totalRecords > 0 ? totalRecords : incomes.length;
  const showTable = period !== "custom" || (customFrom && customTo);
  const initialLoading = loading && incomes.length === 0 && showTable;

  const canExport =
    incomes.length > 0 && !(period === "custom" && (!customFrom || !customTo));

  const reportFileBase = `income-history-${period}-${new Date().toISOString().slice(0, 10)}`;

  const userDisplayName =
    (user as { fullName?: string; name?: string; email?: string })?.fullName ||
    (user as { name?: string })?.name ||
    (user as { email?: string })?.email ||
    "Customer";

  const buildReportMeta = (): { label: string; value: string }[] => {
    const meta: { label: string; value: string }[] = [
      { label: "Report", value: "Income History" },
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
    if (summary) {
      meta.push(
        { label: "Total earned (lifetime)", value: summary.totalEarnedAmount.toFixed(2) },
        { label: "Withdrawal amount", value: summary.withdrawalAmount.toFixed(2) },
      );
      if (summary.lifetimeWithdrawalCap != null) {
        meta.push({
          label: "Withdrawal plan limit",
          value: summary.lifetimeWithdrawalCap.toFixed(2),
        });
      }
    }
    if (periodSummary) {
      meta.push(
        {
          label: "Earned in period",
          value: (periodSummary.totalEarnedInPeriod ?? totalEarnedInPeriod).toFixed(2),
        },
        {
          label: "Records in period",
          value: String(periodSummary.recordCount ?? totalRecordsDisplay),
        },
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
    incomes.forEach((inc) => {
      lines.push(exportTableRow(inc).map((c) => csvEscape(c)).join(","));
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
    doc.text("Income History Report", 40, 40);
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
    if (summary) {
      doc.text(
        `Lifetime earned: ${formatINRPrecise(summary.totalEarnedAmount)}  Withdrawal available: ${formatINRPrecise(summary.withdrawalAmount)}  Period earned: ${formatINRPrecise(totalEarnedInPeriod)}`,
        40,
        y,
      );
      y += 14;
    }

    autoTable(doc, {
      startY: y + 8,
      head: [EXPORT_HEADERS],
      body: incomes.map((inc) => exportTableRow(inc)),
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

    const tableRows = incomes
      .map((inc) => {
        const cols = exportTableRow(inc);
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
  <title>Income History</title>
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
  <h1>Income History</h1>
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

  if (initialLoading) {
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
            onClick={() => void fetchIncomes()}
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
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/80">Total earned (lifetime)</p>
            <p className="text-lg font-semibold text-emerald-900">{formatINRPrecise(totalEarnedLifetime)}</p>
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
        <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-zinc-900">Income records</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Filter earnings by when they were credited</p>

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
                onClick={() => void fetchIncomes()}
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

          {periodSummary && showTable ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs">
                <span className="text-emerald-700">Earned in period</span>
                <p className="font-semibold text-emerald-900">
                  {formatINRPrecise(totalEarnedInPeriod)}
                </p>
              </div>
              <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs">
                <span className="text-zinc-500">Records in period</span>
                <p className="font-semibold text-zinc-900">
                  {periodSummary.recordCount ?? totalRecordsDisplay}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {showTable ? (
          <>
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  <span className="font-medium text-zinc-800">
                    Period income: {formatINRPrecise(totalEarnedInPeriod)}
                  </span>
                </div>
                <span className="text-sm text-zinc-500">
                  {totalRecordsDisplay} record{totalRecordsDisplay !== 1 ? "s" : ""}
                  {loading ? " · updating…" : ""}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCsvReport}
                  disabled={!canExport}
                  title={canExport ? "Download CSV" : "No income records to export"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={downloadPdfReport}
                  disabled={!canExport}
                  title={canExport ? "Download PDF" : "No income records to export"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={printReport}
                  disabled={!canExport}
                  title={canExport ? "Print report" : "No income records to print"}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
              </div>
            </div>

            {incomes.length === 0 && !loading ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 px-4 py-12 text-zinc-500">
                <TrendingUp className="h-12 w-12 text-zinc-300" />
                <p>No income records in this period</p>
                <p className="text-sm">
                  Try another period or wait for referrals to make purchases
                </p>
              </div>
            ) : incomes.length > 0 ? (
              <div className="overflow-x-auto">
                <VirtualizedIncomeTable incomes={incomes} />
              </div>
            ) : loading ? (
              <div className="flex min-h-[120px] items-center justify-center text-zinc-500">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
