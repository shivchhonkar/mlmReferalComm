"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Income = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
  purchase?: {
    _id?: string;
    service?:
      | string
      | {
          _id?: string;
          name?: string;
          price?: number;
          businessVolume?: number;
        };
  };
};

type ApiResponse = {
  incomes: Income[];
};

type ReportType = "monthly" | "quarterly" | "annual" | "custom";

type ReportRow = {
  key: string;
  periodLabel: string;
  serviceId: string;
  serviceName: string;
  totalBusiness: number;
  totalIncome: number;
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

function quarterFromMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

export default function ServiceIncomeReportsPage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("all");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);

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

  const serviceMeta = useMemo(() => {
    const map = new Map<string, string>();
    incomes.forEach((inc) => {
      const svc = inc.purchase?.service;
      if (!svc) return;
      if (typeof svc === "string") {
        if (!map.has(svc)) map.set(svc, `Service ${svc}`);
      } else if (svc._id) {
        map.set(svc._id, svc.name || `Service ${svc._id}`);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [incomes]);

  const filteredIncomes = useMemo(() => {
    const byDate = incomes.filter((inc) => {
      const dt = new Date(inc.createdAt);
      if (Number.isNaN(dt.getTime())) return false;
      if (reportType === "custom") {
        const from = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
        const to = customTo ? new Date(`${customTo}T23:59:59`) : null;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      return true;
    });

    if (selectedServiceId === "all") return byDate;
    return byDate.filter((inc) => {
      const svc = inc.purchase?.service;
      const svcId = typeof svc === "string" ? svc : svc?._id;
      return svcId === selectedServiceId;
    });
  }, [incomes, reportType, customFrom, customTo, selectedServiceId]);

  const totalBusiness = filteredIncomes.reduce((sum, inc) => sum + (inc.bv ?? 0), 0);
  const totalIncome = filteredIncomes.reduce((sum, inc) => sum + (inc.amount ?? 0), 0);

  const buildReport = (type: ReportType): ReportRow[] => {
    const grouped = new Map<
      string,
      {
        key: string;
        periodLabel: string;
        serviceId: string;
        serviceName: string;
        totalBusiness: number;
        totalIncome: number;
        entries: Income[];
        sortTs: number;
      }
    >();

    filteredIncomes.forEach((inc) => {
      const d = new Date(inc.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const quarter = quarterFromMonth(month);
      const svc = inc.purchase?.service;
      const serviceId = typeof svc === "string" ? svc : svc?._id || "unknown";
      const serviceName =
        typeof svc === "string"
          ? `Service ${svc}`
          : svc?.name || `Service ${serviceId}`;

      let periodKey = "";
      let periodLabel = "";
      let sortTs = d.getTime();

      if (type === "monthly") {
        periodKey = `${year}-${String(month).padStart(2, "0")}`;
        periodLabel = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        sortTs = new Date(year, month - 1, 1).getTime();
      } else if (type === "quarterly") {
        periodKey = `${year}-Q${quarter}`;
        periodLabel = `Q${quarter} ${year}`;
        sortTs = new Date(year, (quarter - 1) * 3, 1).getTime();
      } else if (type === "annual") {
        periodKey = `${year}`;
        periodLabel = `${year}`;
        sortTs = new Date(year, 0, 1).getTime();
      } else {
        periodKey = customFrom || customTo ? `${customFrom || "start"}-${customTo || "end"}` : "custom";
        periodLabel = customFrom || customTo ? `${customFrom || "Start"} to ${customTo || "End"}` : "Custom Period";
        sortTs = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : 0;
      }

      const key = `${periodKey}__${serviceId}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          periodLabel,
          serviceId,
          serviceName,
          totalBusiness: 0,
          totalIncome: 0,
          entries: [],
          sortTs,
        });
      }

      const target = grouped.get(key)!;
      target.totalBusiness += inc.bv ?? 0;
      target.totalIncome += inc.amount ?? 0;
      target.entries.push(inc);
    });

    return Array.from(grouped.values())
      .sort((a, b) => b.sortTs - a.sortTs || a.serviceName.localeCompare(b.serviceName))
      .map((row) => ({
        key: row.key,
        periodLabel: row.periodLabel,
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        totalBusiness: row.totalBusiness,
        totalIncome: row.totalIncome,
        entries: row.entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }));
  };

  useEffect(() => {
    setReportRows(buildReport(reportType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIncomes, reportType, customFrom, customTo]);

  const generateReport = () => {
    setReportRows(buildReport(reportType));
  };

  const downloadCsv = () => {
    const lines: string[] = [];
    lines.push(`Report Type,${reportType.toUpperCase()}`);
    lines.push(`Selected Service,${selectedServiceId === "all" ? "All Services" : selectedServiceId}`);
    if (reportType === "custom") {
      lines.push(`Custom From,${customFrom || "-"}`);
      lines.push(`Custom To,${customTo || "-"}`);
    }
    lines.push(`Total Business,${totalBusiness}`);
    lines.push(`Total Income,${totalIncome.toFixed(2)}`);
    lines.push("");
    lines.push("Period,Service Name,Date,Level,BV,Amount");
    reportRows.forEach((row) => {
      row.entries.forEach((inc) => {
        lines.push(
          `"${row.periodLabel}","${row.serviceName}","${new Date(inc.createdAt).toLocaleString("en-IN")}","L${inc.level}",${inc.bv ?? 0},${(inc.amount ?? 0).toFixed(2)}`
        );
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `service-income-report-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Service Income Report (${reportType.toUpperCase()})`, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 40, 58);
    doc.text(`Selected Service: ${selectedServiceId === "all" ? "All Services" : selectedServiceId}`, 40, 74);
    if (reportType === "custom") {
      doc.text(`Custom range: ${customFrom || "-"} to ${customTo || "-"}`, 40, 90);
    }
    doc.text(`Total Business: ${totalBusiness}    Total Income: ${formatINRPrecise(totalIncome)}`, 40, 106);

    const body: Array<Array<string | number>> = [];
    reportRows.forEach((row) => {
      row.entries.forEach((inc) => {
        body.push([
          row.periodLabel,
          row.serviceName,
          new Date(inc.createdAt).toLocaleString("en-IN"),
          `L${inc.level}`,
          inc.bv ?? 0,
          formatINRPrecise(inc.amount ?? 0),
        ]);
      });
    });

    autoTable(doc, {
      startY: 120,
      head: [["Period", "Service", "Date", "Level", "BV", "Amount"]],
      body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129] },
    });
    doc.save(`service-income-report-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading && incomes.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p>Loading service income reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Service Income Reports</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Separate income reports for each service
          </p>
        </div>
        <button
          type="button"
          onClick={fetchIncomes}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
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
              <span className="font-medium text-zinc-800">Total Income: {formatINRPrecise(totalIncome)}</span>
            </div>
            <span className="font-medium text-zinc-800">Total Business: {totalBusiness}</span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
            >
              <option value="all">All services</option>
              {serviceMeta.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setReportType("monthly")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "monthly" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setReportType("quarterly")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "quarterly" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Quarterly
            </button>
            <button
              type="button"
              onClick={() => setReportType("annual")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "annual" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              } hover:cursor-pointer`}
            >
              Annual
            </button>
            <button
              type="button"
              onClick={() => setReportType("custom")}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                reportType === "custom" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
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
              onClick={downloadCsv}
              disabled={reportRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={reportRows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>

          {reportRows.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">No service report data available.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-[860px]">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/60">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Service</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Total Business</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Total Income</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">Entries</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {reportRows.map((row) => (
                    <tr key={row.key} className="transition hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm text-zinc-800">{row.periodLabel}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800">{row.serviceName}</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-700">{row.totalBusiness}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700">{formatINRPrecise(row.totalIncome)}</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-700">{row.entries.length}</td>
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

