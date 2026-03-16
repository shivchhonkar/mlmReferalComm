"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/apiClient";
import {
  FolderOpen,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Pencil,
  Power,
  PowerOff,
  X,
} from "lucide-react";
import AdminCategoryUpload from "./AdminCategoryUpload";
import ConfirmDialog from "@/app/_components/ConfirmDialog";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface Category {
  _id: string;
  name: string;
  slug: string;
  code: string;
  icon?: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  code: string;
  categoryId: string | { _id: string; name?: string; code?: string };
  icon?: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  category?: {
    _id: string;
    name: string;
    code: string;
  };
}

export default function CategoriesPage() {
  useAuth({ requireAdmin: true });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showEditSubcategoryModal, setShowEditSubcategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [activeTab, setActiveTab] = useState<"manage" | "bulk">("manage");
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: "default" | "danger";
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    code: "",
    icon: "",
    image: "",
    isActive: true,
    sortOrder: 0,
    categoryId: "",
  });

  const fetchCategories = async () => {
    try {
      setError(null);
      const res = await apiFetch("/api/admin/categories");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCategories([]);
    }
  };

  const fetchSubcategories = async () => {
    try {
      setError(null);
      const res = await apiFetch("/api/admin/subcategories");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to fetch subcategories");
      setSubcategories(Array.isArray(data?.subcategories) ? data.subcategories : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubcategories([]);
    }
  };

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchCategories(), fetchSubcategories()]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCategoryCodeDuplicate = (code: string, ignoreId?: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return false;
    return categories.some((cat) => cat.code?.toUpperCase() === c && cat._id !== ignoreId);
  };

  const isSubcategoryCodeDuplicate = (code: string, ignoreId?: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return false;
    return subcategories.some((sub) => sub.code?.toUpperCase() === c && sub._id !== ignoreId);
  };

  // Listen for updates from bulk upload (cross-tab + same-origin channel)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // localStorage cross-tab
    const onStorage = (e: StorageEvent) => {
      if (e.key === "admin-categories-updated") refreshAll();
    };
    globalThis.addEventListener("storage", onStorage);

    // BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("admin-categories");
      channel.onmessage = (msg) => {
        if (msg?.data?.type === "CATEGORIES_UPDATED") refreshAll();
      };
    } catch {
      channel = null;
    }

    return () => {
      globalThis.removeEventListener("storage", onStorage);
      try {
        channel?.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCategory = async () => {
    const code = formData.code.trim();
    if (code.length > 10) {
      showErrorToast("Category code must be at most 10 characters.");
      return;
    }
    if (isCategoryCodeDuplicate(code)) {
      showErrorToast("Category code must be unique.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create category");
      showSuccessToast("Category created successfully");
      await refreshAll();
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      showErrorToast(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const createSubcategory = async () => {
    const code = formData.code.trim();
    if (code.length > 10) {
      showErrorToast("Subcategory code must be at most 10 characters.");
      return;
    }
    if (isSubcategoryCodeDuplicate(code)) {
      showErrorToast("Subcategory code must be unique.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create subcategory");
      showSuccessToast("Subcategory created successfully");
      await refreshAll();
      setShowSubcategoryModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      showErrorToast(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const updateCategory = async () => {
    if (!editingCategory) return;
    const code = formData.code.trim();
    if (code.length > 10) {
      showErrorToast("Category code must be at most 10 characters.");
      return;
    }
    if (isCategoryCodeDuplicate(code, editingCategory._id)) {
      showErrorToast("Category code must be unique.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/categories/${editingCategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update category");
      showSuccessToast("Category updated successfully");
      await refreshAll();
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      showErrorToast(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const updateSubcategory = async () => {
    if (!editingSubcategory) return;
    const code = formData.code.trim();
    if (code.length > 10) {
      showErrorToast("Subcategory code must be at most 10 characters.");
      return;
    }
    if (isSubcategoryCodeDuplicate(code, editingSubcategory._id)) {
      showErrorToast("Subcategory code must be unique.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/subcategories/${editingSubcategory._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update subcategory");
      showSuccessToast("Subcategory updated successfully");
      await refreshAll();
      setShowEditSubcategoryModal(false);
      setEditingSubcategory(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      showErrorToast(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const toggleCategoryActive = async (category: Category) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/categories/${category._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update category");
      showSuccessToast(category.isActive ? "Category deactivated" : "Category activated");
      await refreshAll();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const toggleSubcategoryActive = async (sub: Subcategory) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/subcategories/${sub._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sub.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update subcategory");
      showSuccessToast(sub.isActive ? "Subcategory deactivated" : "Subcategory activated");
      await refreshAll();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      code: category.code,
      icon: category.icon ?? "",
      image: category.image ?? "",
      isActive: category.isActive,
      sortOrder: category.sortOrder ?? 0,
      categoryId: "",
    });
    setShowEditCategoryModal(true);
  };

  const openEditSubcategory = (sub: Subcategory) => {
    setEditingSubcategory(sub);
    const catId = typeof sub.categoryId === "object" && sub.categoryId && "_id" in sub.categoryId
      ? String((sub.categoryId as { _id?: unknown })._id ?? "")
      : String(sub.categoryId ?? "");
    setFormData({
      name: sub.name,
      slug: sub.slug,
      code: sub.code,
      icon: sub.icon ?? "",
      image: sub.image ?? "",
      isActive: sub.isActive,
      sortOrder: sub.sortOrder ?? 0,
      categoryId: catId,
    });
    setShowEditSubcategoryModal(true);
  };

  const deleteCategory = async (categoryId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/categories/${categoryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete category");
      showSuccessToast("Category deleted successfully");
      await refreshAll();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const deleteSubcategory = async (subcategoryId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/subcategories/${subcategoryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete subcategory");
      showSuccessToast("Subcategory deleted successfully");
      await refreshAll();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setBusy(false);
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const next = new Set(expandedCategories);
    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);
    setExpandedCategories(next);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      code: "",
      icon: "",
      image: "",
      isActive: true,
      sortOrder: 0,
      categoryId: "",
    });
    setSelectedCategory(null);
  };

  const openSubcategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setFormData((prev) => ({
      ...prev,
      categoryId: category._id,
    }));
    setShowSubcategoryModal(true);
  };

  const handleSubcategoryCategoryChange = (categoryId: string) => {
    const cat = categories.find((c) => c._id === categoryId) ?? null;
    setSelectedCategory(cat);
    setFormData((prev) => ({
      ...prev,
      categoryId,
    }));
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const generateCode = (name: string) =>
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "") // keep only letters/numbers
      .slice(0, 10); // enforce max length 10

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: generateSlug(name),
      code: generateCode(name),
    }));
  };

  const filteredCategories = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (category) =>
        category.name.toLowerCase().includes(q) || category.code.toLowerCase().includes(q)
    );
  }, [categories, searchTerm]);

  const getSubcategoriesForCategory = (categoryId: string) => {
    const list = Array.isArray(subcategories) ? subcategories : [];
    return list.filter((sub) => {
      const cat = sub.categoryId as any;
      const subCategoryId =
        cat && typeof cat === "object" && "_id" in cat ? String(cat._id ?? "") : String(cat ?? "");
      return subCategoryId === categoryId;
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-2 flex items-center gap-2">
              <FolderOpen className="h-7 w-7 text-emerald-600" />
              Categories &amp; Subcategories
            </h1>
            <p className="text-sm sm:text-base text-zinc-600">
              Organize services into clear categories and subcategories for a better marketplace experience.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60 hover:cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {activeTab === "manage" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition bg-emerald-600 hover:bg-emerald-700 hover:cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Category
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 p-1 mb-6">
          <button
            onClick={() => setActiveTab("manage")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition hover:cursor-pointer ${
              activeTab === "manage"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Manage Categories
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition hover:cursor-pointer ${
              activeTab === "bulk"
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Bulk Import
          </button>
        </div>

        {/* Search (only manage tab) */}
        {activeTab === "manage" && (
          <div className="relative max-w-md mt-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full !pl-10 pr-4 py-2 rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "manage" ? (
        <div className="space-y-4">
          {filteredCategories.length === 0 ? (
            <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center shadow-sm">
              <FolderOpen className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 mb-2">No categories yet</h3>
              <p className="text-zinc-500 mb-4">Create your first category to start organizing services.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create category
              </button>
            </div>
          ) : (
            filteredCategories.map((category) => {
              const categorySubcategories = getSubcategoriesForCategory(category._id);
              const isExpanded = expandedCategories.has(category._id);

              return (
                <div key={category._id} className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm">
                  {/* Category Header */}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => toggleCategoryExpansion(category._id)}
                          className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-zinc-500" />
                          )}
                        </button>

                        <div className="flex items-center space-x-3">
                          {category.image ? (
                            <img
                              src={category.image}
                              alt={category.name}
                              className="w-10 h-10 rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280' font-family='sans-serif' font-size='10'%3ENo%3C/text%3E%3C/svg%3E";
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                              <FolderOpen className="w-5 h-5 text-emerald-500" />
                            </div>
                          )}

                          <div>
                            <h3 className="text-lg font-semibold text-zinc-900">{category.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                              <span>Code: {category.code}</span>
                              <span>Slug: {category.slug}</span>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  category.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}
                              >
                                {category.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditCategory(category)}
                          disabled={busy}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Category"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleCategoryActive(category)}
                          disabled={busy}
                          className={`p-2 rounded-lg transition-colors ${
                            category.isActive
                              ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              : "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                          }`}
                          title={category.isActive ? "Deactivate" : "Activate"}
                        >
                          {category.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openSubcategoryModal(category)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 hover:cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Add subcategory
                        </button>
                        <button
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: "Delete category?",
                              description:
                                "This will delete the category and all of its subcategories. This action cannot be undone.",
                              variant: "danger",
                              confirmLabel: "Delete category",
                              onConfirm: () => deleteCategory(category._id),
                            })
                          }
                          disabled={busy}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500">
                      <span>{categorySubcategories.length} subcategories</span>
                      <span>Sort order: {category.sortOrder}</span>
                      <span>Created: {new Date(category.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Subcategories */}
                  {isExpanded && categorySubcategories.length > 0 && (
                    <div className="border-t border-zinc-200 bg-zinc-50">
                      <div className="p-4">
                        <h4 className="text-sm font-medium text-zinc-800 mb-3">Subcategories</h4>
                        <div className="space-y-2">
                          {categorySubcategories.map((subcategory) => (
                            <div key={subcategory._id} className="bg-white p-3 rounded-2xl border border-zinc-200">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-3">
                                  {subcategory.image ? (
                                    <img
                                      src={subcategory.image}
                                      alt={subcategory.name}
                                      className="w-8 h-8 rounded object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src =
                                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%236b7280' font-family='sans-serif' font-size='9'%3ENo%3C/text%3E%3C/svg%3E";
                                      }}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
                                      <FolderOpen className="w-4 h-4 text-emerald-500" />
                                    </div>
                                  )}

                                  <div>
                                    <p className="font-medium text-zinc-900">{subcategory.name}</p>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                                      <span>Code: {subcategory.code}</span>
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                          subcategory.isActive
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {subcategory.isActive ? "Active" : "Inactive"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditSubcategory(subcategory)}
                                    disabled={busy}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                    title="Edit Subcategory"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => toggleSubcategoryActive(subcategory)}
                                    disabled={busy}
                                    className={`p-1.5 rounded transition-colors ${
                                      subcategory.isActive
                                        ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                        : "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                    }`}
                                    title={subcategory.isActive ? "Deactivate" : "Activate"}
                                  >
                                    {subcategory.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmState({
                                        open: true,
                                        title: "Delete subcategory?",
                                        description:
                                          "This will permanently delete the subcategory. Existing services will need to be reassigned.",
                                        variant: "danger",
                                        confirmLabel: "Delete subcategory",
                                        onConfirm: () => deleteSubcategory(subcategory._id),
                                      })
                                    }
                                    disabled={busy}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                                    title="Delete Subcategory"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <AdminCategoryUpload onUploaded={refreshAll} />
      )}

      {/* Create Category Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Create category</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Define a top-level bucket for grouping related services in the marketplace.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                disabled={busy}
                className="p-1.5 rounded-full hover:bg-zinc-100"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. Accounting, Marketing, Legal"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Slug</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="URL-friendly slug"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Short code (auto-filled)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Sort order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="0"
                  />
                </div>

                <div className="flex items-center mt-1 sm:mt-7">
                  <input
                    type="checkbox"
                    id="isActiveCat"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="mr-2 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  <label htmlFor="isActiveCat" className="text-sm text-zinc-700">
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={createCategory}
                disabled={busy || !formData.name.trim()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? "Creating…" : "Create category"}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                disabled={busy}
                className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Edit category</h2>
                <p className="mt-1 text-xs text-zinc-600">
                  Update label, code, and visibility without affecting existing services.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditingCategory(null);
                  resetForm();
                }}
                disabled={busy}
                className="p-1.5 rounded-full hover:bg-zinc-100"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="Category name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Slug</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Sort order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                    }
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-center mt-1 sm:mt-7 gap-2">
                  <input
                    type="checkbox"
                    id="editIsActiveCat"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500/40"
                  />
                  <label htmlFor="editIsActiveCat" className="text-sm text-zinc-700">
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={updateCategory}
                disabled={busy || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setShowEditCategoryModal(false);
                  setEditingCategory(null);
                  resetForm();
                }}
                disabled={busy}
                className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subcategory Modal */}
      {showSubcategoryModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Create subcategory</h2>
                <p className="text-xs text-zinc-600 mt-1">
                  Link a subcategory to a category and we&apos;ll auto-generate the code and slug.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSubcategoryModal(false);
                  resetForm();
                }}
                disabled={busy}
                className="p-1.5 rounded-full hover:bg-zinc-100"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => handleSubcategoryCategoryChange(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Subcategory name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  placeholder="e.g. Digital Marketing, Accounting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  placeholder="URL-friendly slug"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  placeholder="Unique subcategory code"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Sort order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  placeholder="Display order (optional)"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActiveSub"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="mr-2"
                />
                <label htmlFor="isActiveSub" className="text-sm text-zinc-700">
                  Active
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={createSubcategory}
                disabled={busy || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Creating…" : "Create Subcategory"}
              </button>
              <button
                onClick={() => {
                  setShowSubcategoryModal(false);
                  resetForm();
                }}
                disabled={busy}
                className="flex-1 px-4 py-2 bg-zinc-100 text-zinc-800 rounded-lg hover:bg-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subcategory Modal */}
      {showEditSubcategoryModal && editingSubcategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Edit Subcategory</h2>
              <button onClick={() => { setShowEditSubcategoryModal(false); setEditingSubcategory(null); resetForm(); }} disabled={busy} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Subcategory name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort Order</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsActiveSub"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="editIsActiveSub" className="text-sm text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={updateSubcategory}
                disabled={busy || !formData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => { setShowEditSubcategoryModal(false); setEditingSubcategory(null); resetForm(); }}
                disabled={busy}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState?.open}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        onConfirm={() => {
          const fn = confirmState?.onConfirm;
          setConfirmState(null);
          fn?.();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
