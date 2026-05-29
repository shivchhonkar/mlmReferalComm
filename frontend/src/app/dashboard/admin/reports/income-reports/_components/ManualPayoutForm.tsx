"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { formatINRPrecise, type IncomeSummaryRow } from "../lib";
import PayoutPaymentFields, {
  isPayoutPaymentValid,
  type PayoutPaymentPayload,
} from "./PayoutPaymentFields";

type Props = {
  onSuccess?: () => void;
};

export default function ManualPayoutForm({ onSuccess }: Props) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<IncomeSummaryRow[]>([]);
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<IncomeSummaryRow | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PayoutPaymentPayload>({ paymentMethod: "cash" });
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async () => {
    const term = q.trim();
    if (term.length < 2) {
      setOptions([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/admin/reports/income-summaries?q=${encodeURIComponent(term)}&limit=20`,
      );
      const body = await readApiBody(res);
      const data = body.json as { items?: IncomeSummaryRow[] };
      setOptions(data.items ?? []);
    } catch {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => void search(), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const pick = (row: IncomeSummaryRow) => {
    setSelected(row);
    setUserId(row.user.id);
    setOptions([]);
    setQ(row.user.name || row.user.email);
  };

  const submit = async () => {
    if (!userId) {
      showErrorToast("Select a customer");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showErrorToast("Enter a valid amount");
      return;
    }
    if (!isPayoutPaymentValid(payment.paymentMethod, payment.paymentProofUrl)) {
      showErrorToast("Upload a UPI screenshot for UPI payouts");
      return;
    }
    if (selected && amt > selected.withdrawalAmount + 1e-6) {
      showErrorToast(
        `Amount exceeds withdrawable balance (${formatINRPrecise(selected.withdrawalAmount)})`,
      );
      return;
    }

    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/reports/manual-payout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          amount: amt,
          note,
          paymentMethod: payment.paymentMethod,
          paymentProofUrl: payment.paymentProofUrl,
        }),
      });
      const body = await readApiBody(res);
      const data = body.json as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      showSuccessToast("Manual payout recorded");
      setAmount("");
      setNote("");
      setPayment({ paymentMethod: "cash" });
      setSelected(null);
      setUserId("");
      setQ("");
      onSuccess?.();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-zinc-900">Manual payout (no request)</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Pay a customer directly without a withdrawal request. Only their withdrawable balance can
        be paid. UPI requires a payment screenshot for audit.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Find customer</label>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) {
                setSelected(null);
                setUserId("");
              }
            }}
            placeholder="Name, email, mobile, or referral code…"
            className="w-full max-w-md rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          {searching ? <p className="mt-1 text-xs text-zinc-500">Searching…</p> : null}
          {options.length > 0 ? (
            <ul className="mt-2 max-w-md rounded-lg border border-zinc-200 bg-white shadow-sm">
              {options.map((row) => (
                <li key={row.user.id}>
                  <button
                    type="button"
                    onClick={() => pick(row)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  >
                    <span className="font-medium">{row.user.name}</span>
                    <span className="text-zinc-500"> · {row.user.email || row.user.mobile}</span>
                    <span className="block text-xs text-emerald-700">
                      Withdrawable {formatINRPrecise(row.withdrawalAmount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {selected ? (
          <p className="text-sm text-zinc-700">
            Paying <strong>{selected.user.name}</strong> — withdrawable{" "}
            <strong>{formatINRPrecise(selected.withdrawalAmount)}</strong>
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="text-xs text-zinc-500">Amount (INR)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm sm:w-36"
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-zinc-500">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <PayoutPaymentFields disabled={busy} onChange={setPayment} />

        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Record payment
        </button>
      </div>
    </div>
  );
}
