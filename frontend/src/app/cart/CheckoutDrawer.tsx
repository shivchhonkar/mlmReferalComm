"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  User,
  Phone,
  Mail,
  MapPin,
  NotebookText,
  ShieldCheck,
  Banknote,
  Clock,
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

  // Payment: Cash received (services only, no COD/shipping) or Pay later
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pay_later">("cash");

  // Prefill only when drawer opens (and only once per open). Reset payment to "Cash received" each time.
  useEffect(() => {
    if (!open) {
      setDidPrefill(false);
      return;
    }
    setPaymentMethod("cash"); // each new checkout defaults to Cash received
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
    form.mobile.trim().length === 10;

  async function placeOrder() {
    if (!canSubmit) {
      showErrorToast("Please fill name and 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const isCashPaid = paymentMethod === "cash";
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
          mode: isCashPaid ? "CASH" : "COD",
          status: isCashPaid ? "PAID" : "PENDING",
        },
        paymentMode: isCashPaid ? "CASH" : "COD",
        paymentStatus: isCashPaid ? "PAID" : "PENDING",
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
                Services only · No shipping. Confirm details and pay by cash or pay later.
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
              className="inline-flex h-10 w-10 hover:cursor-pointer items-center justify-center rounded-xl text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-60"
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
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
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

              {/* Payment method: Cash received / Pay later */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">
                Select Payment Method
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition hover:cursor-pointer ${
                    paymentMethod === "cash"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <Banknote className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="block font-medium text-zinc-900">Cash</span>
                    <span className="block text-xs opacity-90">Pay now · Order confirmed</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pay_later")}
                  className={`flex flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition hover:cursor-pointer ${
                    paymentMethod === "pay_later"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  <Clock className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="block font-medium text-zinc-900">Pay later</span>
                    <span className="block text-xs opacity-90">Mark as unpaid · Pay when ready</span>
                  </div>
                </button>
              </div>
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
          <div className="mt-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
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
              className="w-full rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!canSubmit || loading}
              onClick={placeOrder}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm  text-white shadow-lg transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              Required: Full Name (min 2 chars) and 10-digit Mobile.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
