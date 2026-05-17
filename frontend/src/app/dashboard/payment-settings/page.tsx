"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Copy, ExternalLink, Link2, Smartphone, Store, X } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type SellerPaymentSettings = {
  paymentLinkEnabled: boolean;
  upiLink: string;
};

export default function UserPaymentSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<SellerPaymentSettings>({
    paymentLinkEnabled: false,
    upiLink: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEligibilityAlert, setShowEligibilityAlert] = useState(false);
  const [eligibilityMessage, setEligibilityMessage] = useState("");

  const sellerStatus = String((user as { sellerStatus?: string } | null)?.sellerStatus ?? "");
  const isSellerApproved = Boolean((user as { isSeller?: boolean } | null)?.isSeller) && sellerStatus === "approved";
  const isSellerPending = sellerStatus === "pending";

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch("/api/requests/seller-payment-settings");
        const body = await readApiBody(res);
        if (!res.ok) {
          throw new Error((body.json as { error?: string } | null)?.error || body.text || "Failed to load payment settings");
        }
        const data = (body.json || {}) as Partial<SellerPaymentSettings>;
        setSettings({
          paymentLinkEnabled: Boolean(data.paymentLinkEnabled),
          upiLink: String(data.upiLink ?? "").trim(),
        });
      } catch (err) {
        showErrorToast(err instanceof Error ? err.message : "Failed to load payment settings");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) loadSettings();
  }, [authLoading]);

  const canPay = settings.paymentLinkEnabled && settings.upiLink.length > 0;

  const upiDeepLink = useMemo(() => {
    const raw = settings.upiLink.trim();
    if (!raw) return "";
    if (raw.startsWith("upi://")) return raw;
    return raw;
  }, [settings.upiLink]);

  async function copyUpiLink() {
    if (!upiDeepLink) return;
    try {
      await navigator.clipboard.writeText(upiDeepLink);
      showSuccessToast("UPI link copied");
    } catch {
      showErrorToast("Unable to copy UPI link");
    }
  }

  async function handleBecomeSeller() {
    setSubmitting(true);
    try {
      const [kycRes, paymentRes] = await Promise.all([
        apiFetch("/api/kyc"),
        apiFetch("/api/requests/seller-payment-settings"),
      ]);
      const [kycBody, paymentBody] = await Promise.all([readApiBody(kycRes), readApiBody(paymentRes)]);

      if (!kycRes.ok) {
        throw new Error((kycBody.json as { error?: string } | null)?.error || kycBody.text || "Failed to validate KYC");
      }
      if (!paymentRes.ok) {
        throw new Error(
          (paymentBody.json as { error?: string } | null)?.error ||
            paymentBody.text ||
            "Failed to validate payment settings"
        );
      }

      const kycStatus = String(((kycBody.json as any)?.kyc?.kycStatus ?? "")).toLowerCase();
      const paymentEnabled = Boolean((paymentBody.json as any)?.paymentLinkEnabled);
      const upiLink = String((paymentBody.json as any)?.upiLink ?? "").trim();
      const hasPaymentMethod = paymentEnabled && upiLink.length > 0;

      if (kycStatus !== "verified" || !hasPaymentMethod) {
        setEligibilityMessage("KYC approval and payment method are mendatory to become a seller");
        setShowEligibilityAlert(true);
        return;
      }

      const response = await apiFetch("/api/requests/seller", { method: "POST" });
      const responseBody = await readApiBody(response);
      const data = responseBody.json as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || responseBody.text || "Failed to submit seller request");
      }
      showSuccessToast("Seller request submitted successfully");
      window.location.href = "/dashboard";
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to submit seller request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Seller Payment Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Users who want to become sellers can complete payment using the UPI details below.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Link2 className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Payment links</h2>
              <p className="text-sm text-slate-600">Status for seller-onboarding payments</p>
            </div>
          </div>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              settings.paymentLinkEnabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {settings.paymentLinkEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Smartphone className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">UPI details</h3>
              <p className="text-sm text-slate-600">Use this UPI link to complete payment</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            {loading ? (
              <p className="text-sm text-slate-500">Loading payment details...</p>
            ) : upiDeepLink ? (
              <p className="break-all text-sm font-medium text-slate-800">{upiDeepLink}</p>
            ) : (
              <p className="text-sm text-slate-500">UPI link is not configured yet. Please contact admin.</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyUpiLink}
              disabled={!upiDeepLink}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copy UPI Link
            </button>
            <a
              href={upiDeepLink || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                canPay
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-zinc-200 text-zinc-500 pointer-events-none"
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              Open UPI App
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Become a seller</h3>
        <p className="mt-1 text-sm text-slate-600">
          After payment, submit your seller request for admin approval.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {isSellerApproved ? (
            <Link
              href="/dashboard/seller/services"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Store className="h-4 w-4" />
              Manage Seller Services
            </Link>
          ) : isSellerPending ? (
            <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
              Request already pending approval
            </span>
          ) : (
            <button
              type="button"
              onClick={handleBecomeSeller}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Store className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Seller Request"}
            </button>
          )}
        </div>
      </div>

      {showEligibilityAlert ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">Action required</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{eligibilityMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEligibilityAlert(false)}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Link
                prefetch={false}
                href="/dashboard/payment-settings"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Setup Payment
              </Link>
              <Link
                prefetch={false}
                href="/dashboard/kyc"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Complete KYC
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
