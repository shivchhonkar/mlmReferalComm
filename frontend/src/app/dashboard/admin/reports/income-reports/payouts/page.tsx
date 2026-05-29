"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import ReportExportButtons from "../_components/ReportExportButtons";
import { formatINRPrecise, personLabel } from "../lib";
import PayoutPaymentFields, {
  isPayoutPaymentValid,
  type PayoutPaymentPayload,
} from "../_components/PayoutPaymentFields";

type WithdrawalRow = {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  paymentMethod?: string;
  paymentProofUrl?: string;
  user?: {
    _id?: string;
    fullName?: string;
    name?: string;
    email?: string;
    mobile?: string;
    referralCode?: string;
  };
};

export default function IncomeReportsPayoutsPage() {
  const [status, setStatus] = useState<"pending" | "completed" | "rejected" | "all">("all");
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PayoutPaymentPayload>({ paymentMethod: "cash" });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/withdrawals?status=${status}`);
      const body = await readApiBody(res);
      const data = body.json as { withdrawals?: WithdrawalRow[]; error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setRows(data.withdrawals ?? []);
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, next: "completed" | "rejected") => {
    if (next === "completed") {
      if (!isPayoutPaymentValid(payment.paymentMethod, payment.paymentProofUrl)) {
        showErrorToast("Upload a UPI screenshot before marking as paid");
        return;
      }
    }

    setActingId(id);
    try {
      const payload =
        next === "rejected"
          ? { status: next, rejectionReason: "Rejected by admin" }
          : {
              status: next,
              paymentMethod: payment.paymentMethod,
              paymentProofUrl: payment.paymentProofUrl,
            };
      const res = await apiFetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await readApiBody(res);
      const data = body.json as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Update failed");
      showSuccessToast(next === "completed" ? "Marked as paid" : "Withdrawal rejected");
      setPayingId(null);
      setPayment({ paymentMethod: "cash" });
      await load();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setActingId(null);
    }
  };

  const startPay = (id: string) => {
    setPayingId(id);
    setPayment({ paymentMethod: "cash" });
  };

  const cancelPay = () => {
    setPayingId(null);
    setPayment({ paymentMethod: "cash" });
  };

  const exportHeaders = [
    "User",
    "Amount (INR)",
    "Status",
    "Payment",
    "Requested",
    "Rejection reason",
  ];

  const exportRows = useMemo(
    () =>
      rows.map((w) => [
        personLabel(w.user),
        (w.amount ?? 0).toFixed(2),
        w.status,
        w.status === "completed" && w.paymentMethod ? w.paymentMethod.toUpperCase() : "—",
        new Date(w.createdAt).toLocaleString("en-IN"),
        w.rejectionReason || "—",
      ]),
    [rows],
  );

  const fileBase = `admin-income-payouts-${status}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["pending", "completed", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-xl px-3 py-2 text-sm font-medium capitalize ${
                status === s ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <ReportExportButtons
          reportTitle="Admin Income — Payout Queue"
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
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const uid = String(w.user?._id ?? "");
              const name = w.user?.fullName || w.user?.name || "User";
              const isPaying = payingId === w._id;
              return (
                <Fragment key={w._id}>
                  <tr className="border-b border-zinc-100">
                    <td className="px-3 py-3">
                      <div className="font-medium">{name}</div>
                      {uid ? (
                        <Link
                          href={`/dashboard/admin/reports/income-reports/${uid}`}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          View income
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 font-medium">{formatINRPrecise(w.amount)}</td>
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
                                className="text-emerald-700 hover:underline"
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
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {new Date(w.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      {w.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          {!isPaying ? (
                            <button
                              type="button"
                              disabled={actingId === w._id}
                              onClick={() => startPay(w._id)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={actingId === w._id || isPaying}
                            onClick={() => void updateStatus(w._id, "rejected")}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                  {isPaying ? (
                    <tr className="border-b border-zinc-100 bg-zinc-50/50">
                      <td colSpan={6} className="px-3 py-4">
                        <PayoutPaymentFields
                          key={w._id}
                          disabled={actingId === w._id}
                          onChange={setPayment}
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={actingId === w._id}
                            onClick={() => void updateStatus(w._id, "completed")}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Confirm payment
                          </button>
                          <button
                            type="button"
                            disabled={actingId === w._id}
                            onClick={cancelPay}
                            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-white disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!busy && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-zinc-500">
                  No withdrawals in this filter
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
