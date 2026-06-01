"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import {
  ShoppingBag,
  Calendar,
  Package,
  RefreshCcw,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Mail,
  Banknote,
  CreditCard,
  Wallet,
  Receipt,
  Filter,
  CheckCircle2,
  Link2,
  ExternalLink,
  Copy,
  Check,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { buildUpiPayUrl, upiQrImageUrl } from "@/lib/upiPayment";
import {
  canMarkDynamicPaid,
  canMarkDynamicPaymentReceived,
  DYNAMIC_PAYMENT_STEP_LABELS,
  dynamicOrderHasPaymentProof,
  dynamicPaymentProofVerified,
  dynamicPaymentStep,
  isPaymentLinkSharedStatus,
  orderHasAdminPricingSet,
  servicePaymentStatusLabel,
} from "@/lib/servicePayment";

import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINR } from "@/lib/format";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { useAppSelector } from "@/store/hooks";

const STATUS_OPTIONS: { value: "" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "paid" | "unpaid"; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "paid", label: "Paid" },
  { value: "unpaid", label: "Unpaid" },
];

/* -------------------- TYPES -------------------- */

type ApiOrderItem = {
  service?: string;
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
  bv?: number;
};

type ApiCustomer = {
  fullName?: string;
  mobile?: string;
  email?: string;
  address?: string;
  notes?: string;
};

type ApiTotals = {
  totalAmount?: number;
  totalQuantity?: number;
};

type ApiPayment = {
  mode?: "COD" | "CASH" | "RAZORPAY" | "UPI" | "DYNAMIC_LINK";
  status?: "PENDING" | "PAID" | "FAILED";
  paymentProofUrl?: string;
  paymentReviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
};

type ServicePaymentStatusType =
  | "pending"
  | "awaiting_payment_link"
  | "payment_link_added"
  | "payment_link_shared"
  | "payment_received"
  | "paid";

type ApiOrder = {
  _id?: string;
  id?: string;
  orderNumber?: string;
  createdAt?: string;
  status?: string;
  customer?: ApiCustomer;
  items?: ApiOrderItem[];
  totals?: ApiTotals;
  payment?: ApiPayment;
  paymentLink?: string;
  servicePaymentStatus?: ServicePaymentStatusType;
  paymentRequestedAt?: string;
};

type OrderStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
type FilterValue = "" | OrderStatus | "paid" | "unpaid";

type UiOrder = {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: OrderStatus;
  items: number;
  shippingAddress: string;
  customerName?: string;
  customerMobile?: string;
  customerEmail?: string;
  paymentMode?: string;
  paymentStatus?: "PENDING" | "PAID" | "FAILED";
  paymentProofUrl?: string;
  paymentReviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  servicePaymentStatus?: ServicePaymentStatusType;
  paymentLink?: string;
  isDynamicPayment?: boolean;
  raw?: ApiOrder;
};

/* -------------------- HELPERS -------------------- */

function normalizeOrderStatus(input?: string): OrderStatus {
  const s = String(input ?? "").toUpperCase();
  if (["COMPLETED", "CONFIRMED", "CANCELLED", "PENDING"].includes(s)) return s as OrderStatus;
  if (["completed", "complete", "success", "delivered"].includes(s.toLowerCase())) return "COMPLETED";
  if (["cancelled", "canceled", "rejected"].includes(s.toLowerCase())) return "CANCELLED";
  if (["confirmed", "processing", "in_progress"].includes(s.toLowerCase())) return "CONFIRMED";
  return "PENDING";
}

function makeOrderNumber(o: ApiOrder) {
  if (o.orderNumber) return o.orderNumber;
  const id = (o.id || o._id || "").toString();
  if (!id) return "ORDER";
  return `ORD-${id.slice(-6).toUpperCase()}`;
}

function safeNum(n: unknown, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

const ORDER_ROW_GAP = 16;
const ORDER_ROW_COLLAPSED_HEIGHT = 96;
const ORDER_ROW_EXPANDED_ESTIMATE = 880;

/* -------------------- DYNAMIC PAYMENT ADMIN WORKFLOW -------------------- */

function DynamicPaymentStepper({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
      {DYNAMIC_PAYMENT_STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const done = currentStep > stepNum;
        const active = currentStep === stepNum;
        return (
          <li key={label} className="flex items-center gap-2 text-xs sm:mr-2">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done
                  ? "bg-emerald-600 text-white"
                  : active
                    ? "bg-sky-600 text-white ring-2 ring-sky-200"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
            </span>
            <span
              className={
                active ? "font-semibold text-slate-900" : done ? "text-emerald-700" : "text-slate-500"
              }
            >
              {label}
            </span>
            {idx < DYNAMIC_PAYMENT_STEP_LABELS.length - 1 ? (
              <span className="hidden text-slate-300 sm:mx-1 sm:inline">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type DynamicOrderLine = {
  serviceId: string;
  name: string;
  quantity: number;
  price: number;
  bv?: number;
};

type DynamicPaymentAdminProps = {
  order: UiOrder;
  lines: DynamicOrderLine[];
  priceDraft: Record<string, string>;
  onPriceChange: (serviceId: string, value: string) => void;
  onSavePricing: () => void;
  paymentLinkDraft: string;
  onPaymentLinkChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onShareLink: () => void;
  onSendUpiPaymentRequest: () => void;
  onApproveProof: () => void;
  onMarkPaid: () => void;
  platformUpi: string;
  confirming: boolean;
  cancelling: boolean;
  saving: boolean;
  savingPricing: boolean;
  reviewingProof: boolean;
};

function DynamicPaymentAdminPanel({
  order,
  lines,
  priceDraft,
  onPriceChange,
  onSavePricing,
  paymentLinkDraft,
  onPaymentLinkChange,
  onConfirm,
  onCancel,
  onShareLink,
  onSendUpiPaymentRequest,
  onApproveProof,
  onMarkPaid,
  platformUpi,
  confirming,
  cancelling,
  saving,
  savingPricing,
  reviewingProof,
}: DynamicPaymentAdminProps) {
  const step = dynamicPaymentStep(order.status, order.servicePaymentStatus, order.total);
  const linkValue = paymentLinkDraft || order.paymentLink || "";
  const linkShared = isPaymentLinkSharedStatus(order.servicePaymentStatus);
  const paymentReceived = order.servicePaymentStatus === "payment_received";
  const isPaid = order.servicePaymentStatus === "paid" || order.paymentStatus === "PAID";
  const pricingSet = orderHasAdminPricingSet(order.total);
  const hasProof = dynamicOrderHasPaymentProof({
    paymentProofUrl: order.paymentProofUrl,
  });
  const proofVerified = dynamicPaymentProofVerified({
    paymentReviewStatus: order.paymentReviewStatus,
  });
  const draftTotal = lines.reduce((sum, line) => {
    const p = Number(priceDraft[line.serviceId] ?? line.price);
    return sum + (Number.isFinite(p) ? p : 0) * line.quantity;
  }, 0);

  return (
    <div className="mt-4 rounded-lg border border-sky-200 bg-gradient-to-b from-sky-50/80 to-white p-4">
      <p className="text-sm font-semibold text-slate-900">Dynamic payment — admin workflow</p>
      <p className="mt-1 text-xs text-slate-600">
        Set the customer-specific price, then share the payment link. BV and commission run only after
        step 5 (Mark paid).
      </p>
      <div className="mt-4">
        <DynamicPaymentStepper currentStep={isPaid ? 6 : step} />
      </div>

      {order.status === "PENDING" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming || cancelling || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {confirming ? "Confirming…" : "1. Confirm order"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling || confirming || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        </div>
      )}

      {order.status !== "PENDING" &&
        (order.status === "CONFIRMED" || order.status === "COMPLETED") &&
        !isPaid && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Customer price (step 2)
            </label>
            <p className="mt-1 text-xs text-amber-800">
              Enter the final amount for this order. BV is calculated from this price when you mark
              paid.
            </p>
            <ul className="mt-3 space-y-2">
              {lines.map((line) => (
                <li
                  key={line.serviceId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{line.name}</p>
                    <p className="text-xs text-slate-500">Qty ×{line.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
                      value={priceDraft[line.serviceId] ?? ""}
                      onChange={(e) => onPriceChange(line.serviceId, e.target.value)}
                      disabled={paymentReceived || saving || savingPricing || isPaid}
                      placeholder="0"
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-700">
                Draft total: <strong>{formatINR(draftTotal)}</strong>
                {pricingSet ? (
                  <span className="ml-2 text-emerald-700">(saved: {formatINR(order.total)})</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={onSavePricing}
                disabled={
                  savingPricing ||
                  saving ||
                  paymentReceived ||
                  isPaid ||
                  !lines.every((l) => {
                    const p = Number(priceDraft[l.serviceId]);
                    return Number.isFinite(p) && p > 0;
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-200 disabled:opacity-50"
              >
                {savingPricing ? "Saving…" : pricingSet ? "Update price" : "Save order price"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-sky-900">
              Send payment request (step 3)
            </label>
            <p className="mt-1 text-xs text-sky-800">
              Customer pays via UPI on their Orders page (Scan &amp; Pay for{" "}
              <strong>{formatINR(order.total)}</strong>
              {platformUpi ? (
                <>
                  {" "}
                  to <strong>{platformUpi}</strong>
                </>
              ) : (
                <> — configure UPI in Admin → Payment Settings</>
              )}
              ).
            </p>
            {linkShared ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Payment request sent — customer can pay from My Orders.
              </p>
            ) : null}
            <div className="mt-3">
              <label className="text-xs text-slate-600">Optional: custom payment URL</label>
              <input
                type="url"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                placeholder="https://razorpay.me/... (leave blank to use platform UPI)"
                value={linkValue}
                onChange={(e) => onPaymentLinkChange(e.target.value)}
                disabled={paymentReceived || saving || !pricingSet}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSendUpiPaymentRequest}
              disabled={saving || !pricingSet || !platformUpi.trim() || paymentReceived || linkShared}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Sending…" : "3. Send UPI payment request"}
            </button>
            <button
              type="button"
              onClick={onShareLink}
              disabled={
                saving ||
                !pricingSet ||
                !linkValue.trim() ||
                paymentReceived ||
                (linkShared && linkValue.trim() === (order.paymentLink ?? "").trim())
              }
              className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-100 px-4 py-2 text-sm font-medium text-sky-900 hover:bg-sky-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : linkShared ? "Update custom link" : "Use custom link instead"}
            </button>

            <button
              type="button"
              onClick={onApproveProof}
              disabled={
                saving ||
                reviewingProof ||
                !linkShared ||
                proofVerified ||
                !hasProof
              }
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
            >
              {reviewingProof ? "Verifying…" : "4. Verify payment proof"}
            </button>

            <button
              type="button"
              onClick={onMarkPaid}
              disabled={
                saving ||
                !canMarkDynamicPaid(order.servicePaymentStatus) ||
                !proofVerified
              }
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              5. Mark paid
            </button>

            {order.status === "CONFIRMED" && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Cancel order
              </button>
            )}
          </div>

          {!pricingSet && (
            <p className="text-xs text-amber-700">
              Save the order price before sharing a payment link with the customer.
            </p>
          )}
          {pricingSet && !linkShared && (
            <p className="text-xs text-sky-700">
              Price saved ({formatINR(order.total)}). Add the payment link and mark it shared.
            </p>
          )}
          {linkShared && !hasProof && !paymentReceived && (
            <p className="text-xs text-violet-700">
              Waiting for the customer to pay and upload payment proof.
            </p>
          )}
          {linkShared && hasProof && !proofVerified && (
            <p className="text-xs text-violet-700">
              Payment proof uploaded — review the screenshot below, then verify.
            </p>
          )}
          {paymentReceived && proofVerified && (
            <p className="text-xs text-emerald-700">
              Payment verified — click &quot;Mark paid&quot; to confirm and distribute BV.
            </p>
          )}

          {hasProof && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Customer payment proof
              </p>
              <button
                type="button"
                onClick={() => {
                  const url = getProofImageUrl(order.paymentProofUrl);
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="mt-2 block text-left"
              >
                <img
                  src={getProofImageUrl(order.paymentProofUrl)}
                  alt="Payment proof"
                  className="max-h-40 rounded-lg border border-slate-200 object-contain"
                />
              </button>
            </div>
          )}
        </div>
      )}

      {isPaid && (
        <p className="mt-3 text-sm font-medium text-emerald-700">This order is fully paid and fulfilled.</p>
      )}
    </div>
  );
}

type CustomerDynamicPaymentProps = {
  order: UiOrder;
  platformUpi: string;
  onReload: () => void;
};

function CustomerDynamicPaymentPanel({
  order,
  platformUpi,
  onReload,
}: CustomerDynamicPaymentProps) {
  const [proofUploading, setProofUploading] = useState(false);
  const [copiedField, setCopiedField] = useState<"upi" | "link" | null>(null);

  const linkShared = isPaymentLinkSharedStatus(order.servicePaymentStatus);
  const isPaid = order.servicePaymentStatus === "paid" || order.paymentStatus === "PAID";
  const proofVerified = dynamicPaymentProofVerified({
    paymentReviewStatus: order.paymentReviewStatus,
  });
  const hasProof = dynamicOrderHasPaymentProof({ paymentProofUrl: order.paymentProofUrl });
  const canPay =
    linkShared &&
    !isPaid &&
    orderHasAdminPricingSet(order.total) &&
    (order.status === "CONFIRMED" || order.status === "COMPLETED");

  const globalUpi = (process.env.NEXT_PUBLIC_UPI_ID ?? "").trim();
  const effectiveUpi = (platformUpi || globalUpi).trim();
  const payAmount = order.total;
  const upiPayLink = useMemo(() => {
    if (order.paymentLink?.startsWith("upi://")) return order.paymentLink;
    return buildUpiPayUrl({
      vpa: effectiveUpi,
      amount: payAmount,
      note: `Order ${order.orderNumber}`,
    });
  }, [order.paymentLink, order.orderNumber, effectiveUpi, payAmount]);

  const qrUrl = useMemo(() => upiQrImageUrl(upiPayLink), [upiPayLink]);

  async function copyText(value: string, field: "upi" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
      showSuccessToast(field === "upi" ? "UPI ID copied" : "Payment link copied");
    } catch {
      showErrorToast("Unable to copy. Please copy manually.");
    }
  }

  async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showErrorToast("Please select an image file (JPG, PNG, GIF, or WebP)");
      return;
    }
    setProofUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const uploadRes = await apiFetch("/api/upload/payment-proof", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const uploadBody = await readApiBody(uploadRes);
      const uploadData = uploadBody.json as { imageUrl?: string; error?: string };
      if (!uploadRes.ok) throw new Error(uploadData?.error || "Upload failed");

      const proofUrl = uploadData.imageUrl || "";
      const res = await apiFetch(`/api/orders/${order.id}/payment-proof`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProofUrl: proofUrl }),
      });
      const data = (await readApiBody(res)).json as { message?: string; error?: string };
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to submit proof");
      showSuccessToast(data?.message || "Payment proof submitted.");
      onReload();
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProofUploading(false);
      e.target.value = "";
    }
  }

  if (!order.isDynamicPayment) return null;

  if (order.status === "PENDING") {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        Your order is being reviewed. You will be able to pay via UPI after admin confirms and sends a
        payment request.
      </div>
    );
  }

  if (
    order.servicePaymentStatus === "awaiting_payment_link" ||
    order.servicePaymentStatus === "pending"
  ) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        Order confirmed. Admin will set your price and send a UPI payment request shortly.
      </div>
    );
  }

  if (isPaid) {
    return (
      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-800">
        Payment complete. Thank you!
      </div>
    );
  }

  if (!canPay) return null;

  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white p-4">
      <p className="text-sm font-semibold text-slate-900">Pay via UPI</p>
      <p className="mt-1 text-xs text-slate-600">
        Pay exactly <strong>{formatINR(payAmount)}</strong>, then upload your payment screenshot.
      </p>

      {effectiveUpi && upiPayLink ? (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-white p-3">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="UPI QR code"
                className="h-36 w-36 rounded-lg border border-slate-200 bg-white object-contain"
              />
            ) : null}
            <div className="w-full min-w-0 space-y-2">
              <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                UPI ID: <span className="font-semibold text-slate-900">{effectiveUpi}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(effectiveUpi, "upi")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {copiedField === "upi" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedField === "upi" ? "Copied" : "Copy UPI ID"}
                </button>
                <a
                  href={upiPayLink}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Open in UPI app
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-800">UPI details are not available. Contact support.</p>
      )}

      {order.paymentLink && !order.paymentLink.startsWith("upi://") ? (
        <a
          href={order.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
        >
          <ExternalLink className="h-4 w-4" />
          Alternate payment link
        </a>
      ) : null}

      <div className="mt-4 border-t border-emerald-100 pt-4">
        <label className="text-sm font-semibold text-slate-900">Payment screenshot *</label>
        <p className="mt-1 text-xs text-slate-600">
          Upload proof after paying. Admin will verify before your order is marked paid.
        </p>
        {hasProof ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-emerald-700">✓ Proof submitted</p>
            <button
              type="button"
              onClick={() => {
                const url = getProofImageUrl(order.paymentProofUrl);
                if (url) window.open(url, "_blank", "noopener,noreferrer");
              }}
              className="mt-2 block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getProofImageUrl(order.paymentProofUrl)}
                alt="Your payment proof"
                className="max-h-32 rounded-lg border border-slate-200 object-contain"
              />
            </button>
            {proofVerified ? (
              <p className="mt-2 text-xs text-violet-700">Verified by admin — awaiting final confirmation.</p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">Awaiting admin verification.</p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-60">
              {proofUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {proofUploading ? "Uploading…" : "Upload payment screenshot"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={proofUploading}
                onChange={handleProofUpload}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- STATUS BADGES -------------------- */

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
    COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
    CANCELLED: "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function ServicePaymentStatusBadge({ status }: { status?: ServicePaymentStatusType }) {
  if (!status) return null;
  const label = servicePaymentStatusLabel(status) || status;
  const styles =
    status === "paid"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : status === "payment_received"
        ? "bg-violet-100 text-violet-800 border-violet-200"
        : status === "payment_link_added" || status === "payment_link_shared"
          ? "bg-sky-100 text-sky-800 border-sky-200"
          : status === "awaiting_payment_link"
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status?: "PENDING" | "PAID" | "FAILED" }) {
  if (!status) return null;
  const isPaid = status === "PAID";
  const isFailed = status === "FAILED";
  const styles = isPaid
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : isFailed
    ? "bg-red-100 text-red-800 border-red-200"
    : "bg-amber-100 text-amber-800 border-amber-200";
  const label = isPaid ? "Paid" : isFailed ? "Failed" : "Unpaid";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {label}
    </span>
  );
}

function PaymentModeIcon({ mode }: { mode?: string }) {
  if (mode === "CASH") return <Banknote className="h-4 w-4" />;
  if (mode === "UPI") return <Wallet className="h-4 w-4" />;
  if (mode === "DYNAMIC_LINK") return <Link2 className="h-4 w-4" />;
  if (mode === "RAZORPAY") return <CreditCard className="h-4 w-4" />;
  return <Wallet className="h-4 w-4" />;
}

function getProofImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  let base = "";
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    base = "http://localhost:4000";
  } else {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (apiBase) {
      try {
        const u = new URL(apiBase);
        base = u.origin;
      } catch {
        base = apiBase.replace(/\/api\/?$/, "") || apiBase;
      }
    }
    if (!base && typeof window !== "undefined") base = window.location.origin;
    if (!base) base = "http://localhost:4000";
  }
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/* -------------------- COMPONENT -------------------- */

export default function OrdersPage() {
  const user = useAppSelector((s) => s.user.profile);
  const isAdmin = useMemo(
    () => ["admin", "super_admin"].includes((user as { role?: string })?.role ?? ""),
    [user]
  );

  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOption, setFilterOption] = useState<FilterValue>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [paymentLinkDraft, setPaymentLinkDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, Record<string, string>>>({});
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [savingPricingId, setSavingPricingId] = useState<string | null>(null);
  const [platformUpi, setPlatformUpi] = useState("");
  const [query, setQuery] = useState("");
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  async function loadOrders() {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/orders", { method: "GET" });
      const body = await readApiBody(res);
      const data = body.json as any;

      if (!res.ok) {
        if (res.status === 401) {
          setOrders([]);
          return;
        }
        showErrorToast(data?.error || "Failed to load orders");
        setOrders([]);
        return;
      }

      const list: ApiOrder[] =
        data?.orders || data?.data?.orders || (Array.isArray(data) ? data : []);

      const mapped: UiOrder[] = list.map((o) => {
        const id = (o.id || o._id || "").toString();
        const createdAt = (o as any).createdAt || new Date().toISOString();

        const totalAmount =
          safeNum(o?.totals?.totalAmount, 0) ||
          safeNum((o as any)?.totalAmount, 0);

        const totalQty =
          safeNum(o?.totals?.totalQuantity, 0) ||
          (o.items ?? []).reduce((s, it) => s + safeNum(it.quantity, 0), 0);

        const address =
          o.customer?.address ||
          o.customer?.email ||
          o.customer?.mobile ||
          "";

        const payment = o.payment as ApiPayment | undefined;
        const isDynamicPayment =
          payment?.mode === "DYNAMIC_LINK" ||
          Boolean(o.servicePaymentStatus) ||
          Boolean((o as { orderUsesDynamicPaymentLink?: boolean }).orderUsesDynamicPaymentLink);
        const paymentMode =
          isDynamicPayment && payment?.mode !== "DYNAMIC_LINK"
            ? "DYNAMIC_LINK"
            : payment?.mode;
        return {
          id,
          orderNumber: makeOrderNumber(o),
          date: createdAt,
          total: totalAmount,
          status: normalizeOrderStatus(o.status),
          items: totalQty,
          shippingAddress: address,
          customerName: o.customer?.fullName,
          customerMobile: o.customer?.mobile,
          customerEmail: o.customer?.email,
          paymentMode,
          paymentStatus: payment?.status,
          paymentProofUrl: payment?.paymentProofUrl,
          paymentReviewStatus: payment?.paymentReviewStatus,
          servicePaymentStatus: o.servicePaymentStatus,
          paymentLink: o.paymentLink,
          isDynamicPayment,
          raw: o,
        };
      });

      mapped.sort((a, b) => +new Date(b.date) - +new Date(a.date));
      setOrders(mapped);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
    const isCancel = status === "CANCELLED";
    const isConfirm = status === "CONFIRMED";
    if (isCancel) setCancellingId(orderId);
    if (isConfirm) setConfirmingId(orderId);

    try {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error(`Failed to update order status`);

      const msg =
        status === "CANCELLED"
          ? "Order cancelled successfully."
          : status === "CONFIRMED"
            ? "Order confirmed."
            : "Order marked as completed.";
      showSuccessToast(msg);
      await loadOrders();
      setExpandedId(null);
    } catch (err: any) {
      showErrorToast(err?.message);
    } finally {
      if (isCancel) setCancellingId(null);
      if (isConfirm) setConfirmingId(null);
    }
  }

  function cancelOrder(orderId: string) {
    updateOrderStatus(orderId, "CANCELLED");
  }

  function confirmOrder(orderId: string) {
    updateOrderStatus(orderId, "CONFIRMED");
  }

  function buildDynamicOrderLines(order: UiOrder): DynamicOrderLine[] {
    const rawItems = order.raw?.items ?? [];
    return rawItems.map((it) => {
      const serviceId = String(it.service ?? it.id ?? "").trim();
      return {
        serviceId,
        name: String(it.name ?? "Service"),
        quantity: safeNum(it.quantity, 1),
        price: safeNum(it.price, 0),
        bv: typeof it.bv === "number" ? it.bv : undefined,
      };
    }).filter((l) => l.serviceId);
  }

  function ensurePriceDraft(order: UiOrder) {
    const lines = buildDynamicOrderLines(order);
    setPriceDraft((prev) => {
      if (prev[order.id]) return prev;
      const next: Record<string, string> = {};
      for (const line of lines) {
        next[line.serviceId] =
          line.price > 0 ? String(line.price) : "";
      }
      return { ...prev, [order.id]: next };
    });
  }

  async function saveOrderPricing(order: UiOrder) {
    const lines = buildDynamicOrderLines(order);
    const draft = priceDraft[order.id] ?? {};
    const items = lines.map((line) => {
      const price = Number(draft[line.serviceId]);
      return { serviceId: line.serviceId, price };
    });

    setSavingPricingId(order.id);
    try {
      const res = await apiFetch(`/api/orders/${order.id}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = (await readApiBody(res)).json as { message?: string; error?: string };
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save price");
      showSuccessToast(data?.message || "Order price saved.");
      await loadOrders();
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : "Failed to save price");
    } finally {
      setSavingPricingId(null);
    }
  }

  async function saveServicePayment(
    orderId: string,
    opts: {
      paymentLink?: string;
      usePlatformUpi?: boolean;
      action?: "payment_received";
      markPaid?: boolean;
    },
  ) {
    setSavingPaymentId(orderId);
    try {
      const res = await apiFetch(`/api/orders/${orderId}/service-payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(opts.paymentLink !== undefined ? { paymentLink: opts.paymentLink } : {}),
          ...(opts.usePlatformUpi ? { usePlatformUpi: true } : {}),
          ...(opts.action ? { action: opts.action } : {}),
          ...(opts.markPaid ? { markPaid: true } : {}),
        }),
      });
      const data = (await readApiBody(res)).json as any;
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed");
      const msg =
        data?.message ||
        (opts.markPaid
          ? "Payment marked paid. BV distributed."
          : opts.action === "payment_received"
            ? "Payment marked as received."
            : opts.usePlatformUpi
              ? "UPI payment request sent to customer."
              : "Payment link saved.");
      showSuccessToast(msg);
      await loadOrders();
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to update payment");
    } finally {
      setSavingPaymentId(null);
    }
  }

  async function reviewPayment(orderId: string, action: "approve" | "reject", reason?: string) {
    setReviewingId(orderId);
    try {
      const res = await apiFetch(`/api/orders/${orderId}/payment-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await readApiBody(res)).json as any;
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed");
      const orderRow = orders.find((o) => o.id === orderId);
      const dynamicApprove =
        action === "approve" && orderRow?.isDynamicPayment;
      showSuccessToast(
        dynamicApprove
          ? "Payment proof verified. You can mark the order as paid."
          : action === "approve"
            ? "Payment approved. Order confirmed."
            : "Payment rejected.",
      );
      await loadOrders();
      setExpandedId(null);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to review payment");
    } finally {
      setReviewingId(null);
    }
  }

  async function loadCheckoutUpi() {
    try {
      const res = await apiFetch("/api/orders/checkout-upi");
      const data = (await readApiBody(res)).json as { upiLink?: string };
      if (res.ok && data?.upiLink) setPlatformUpi(String(data.upiLink).trim());
    } catch {
      setPlatformUpi("");
    }
  }

  useEffect(() => {
    if (user) {
      loadOrders();
      loadCheckoutUpi();
    } else {
      setOrders([]);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredStatusOptions = useMemo(() => {
    if (!filterQuery.trim()) return STATUS_OPTIONS;
    const q = filterQuery.toLowerCase();
    return STATUS_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [filterQuery]);

  const currentFilterLabel = STATUS_OPTIONS.find((o) => o.value === filterOption)?.label ?? "All";

  const filteredOrders = useMemo(() => {
    let base = orders;

    if (filterOption === "paid") {
      base = base.filter((o) => o.paymentStatus === "PAID");
    } else if (filterOption === "unpaid") {
      base = base.filter((o) => o.paymentStatus !== "PAID");
    } else if (
      filterOption === "PENDING" ||
      filterOption === "CONFIRMED" ||
      filterOption === "COMPLETED" ||
      filterOption === "CANCELLED"
    ) {
      base = base.filter((o) => o.status === filterOption);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      return base.filter((o) =>
        [o.orderNumber, o.customerName, o.customerEmail, o.customerMobile, o.shippingAddress]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return base;
  }, [orders, filterOption, query]);

  const totalRows = filteredOrders.length;

  const rowVirtualizer = useVirtualizer({
    count: filteredOrders.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: (index) => {
      const order = filteredOrders[index];
      const base =
        order && expandedId === order.id
          ? ORDER_ROW_EXPANDED_ESTIMATE
          : ORDER_ROW_COLLAPSED_HEIGHT;
      return base + ORDER_ROW_GAP;
    },
    overscan: 6,
    getItemKey: (index) => filteredOrders[index]?.id ?? index,
  });

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [filterOption, query]);

  useEffect(() => {
    rowVirtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remeasure when expand/filter changes
  }, [expandedId, filteredOrders.length]);

  return (
    <div className="min-h-screen bg-white">
      {/* Image modal for payment proof */}
      {imageModalUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setImageModalUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof image"
        >
          <button
            type="button"
            onClick={() => setImageModalUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={imageModalUrl}
            alt="Payment proof (full size)"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Your Orders
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Track and manage your orders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse services
            </Link> */}
            <button
              onClick={loadOrders}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 hover:cursor-pointer"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search + Status dropdown (dropdown to the right of search) */}
        <div className="mb-6 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders, customer..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 !pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none ring-emerald-500/20 focus:border-emerald-500 focus:ring-2"
            />
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 min-w-[140px] justify-between"
            >
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="truncate">{currentFilterLabel}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition cursor-pointer ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-2">
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search status..."
                    className="w-full rounded-lg border border-slate-200 py-2 px-3 text-sm outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {filteredStatusOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-500">No match</li>
                  ) : (
                    filteredStatusOptions.map((opt) => (
                      <li key={opt.value || "all"}>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterOption(opt.value);
                            setFilterQuery("");
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition hover:cursor-pointer ${
                            filterOption === opt.value
                              ? "bg-emerald-50 font-medium text-emerald-800"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
          </div>
          {!loading && totalRows > 0 && (
            <span className="text-sm text-slate-600">
              {totalRows} order{totalRows !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Orders list */}
        {!user ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <Receipt className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Sign in to view orders</h3>
            <p className="mt-1 text-sm text-slate-500">
              Your service orders will appear here after you sign in.
            </p>
            <Link
              href="/login?next=/orders"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            <p className="mt-4 text-sm text-slate-600">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No orders found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {filteredOrders.length !== orders.length
                ? "Try changing filters or search."
                : "Service orders you place will appear here."}
            </p>
            <Link
              href="/services"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse services
            </Link>
          </div>
        ) : (
          <div
            ref={listScrollRef}
            className="h-[min(70vh,800px)] overflow-auto"
            style={{ contain: "strict" }}
          >
            <div
              className="relative w-full"
              style={{ height: rowVirtualizer.getTotalSize() }}
            >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const order = filteredOrders[vi.index];
              if (!order) return null;
              const isExpanded = expandedId === order.id;
              const rawItems = order.raw?.items ?? [];

              return (
                <div
                  key={order.id}
                  data-index={vi.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                <div
                  className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  style={{ marginBottom: ORDER_ROW_GAP }}
                >
                  {/* Summary row - always visible */}
                  <div
                    className="flex cursor-pointer flex-wrap items-center gap-4 p-5 sm:p-6"
                    onClick={() => {
                      const next = isExpanded ? null : order.id;
                      if (next && order.isDynamicPayment) ensurePriceDraft(order);
                      setExpandedId(next);
                    }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Receipt className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-900 text-sm font-medium">
                          {order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <PaymentStatusBadge status={order.paymentStatus} />
                        {order.isDynamicPayment ? (
                          <ServicePaymentStatusBadge status={order.servicePaymentStatus} />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(order.date).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                          {" · "}
                          {new Date(order.date).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          {order.items} item{order.items !== 1 ? "s" : ""}
                        </span>
                        {order.customerName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {order.customerName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-emerald-700">
                        {order.isDynamicPayment && !orderHasAdminPricingSet(order.total)
                          ? "Price pending"
                          : formatINR(order.total)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = isExpanded ? null : order.id;
                          if (next && order.isDynamicPayment) ensurePriceDraft(order);
                          setExpandedId(next);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 hover:cursor-pointer"
                        aria-label={isExpanded ? "Collapse details" : "View details"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                      {/* Customer + Payment: admin sees full block; regular user sees payment mode only */}
                      <div className="mb-6 grid gap-4 sm:grid-cols-2">
                        {isAdmin ? (
                          <>
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                                Customer Details 
                              </div>
                              <dl className="mt-3 space-y-2 text-xs">
                                {order.customerName && (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span className="text-slate-900">{order.customerName}</span>
                                  </div>
                                )}
                                {order.customerMobile && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <span className="text-slate-700">{order.customerMobile}</span>
                                  </div>
                                )}
                                {order.customerEmail && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    <span className="text-slate-700">{order.customerEmail}</span>
                                  </div>
                                )}
                              </dl>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                                Payment
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-2 text-sm text-slate-700">
                                  <PaymentModeIcon mode={order.paymentMode} />
                                  {order.paymentMode || "—"}
                                </span>
                                <PaymentStatusBadge status={order.paymentStatus} />
                              </div>
                              {order.isDynamicPayment && (
                                <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-sm">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                                    Dynamic payment
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <ServicePaymentStatusBadge status={order.servicePaymentStatus} />
                                  </div>
                                  {order.paymentLink ? (
                                    <a
                                      href={order.paymentLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Open payment link
                                    </a>
                                  ) : (
                                    <p className="mt-2 text-xs text-slate-600">
                                      Payment link not added yet.
                                    </p>
                                  )}
                                </div>
                              )}
                              {order.paymentMode === "UPI" && order.paymentProofUrl && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-slate-600">Payment screenshot</p>
                                  <button
                                    type="button"
                                    onClick={() => setImageModalUrl(getProofImageUrl(order.paymentProofUrl))}
                                    className="mt-1 inline-block cursor-pointer text-left"
                                  >
                                    <img
                                      src={getProofImageUrl(order.paymentProofUrl)}
                                      alt="Payment proof"
                                      className="max-h-32 rounded-lg border border-slate-200 object-contain hover:opacity-90 transition"
                                    />
                                  </button>
                                  <p className="mt-1 text-xs text-slate-500">Click to open full size</p>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="rounded-lg border border-slate-200 bg-white p-4 sm:col-span-2">
                            <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                              Payment
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-2 text-sm text-slate-700">
                                <PaymentModeIcon mode={order.paymentMode} />
                                {order.paymentMode === "DYNAMIC_LINK"
                                  ? "Dynamic payment link"
                                  : order.paymentMode === "CASH"
                                    ? "Cash"
                                    : order.paymentMode === "UPI"
                                      ? "UPI"
                                      : order.paymentMode === "COD"
                                        ? "Pay later"
                                        : order.paymentMode || "—"}
                              </span>
                              <PaymentStatusBadge status={order.paymentStatus} />
                              {order.isDynamicPayment ? (
                                <ServicePaymentStatusBadge status={order.servicePaymentStatus} />
                              ) : null}
                              {order.paymentMode === "UPI" && order.paymentReviewStatus === "PENDING_REVIEW" && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Awaiting review</span>
                              )}
                            </div>
                            {!isAdmin && order.isDynamicPayment ? (
                              <CustomerDynamicPaymentPanel
                                order={order}
                                platformUpi={platformUpi}
                                onReload={loadOrders}
                              />
                            ) : null}
                            {order.paymentMode === "UPI" && order.paymentProofUrl && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-slate-600">Your payment screenshot</p>
                                <button
                                  type="button"
                                  onClick={() => setImageModalUrl(getProofImageUrl(order.paymentProofUrl))}
                                  className="mt-1 inline-block cursor-pointer text-left"
                                >
                                  <img
                                    src={getProofImageUrl(order.paymentProofUrl)}
                                    alt="Payment proof"
                                    className="max-h-24 rounded-lg border border-slate-200 object-contain hover:opacity-90 transition"
                                  />
                                </button>
                                <p className="mt-1 text-xs text-slate-500">Click to open full size</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Order items - visible to all */}
                      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Items
                        </div>
                        <ul className="mt-3 space-y-2">
                          {rawItems.map((it, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                            >
                              <div>
                                <span className="text-sm text-slate-900">
                                  {it.name ?? "Item"}
                                </span>
                                <span className="ml-2 text-xs text-slate-500">
                                  ×{safeNum(it.quantity, 1)}
                                  {typeof it.bv === "number" ? ` · ${it.bv} BV` : ""}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-slate-900">
                                {order.isDynamicPayment && safeNum(it.price, 0) <= 0
                                  ? "—"
                                  : formatINR(safeNum(it.price, 0) * safeNum(it.quantity, 1))}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
                          <span>Total</span>
                          <span>
                            {order.isDynamicPayment && !orderHasAdminPricingSet(order.total)
                              ? "Price pending"
                              : formatINR(order.total)}
                          </span>
                        </div>
                      </div>

                      {isAdmin &&
                        order.isDynamicPayment &&
                        order.status !== "CANCELLED" && (
                          <DynamicPaymentAdminPanel
                            order={order}
                            lines={buildDynamicOrderLines(order)}
                            priceDraft={priceDraft[order.id] ?? {}}
                            onPriceChange={(serviceId, value) => {
                              ensurePriceDraft(order);
                              setPriceDraft((prev) => ({
                                ...prev,
                                [order.id]: {
                                  ...(prev[order.id] ?? {}),
                                  [serviceId]: value,
                                },
                              }));
                            }}
                            onSavePricing={() => saveOrderPricing(order)}
                            paymentLinkDraft={paymentLinkDraft[order.id] ?? ""}
                            onPaymentLinkChange={(value) =>
                              setPaymentLinkDraft((prev) => ({ ...prev, [order.id]: value }))
                            }
                            onConfirm={() => confirmOrder(order.id)}
                            onCancel={() => cancelOrder(order.id)}
                            onSendUpiPaymentRequest={() =>
                              saveServicePayment(order.id, { usePlatformUpi: true })
                            }
                            onShareLink={() =>
                              saveServicePayment(order.id, {
                                paymentLink:
                                  paymentLinkDraft[order.id] ?? order.paymentLink ?? "",
                              })
                            }
                            platformUpi={platformUpi}
                            onApproveProof={() => reviewPayment(order.id, "approve")}
                            onMarkPaid={() => saveServicePayment(order.id, { markPaid: true })}
                            confirming={confirmingId === order.id}
                            cancelling={cancellingId === order.id}
                            saving={savingPaymentId === order.id}
                            savingPricing={savingPricingId === order.id}
                            reviewingProof={reviewingId === order.id}
                          />
                        )}

                      {order.status === "PENDING" && isAdmin && !order.isDynamicPayment && (
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                          {order.paymentMode === "UPI" && order.paymentReviewStatus === "PENDING_REVIEW" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => reviewPayment(order.id, "approve")}
                                disabled={reviewingId === order.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                              >
                                {reviewingId === order.id ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Approving…
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approve payment
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewPayment(order.id, "reject")}
                                disabled={reviewingId === order.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                              >
                                Reject payment
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => confirmOrder(order.id)}
                                disabled={confirmingId === order.id || cancellingId === order.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
                              >
                                {confirmingId === order.id ? (
                                  <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    Confirming…
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Confirm order
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelOrder(order.id)}
                                disabled={cancellingId === order.id || confirmingId === order.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                              >
                                {cancellingId === order.id ? "Cancelling…" : "Cancel order"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
