"use client";

import { useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import PayoutPaymentFields, {
  isPayoutPaymentValid,
  type PayoutPaymentPayload,
} from "./PayoutPaymentFields";

type Props = {
  withdrawalId: string;
  disabled?: boolean;
  onDone?: () => void;
  compact?: boolean;
};

export default function WithdrawalPayoutActions({
  withdrawalId,
  disabled,
  onDone,
  compact,
}: Props) {
  const [paying, setPaying] = useState(false);
  const [acting, setActing] = useState(false);
  const [payment, setPayment] = useState<PayoutPaymentPayload>({ paymentMethod: "cash" });

  const reject = async () => {
    setActing(true);
    try {
      const res = await apiFetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          rejectionReason: "Rejected by admin",
        }),
      });
      const body = await readApiBody(res);
      const data = body.json as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Reject failed");
      showSuccessToast("Withdrawal rejected");
      setPaying(false);
      onDone?.();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  const markPaid = async () => {
    if (!isPayoutPaymentValid(payment.paymentMethod, payment.paymentProofUrl)) {
      showErrorToast("Upload a UPI screenshot before confirming payment");
      return;
    }
    setActing(true);
    try {
      const res = await apiFetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          paymentMethod: payment.paymentMethod,
          paymentProofUrl: payment.paymentProofUrl,
        }),
      });
      const body = await readApiBody(res);
      const data = body.json as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Payment failed");
      showSuccessToast("Payment recorded");
      setPaying(false);
      setPayment({ paymentMethod: "cash" });
      onDone?.();
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  if (paying) {
    return (
      <div className={compact ? "mt-2 min-w-[220px]" : "mt-2"}>
        <PayoutPaymentFields
          key={withdrawalId}
          disabled={disabled || acting}
          onChange={setPayment}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || acting}
            onClick={() => void markPaid()}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Confirm payment
          </button>
          <button
            type="button"
            disabled={acting}
            onClick={() => {
              setPaying(false);
              setPayment({ paymentMethod: "cash" });
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || acting}
        onClick={() => setPaying(true)}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Approve & pay
      </button>
      <button
        type="button"
        disabled={disabled || acting}
        onClick={() => void reject()}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
