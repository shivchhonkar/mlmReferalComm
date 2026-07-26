"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { RefreshCw, Search } from "lucide-react";
import ReportExportButtons from "./_components/ReportExportButtons";
import { formatINRPrecise, formatBankDetailsExport, formatBankDetailsLabel, type IncomeSummaryRow } from "./_lib";

export default function IncomeReportsOverviewPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<IncomeSummaryRow[]>([]);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "50" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await apiFetch(`/api/admin/reports/income-summaries?${qs}`);
      const body = await readApiBody(res);
      const data = body.json as {
        items?: IncomeSummaryRow[];
        pagination?: { pages?: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setItems(data.items ?? []);
      setPages(data.pagination?.pages ?? 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setBusy(false);
    }
  }, [page, q]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(t);
  }, [load]);

  const exportHeaders = [
    "User",
    "Customer ID",
    "Mobile",
    "Email",
    "Bank details",
    "Total earned (INR)",
    "Total paid (INR)",
    "Remaining withdrawable (INR)",
    "Pending payouts (INR)",
  ];

  const exportRows = useMemo(
    () =>
      items.map((row) => [
        row.user.name,
        row.user.referralCode || "—",
        row.user.mobile || "—",
        row.user.email || "—",
        formatBankDetailsExport(row.user.bank),
        row.totalEarnedAmount.toFixed(2),
        row.totalPaidAmount.toFixed(2),
        row.withdrawalAmount.toFixed(2),
        row.pendingPayouts.toFixed(2),
      ]),
    [items],
  );

  const fileBase = `customers-income-overview-p${page}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Search name, email, mobile, code…"
            className="w-full rounded-xl border border-zinc-200 py-2.5 !pl-10 pr-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <ReportExportButtons
            reportTitle="Customers Income — Overview"
            fileNameBase={fileBase}
            meta={[
              { label: "Page", value: `${page} of ${pages}` },
              { label: "Search", value: q.trim() || "—" },
              { label: "Rows on page", value: String(items.length) },
            ]}
            headers={exportHeaders}
            rows={exportRows}
            disabled={busy}
          />
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs font-medium uppercase text-zinc-500">
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Customer ID</th>
              <th className="px-3 py-3">Mobile</th>
              <th className="px-3 py-3">Bank details</th>
              <th className="px-3 py-3">Total earned</th>
              <th className="px-3 py-3">Total paid</th>
              <th className="px-3 py-3">Remaining withdrawable</th>
              <th className="px-3 py-3">Pending payouts</th>
              <th className="px-3 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.user.id} className="border-b border-zinc-100 hover:bg-emerald-50/30">
                <td className="px-3 py-3">
                  <div className="font-medium text-zinc-900">{row.user.name}</div>
                  {row.user.email ? (
                    <div className="text-xs text-zinc-500">{row.user.email}</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-zinc-800">
                  {row.user.referralCode || "—"}
                </td>
                <td className="px-3 py-3 text-zinc-800">{row.user.mobile || "—"}</td>
                <td className="max-w-[220px] px-3 py-3 text-xs leading-relaxed text-zinc-700">
                  {formatBankDetailsLabel(row.user.bank)}
                </td>
                <td className="px-3 py-3 font-medium text-emerald-800">
                  {formatINRPrecise(row.totalEarnedAmount)}
                </td>
                <td className="px-3 py-3 text-sky-800">{formatINRPrecise(row.totalPaidAmount)}</td>
                <td className="px-3 py-3">{formatINRPrecise(row.withdrawalAmount)}</td>
                <td className="px-3 py-3 text-amber-800">{formatINRPrecise(row.pendingPayouts)}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/dashboard/admin/reports/customers-income-reports/${row.user.id}`}
                    className="text-sm font-medium text-emerald-700 hover:underline"
                  >
                    View details
                  </Link>
                </td>
              </tr>
            ))}
            {!busy && items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-zinc-500">
                  No users found
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
        <button
          type="button"
          disabled={page <= 1 || busy}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages || busy}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
