"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
  ChevronLeft,
  ChevronRight,
  Receipt,
  Filter,
  CheckCircle2,
} from "lucide-react";

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
  mode?: "COD" | "CASH" | "RAZORPAY" | "UPI";
  status?: "PENDING" | "PAID" | "FAILED";
  paymentProofUrl?: string;
  paymentReviewStatus?: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
};

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

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
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
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);

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
          paymentMode: payment?.mode,
          paymentStatus: payment?.status,
          paymentProofUrl: payment?.paymentProofUrl,
          paymentReviewStatus: payment?.paymentReviewStatus,
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
      showSuccessToast(action === "approve" ? "Payment approved. Order confirmed." : "Payment rejected.");
      await loadOrders();
      setExpandedId(null);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to review payment");
    } finally {
      setReviewingId(null);
    }
  }

  useEffect(() => {
    if (user) loadOrders();
    else {
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
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, safePage, pageSize]);

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(totalRows, safePage * pageSize);

  useEffect(() => {
    if (safePage > totalPages && totalPages >= 1) setPage(1);
  }, [safePage, totalPages]);

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
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
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
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${dropdownOpen ? "rotate-180" : ""}`} />
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
                            setPage(1);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition ${
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
          <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[7rem] px-3 py-1.5 text-center text-sm text-slate-700">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
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
        ) : pageSlice.length === 0 ? (
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
          <div className="space-y-4">
            {pageSlice.map((order) => {
              const isExpanded = expandedId === order.id;
              const rawItems = order.raw?.items ?? [];

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Summary row - always visible */}
                  <div
                    className="flex cursor-pointer flex-wrap items-center gap-4 p-5 sm:p-6"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <Receipt className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-900">
                          {order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <PaymentStatusBadge status={order.paymentStatus} />
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
                      <span className="text-lg text-emerald-700">
                        {formatINR(order.total)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : order.id);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Customer
                              </h4>
                              <dl className="mt-3 space-y-2 text-sm">
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
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Payment
                              </h4>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-2 text-sm text-slate-700">
                                  <PaymentModeIcon mode={order.paymentMode} />
                                  {order.paymentMode || "—"}
                                </span>
                                <PaymentStatusBadge status={order.paymentStatus} />
                              </div>
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
                          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              Payment
                            </h4>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-2 text-sm text-slate-700">
                                <PaymentModeIcon mode={order.paymentMode} />
                                {order.paymentMode === "CASH" ? "Cash" : order.paymentMode === "UPI" ? "UPI" : order.paymentMode === "COD" ? "Pay later" : order.paymentMode || "—"}
                              </span>
                              <PaymentStatusBadge status={order.paymentStatus} />
                              {order.paymentMode === "UPI" && order.paymentReviewStatus === "PENDING_REVIEW" && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Awaiting review</span>
                              )}
                            </div>
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
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Items
                        </h4>
                        <ul className="mt-3 space-y-2">
                          {rawItems.map((it, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                            >
                              <div>
                                <span className="text-sm font-medium text-slate-900">
                                  {it.name ?? "Item"}
                                </span>
                                <span className="ml-2 text-xs text-slate-500">
                                  ×{safeNum(it.quantity, 1)}
                                  {typeof it.bv === "number" ? ` · ${it.bv} BV` : ""}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-slate-900">
                                {formatINR(safeNum(it.price, 0) * safeNum(it.quantity, 1))}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
                          <span>Total</span>
                          <span>{formatINR(order.total)}</span>
                        </div>
                      </div>

                      {order.status === "PENDING" && isAdmin && (
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
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalRows > 0 && (
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4 ">
              <span className="text-sm text-slate-600 min-w-[160px]">
                Showing {showingFrom}–{showingTo} of {totalRows}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[7rem] px-3 py-1.5 text-center text-sm text-slate-700">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
