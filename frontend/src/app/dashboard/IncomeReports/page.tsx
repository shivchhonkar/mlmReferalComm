"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { BarChart3, Download, RefreshCw, TrendingUp } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Income = {
  _id: string;
  fromUser?: { name?: string; email?: string; mobile?: string; referralCode?: string } | string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
};

type ApiResponse = {
  incomes: Income[];
};

type ReportType = "monthly" | "quarterly" | "annual" | "custom";

type ReportRow = {
  key: string;
  periodLabel: string;
  totalBusiness: number;
  totalIncome: number;
  levelTotals: Array<{ level: number; amount: number }>;
  periodStart: Date;
  entries: Income[];
};

function formatINRPrecise(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export default function IncomeReportsPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

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

  const filteredIncomes = useMemo(() => {
    if (reportType !== "custom") return incomes;
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const to = customTo ? new Date(`${customTo}T23:59:59`) : null;
    return incomes.filter((inc) => {
      const dt = new Date(inc.createdAt);
      if (Number.isNaN(dt.getTime())) return false;
      if (from && dt < from) return false;
      if (to && dt > to) return false;
      return true;
    });
  }, [incomes, reportType, customFrom, customTo]);

  const totalAmount = filteredIncomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0);
  const totalBusiness = filteredIncomes.reduce((sum, inc) => sum + (inc.bv ?? 0), 0);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    filteredIncomes.forEach((inc) => {
      const d = new Date(inc.createdAt);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [filteredIncomes]);

  const buildReport = (type: ReportType): ReportRow[] => {
    const grouped = new Map<
      string,
      {
        key: string;
        periodLabel: string;
        periodStart: Date;
        totalBusiness: number;
        totalIncome: number;
        levelMap: Map<number, number>;
      }
    >();

    filteredIncomes.forEach((inc) => {
      const d = new Date(inc.createdAt);
      if (Number.isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const quarter = Math.floor((month - 1) / 3) + 1;

      let key = "";
      let periodLabel = "";
      let periodStart = new Date(year, 0, 1);

      if (type === "custom") {
        key = "custom";
        periodLabel =
          customFrom || customTo
            ? `${customFrom || "Start"} to ${customTo || "End"}`
            : "Custom Period";
        periodStart = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
      } else if (type === "monthly") {
        key = `${year}-${String(month).padStart(2, "0")}`;
        periodLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        periodStart = new Date(year, month - 1, 1);
      } else if (type === "quarterly") {
        key = `${year}-Q${quarter}`;
        periodLabel = `Q${quarter} ${year}`;
        periodStart = new Date(year, (quarter - 1) * 3, 1);
      } else {
        key = `${year}`;
        periodLabel = String(year);
        periodStart = new Date(year, 0, 1);
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          periodLabel,
          periodStart,
          totalBusiness: 0,
          totalIncome: 0,
          levelMap: new Map<number, number>(),
          entries: [],
        });
      }

      const target = grouped.get(key)!;
      target.totalBusiness += inc.bv ?? 0;
      target.totalIncome += inc.amount ?? 0;
      target.entries.push(inc);

      const level = inc.level ?? 0;
      if (level > 0) {
        target.levelMap.set(level, (target.levelMap.get(level) ?? 0) + (inc.amount ?? 0));
      }
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
      .map((entry) => ({
        key: entry.key,
        periodLabel: entry.periodLabel,
        periodStart: entry.periodStart,
        totalBusiness: entry.totalBusiness,
        totalIncome: entry.totalIncome,
        levelTotals: Array.from(entry.levelMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([level, amount]) => ({ level, amount })),
        entries: entry.entries.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
      }));
  };

  const generateReport = () => {
    setReportRows(buildReport(reportType));
  };

  useEffect(() => {
    setReportRows(buildReport(reportType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, filteredIncomes, reportType, customFrom, customTo]);

  const fromUserLabel = (fromUser?: Income["fromUser"]) => {
    if (!fromUser || typeof fromUser === "string") return "-";
    return fromUser.name || fromUser.email || fromUser.referralCode || "-";
  };
  const fromUserEmail = (fromUser?: Income["fromUser"]) => {
    if (!fromUser || typeof fromUser === "string") return "-";
    return fromUser.email || "-";
  };
  const fromUserMobile = (fromUser?: Income["fromUser"]) => {
    if (!fromUser || typeof fromUser === "string") return "-";
    return fromUser.mobile || "-";
  };

  const rowPeriodLabel = (inc: Income, type: ReportType): string => {
    const d = new Date(inc.createdAt);
    if (Number.isNaN(d.getTime())) return "-";
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const quarter = Math.floor((month - 1) / 3) + 1;
    if (type === "monthly") return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (type === "quarterly") return `Q${quarter} ${year}`;
    if (type === "annual") return `${year}`;
    return customFrom || customTo ? `${customFrom || "Start"} to ${customTo || "End"}` : "Custom Period";
  };

  const downloadCsvReport = () => {
    const lines: string[] = [];
    lines.push(`Report Type,${reportType.toUpperCase()}`);
    if (reportType === "custom") {
      lines.push(`Custom From,${customFrom || "-"}`);
      lines.push(`Custom To,${customTo || "-"}`);
    }
    lines.push(`Total Business,${totalBusiness}`);
    lines.push(`Total Income,${totalAmount.toFixed(2)}`);
    lines.push("");
    lines.push("Period,Date,Level,From User,Mobile,Email,BV,Amount");

    reportRows.forEach((row) => {
      row.entries.forEach((inc) => {
        const dateStr = new Date(inc.createdAt).toLocaleString("en-IN");
        const from = fromUserLabel(inc.fromUser).replace(/,/g, " ");
        const mobile = fromUserMobile(inc.fromUser).replace(/,/g, " ");
        const email = fromUserEmail(inc.fromUser).replace(/,/g, " ");
        lines.push(
          `"${rowPeriodLabel(inc, reportType)}","${dateStr}","L${inc.level}","${from}","${mobile}","${email}",${inc.bv ?? 0},${(inc.amount ?? 0).toFixed(2)}`
        );
      });
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income-report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = `Income Report (${reportType.toUpperCase()})`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 58);
    if (reportType === "custom") {
      doc.text(`Custom range: ${customFrom || "-"} to ${customTo || "-"}`, 40, 74);
    }
    doc.text(`Total Business: ${totalBusiness}    Total Income: ${formatINRPrecise(totalAmount)}`, 40, 90);

    const bodyRows: Array<Array<string | number>> = [];
    reportRows.forEach((row) => {
      row.entries.forEach((inc) => {
        bodyRows.push([
          rowPeriodLabel(inc, reportType),
          new Date(inc.createdAt).toLocaleString("en-IN"),
          `L${inc.level}`,
          fromUserLabel(inc.fromUser),
          fromUserMobile(inc.fromUser),
          fromUserEmail(inc.fromUser),
          inc.bv ?? 0,
          formatINRPrecise(inc.amount ?? 0),
        ]);
      });
    });

    autoTable(doc, {
      startY: 105,
      head: [["Period", "Date", "Level", "From User", "Mobile", "Email", "BV", "Amount"]],
      body: bodyRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.save(`income-report-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading && incomes.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading income reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Income Reports</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Monthly, Quarterly, and Annual business and income distribution reports
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
              <span className="font-medium text-zinc-800">Total Income: {formatINRPrecise(totalAmount)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-sky-600" />
              <span className="font-medium text-zinc-800">Total Business: {totalBusiness}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReportType("monthly")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "monthly"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setReportType("quarterly")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "quarterly"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Quarterly
            </button>
            <button
              type="button"
              onClick={() => setReportType("annual")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "annual"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Annual
            </button>
            <button
              type="button"
              onClick={() => setReportType("custom")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "custom"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Custom
            </button>
            {reportType === "custom" && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
                />
              </>
            )}
            <button
              type="button"
              onClick={generateReport}
              className="rounded-lg border border-emerald-300 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 hover:cursor-pointer"
            >
              Generate Report
            </button>
            <button
              type="button"
              onClick={downloadCsvReport}
              disabled={reportRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={downloadPdfReport}
              disabled={reportRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>

          {availableYears.length > 0 && (
            <p className="mb-2 text-xs text-zinc-500">Data years: {availableYears.join(", ")}</p>
          )}

          {reportRows.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No report data available.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/60">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Period
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Total Business
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Total Income
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Income Distribution
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {reportRows.map((row) => (
                    <tr key={row.key} className="transition hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-800">{row.periodLabel}</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-700">{row.totalBusiness}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700">
                        {formatINRPrecise(row.totalIncome)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {row.levelTotals.length === 0 ? (
                          <span className="text-zinc-400">No level distribution</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {row.levelTotals.map((l) => (
                              <span
                                key={`${row.key}-L${l.level}`}
                                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
                              >
                                L{l.level}: {formatINRPrecise(l.amount)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

