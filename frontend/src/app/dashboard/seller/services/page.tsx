"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/lib/useAuth";
import {
  AlertCircle,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  Package,
  Check,
  X,
  LayoutDashboard,
  IndianRupee,
  BarChart3,
} from "lucide-react";
import { formatINR } from "@/lib/format";

type Service = {
  _id: string;
  name: string;
  price: number;
  businessVolume: number;
  status: "draft" | "pending" | "pending_approval" | "approved" | "rejected" | "active" | "inactive";
  createdAt: string;
  slug?: string;
  image?: string;
  shortDescription?: string;
  description?: string;
  categoryId?: string | { _id: string; name: string; code: string };
  rejectionReason?: string;
};

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
    pending: { label: "Pending review", className: "bg-amber-50 text-amber-800 border-amber-200" },
    pending_approval: { label: "Pending review", className: "bg-amber-50 text-amber-800 border-amber-200" },
    approved: { label: "Approved", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    active: { label: "Live", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
    inactive: { label: "Inactive", className: "bg-slate-100 text-slate-600 border-slate-200" },
    out_of_stock: { label: "Out of stock", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { label, className } = config[status] ?? { label: status, className: "bg-slate-100 text-slate-600" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>
      {label}
    </span>
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

const formInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
const formLabelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export default function SellerServicesPage() {
  const { user } = useAuth({ requireSeller: true });
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [businessVolume, setBusinessVolume] = useState<number | "">("");
  const [image, setImage] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [createStatus, setCreateStatus] = useState<"draft" | "pending">("draft");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editBusinessVolume, setEditBusinessVolume] = useState<number | "">("");
  const [editImage, setEditImage] = useState("");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "pending">("draft");

  const [categories, setCategories] = useState<{ _id: string; name: string; code?: string }[]>([]);

  const canChangeStatus = (s: Service) => ["draft", "rejected"].includes(s.status);
  const isApprovedOrActive = (s: Service) => ["approved", "active"].includes(s.status);

  async function loadCategories() {
    try {
      const res = await apiFetch("/api/categories");
      const data = await res.json();
      if (res.ok && data?.categories) setCategories(data.categories);
    } catch {
      setCategories([]);
    }
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/seller/services");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load services");
      setServices(json.services ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  const filtered = useMemo(() => {
    let list = services;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => `${s.name ?? ""} ${s.slug ?? ""}`.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((s) => {
        if (statusFilter === "pending") return s.status === "pending" || s.status === "pending_approval";
        return s.status === statusFilter;
      });
    }
    return list;
  }, [services, query, statusFilter]);

  function openCreate() {
    setName("");
    setSlug("");
    setPrice("");
    setBusinessVolume("");
    setImage("");
    setShortDescription("");
    setCategoryId("");
    setCreateStatus("draft");
    setCreateOpen(true);
  }

  async function createService(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/seller/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || generateSlug(name),
          price,
          businessVolume,
          image: image || undefined,
          shortDescription: shortDescription || undefined,
          categoryId: categoryId || undefined,
          status: createStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Create failed");
      setCreateOpen(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function openEdit(service: Service) {
    setEditing(service);
    setEditName(service.name ?? "");
    setEditSlug(service.slug ?? generateSlug(service.name ?? ""));
    setEditPrice(service.price ?? "");
    setEditBusinessVolume(service.businessVolume ?? "");
    setEditImage(service.image ?? "");
    setEditShortDescription(service.shortDescription ?? "");
    setEditCategoryId(typeof service.categoryId === "object" ? service.categoryId?._id ?? "" : service.categoryId ?? "");
    setEditStatus(service.status === "rejected" ? "pending" : (service.status as "draft" | "pending"));
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editName,
        slug: editSlug || generateSlug(editName),
        price: editPrice,
        businessVolume: editBusinessVolume,
        image: editImage || undefined,
        shortDescription: editShortDescription || undefined,
        categoryId: editCategoryId || undefined,
      };
      if (canChangeStatus(editing)) {
        payload.status = editStatus;
      }
      const res = await apiFetch(`/api/seller/services/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const stats = useMemo(() => ({
    total: services.length,
    draft: services.filter((s) => s.status === "draft").length,
    pending: services.filter((s) => s.status === "pending" || s.status === "pending_approval").length,
    live: services.filter((s) => s.status === "approved" || s.status === "active").length,
    rejected: services.filter((s) => s.status === "rejected").length,
  }), [services]);

  const statusTabs = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "pending", label: "Pending" },
    { value: "active", label: "Live" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LayoutDashboard className="h-4 w-4" />
              <span>Seller dashboard</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              My Services
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Create and manage your listings. Only approved services appear on the marketplace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Dashboard
            </Link>
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Draft</div>
            <p className="mt-2 text-2xl font-bold text-slate-600">{stats.draft}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending</div>
            <p className="mt-2 text-2xl font-bold text-amber-800">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Live</div>
            <p className="mt-2 text-2xl font-bold text-emerald-800">{stats.live}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-red-700">Rejected</div>
            <p className="mt-2 text-2xl font-bold text-red-800">{stats.rejected}</p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services..."
              className={cn(formInputClass, "!pl-10")}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  statusFilter === tab.value
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Error</p>
              <p className="mt-0.5 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* List */}
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
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
            <Package className="mx-auto h-14 w-14 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No services yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              {services.length === 0
                ? "Create your first service to start selling."
                : "No services match your filters."}
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add service
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <div
                key={s._id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={s.status} />
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      title="Edit service"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4">
                    <ServiceImage src={s.image} name={s.name} />
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900 line-clamp-2">{s.name}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                    {s.shortDescription || s.description || "No description"}
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-lg font-bold text-slate-900">
                      <IndianRupee className="h-4 w-4" />
                      {formatINR(s.price)}
                    </span>
                    <span className="text-xs text-slate-500">· {s.businessVolume} BV</span>
                  </div>
                  {s.status === "rejected" && s.rejectionReason && (
                    <p className="mt-2 text-xs text-red-600">Rejected: {s.rejectionReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createOpen}
        title="Create service"
        subtitle="Save as draft or submit for admin review. Only approved services go live."
        onClose={() => !busy && setCreateOpen(false)}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              onClick={() => !busy && setCreateOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createService()}
              disabled={busy || !name || price === "" || businessVolume === ""}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {busy ? "Creating…" : createStatus === "draft" ? "Save draft" : "Submit for review"}
            </button>
          </>
        }
      >
        <form onSubmit={createService} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={formLabelClass}>Service name *</label>
            <input
              className={formInputClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(generateSlug(e.target.value));
              }}
              placeholder="e.g. GST Filing Service"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={formLabelClass}>URL slug</label>
            <input
              className={formInputClass}
              value={slug}
              onChange={(e) => setSlug(generateSlug(e.target.value))}
              placeholder="Auto-generated from name"
            />
          </div>
          <div>
            <label className={formLabelClass}>Price (₹) *</label>
            <input
              className={formInputClass}
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className={formLabelClass}>Business volume (BV) *</label>
            <input
              className={formInputClass}
              type="number"
              min={0}
              value={businessVolume}
              onChange={(e) => setBusinessVolume(e.target.value === "" ? "" : Number(e.target.value))}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className={formLabelClass}>Image URL</label>
            <input
              className={formInputClass}
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className={formLabelClass}>Short description</label>
            <textarea
              className={formInputClass}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief summary (max 200 characters)"
              maxLength={200}
              rows={3}
            />
          </div>
          <div>
            <label className={formLabelClass}>Category</label>
            <select
              className={formInputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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
            <label className={formLabelClass}>Save as</label>
            <select
              className={formInputClass}
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value as "draft" | "pending")}
            >
              <option value="draft">Draft</option>
              <option value="pending">Submit for review</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        title="Edit service"
        subtitle={
          editing
            ? isApprovedOrActive(editing)
              ? "Updates apply to your live listing. Status cannot be changed."
              : "Update and save as draft or resubmit for review."
            : undefined
        }
        onClose={() => !busy && (setEditOpen(false), setEditing(null))}
        busy={busy}
        footer={
          <>
            <button
              type="button"
              onClick={() => !busy && (setEditOpen(false), setEditing(null))}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={busy || !editName || editPrice === "" || editBusinessVolume === ""}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {busy ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={formLabelClass}>Service name *</label>
              <input
                className={formInputClass}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={formLabelClass}>URL slug</label>
              <input
                className={formInputClass}
                value={editSlug}
                onChange={(e) => setEditSlug(generateSlug(e.target.value))}
              />
            </div>
            <div>
              <label className={formLabelClass}>Price (₹) *</label>
              <input
                className={formInputClass}
                type="number"
                min={0}
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className={formLabelClass}>Business volume (BV) *</label>
              <input
                className={formInputClass}
                type="number"
                min={0}
                value={editBusinessVolume}
                onChange={(e) => setEditBusinessVolume(e.target.value === "" ? "" : Number(e.target.value))}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={formLabelClass}>Image URL</label>
              <input
                className={formInputClass}
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={formLabelClass}>Short description</label>
              <textarea
                className={formInputClass}
                value={editShortDescription}
                onChange={(e) => setEditShortDescription(e.target.value)}
                maxLength={200}
                rows={3}
              />
            </div>
            <div>
              <label className={formLabelClass}>Category</label>
              <select
                className={formInputClass}
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {canChangeStatus(editing) ? (
              <div>
                <label className={formLabelClass}>Status after save</label>
                <select
                  className={formInputClass}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "draft" | "pending")}
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Submit for review</option>
                </select>
              </div>
            ) : (
              <div>
                <label className={formLabelClass}>Status</label>
                <div className="flex items-center gap-2 pt-2">
                  <StatusBadge status={editing.status} />
                  <span className="text-xs text-slate-500">(Live listing — cannot change)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
