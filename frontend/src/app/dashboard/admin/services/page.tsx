"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  AlertCircle,
  Settings,
  Plus,
  Package,
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
  LayoutDashboard,
  BarChart3,
  IndianRupee,
} from "lucide-react";
import { formatINR } from "@/lib/format";
import AdminServiceUpload from "./AdminServiceUpload";

type Service = {
  _id: string;
  name: string;
  price: number;
  businessVolume: number;
  status: "draft" | "pending" | "pending_approval" | "approved" | "rejected" | "active" | "inactive" | "out_of_stock";
  createdAt: string;

  slug?: string;
  image?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string | { _id: string; name: string; code: string };
  sellerId?: { _id: string; name?: string; fullName?: string; email?: string; mobile?: string } | null;
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
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="aspect-[16/10] w-full flex items-center justify-center">
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
          <div className="flex flex-col items-center gap-1.5 text-slate-400">
            <Package className="h-10 w-10" />
            <span className="text-[10px] font-semibold uppercase tracking-wider">No image</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Service["status"] }) {
  const config: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
    pending: { label: "Pending", className: "bg-amber-50 text-amber-800 border-amber-200" },
    pending_approval: { label: "Pending", className: "bg-amber-50 text-amber-800 border-amber-200" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    active: { label: "Active", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
    inactive: { label: "Inactive", className: "bg-slate-100 text-slate-600 border-slate-200" },
    out_of_stock: { label: "Out of stock", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { label, className } = config[status] ?? { label: String(status), className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>
      {label}
    </span>
  );
}

const formInputClass =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed";
const formLabelClass = "mb-1.5 block text-sm font-medium text-slate-700";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminServicesPage() {
  const { user } = useAuth({ requireAdmin: true });

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
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "pending" | "approved" | "rejected" | "active" | "inactive"
  >("all");
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
  const [editStatus, setEditStatus] = useState<"draft" | "pending" | "pending_approval" | "active" | "inactive" | "approved" | "rejected" | "out_of_stock">("active");

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  // Approval modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedServiceForReject, setSelectedServiceForReject] = useState<Service | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);

  // Categories for dropdown (active only)
  const [categories, setCategories] = useState<{ _id: string; name: string; code?: string }[]>([]);

  async function loadCategories() {
    try {
      const res = await apiFetch("/api/categories");
      const data = await res.json();
      if (res.ok && data?.categories) setCategories(data.categories);
    } catch {
      setCategories([]);
    }
  }

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
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await apiFetch(`/api/admin/services${params}`);
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
    setMeRole(user?.role);
    load();
    loadCategories();
    if (activeTab === "approvals") {
      loadPendingServices();
    }
  }, [user, activeTab, statusFilter]);

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
    setEditCategoryId(
      typeof service.categoryId === "object" ? service.categoryId?._id ?? "" : service.categoryId ?? ""
    );
    setEditIsFeatured(Boolean(service.isFeatured));
    const validStatuses = ["draft", "pending", "pending_approval", "approved", "rejected", "active", "inactive", "out_of_stock"] as const;
    const s = service.status ?? "active";
    setEditStatus(validStatuses.includes(s) ? s : "active");
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
  }, [services, query, featuredFilter, sortBy]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LayoutDashboard className="h-4 w-4" />
              <span>Admin</span>
              <span className="text-slate-400">·</span>
              <span>Services</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Services
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage catalog, approve seller submissions, and control what appears on the marketplace.
            </p>
            <div className="mt-3 flex items-center gap-2">
              {/* <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  canManage ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                <BadgeCheck className="h-3.5 w-3.5" />
                {canManage ? "Full access" : "Read-only"}
              </span> */}
              {stats.pending > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  {stats.pending} pending
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Admin home
            </Link>
            <Link
              href="/admin/rules"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Rules
            </Link> */}
            <button
              type="button"
              onClick={() => load().catch((e) => setError(String(e?.message ?? e)))}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              disabled={!canManage}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                canManage ? "bg-emerald-600 hover:bg-emerald-700" : "cursor-not-allowed bg-slate-400"
              )}
            >
              <Plus className="h-4 w-4" />
              Add service
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <BarChart3 className="h-4 w-4" />
              Total
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Active</div>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Inactive</div>
            <p className="mt-2 text-2xl font-bold text-slate-700">{stats.inactive}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending</div>
            <p className="mt-2 text-2xl font-bold text-amber-800">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-sky-700">Featured</div>
            <p className="mt-2 text-2xl font-bold text-sky-800">{stats.featured}</p>
          </div>
        </div>

        {/* Search + filters + sort — single row */}
        <div className="mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="relative min-w-0 flex-1 sm:max-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className={cn(formInputClass, "!pl-9")}
            />
          </div>
          <select
            className={cn(formInputClass, "w-auto shrink-0 !min-w-0 sm:min-w-[110px] max-w-[110px]")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className={cn(formInputClass, "w-auto shrink-0 !min-w-0 sm:min-w-[90px] max-w-[90px]")}
            value={featuredFilter}
            onChange={(e) => setFeaturedFilter(e.target.value as typeof featuredFilter)}
          >
            <option value="all">All</option>
            <option value="featured">Featured</option>
          </select>
          <select
            className={cn(formInputClass, "w-auto shrink-0 !min-w-0 sm:min-w-[120px] max-w-[120px]")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="date_desc">Newest</option>
            <option value="date_asc">Oldest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="category_asc">Category A–Z</option>
            <option value="category_desc">Category Z–A</option>
          </select>
          <span className="shrink-0 whitespace-nowrap pl-1 text-sm text-slate-500">
            {filteredSorted.length} of {services.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
              activeTab === "manage" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Manage
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("approvals"); loadPendingServices(); }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition relative",
              activeTab === "approvals" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Clock className="h-4 w-4" />
            Approvals
            {pendingPagination.total > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendingPagination.total}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition",
              activeTab === "upload" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Upload className="h-4 w-4" />
            Bulk import
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-10 lg:px-8">
        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="mt-0.5 text-sm text-red-700">{error}</p>
            </div>
          </div>
        ) : null}

        {activeTab === "upload" ? (
          <AdminServiceUpload />
        ) : activeTab === "approvals" ? (
          <div className="mt-2">
            {pendingServices.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
                <Clock className="mx-auto h-14 w-14 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No pending approvals</h3>
                <p className="mt-1 text-sm text-slate-500">All submissions have been reviewed.</p>
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
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge status={s.status === "pending_approval" ? "pending_approval" : "pending"} />
                        </div>
                        <div className="mt-4">
                          <ServiceImage src={s.image} name={s.name} />
                        </div>
                        <h3 className="mt-4 font-semibold text-slate-900 line-clamp-2">{s.name}</h3>
                        <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                          {s.shortDescription || s.description || "No description provided."}
                        </p>
                        <div className="mt-4 flex items-center gap-2">
                          <span className="flex items-center gap-1 text-lg font-bold text-slate-900">
                            <IndianRupee className="h-4 w-4" />
                            {formatINR(s.price)}
                          </span>
                          <span className="text-xs text-slate-500">{s.businessVolume} BV</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {categoryName ?? "—"}
                          {s.sellerId && (
                            <span> · Seller: {s.sellerId?.name || s.sellerId?.fullName || s.sellerId?.email || "—"}</span>
                          )}
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
                              "flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
                              canManage ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-300 cursor-not-allowed"
                            )}
                          >
                            <CheckCircle className="h-4 w-4" />
                            {isBusy ? "Working…" : "Approve"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedServiceForReject(s);
                              setRejectModalOpen(true);
                            }}
                            disabled={isBusy || !canManage}
                            className={cn(
                              "flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60",
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

                {pendingPagination.pages > 1 && (
                  <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      Showing {(pendingPagination.page - 1) * pendingPagination.limit + 1}–{Math.min(pendingPagination.page * pendingPagination.limit, pendingPagination.total)} of {pendingPagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => loadPendingServices(Math.max(1, pendingPagination.page - 1))}
                        disabled={pendingPagination.page === 1}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="px-3 text-sm text-slate-600">
                        Page {pendingPagination.page} of {pendingPagination.pages}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadPendingServices(Math.min(pendingPagination.pages, pendingPagination.page + 1))}
                        disabled={pendingPagination.page === pendingPagination.pages}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
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
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="aspect-[16/10] rounded-xl bg-slate-100 animate-pulse" />
                    <div className="mt-4 h-5 w-3/4 rounded bg-slate-100 animate-pulse" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSorted.map((s) => (
                  <div
                    key={s._id}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={s.status} />
                          {s.isFeatured && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                              <Star className="h-3.5 w-3.5" />
                              Featured
                            </span>
                          )}
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {s.businessVolume} BV
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            title="Edit"
                            onClick={() => openEdit(s)}
                            disabled={!canManage || busy}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            title="Toggle active/inactive"
                            onClick={() => toggleActive(s)}
                            disabled={!canManage || busy}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                            title="Delete"
                            onClick={() => openDelete(s)}
                            disabled={!canManage || busy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <ServiceImage src={s.image} name={s.name} />
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-900 line-clamp-2">{s.name}</h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                        {s.shortDescription || "No description."}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-lg font-bold text-slate-900">
                            <IndianRupee className="h-4 w-4" />
                            {formatINR(s.price)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {typeof s.categoryId === "object" ? s.categoryId?.name : s.categoryId || "—"}
                        {s.sellerId && (
                          <span> · {s.sellerId?.name || s.sellerId?.fullName || s.sellerId?.email || "—"}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}

                {!loading && filteredSorted.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm sm:col-span-2 lg:col-span-3">
                    <Package className="mx-auto h-14 w-14 text-slate-300" />
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">No services found</h3>
                    <p className="mt-1 text-sm text-slate-500">Try a different search or filter.</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal
        open={createOpen}
        title="Create service"
        subtitle="Add a new service to the catalog. Admin-created services can be set active immediately."
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
        <form onSubmit={createService} className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={formLabelClass}>Service name *</label>
            <input
              className={formInputClass}
              placeholder="e.g. GST Filing Service"
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
            <label className={formLabelClass}>URL slug</label>
            <input
              className={formInputClass}
              placeholder="Auto-generated from name"
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              disabled={!canManage}
            />
          </div>
          <div>
            <label className={formLabelClass}>Price (₹) *</label>
            <input
              className={formInputClass}
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
            <label className={formLabelClass}>Business volume (BV) *</label>
            <input
              className={formInputClass}
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
            <label className={formLabelClass}>Image URL</label>
            <input
              className={formInputClass}
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              disabled={!canManage}
            />
          </div>
          <div className="md:col-span-2">
            <label className={formLabelClass}>Short description</label>
            <textarea
              className={formInputClass}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Max 200 characters"
              maxLength={200}
              rows={3}
              disabled={!canManage}
            />
            <p className="mt-1 text-xs text-slate-500">{shortDescription.length}/200</p>
          </div>
          <div>
            <label className={formLabelClass}>Category</label>
            <select
              className={formInputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canManage}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="isFeaturedCreate"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={!canManage}
            />
            <label htmlFor="isFeaturedCreate" className="text-sm font-medium text-slate-700">
              Featured on marketplace
            </label>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        title="Edit service"
        subtitle="Update details, status, and featured flag."
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
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={formLabelClass}>Name *</label>
            <input
              className={formInputClass}
              value={editName}
              onChange={(e) => {
                const v = e.target.value;
                setEditName(v);
                if (!editSlug) setEditSlug(generateSlug(v));
              }}
              disabled={!canManage}
            />
          </div>
          <div className="md:col-span-2">
            <label className={formLabelClass}>URL slug</label>
            <input
              className={formInputClass}
              value={editSlug}
              onChange={(e) => setEditSlug(generateSlug(e.target.value))}
              disabled={!canManage}
            />
          </div>
          <div>
            <label className={formLabelClass}>Price (₹) *</label>
            <input
              className={formInputClass}
              type="number"
              step="0.01"
              min={0}
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
            />
          </div>
          <div>
            <label className={formLabelClass}>BV *</label>
            <input
              className={formInputClass}
              type="number"
              min={0}
              value={editBusinessVolume}
              onChange={(e) => setEditBusinessVolume(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={!canManage}
            />
          </div>
          <div className="md:col-span-2">
            <label className={formLabelClass}>Image URL</label>
            <input
              className={formInputClass}
              value={editImage}
              onChange={(e) => setEditImage(e.target.value)}
              placeholder="https://..."
              disabled={!canManage}
            />
          </div>
          <div className="md:col-span-2">
            <label className={formLabelClass}>Short description</label>
            <textarea
              className={formInputClass}
              value={editShortDescription}
              onChange={(e) => setEditShortDescription(e.target.value)}
              maxLength={200}
              rows={3}
              disabled={!canManage}
            />
            <p className="mt-1 text-xs text-slate-500">{editShortDescription.length}/200</p>
          </div>
          <div>
            <label className={formLabelClass}>Category</label>
            <select
              className={formInputClass}
              value={editCategoryId}
              onChange={(e) => setEditCategoryId(e.target.value)}
              disabled={!canManage}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={formLabelClass}>Status</label>
            <select
              className={formInputClass}
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
              disabled={!canManage}
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              checked={editIsFeatured}
              onChange={(e) => setEditIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={!canManage}
            />
            <span className="text-sm font-medium text-slate-700">Featured on marketplace</span>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteOpen}
        title="Delete service"
        subtitle="This action cannot be undone."
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
        title="Reject submission"
        subtitle="Provide a reason so the seller can address it."
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
            <label className={formLabelClass}>
              Rejection reason *
            </label>
            <textarea
              className={formInputClass}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Invalid documents, Wrong category, Pricing mismatch"
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
