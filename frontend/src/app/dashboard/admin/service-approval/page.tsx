"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  Package,
  User,
  Mail,
  ArrowLeft,
  CheckSquare,
} from "lucide-react";
import { showSuccessToast } from "@/lib/toast";
import { formatINR } from "@/lib/format";

interface Service {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price: number;
  businessVolume: number;
  status: string;
  image?: string;
  gallery?: string[];
  categoryId?: { _id: string; name: string; code: string };
  sellerId?: { _id: string; name?: string; fullName?: string; email?: string; mobile?: string } | null;
  tags?: string[];
  createdAt: string;
}

interface ServicesResponse {
  services: Service[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

function SellerBadge({ seller }: { seller: Service["sellerId"] }) {
  if (!seller) return <span className="text-slate-400">—</span>;
  const name = seller.fullName || seller.name || seller.email || seller.mobile || "Unknown";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <User className="h-4 w-4 text-slate-500" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {(seller.email || seller.mobile) && (
          <p className="truncate text-xs text-slate-500">{seller.email || seller.mobile}</p>
        )}
      </div>
    </div>
  );
}

export default function ServiceApprovalPage() {
  useAuth({ requireAdmin: true });

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    fetchPendingServices();
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "admin-action-updated") fetchPendingServices();
    };
    globalThis.addEventListener("storage", onStorage);
    return () => globalThis.removeEventListener("storage", onStorage);
  }, []);

  const fetchPendingServices = async () => {
    try {
      setError(null);
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await apiFetch(`/api/admin/services/pending?${params}`);
      const data: ServicesResponse = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to fetch");
      setServices(data.services);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const approveService = async (serviceId: string) => {
    try {
      setError(null);
      setBusyId(serviceId);
      const res = await apiFetch(`/api/admin/services/${serviceId}/approve`, { method: "PUT" });
      if (!res.ok) throw new Error("Failed to approve");
      showSuccessToast("Service approved successfully");
      fetchPendingServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusyId(null);
    }
  };

  const rejectService = async (serviceId: string, reason: string) => {
    try {
      setError(null);
      setBusyId(serviceId);
      const res = await apiFetch(`/api/admin/services/${serviceId}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedService(null);
      showSuccessToast("Service rejected");
      fetchPendingServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = pagination.total;

  if (loading && services.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 rounded-lg bg-slate-200" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="mb-4 aspect-video rounded-xl bg-slate-200" />
                  <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
                  <div className="mb-4 h-3 w-1/2 rounded bg-slate-200" />
                  <div className="flex gap-2">
                    <div className="h-10 flex-1 rounded-lg bg-slate-200" />
                    <div className="h-10 flex-1 rounded-lg bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckSquare className="h-4 w-4" />
              <span>Admin</span>
              <span className="text-slate-400">·</span>
              <span>Service Approval</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Pending Service Approvals
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Review and approve or reject services submitted by sellers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/admin/services"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Manage services
            </Link>
            <button
              onClick={fetchPendingServices}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Search + Stats */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setCurrentPage(1);
                setSearchTerm(e.target.value);
              }}
              placeholder="Search by name, seller, category..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 !pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">{pendingCount} pending</span>
            </div>
          </div>
        </div>

        {/* Services grid */}
        {services.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No Pending Services</h3>
            <p className="mt-1 text-sm text-slate-600">
              All seller submissions have been reviewed.
            </p>
            <Link
              href="/dashboard/admin/services"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Manage services
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => {
                const isBusy = busyId === service._id;
                const categoryName = service.categoryId?.name ?? "—";

                return (
                  <div
                    key={service._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    {/* Image */}
                    <div className="relative aspect-video bg-slate-100">
                      {service.image ? (
                        <img
                          src={service.image}
                          alt={service.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect fill='%23e2e8f0' width='400' height='225'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-12 w-12 text-slate-300" />
                        </div>
                      )}
                      <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        service.status === "draft"
                          ? "bg-slate-100 text-slate-700"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {service.status === "draft" ? "Draft" : "Pending"}
                      </span>
                    </div>

                    <div className="p-5">
                      <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
                        {service.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {service.shortDescription || service.description || "No description"}
                      </p>

                      <div className="mt-4 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-lg font-bold text-slate-900">{formatINR(service.price)}</p>
                          <p className="text-xs text-slate-500">BV: {service.businessVolume}</p>
                        </div>
                        <span className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                          {categoryName}
                        </span>
                      </div>

                      {/* Seller */}
                      <div className="mt-4">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                          Submitted by
                        </p>
                        <SellerBadge seller={service.sellerId} />
                      </div>

                      {/* Actions */}
                      <div className="mt-5 flex gap-2">
                        <button
                          onClick={() => approveService(service._id)}
                          disabled={isBusy}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {isBusy ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedService(service);
                            setShowRejectModal(true);
                          }}
                          disabled={isBusy}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row">
                <p className="text-sm text-slate-600">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={currentPage === pagination.pages}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Reject modal */}
        {showRejectModal && selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-900">Reject Service</h2>
              <p className="mt-2 text-sm text-slate-600">
                Provide a reason for rejecting <strong>"{selectedService.name}"</strong>
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Invalid documents, wrong category..."
                rows={4}
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => rejectService(selectedService._id, rejectionReason.trim())}
                  disabled={!rejectionReason.trim() || busyId === selectedService._id}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busyId === selectedService._id ? "Rejecting…" : "Reject"}
                </button>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedService(null);
                    setRejectionReason("");
                  }}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
