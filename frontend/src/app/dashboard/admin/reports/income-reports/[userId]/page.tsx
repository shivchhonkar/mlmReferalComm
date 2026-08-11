"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { ArrowLeft } from "lucide-react";
import ReportExportButtons, { type ReportSection } from "../_components/ReportExportButtons";
import { formatINRPrecise, type WithdrawalSummary } from "../lib";
import PayoutPaymentFields, {
  isPayoutPaymentValid,
  type PayoutPaymentPayload,
} from "../_components/PayoutPaymentFields";
import { formatServiceCostDisplay, resolveIncomeServiceCost } from "@/lib/incomeServiceCost";

type IncomeEntry = {
  _id: string;
  level: number;
  bv: number;
  amount: number;
  createdAt: string;
  fromUser?: { fullName?: string; name?: string; email?: string };
  purchase?: {
    service?: { _id?: string; name?: string; price?: number } | string;
    order?: {
      items?: Array<{ service?: string; price?: number }>;
    } | null;
  };
};

type WithdrawalEntry = {
  _id: string;
  amount: number;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  paymentMethod?: string;
  paymentProofUrl?: string;
};

export default function IncomeReportsUserDetailPage() {
  const params = useParams();
  const userId = String(params.userId ?? "");

  const [busy, setBusy] = useState(true);
  const [summary, setSummary] = useState<WithdrawalSummary | null>(null);
  const [userName, setUserName] = useState("");
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalEntry[]>([]);
  const [manualAmount, setManualAmount] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [markPaidPayment, setMarkPaidPayment] = useState<PayoutPaymentPayload>({
    paymentMethod: "cash",
  });
  const [manualPayment, setManualPayment] = useState<PayoutPaymentPayload>({
    paymentMethod: "cash",
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/reports/income-summaries/${encodeURIComponent(userId)}`);
      const body = await readApiBody(res);
      const data = body.json as {
        user?: { name?: string };
        summary?: WithdrawalSummary;
        incomes?: IncomeEntry[];
        withdrawals?: WithdrawalEntry[];
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setUserName(data.user?.name ?? "User");
      setSummary(data.summary ?? null);
      setIncomes(data.incomes ?? []);
      setWithdrawals(data.withdrawals ?? []);
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (withdrawalId: string) => {
    if (
      !isPayoutPaymentValid(markPaidPayment.paymentMethod, markPaidPayment.paymentProofUrl)
    ) {
      showErrorToast("Upload a UPI screenshot before marking as paid");
      return;
    }
    setActingId(withdrawalId);
    try {
      const res = await apiFetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          paymentMethod: markPaidPayment.paymentMethod,
          paymentProofUrl: markPaidPayment.paymentProofUrl,
        }),
      });
      const body = await readApiBody(res);
      const data = body.json as { summary?: WithdrawalSummary; error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.summary) setSummary(data.summary);
      showSuccessToast("Payment marked as paid");
      setPayingId(null);
      setMarkPaidPayment({ paymentMethod: "cash" });
      await load();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setActingId(null);
    }
  };

  const submitManualPayout = async () => {
    const amount = Number(manualAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showErrorToast("Enter a valid amount");
      return;
    }
    if (!isPayoutPaymentValid(manualPayment.paymentMethod, manualPayment.paymentProofUrl)) {
      showErrorToast("Upload a UPI screenshot for UPI payouts");
      return;
    }
    try {
      const res = await apiFetch("/api/admin/reports/manual-payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          amount,
          note: manualNote,
          paymentMethod: manualPayment.paymentMethod,
          paymentProofUrl: manualPayment.paymentProofUrl,
        }),
      });
      const body = await readApiBody(res);
      const data = body.json as { summary?: WithdrawalSummary; error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      if (data.summary) setSummary(data.summary);
      setManualAmount("");
      setManualNote("");
      setManualPayment({ paymentMethod: "cash" });
      showSuccessToast("Manual payout recorded");
      await load();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    }
  };

  const serviceLabel = (row: IncomeEntry) => {
    const s = row.purchase?.service;
    return typeof s === "string" ? s : s?.name || "—";
  };

  const exportMeta = useMemo(() => {
    if (!summary) return [{ label: "Customer", value: userName }];
    return [
      { label: "Customer", value: userName },
      { label: "Total earned", value: summary.totalEarnedAmount.toFixed(2) },
      { label: "Total paid", value: summary.totalPaidAmount.toFixed(2) },
      { label: "Remaining withdrawable", value: summary.withdrawalAmount.toFixed(2) },
      { label: "Pending payouts", value: summary.pendingPayouts.toFixed(2) },
    ];
  }, [summary, userName]);

  const exportSections = useMemo((): ReportSection[] => {
    return [
      {
        title: "Withdrawal requests",
        headers: ["Amount (INR)", "Status", "Date", "Payment method"],
        rows: withdrawals.map((w) => [
          w.amount.toFixed(2),
          w.status,
          new Date(w.createdAt).toLocaleString("en-IN"),
          w.status === "completed" && w.paymentMethod ? w.paymentMethod.toUpperCase() : "—",
        ]),
      },
      {
        title: "Income sources",
        headers: ["Date", "Level", "From", "Service", "BV", "Service cost", "Amount (INR)"],
        rows: incomes.map((inc) => [
          new Date(inc.createdAt).toLocaleString("en-IN"),
          `L${inc.level}`,
          inc.fromUser?.fullName || inc.fromUser?.name || inc.fromUser?.email || "—",
          serviceLabel(inc),
          String(inc.bv),
          formatServiceCostDisplay(inc.purchase),
          inc.amount.toFixed(2),
        ]),
      },
    ];
  }, [withdrawals, incomes]);

  const fileBase = `admin-income-customer-${userId.slice(-8)}-${new Date().toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/admin/reports/income-reports"
          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to income overview
        </Link>
        <ReportExportButtons
          reportTitle={`Admin Income — ${userName}`}
          fileNameBase={fileBase}
          meta={exportMeta}
          sections={exportSections}
          disabled={busy}
        />
      </div>

      <h2 className="text-lg font-semibold text-zinc-900">{userName}</h2>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total earned", value: summary.totalEarnedAmount, cls: "text-emerald-800" },
            { label: "Total paid", value: summary.totalPaidAmount, cls: "text-sky-800" },
            { label: "Remaining withdrawable", value: summary.withdrawalAmount, cls: "text-zinc-900" },
            { label: "Pending payouts", value: summary.pendingPayouts, cls: "text-amber-800" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase text-zinc-500">{c.label}</p>
              <p className={`mt-1 text-lg font-semibold ${c.cls}`}>{formatINRPrecise(c.value)}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium text-zinc-900">Manual payout</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="text-xs text-zinc-500">Amount (INR)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm sm:w-40"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500">Note (optional)</label>
            <input
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void submitManualPayout()}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Record payout
          </button>
        </div>
        <div className="mt-4">
          <PayoutPaymentFields onChange={setManualPayment} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium text-zinc-900">Withdrawal requests</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-zinc-500">
                <th className="px-2 py-2 text-left">Amount</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Payment</th>
                <th className="px-2 py-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w._id} className="border-b border-zinc-100">
                  <td className="px-2 py-2">{formatINRPrecise(w.amount)}</td>
                  <td className="px-2 py-2 capitalize">{w.status}</td>
                  <td className="px-2 py-2 text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs">
                    {w.status === "completed" && w.paymentMethod ? (
                      <>
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
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {w.status === "pending" ? (
                      payingId === w._id ? (
                        <span className="text-xs text-zinc-500">Confirm below</span>
                      ) : (
                        <button
                          type="button"
                          disabled={actingId === w._id}
                          onClick={() => {
                            setPayingId(w._id);
                            setMarkPaidPayment({ paymentMethod: "cash" });
                          }}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {payingId ? (
                <tr>
                  <td colSpan={5} className="px-2 py-3">
                    <PayoutPaymentFields
                      key={payingId}
                      disabled={actingId === payingId}
                      onChange={setMarkPaidPayment}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actingId === payingId}
                        onClick={() => void markPaid(payingId)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Confirm payment
                      </button>
                      <button
                        type="button"
                        disabled={actingId === payingId}
                        onClick={() => {
                          setPayingId(null);
                          setMarkPaidPayment({ paymentMethod: "cash" });
                        }}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-medium text-zinc-900">Income sources</h3>
        {busy ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-zinc-500">
                  <th className="px-2 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Level</th>
                  <th className="px-2 py-2 text-left">From</th>
                  <th className="px-2 py-2 text-left">Service</th>
                  <th className="px-2 py-2 text-left">BV</th>
                  <th className="px-2 py-2 text-left">Service cost</th>
                  <th className="px-2 py-2 text-left">Amount</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((inc) => (
                  <tr key={inc._id} className="border-b border-zinc-100">
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">L{inc.level}</td>
                    <td className="px-2 py-2">
                      {inc.fromUser?.fullName || inc.fromUser?.name || inc.fromUser?.email || "—"}
                    </td>
                    <td className="px-2 py-2">{serviceLabel(inc)}</td>
                    <td className="px-2 py-2">{inc.bv}</td>
                    <td className="px-2 py-2">
                      {(() => {
                        const cost = resolveIncomeServiceCost(inc.purchase);
                        return cost == null ? "—" : formatINRPrecise(cost);
                      })()}
                    </td>
                    <td className="px-2 py-2 font-medium text-emerald-800">
                      {formatINRPrecise(inc.amount)}
                    </td>
                  </tr>
                ))}
                {incomes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No income entries
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
