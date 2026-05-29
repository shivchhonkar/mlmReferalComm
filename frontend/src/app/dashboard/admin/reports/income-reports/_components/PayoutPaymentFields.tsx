"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast } from "@/lib/toast";

export type PayoutPaymentMethod = "cash" | "upi";

export type PayoutPaymentPayload = {
  paymentMethod: PayoutPaymentMethod;
  paymentProofUrl?: string;
};

type Props = {
  disabled?: boolean;
  onChange?: (payload: PayoutPaymentPayload) => void;
};

export default function PayoutPaymentFields({ disabled, onChange }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<PayoutPaymentMethod>("cash");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onChange?.({ paymentMethod: "cash" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial default
  }, []);

  const emit = (method: PayoutPaymentMethod, url: string | null) => {
    onChange?.({
      paymentMethod: method,
      paymentProofUrl: method === "upi" ? url ?? undefined : undefined,
    });
  };

  const onMethodChange = (method: PayoutPaymentMethod) => {
    setPaymentMethod(method);
    if (method === "cash") {
      setProofUrl(null);
      setProofName(null);
      emit("cash", null);
    } else {
      emit("upi", proofUrl);
    }
  };

  const uploadProof = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await apiFetch("/api/admin/upload/payout-proof", {
        method: "POST",
        body: fd,
      });
      const body = await readApiBody(res);
      const data = body.json as { imageUrl?: string; error?: string };
      if (!res.ok || !data?.imageUrl) {
        throw new Error(data?.error ?? "Upload failed");
      }
      setProofUrl(data.imageUrl);
      setProofName(file.name);
      emit("upi", data.imageUrl);
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : String(e));
      setProofUrl(null);
      setProofName(null);
      emit("upi", null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Payment method</p>
      <div className="flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="payoutMethod"
            checked={paymentMethod === "cash"}
            disabled={disabled}
            onChange={() => onMethodChange("cash")}
          />
          Cash
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="payoutMethod"
            checked={paymentMethod === "upi"}
            disabled={disabled}
            onChange={() => onMethodChange("upi")}
          />
          UPI
        </label>
      </div>

      {paymentMethod === "upi" ? (
        <div>
          <label className="text-xs text-zinc-600">
            UPI screenshot <span className="text-red-600">*</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            className="mt-1 block w-full text-sm text-zinc-700"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadProof(file);
            }}
          />
          {uploading ? <p className="mt-1 text-xs text-zinc-500">Uploading…</p> : null}
          {proofUrl ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                View screenshot{proofName ? ` (${proofName})` : ""}
              </a>
            </div>
          ) : (
            <p className="mt-1 text-xs text-amber-700">Screenshot required before marking paid.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No attachment needed for cash payments.</p>
      )}
    </div>
  );
}

export function isPayoutPaymentValid(
  paymentMethod: PayoutPaymentMethod,
  paymentProofUrl?: string,
): boolean {
  if (paymentMethod === "upi") {
    return !!paymentProofUrl?.trim();
  }
  return true;
}
