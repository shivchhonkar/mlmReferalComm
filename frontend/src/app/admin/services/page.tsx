"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  AlertCircle,
  Settings,
  Plus,
  ClipboardList,
  Upload,
  Search,
  Filter,
  BadgeCheck,
  Sparkles,
  Pencil,
  Trash2,
  Power,
  X,
  Check,
  RefreshCw,
  Star,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import AdminServiceUpload from "./AdminServiceUpload";

type Service = {
  _id: string;
  name: string;
  price: number;
  businessVolume: number;
  status: "pending_approval" | "approved" | "rejected" | "active" | "inactive" | "out_of_stock";
  createdAt: string;

  slug?: string;
  image?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string | { _id: string; name: string; code: string };
  isFeatured?: boolean;
  tags?: string[];
  rejectionReason?: string;
};

type MeResponse = {
  user?: {
    id: string;
    email: string;
    role?: string;
    name?: string;
    fullName?: string;
  };
};

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

function cn(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

function generateSlug(text: string) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ServiceImage({ src, name }: { src?: string; name: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-[16/10] w-full bg-slate-50 flex items-center justify-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "";
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="h-12 w-12 rounded-xl border border-slate-200 bg-white flex items-center justify-center">
              <span className="text-xs font-semibold">NO</span>
            </div>
            <span className="text-[10px] font-semibold tracking-wide">IMAGE</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  footer,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Settings className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{subtitle ?? "Manage service details"}</p>
              </div>
            </div>
            <button
              className="h-10 w-10 rounded-2xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center"
              onClick={() => !busy && onClose()}
              aria-label="Close"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          <div className="px-6 py-5">{children}</div>

          {footer ? (
            <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-end gap-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminServicesPage() {
 const { user } = useAuth({ requireAdmin: true });
 console.log("user: ", user)

  const [meRole, setMeRole] = useState<string | undefined>(user?.role);
  const canManage = useMemo(() => ADMIN_ROLES.has(String(meRole ?? "")), [meRole]);

  const [services, setServices] = useState<Service[]>([]);
  const [pendingServices, setPendingServices] = useState<Service[]>([]);
  const [pendingPagination, setPendingPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [activeTab, setActiveTab] = useState<"manage" | "upload" | "approvals">("manage");

  // UI
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "featured">("all");

  // Sorting
  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "price_asc" | "price_desc" | "name_asc" | "name_desc" | "category_asc" | "category_desc"
  >("date_desc");

  // Create modal state + form
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [businessVolume, setBusinessVolume] = useState<number | "">("");
  const [image, setImage] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editBusinessVolume, setEditBusinessVolume] = useState<number | "">("");
  const [editImage, setEditImage] = useState("");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editIsFeatured, setEditIsFeatured] = useState(false);
  const [editStatus, setEditStatus] = useState<"active" | "pending_approval" | "inactive" | "approved" | "rejected" | "out_of_stock">("active");

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  // Approval modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedServiceForReject, setSelectedServiceForReject] = useState<Service | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);

  // async function loadMe() {
  //   try {
  //     const res = await apiFetch("/api/auth/me");
  //     const json: MeResponse = await res.json();
  //     if (res.ok) setMeRole(json?.user?.role);
  //   } catch {
  //     // ignore
  //   }
  // }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/services");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load services");
      setServices(json.services ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingServices(page = 1) {
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
      });
      const res = await apiFetch(`/api/admin/services/pending?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load pending services");
      setPendingServices(json.services ?? []);
      setPendingPagination(json.pagination ?? { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    setMeRole(user?.role)
    load();
    if (activeTab === "approvals") {
      loadPendingServices();
    }
    console.log('user?.role: ', user?.role,'---', user);
  }, [user, activeTab]);

  // ---- Create modal handlers
  function openCreate() {
    if (!canManage) {
      setError("Only admin/super_admin can create services.");
      return;
    }
    setCreateOpen(true);
  }

  function closeCreate() {
    if (busy) return;
    setCreateOpen(false);
  }

  function resetCreateForm() {
    setName("");
    setSlug("");
    setPrice("");
    setBusinessVolume("");
    setImage("");
    setShortDescription("");
    setCategoryId("");
    setIsFeatured(false);
  }

  async function createService(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canManage) {
      setError("Only admin/super_admin can create services.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const finalSlug = slug || generateSlug(name);

      const res = await apiFetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: finalSlug,
          price,
          businessVolume,
          image: image || undefined,
          shortDescription: shortDescription || undefined,
          categoryId: categoryId || undefined,
          isFeatured,
          status: canManage ? "active" : "pending_approval", // Non-admins need approval
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Create failed");

      resetCreateForm();
      setCreateOpen(false);
      await load();
      if (activeTab === "approvals") {
        await loadPendingServices();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- Edit handlers
  function openEdit(service: Service) {
    if (!canManage) {
      setError("Only admin/super_admin can edit services.");
      return;
    }
    setEditing(service);
    setEditName(service.name ?? "");
    setEditSlug(service.slug ?? generateSlug(service.name ?? ""));
    setEditPrice(service.price ?? "");
    setEditBusinessVolume(service.businessVolume ?? "");
    setEditImage(service.image ?? "");
    setEditShortDescription(service.shortDescription ?? "");
    setEditCategoryId(service._id ?? "");
    setEditIsFeatured(Boolean(service.isFeatured));
    setEditStatus(service.status ?? "active");
    setEditOpen(true);
  }

  function closeEdit() {
    if (busy) return;
    setEditOpen(false);
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!canManage) {
      setError("Only admin/super_admin can update services.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/admin/services/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          slug: editSlug || generateSlug(editName),
          price: editPrice,
          businessVolume: editBusinessVolume,
          image: editImage || undefined,
          shortDescription: editShortDescription || undefined,
          categoryId: editCategoryId || undefined,
          isFeatured: editIsFeatured,
          status: editStatus,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");

      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- Toggle active
  async function toggleActive(service: Service) {
    if (!canManage) {
      setError("Only admin/super_admin can change status.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/admin/services/${service._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: service.status === "active" ? "inactive" : "active" }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Update failed");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ---- Delete
  function openDelete(service: Service) {
    if (!canManage) {
      setError("Only admin/super_admin can delete services.");
      return;
    }
    setDeleteTarget(service);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (busy) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!canManage) {
      setError("Only admin/super_admin can delete services.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/admin/services/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error ?? "Delete failed");

      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const total = services.length;
    const active = services.filter((s) => s.status === "active").length;
    const inactive = services.filter((s) => s.status === "inactive").length;
    const featured = services.filter((s) => s.isFeatured).length;
    const pending = pendingPagination.total;
    return { total, active, inactive, featured, pending };
  }, [services, pendingPagination]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const arr = services.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (featuredFilter === "featured" && !s.isFeatured) return false;
      if (!q) return true;
      const hay = `${s.name ?? ""} ${s.slug ?? ""} ${s.categoryId ?? ""}`.toLowerCase();
      return hay.includes(q);
    });

    const safeDate = (d?: string) => {
      const t = Date.parse(String(d ?? ""));
      return Number.isFinite(t) ? t : 0;
    };

    arr.sort((a, b) => {
      switch (sortBy) {
        case "date_desc":
          return safeDate(b.createdAt) - safeDate(a.createdAt);
        case "date_asc":
          return safeDate(a.createdAt) - safeDate(b.createdAt);
        case "price_asc":
          return (a.price ?? 0) - (b.price ?? 0);
        case "price_desc":
          return (b.price ?? 0) - (a.price ?? 0);
        case "name_asc":
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        case "name_desc":
          return String(b.name ?? "").localeCompare(String(a.name ?? ""));
        case "category_asc":
          return String(a.categoryId ?? "").localeCompare(String(b.categoryId ?? ""));
        case "category_desc":
          return String(b.categoryId ?? "").localeCompare(String(a.categoryId ?? ""));
        default:
          return 0;
      }
    });

    return arr;
  }, [services, query, statusFilter, featuredFilter, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header like marketplace */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Settings className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Services Admin
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Manage services to generate Business Volume (BV) and grow referral income.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    Quality Assured
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    <Sparkles className="h-4 w-4 text-sky-600" />
                    Instant BV
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                      canManage
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    )}
                  >
                    <Star className="h-4 w-4" />
                    {canManage ? "Admin Controls Enabled" : "Read-only (not admin/super_admin)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/rules"
                prefetch={false}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Rules
              </Link>
              <Link
                href="/dashboard"
                prefetch={false}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <button
                onClick={() => load().catch((e) => setError(String(e?.message ?? e)))}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                disabled={busy}
              >
                <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                Refresh
              </button>

              {/* ✅ Create button opens modal */}
              <button
                onClick={openCreate}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white",
                  canManage ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                )}
                disabled={!canManage}
              >
                <Plus className="h-4 w-4" />
                Create Service
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Total Services</div>
              <div className="mt-1 text-2xl text-slate-900">{stats.total}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Active</div>
              <div className="mt-1 text-2xl  text-emerald-700">{stats.active}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Inactive</div>
              <div className="mt-1 text-2xl text-slate-700">{stats.inactive}</div>
            </div>
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="text-xs font-semibold text-yellow-700">Pending Approval</div>
              <div className="mt-1 text-2xl text-yellow-700">{stats.pending}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Featured</div>
              <div className="mt-1 text-2xl text-sky-700">{stats.featured}</div>
            </div>
          </div>

          {/* Search + Filters + Sort */}
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-emerald-600" />
                  Search, Filter & Sort
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Find services quickly and manage them faster.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {filteredSorted.length} of {services.length} found
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-6">
              <div className="lg:col-span-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white !pl-12 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Search services..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none"
                  value={featuredFilter}
                  onChange={(e) => setFeaturedFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="featured">Featured</option>
                </select>
              </div>

              <div className="lg:col-span-1">
                <div className="relative">
                  <ArrowUpDown className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white !pl-10 pr-3 py-3 text-sm font-semibold text-slate-800 outline-none"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="date_desc">Date (Newest)</option>
                    <option value="date_asc">Date (Oldest)</option>
                    <option value="price_asc">Price (Low → High)</option>
                    <option value="price_desc">Price (High → Low)</option>
                    <option value="name_asc">Name (A → Z)</option>
                    <option value="name_desc">Name (Z → A)</option>
                    <option value="category_asc">Category (A → Z)</option>
                    <option value="category_desc">Category (Z → A)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("manage")}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "manage"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              Manage
            </button>
            <button
              onClick={() => {
                setActiveTab("approvals");
                loadPendingServices();
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors relative",
                activeTab === "approvals"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <Clock className="h-4 w-4" />
              Approvals
              {pendingPagination.total > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px]">
                  {pendingPagination.total}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "upload"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <Upload className="h-4 w-4" />
              Bulk Import
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold">Error</div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        ) : null}

        {activeTab === "upload" ? (
          <AdminServiceUpload />
        ) : activeTab === "approvals" ? (
          <div className="mt-2">
            {pendingServices.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100">
                  <Clock className="h-8 w-8 text-zinc-500" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">No Pending Services</h3>
                <p className="text-sm text-zinc-600">All services have been reviewed. Great job!</p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingServices.map((s) => {
                    const isBusy = busyApprovalId === s._id;
                    const categoryName = typeof s.categoryId === "object" ? s.categoryId?.name : s.categoryId;

                    return (
                      <div
                        key={s._id}
                        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="inline-flex items-center rounded-full bg-yellow-50 border border-yellow-200 px-2.5 py-1 text-[11px] font-bold text-yellow-700">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </span>
                        </div>

                        <div className="mt-4">
                          <ServiceImage src={s.image} name={s.name} />
                        </div>

                        <div className="mt-4">
                          <div className="text-base font-bold text-slate-900">{s.name}</div>
                          <div className="mt-1 text-sm text-slate-600 line-clamp-2">
                            {s.shortDescription || s.description || "No description provided."}
                          </div>
                        </div>

                        <div className="mt-4 flex items-end justify-between">
                          <div>
                            <div className="text-lg font-extrabold text-slate-900">
                              {formatINR(s.price)}
                            </div>
                            <div className="text-xs text-slate-500">
                              BV: {s.businessVolume} {categoryName ? `• ${categoryName}` : ""}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setBusyApprovalId(s._id);
                              try {
                                const res = await apiFetch(`/api/admin/services/${s._id}/approve`, {
                                  method: "PUT",
                                });
                                const json = await res.json();
                                if (!res.ok) throw new Error(json?.error ?? "Failed to approve");
                                await loadPendingServices(pendingPagination.page);
                                await load();
                              } catch (e: unknown) {
                                setError(e instanceof Error ? e.message : String(e));
                              } finally {
                                setBusyApprovalId(null);
                              }
                            }}
                            disabled={isBusy || !canManage}
                            className={cn(
                              "flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
                              canManage ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                            )}
                          >
                            <CheckCircle className="h-4 w-4" />
                            {isBusy ? "Working..." : "Approve"}
                          </button>

                          <button
                            onClick={() => {
                              setSelectedServiceForReject(s);
                              setRejectModalOpen(true);
                            }}
                            disabled={isBusy || !canManage}
                            className={cn(
                              "flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
                              canManage ? "bg-red-600 hover:bg-red-700" : "bg-slate-300 cursor-not-allowed"
                            )}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pendingPagination.pages > 1 && (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-700">
                        Showing{" "}
                        <span className="font-bold">
                          {(pendingPagination.page - 1) * pendingPagination.limit + 1}
                        </span>{" "}
                        to{" "}
                        <span className="font-bold">
                          {Math.min(pendingPagination.page * pendingPagination.limit, pendingPagination.total)}
                        </span>{" "}
                        of <span className="font-bold">{pendingPagination.total}</span> results
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newPage = Math.max(1, pendingPagination.page - 1);
                            loadPendingServices(newPage);
                          }}
                          disabled={pendingPagination.page === 1}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:shadow-md transition disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 text-sm font-semibold text-zinc-700">
                          Page {pendingPagination.page} of {pendingPagination.pages}
                        </span>
                        <button
                          onClick={() => {
                            const newPage = Math.min(pendingPagination.pages, pendingPagination.page + 1);
                            loadPendingServices(newPage);
                          }}
                          disabled={pendingPagination.page === pendingPagination.pages}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 hover:shadow-md transition disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mt-2">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
                    <div className="mt-4 h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-2 h-4 w-1/2 bg-slate-100 rounded animate-pulse" />
                    <div className="mt-4 h-10 bg-slate-100 rounded-2xl animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSorted.map((s) => (
                  <div
                    key={s._id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {s.isFeatured ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                            <Star className="h-3.5 w-3.5" />
                            Featured
                          </span>
                        ) : null}

                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
                            s.status === "active"
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                              : s.status === "inactive"?"bg-orange-700 text-white-700": "bg-slate-50 border-slate-200 text-slate-700"
                          )}
                        >
                          {s.status === "active" ? "Active" : "Inactive"}
                        </span>

                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                          {s.businessVolume} BV
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <ServiceImage src={s.image} name={s.name} />
                    </div>

                    <div className="mt-4">
                      <div className="text-base font-bold text-slate-900">{s.name}</div>
                      <div className="mt-1 text-sm text-slate-600 line-clamp-2">
                        {s.shortDescription || "No description provided."}
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-lg font-extrabold text-slate-900">
                          {formatINR(s.price)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Category:{" "}
                          <span className="font-semibold">{s._id || "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          className={cn(
                            "h-10 w-10 rounded-2xl border flex items-center justify-center",
                            canManage
                              ? "border-slate-200 hover:bg-slate-50"
                              : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          )}
                          title={canManage ? "Edit service" : "Not allowed"}
                          onClick={() => openEdit(s)}
                          disabled={!canManage || busy}
                        >
                          <Pencil className="h-5 w-5 text-slate-700" />
                        </button>

                        <button
                          className={cn(
                            "h-10 w-10 rounded-2xl border flex items-center justify-center",
                            canManage
                              ? "border-slate-200 hover:bg-slate-50"
                              : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          )}
                          title={canManage ? "Toggle active/inactive" : "Not allowed"}
                          onClick={() => toggleActive(s)}
                          disabled={!canManage || busy}
                        >
                          <Power className="h-5 w-5 text-slate-700" />
                        </button>

                        <button
                          className={cn(
                            "h-10 w-10 rounded-2xl border flex items-center justify-center",
                            canManage
                              ? "border-red-200 hover:bg-red-50"
                              : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          )}
                          title={canManage ? "Delete service" : "Not allowed"}
                          onClick={() => openDelete(s)}
                          disabled={!canManage || busy}
                        >
                          <Trash2 className="h-5 w-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {!loading && filteredSorted.length === 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 sm:col-span-2 lg:col-span-3">
                    No services found. Try a different search/filter.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ✅ Create Modal */}
      <Modal
        open={createOpen}
        title="Create New Service"
        subtitle="Add a service with price & BV (opens in modal to save page space)"
        onClose={() => {
          closeCreate();
        }}
        busy={busy}
        footer={
          <>
            <button
              onClick={() => {
                if (busy) return;
                closeCreate();
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={() => createService()}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60",
                canManage ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300"
              )}
              disabled={busy || !canManage || !name || price === "" || businessVolume === ""}
            >
              <Check className="h-4 w-4" />
              {busy ? "Creating..." : "Create"}
            </button>
          </>
        }
      >
        <form onSubmit={createService} className="grid gap-4 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Service Name *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Enter service name"
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (!slug) setSlug(generateSlug(v));
              }}
              required
              disabled={!canManage}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Slug</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="auto-generated"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              disabled={!canManage}
            />
            <p className="mt-1 text-xs text-slate-500">
              Auto: <span className="font-semibold">{generateSlug(name || "service")}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Price (₹) *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              step="0.01"
              placeholder="0.00"
              required
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Business Volume (BV) *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              type="number"
              value={businessVolume}
              onChange={(e) => setBusinessVolume(e.target.value === "" ? "" : Number(e.target.value))}
              min={0}
              placeholder="0"
              required
              disabled={!canManage}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Image URL</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://example.com/image.jpg (optional)"
              disabled={!canManage}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Short Description</label>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief description (max 200 chars)"
              maxLength={200}
              rows={3}
              disabled={!canManage}
            />
            <p className="mt-1 text-xs text-slate-500">{shortDescription.length}/200</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category ID</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Optional"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canManage}
            />
          </div>

          <div className="flex items-center gap-3 md:mt-8">
            <input
              type="checkbox"
              id="isFeaturedCreate"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage}
            />
            <label htmlFor="isFeaturedCreate" className="text-sm font-semibold text-slate-700">
              Featured Service
            </label>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        title="Edit Service"
        subtitle="Edit fields and save changes"
        onClose={closeEdit}
        busy={busy}
        footer={
          <>
            <button
              onClick={closeEdit}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              disabled={busy || !canManage}
            >
              <Check className="h-4 w-4" />
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2grid gap-4 md:grid-cols-2 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Name *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={editName}
              onChange={(e) => {
                const v = e.target.value;
                setEditName(v);
                if (!editSlug) setEditSlug(generateSlug(v));
              }}
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Slug</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={editSlug}
              onChange={(e) => setEditSlug(generateSlug(e.target.value))}
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Price (₹) *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              type="number"
              step="0.01"
              min={0}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">BV *</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              type="number"
              min={0}
              value={editBusinessVolume}
              onChange={(e) =>
                setEditBusinessVolume(e.target.value === "" ? "" : Number(e.target.value))
              }
              disabled={!canManage}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Image URL</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={editImage}
              onChange={(e) => setEditImage(e.target.value)}
              placeholder="https://..."
              disabled={!canManage}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Short Description
            </label>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={editShortDescription}
              onChange={(e) => setEditShortDescription(e.target.value)}
              maxLength={200}
              rows={3}
              disabled={!canManage}
            />
            <p className="mt-1 text-xs text-slate-500">{editShortDescription.length}/200</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category ID</label>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-200"
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
              disabled={!canManage}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
              disabled={!canManage}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              checked={editIsFeatured}
              onChange={(e) => setEditIsFeatured(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage}
            />
            <span className="text-sm font-semibold text-slate-700">Featured Service</span>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        open={deleteOpen}
        title="Delete Service"
        subtitle="This action cannot be undone"
        onClose={closeDelete}
        busy={busy}
        footer={
          <>
            <button
              onClick={closeDelete}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              disabled={busy || !canManage}
            >
              <Trash2 className="h-4 w-4" />
              {busy ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-bold">This action cannot be undone.</div>
          <div className="mt-2">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteTarget?.name}</span>?
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectModalOpen}
        title="Reject Service"
        subtitle="Please provide a reason for rejection"
        onClose={() => {
          if (busyApprovalId) return;
          setRejectModalOpen(false);
          setSelectedServiceForReject(null);
          setRejectionReason("");
        }}
        busy={!!busyApprovalId}
        footer={
          <>
            <button
              onClick={() => {
                if (busyApprovalId) return;
                setRejectModalOpen(false);
                setSelectedServiceForReject(null);
                setRejectionReason("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              disabled={!!busyApprovalId}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!selectedServiceForReject || !rejectionReason.trim()) return;
                setBusyApprovalId(selectedServiceForReject._id);
                try {
                  const res = await apiFetch(`/api/admin/services/${selectedServiceForReject._id}/reject`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason: rejectionReason.trim() }),
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.error ?? "Failed to reject");
                  setRejectModalOpen(false);
                  setSelectedServiceForReject(null);
                  setRejectionReason("");
                  await loadPendingServices(pendingPagination.page);
                  await load();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusyApprovalId(null);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              disabled={!!busyApprovalId || !rejectionReason.trim() || !canManage}
            >
              <XCircle className="h-4 w-4" />
              {busyApprovalId ? "Rejecting..." : "Reject"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-bold">Rejecting: {selectedServiceForReject?.name}</div>
            <div className="mt-1 text-xs">This action will mark the service as rejected.</div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Rejection Reason *
            </label>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-red-200"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason (e.g., Invalid documents, Wrong category, Pricing mismatch...)"
              rows={4}
              disabled={!!busyApprovalId}
            />
            <p className="mt-1 text-xs text-slate-500">
              Tip: Use clear reasons like "Invalid documents", "Wrong category", "Pricing mismatch", etc.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
