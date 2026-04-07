"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  User,
  Phone,
  Mail,
  NotebookText,
  ImagePlus,
  Banknote,
  Clock,
  Wallet,
  Copy,
  Check,
} from "lucide-react";

import { formatINR } from "@/lib/format";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCart } from "@/store/slices/cartSlice";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type CheckoutDrawerProps = {
  open: boolean;
  onClose: () => void;
};

type CheckoutForm = {
  fullName: string;
  mobile: string;
  email: string;
  address: string;
  notes: string;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function safeString(v: unknown) {
  return typeof v === "string" ? v : "";
}

export default function CheckoutDrawer({ open, onClose }: CheckoutDrawerProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const cart = useAppSelector((s) => s.cart);
  const items = useMemo(() => Object.values(cart.items), [cart.items]);

  // from userSlice
  const user = useAppSelector((s) => s.user.profile);

  const [loading, setLoading] = useState(false);

  // prevent overwriting user edits after they start typing
  const [didPrefill, setDidPrefill] = useState(false);

  const [form, setForm] = useState<CheckoutForm>({
    fullName: "",
    mobile: "",
    email: "",
    address: "",
    notes: "",
  });

  // Keep all payment methods available in code for future enablement.
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "pay_later">("upi");
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>("");
  const [proofUploading, setProofUploading] = useState(false);
  const [copiedField, setCopiedField] = useState<"upi" | "link" | null>(null);

  const upiId = process.env.NEXT_PUBLIC_UPI_ID;
  const upiPayLink = useMemo(() => {
    const amount = Number(cart.totalAmount || 0).toFixed(2);
    const params = new URLSearchParams({
      pa: upiId || "",
      pn: "Sambhariya Marketing",
      am: amount,
      cu: "INR",
      tn: `Order payment of ${formatINR(cart.totalAmount)}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [cart.totalAmount]);

  const qrImageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayLink)}`,
    [upiPayLink],
  );

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

  useEffect(() => {
    if (!open) {
      setDidPrefill(false);
      setPaymentProofUrl("");
      return;
    }
    if (didPrefill) return;

    const profileName = safeString(user?.name);
    const profileEmail = safeString(user?.email);

    // If you later store mobile in profile, it'll prefill too:
    const profileMobile = safeString((user as any)?.mobile);

    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || profileName || "",
      email: prev.email || profileEmail || "",
      mobile: prev.mobile || (profileMobile ? onlyDigits(profileMobile).slice(0, 10) : ""),
    }));

    setDidPrefill(true);
  }, [open, didPrefill, user]);

  const canSubmit =
    items.length > 0 &&
    form.fullName.trim().length >= 2 &&
    form.mobile.trim().length === 10 &&
    (paymentMethod !== "upi" || !!paymentProofUrl);

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
      const res = await apiFetch("/api/upload/payment-proof", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const body = await readApiBody(res);
      const data = body.json as { imageUrl?: string; error?: string };
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      setPaymentProofUrl(data.imageUrl || "");
      showSuccessToast("Screenshot uploaded");
    } catch (err: any) {
      showErrorToast(err?.message || "Upload failed");
    } finally {
      setProofUploading(false);
      e.target.value = "";
    }
  }

  async function placeOrder() {
    if (!canSubmit) {
      if (paymentMethod === "upi" && !paymentProofUrl) {
        showErrorToast("Please upload your UPI payment screenshot to proceed.");
      } else {
        showErrorToast("Please fill name and 10-digit mobile number.");
      }
      return;
    }

    setLoading(true);
    try {
      const isCashPaid = paymentMethod === "cash";
      const isUpi = paymentMethod === "upi";
      const payload = {
        user: {
          id: (user as any)?.id || user?._id || undefined,
          email: user?.email || undefined,
          referralCode: user?.referralCode || undefined,
          role: user?.role || undefined,
        },
        customer: {
          fullName: form.fullName.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        },
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          businessVolume: i.businessVolume ?? 0,
          bv: i.businessVolume ?? 0,
        })),
        totals: {
          totalQuantity: cart.totalQuantity,
          totalAmount: cart.totalAmount,
        },
        payment: {
          mode: isCashPaid ? "CASH" : isUpi ? "UPI" : "COD",
          status: isCashPaid ? "PAID" : "PENDING",
          ...(isUpi && paymentProofUrl && { proofUrl: paymentProofUrl }),
        },
        paymentMode: isCashPaid ? "CASH" : isUpi ? "UPI" : "COD",
        paymentStatus: isCashPaid ? "PAID" : "PENDING",
        ...(isUpi && paymentProofUrl && { paymentProofUrl }),
      };

      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ readApiBody is NOT generic in your project
      const body = await readApiBody(res);
      const data = body.json as any;

      if (!res.ok) {
        throw new Error(
          data?.message || data?.error || body.text || "Failed to create order"
        );
      }

      const orderId = data?.order?.id || data?.orderId || data?.id;

      dispatch(clearCart());
      showSuccessToast("Order placed successfully!");

      onClose();
      router.push(`/checkout/success${orderId ? `?orderId=${orderId}` : ""}`);
    } catch (err: any) {
      showErrorToast(err?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close checkout"
        onClick={() => !loading && onClose()}
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] hover:cursor-pointer"
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-zinc-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xl text-zinc-900">
                  Checkout
                </div>
                {/* <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Services only • No shipping
                </span> */}
              </div>

              <p className="mt-1 text-sm text-zinc-600">
                Services only · UPI payment with screenshot verification.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-700">
                  {cart.totalQuantity} service{cart.totalQuantity !== 1 ? "s" : ""}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Total: {formatINR(cart.totalAmount)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => !loading && onClose()}
              className="inline-flex h-10 w-10 hover:cursor-pointer items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-60 hover:cursor-pointer"
              disabled={loading}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-92px)] overflow-y-auto px-6 py-6">
          {/* Customer Details */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm  text-zinc-900">
                Customer Details
              </div>
              {user?.email ? (
                <span className="text-xs text-zinc-500">
                  Logged in as{" "}
                  <span className=" text-emerald-700">{user.email}</span>
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4">
              {/* Full name */}
              <div>
                <label className="text-xs text-zinc-600">
                  Full Name *
                </label>
                <div className="mt-1 flex items-center gap-2 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                  <User className="h-4 w-4 text-zinc-400" />
                  <input
                    value={form.fullName}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, fullName: e.target.value }))
                    }
                    className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label className="text-xs text-zinc-600">
                  Mobile Number * (10 digits)
                </label>
                <div className="mt-1 flex items-center gap-2 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                  <Phone className="h-4 w-4 text-zinc-400" />
                  <input
                    inputMode="numeric"
                    value={form.mobile}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        mobile: onlyDigits(e.target.value).slice(0, 10),
                      }))
                    }
                    className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    placeholder="Enter your mobile number"
                  />
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  We'll contact you on this number if needed.
                </div>
              </div>

              {/* Payment method */}
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">
               Payment Method
              </div>
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {/* UPI transfer is currently enabled. Other payment methods will be available soon. */}
                Make payment via UPI and upload screenshot for verification.
              </div>
              {/* <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  className={`flex flex-1 min-w-[100px] items-center gap-3 rounded-lg border px-4 py-3 text-left transition hover:cursor-pointer ${
                    paymentMethod === "upi"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <Wallet className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="block font-medium text-zinc-900">UPI</span>
                    <span className="block text-xs opacity-90">Upload screenshot · Review</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-1 min-w-[100px] cursor-not-allowed items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-left text-zinc-500 opacity-70 invisible"
                  title="Cash payment will be enabled soon"
                >
                  <Banknote className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="block font-medium">Cash</span>
                    <span className="block text-xs opacity-90">Coming soon</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled
                  className="flex flex-1 min-w-[100px] cursor-not-allowed items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-3 text-left text-zinc-500 opacity-70 invisible"
                  title="Pay later will be enabled soon"
                >
                  <Clock className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="block font-medium">Pay later</span>
                    <span className="block text-xs opacity-90">Coming soon</span>
                  </div>
                </button>
              </div> */}

              {/* UPI: mandatory screenshot upload */}
              {paymentMethod === "upi" && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                  <label className="text-sm font-semibold text-amber-900">Scan & Pay via UPI</label>
                  <p className="mt-1 text-xs text-amber-800">
                    Scan this QR to pay exactly <span className="font-semibold">{formatINR(cart.totalAmount)}</span>.
                  </p>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                      <img
                        src={qrImageUrl}
                        alt="UPI payment QR"
                        className="h-32 w-32 rounded-lg border border-zinc-200 bg-white object-contain"
                      />
                      <div className="w-full min-w-0 space-y-2">
                        <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                          UPI ID: <span className="font-semibold text-zinc-900">{upiId}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(upiId, "upi")}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            {copiedField === "upi" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedField === "upi" ? "Copied" : "Copy UPI ID"}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(upiPayLink, "link")}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            {copiedField === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedField === "link" ? "Copied" : "Copy payment link"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <label className="text-sm font-semibold text-amber-900">UPI Payment Screenshot *</label>
                  <p className="mt-1 text-xs text-amber-800">Upload payment proof. Your order will be confirmed after admin verification.</p>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50 disabled:opacity-60">
                      {proofUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {paymentProofUrl ? "Change" : "Upload screenshot"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofUpload}
                        className="hidden"
                        disabled={proofUploading}
                      />
                    </label>
                    {paymentProofUrl && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-emerald-700">✓ Uploaded</span>
                        <button
                          type="button"
                          onClick={() => setPaymentProofUrl("")}
                          className="text-xs text-slate-600 underline hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  {!paymentProofUrl && (
                    <p className="mt-2 text-xs text-amber-700">Screenshot is required to place order with UPI.</p>
                  )}
                </div>
              )}
            </div>

            {/* Email */}
              <div>
                <label className="text-xs text-zinc-600">
                  Email (optional)
                </label>
                <div className="mt-1 flex items-center gap-2 bg-white px-3 py-2.5 focus-within:border-emerald-400">
                  <Mail className="h-4 w-4 text-zinc-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, email: e.target.value }))
                    }
                    className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Address */}
              {/* <div>
                <label className="text-xs font-semibold text-zinc-600">
                  Address (optional)
                </label>
                <div className="mt-1 bg-white p-3 focus-within:border-emerald-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-500">
                      Service location or notes
                    </span>
                  </div>
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, address: e.target.value }))
                    }
                    className="mt-2 w-full resize-none bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400"
                    rows={3}
                    placeholder="House/Street/City"
                  />
                </div>
              </div> */}

              {/* Notes */}
              <div>
                <label className="text-xs text-zinc-600">
                  Notes (optional)
                </label>
                <div className="mt-1 bg-white p-3 focus-within:border-emerald-400">
                  <div className="flex items-center gap-2">
                    <NotebookText className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs text-zinc-500">
                      Any additional instructions
                    </span>
                  </div>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, notes: e.target.value }))
                    }
                    className="mt-2 w-full resize-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
                    rows={2}
                    placeholder="Timing, call before visit, etc."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Items Summary */}
          <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm  text-zinc-900">
                Order Summary
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700 shadow-sm">
                {cart.totalQuantity} items
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {items.map((i) => (
                <div key={i.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm  text-zinc-900">
                        {i.name}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-zinc-500">
                        Qty: {i.quantity} • {formatINR(i.price)}
                        {typeof i.businessVolume === "number"
                          ? ` • ${i.businessVolume} BV`
                          : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm  text-zinc-900">
                      {formatINR(i.price * i.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
              <div className="text-sm font-semibold text-zinc-600">Total</div>
              <div className="text-lg  text-zinc-900">
                {formatINR(cart.totalAmount)}
              </div>
            </div>

            {/* <div className="mt-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
              {/* <p className="text-xs font-semibold text-zinc-700">
                Commission is distributed by BV: Level 1 → 5%, Level 2 → 2.5%, Level 3 → 1.25%, Level 4 → 0.625%, Level 5+ → 50% of previous.
              </p> 
            </div> */}
          </div>

          {/* Spacer so sticky footer doesn’t cover content */}
          <div className="h-24" />
        </div>

        {/* Sticky Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => !loading && onClose()}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 hover:cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canSubmit || loading}
              onClick={placeOrder}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm  text-white shadow-lg transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60 hover:cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Placing Order...
                </>
              ) : (
                "Place Order"
              )}
            </button>
          </div>

          {!canSubmit ? (
            <div className="mt-2 text-[11px] font-semibold text-zinc-500">
              {!paymentProofUrl
                ? "Required: Upload UPI payment screenshot to proceed."
                : "Required: Full Name (min 2 chars) and 10-digit Mobile."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
