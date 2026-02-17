"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { apiFetch, readApiBody } from "@/lib/apiClient";
import { formatINR } from "@/lib/format";
import { showErrorToast } from "@/lib/toast";

type ApiOrderItem = {
  service?: string; // e.g. "svc004invoice"
  id?: string; // if backend uses "id"
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
  mode?: "COD" | "RAZORPAY";
  status?: "PENDING" | "PAID" | "FAILED";
};

type ApiOrder = {
  _id?: string;
  id?: string;
  orderNumber?: string;
  createdAt?: string;
  status?: string; // "PENDING" | ...
  customer?: ApiCustomer;
  items?: ApiOrderItem[];
  totals?: ApiTotals;
  payment?: ApiPayment;
};

type UiStatus = "pending" | "processing" | "completed" | "cancelled";

type UiOrder = {
  id: string;
  orderNumber: string;
  date: string; // ISO
  total: number;
  status: UiStatus;
  items: number;
  shippingAddress: string;
  customerName?: string;
  paymentMode?: string;
  paymentStatus?: string;
  raw?: ApiOrder;
};

function normalizeStatus(input?: string): UiStatus {
  const s = String(input ?? "").toLowerCase();
  if (["completed", "complete", "success", "delivered", "paid"].includes(s)) return "completed";
  if (["cancelled", "canceled", "rejected"].includes(s)) return "cancelled";
  if (["processing", "in_progress", "in-progress"].includes(s)) return "processing";
  if (["pending", "created", "unpaid", "initiated"].includes(s)) return "pending";
  if (s === "pending") return "pending";
  return "pending";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<"all" | UiStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  // ✅ UX improvements
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);

  async function loadOrders() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/orders", { method: "GET" });
      const body = await readApiBody(res);
      const data = body.json as any;

      if (!res.ok) {
        const msg = data?.error || data?.message || body.text || "Failed to load orders";
        showErrorToast(msg);
        setOrders([]);
        return;
      }

      const list: ApiOrder[] =
        data?.orders || data?.data?.orders || (Array.isArray(data) ? data : []);

      const mapped: UiOrder[] = (list ?? []).map((o) => {
        const id = (o.id || o._id || "").toString();
        const createdAt = o.createdAt ? String(o.createdAt) : new Date().toISOString();

        const totalAmount =
          safeNum(o?.totals?.totalAmount, 0) || safeNum((o as any)?.totalAmount, 0);

        const totalQty =
          safeNum(o?.totals?.totalQuantity, 0) ||
          safeNum((o as any)?.totalQuantity, 0) ||
          (Array.isArray(o.items) ? o.items.reduce((s, it) => s + safeNum(it.quantity, 0), 0) : 0);

        const address =
          (o.customer?.address && String(o.customer.address).trim()) ||
          (o.customer?.email && `Email: ${o.customer.email}`) ||
          (o.customer?.mobile && `Mobile: ${o.customer.mobile}`) ||
          "—";

        return {
          id,
          orderNumber: makeOrderNumber(o),
          date: createdAt,
          total: totalAmount,
          status: normalizeStatus(o.status || o.payment?.status),
          items: totalQty,
          shippingAddress: address,
          customerName: o.customer?.fullName ? String(o.customer.fullName) : undefined,
          paymentMode: o.payment?.mode,
          paymentStatus: o.payment?.status,
          raw: o,
        };
      });

      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setOrders(mapped);
    } catch (err: any) {
      showErrorToast(err?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset page when filters/search/page size change
  useEffect(() => {
    setPage(1);
    setOpenId(null);
  }, [filter, query, pageSize]);

  const getStatusPill = (status: UiStatus) => {
    switch (status) {
      case "completed":
        return {
          dot: "bg-emerald-600",
          cls: "border-emerald-200 bg-emerald-50 text-emerald-800",
          icon: <CheckCircle className="h-4 w-4" />,
          label: "Completed",
        };
      case "processing":
        return {
          dot: "bg-sky-600",
          cls: "border-sky-200 bg-sky-50 text-sky-800",
          icon: <Clock className="h-4 w-4" />,
          label: "Processing",
        };
      case "pending":
        return {
          dot: "bg-amber-600",
          cls: "border-amber-200 bg-amber-50 text-amber-800",
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Pending",
        };
      case "cancelled":
        return {
          dot: "bg-red-600",
          cls: "border-red-200 bg-red-50 text-red-800",
          icon: <AlertCircle className="h-4 w-4" />,
          label: "Cancelled",
        };
      default:
        return {
          dot: "bg-zinc-500",
          cls: "border-zinc-200 bg-zinc-50 text-zinc-800",
          icon: <AlertCircle className="h-4 w-4" />,
          label: status,
        };
    }
  };

  const filteredOrders = useMemo(() => {
    const base = filter === "all" ? orders : orders.filter((o) => o.status === filter);

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((o) => {
      const raw = o.raw;
      const hay = [
        o.orderNumber,
        o.id,
        o.customerName,
        o.shippingAddress,
        o.paymentMode,
        o.paymentStatus,
        raw?.customer?.mobile,
        raw?.customer?.email,
        ...(raw?.items ?? []).map((it) => it.name || it.service || ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [orders, filter, query]);

  // Pagination (client-side)
  const totalRows = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = clamp(page, 1, totalPages);

  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filteredOrders.slice(start, end);
  }, [filteredOrders, safePage, pageSize]);

  // Summary cards (nice dashboard feel)
  const stats = useMemo(() => {
    const all = orders;
    const count = all.length;

    const by = (s: UiStatus) => all.filter((o) => o.status === s).length;

    return {
      count,
      pending: by("pending"),
      processing: by("processing"),
      completed: by("completed"),
      cancelled: by("cancelled"),
    };
  }, [orders]);

  const showingFrom = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(totalRows, safePage * pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      {/* Brand top line */}
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 text-white">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-800">Orders</span>
            </div>

            <h1 className="mt-4 text-3xl  tracking-tight text-zinc-900 sm:text-4xl">
              Your Orders
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Track order status, payment mode, and order items — all in one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadOrders}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
              title="Refresh orders"
            >
              <RefreshCcw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
              Refresh
            </button>

            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-5 py-2.5 text-sm  text-white shadow-lg transition hover:from-emerald-700 hover:to-sky-700 hover:shadow-xl"
            >
              Continue Shopping
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-bold text-zinc-500">Total Orders</div>
            <div className="mt-1 text-2xl  text-zinc-900">{stats.count}</div>
          </div>

          {(
            [
              ["pending", "Pending", "bg-amber-600"] as const,
              ["processing", "Processing", "bg-sky-600"] as const,
              ["completed", "Completed", "bg-emerald-600"] as const,
              ["cancelled", "Cancelled", "bg-red-600"] as const,
            ] as const
          ).map(([key, label, dot]) => (
            <div key={key} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-500">{label}</div>
                <span className={["h-2.5 w-2.5 rounded-full", dot].join(" ")} />
              </div>
              <div className="mt-1 text-2xl  text-zinc-900">
                {stats[key]}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar: Filters + Search + Page size */}
        <div className="mb-6 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(["all", "pending", "processing", "completed", "cancelled"] as const).map(
                (status) => {
                  const active = filter === status;
                  return (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={[
                        "whitespace-nowrap rounded-2xl px-4 py-2 text-sm  transition",
                        active
                          ? "bg-gradient-to-r from-emerald-600 to-sky-600 text-white shadow"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                      type="button"
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  );
                }
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search orders, customer, items..."
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-200/60"
                />
              </div>

              {/* Page size */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500">Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) as 10 | 20 | 50)}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm  text-zinc-800 shadow-sm outline-none transition hover:bg-zinc-50"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info row */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-semibold text-zinc-500">
              Showing <span className=" text-zinc-700">{showingFrom}</span>–
              <span className=" text-zinc-700">{showingTo}</span> of{" "}
              <span className=" text-zinc-700">{totalRows}</span>
            </div>

            {/* Pagination controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
                First
              </button>

              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="inline-flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs  text-zinc-800">
                Page {safePage} / {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                title="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="inline-flex items-center gap-1 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs  text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                title="Last page"
              >
                Last
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Orders */}
        {loading ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto inline-block h-12 w-12 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            <p className="mt-4 text-sm font-semibold text-zinc-600">Loading orders...</p>
          </div>
        ) : pageSlice.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50">
              <ShoppingBag className="h-8 w-8 text-emerald-700" />
            </div>
            <h3 className="text-xl  text-zinc-900 mb-2">No orders found</h3>
            <p className="text-sm text-zinc-600 mb-6">
              Try changing filters or search keyword.
            </p>
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-6 py-3 text-sm  text-white shadow-lg transition hover:from-emerald-700 hover:to-sky-700 hover:shadow-xl"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {pageSlice.map((order) => {
              const pill = getStatusPill(order.status);
              const isOpen = openId === order.id;
              const raw = order.raw;

              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Top bar */}
                  <div className="flex flex-col gap-3 border-b border-zinc-200 bg-gradient-to-r from-zinc-50 to-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={["h-2.5 w-2.5 rounded-full", pill.dot].join(" ")} />
                        <div className="truncate text-base  text-zinc-900">
                          {order.orderNumber}
                        </div>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-zinc-500">
                        Order ID: <span className="font-mono text-zinc-700">{order.id}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={[
                          "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm ",
                          pill.cls,
                        ].join(" ")}
                      >
                        {pill.icon}
                        <span>{pill.label}</span>
                      </div>

                      <button
                        className="rounded-2xl border border-emerald-200 bg-white px-5 py-2 text-sm  text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                        type="button"
                        onClick={() => setOpenId((prev) => (prev === order.id ? null : order.id))}
                      >
                        {isOpen ? "Hide Details" : "View Details"}
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-6 py-5">
                    <div className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-zinc-500" />
                        <span className="font-semibold text-zinc-600">Date:</span>
                        <span className=" text-zinc-900">
                          {new Date(order.date).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-zinc-500" />
                        <span className="font-semibold text-zinc-600">Items:</span>
                        <span className=" text-zinc-900">
                          {order.items}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-600">Total:</span>
                        <span className=" text-zinc-900">{formatINR(order.total)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
                      <MapPin className="mt-0.5 h-4 w-4 text-zinc-500" />
                      <span className="font-semibold text-zinc-600">Address:</span>
                      <span className="font-semibold text-zinc-900">{order.shippingAddress}</span>
                    </div>

                    {/* meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
                      {order.customerName ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                          Customer: <span className=" text-zinc-900">{order.customerName}</span>
                        </span>
                      ) : null}

                      {order.paymentMode ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                          Payment: <span className=" text-zinc-900">{order.paymentMode}</span>
                        </span>
                      ) : null}

                      {order.paymentStatus ? (
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1">
                          Status: <span className=" text-zinc-900">{order.paymentStatus}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Details */}
                  {isOpen ? (
                    <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="text-sm  text-zinc-900">Customer</div>
                          <div className="mt-2 text-sm text-zinc-700 space-y-1">
                            <div>
                              <span className="font-semibold text-zinc-600">Name:</span>{" "}
                              <span className="font-bold text-zinc-900">{raw?.customer?.fullName ?? "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-600">Mobile:</span>{" "}
                              <span className="font-bold text-zinc-900">{raw?.customer?.mobile ?? "—"}</span>
                            </div>
                            <div>
                              <span className="font-semibold text-zinc-600">Email:</span>{" "}
                              <span className="font-bold text-zinc-900">{raw?.customer?.email ?? "—"}</span>
                            </div>
                            <div className="pt-2">
                              <span className="font-semibold text-zinc-600">Address:</span>{" "}
                              <span className="font-semibold text-zinc-900">{raw?.customer?.address ?? "—"}</span>
                            </div>
                            {raw?.customer?.notes ? (
                              <div className="pt-2">
                                <span className="font-semibold text-zinc-600">Notes:</span>{" "}
                                <span className="font-semibold text-zinc-900">{raw.customer.notes}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="text-sm  text-zinc-900">Items</div>

                          <div className="mt-3 space-y-3">
                            {(raw?.items ?? []).map((it, idx) => {
                              const qty = safeNum(it.quantity, 0);
                              const price = safeNum(it.price, 0);
                              const line = price * qty;

                              return (
                                <div
                                  key={`${order.id}-${idx}`}
                                  className="flex items-start justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm  text-zinc-900">
                                      {it.name ?? it.service ?? "Service"}
                                    </div>
                                    <div className="mt-0.5 text-xs font-semibold text-zinc-600">
                                      Qty: {qty} • {formatINR(price)}
                                      {typeof it.bv === "number" ? ` • ${it.bv} BV` : ""}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-sm  text-zinc-900">
                                    {formatINR(line)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
                            <div className="text-sm font-semibold text-zinc-600">Total</div>
                            <div className="text-lg  text-zinc-900">
                              {formatINR(order.total)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
