"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import ReportExportButtons from "../_components/ReportExportButtons";
import { formatActionLabel, formatINRPrecise, personLabel } from "../lib";

type AuditRow = {
  _id: string;
  action: string;
  amount?: number | null;
  previousStatus?: string;
  newStatus?: string;
  note?: string;
  createdAt: string;
  adminId?: { fullName?: string; name?: string; email?: string };
  targetUserId?: { fullName?: string; name?: string; email?: string; mobile?: string };
};

export default function IncomeReportsAuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/reports/payment-audit?limit=200&scope=mine");
      const body = await readApiBody(res);
      const data = body.json as { logs?: AuditRow[] };
      setLogs(data.logs ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHeaders = [
    "When",
    "Admin",
    "User",
    "Action",
    "Amount (INR)",
    "Status change",
    "Note",
  ];

  const exportRows = useMemo(
    () =>
      logs.map((log) => [
        new Date(log.createdAt).toLocaleString("en-IN"),
        personLabel(log.adminId),
        personLabel(log.targetUserId),
        formatActionLabel(log.action),
        log.amount != null ? log.amount.toFixed(2) : "—",
        `${log.previousStatus || "—"} → ${log.newStatus || "—"}`,
        log.note || "—",
      ]),
    [logs],
  );

  const fileBase = `admin-income-audit-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-zinc-600">
          Your actions on customer withdrawals and manual payouts — approve, reject, pay (cash/UPI),
          and notes. UPI payments store screenshot proof for audit.
        </p>
        <ReportExportButtons
          reportTitle="Admin Income — My Audit Log"
          fileNameBase={fileBase}
          meta={[{ label: "Entries", value: String(logs.length) }]}
          headers={exportHeaders}
          rows={exportRows}
          disabled={busy}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-3 py-3">When</th>
              <th className="px-3 py-3">Admin</th>
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Action</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Status change</th>
              <th className="px-3 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-zinc-100">
                <td className="px-3 py-3 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-xs">{personLabel(log.adminId)}</td>
                <td className="px-3 py-3 text-xs">{personLabel(log.targetUserId)}</td>
                <td className="px-3 py-3 text-xs capitalize">{formatActionLabel(log.action)}</td>
                <td className="px-3 py-3 text-xs">
                  {log.amount != null ? formatINRPrecise(log.amount) : "—"}
                </td>
                <td className="px-3 py-3 text-xs">
                  {log.previousStatus || "—"} → {log.newStatus || "—"}
                </td>
                <td className="px-3 py-3 text-xs text-zinc-600">{log.note || "—"}</td>
              </tr>
            ))}
            {!busy && logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  No audit entries yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
