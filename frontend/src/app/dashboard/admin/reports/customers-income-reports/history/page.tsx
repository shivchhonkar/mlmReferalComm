"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import ReportExportButtons from "../_components/ReportExportButtons";
import { formatINRPrecise, personLabel } from "../_lib";

type WithdrawalRow = {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string;
  paymentMethod?: string;
  paymentProofUrl?: string;
  user?: { _id?: string; fullName?: string; name?: string; email?: string };
  reviewedBy?: { fullName?: string; name?: string; email?: string };
};

export default function IncomeReportsHistoryPage() {
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ status, limit: "200" });
      const res = await apiFetch(`/api/admin/reports/payment-history?${qs}`);
      const body = await readApiBody(res);
      const data = body.json as { withdrawals?: WithdrawalRow[] };
      setRows(data.withdrawals ?? []);
    } finally {
      setBusy(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHeaders = [
    "User",
    "Amount (INR)",
    "Status",
    "Payment",
    "Requested",
    "Reviewed",
    "Reviewer",
  ];

  const exportRows = useMemo(
    () =>
      rows.map((w) => [
        personLabel(w.user),
        (w.amount ?? 0).toFixed(2),
        w.status,
        w.status === "completed" && w.paymentMethod ? w.paymentMethod.toUpperCase() : "—",
        new Date(w.createdAt).toLocaleString("en-IN"),
        w.reviewedAt ? new Date(w.reviewedAt).toLocaleString("en-IN") : "—",
        personLabel(w.reviewedBy),
      ]),
    [rows],
  );

  const fileBase = `customers-income-history-${status}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "completed", "rejected"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-xl px-3 py-2 text-sm font-medium capitalize ${
                status === s ? "bg-sky-100 text-sky-900" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <ReportExportButtons
          reportTitle="Customers Income — Payment History"
          fileNameBase={fileBase}
          meta={[
            { label: "Status filter", value: status },
            { label: "Records", value: String(rows.length) },
          ]}
          headers={exportHeaders}
          rows={exportRows}
          disabled={busy}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <th className="px-3 py-3">User</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3">Requested</th>
              <th className="px-3 py-3">Reviewed</th>
              <th className="px-3 py-3">Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w._id} className="border-b border-zinc-100">
                <td className="px-3 py-3">
                  <div className="font-medium">{w.user?.fullName || w.user?.name || "—"}</div>
                  {w.user?._id ? (
                    <Link
                      href={`/dashboard/admin/reports/customers-income-reports/${w.user._id}`}
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      Details
                    </Link>
                  ) : null}
                </td>
                <td className="px-3 py-3">{formatINRPrecise(w.amount)}</td>
                <td className="px-3 py-3 capitalize">{w.status}</td>
                <td className="px-3 py-3 text-xs">
                  {w.status === "completed" && w.paymentMethod ? (
                    <div>
                      <span className="uppercase">{w.paymentMethod}</span>
                      {w.paymentMethod === "upi" && w.paymentProofUrl ? (
                        <div>
                          <a
                            href={w.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            Screenshot
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-3 text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                <td className="px-3 py-3 text-xs">
                  {w.reviewedAt ? new Date(w.reviewedAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-3 text-xs">
                  {w.reviewedBy?.fullName || w.reviewedBy?.name || w.reviewedBy?.email || "—"}
                </td>
              </tr>
            ))}
            {!busy && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-zinc-500">
                  No payment records
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
