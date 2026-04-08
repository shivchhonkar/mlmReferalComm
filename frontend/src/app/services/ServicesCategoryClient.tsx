"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Search,
  Star,
  TrendingUp,
  Filter,
  ChevronDown,
  IndianRupee,
  Calendar,
  X,
  ShoppingCart,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setServices, type Service } from "@/store/slices/serviceSlice";
import { setCategories, type Category } from "@/store/slices/categorySlice";
import ServicesGrid from "@/app/services/components/ServicesGrid";
import { addItem } from "@/store/slices/cartSlice";

type Subcategory = {
  _id: string;
  name: string;
  slug: string;
  code: string;
  categoryId: string | { _id: string; name: string; code: string };
  sortOrder?: number;
  createdAt?: string;
};

function getServiceCategoryId(service: Service): string {
  const raw = (service as any).categoryId;
  if (typeof raw === "object" && raw?._id) return String(raw._id);
  return String(raw ?? "");
}

function getServiceSubcategoryId(service: Service): string {
  const raw = (service as any).subcategoryId;
  if (typeof raw === "object" && raw?._id) return String(raw._id);
  return String(raw ?? "");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export default function ServicesCategoryClient({
  services,
  categories,
  subcategories = [],
}: {
  services: Service[];
  categories: Category[];
  subcategories?: Subcategory[];
}) {
  const dispatch = useAppDispatch();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sortBy, setSortBy] = useState<
    "featured" | "price-low" | "price-high" | "rating" | "date-new" | "date-old"
  >("featured");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    dispatch(setServices(services));
    dispatch(setCategories(categories));
  }, [dispatch, services, categories]);

  const getCategoryId = (sub: Subcategory) =>
    typeof sub.categoryId === "object" ? sub.categoryId?._id : sub.categoryId;

  const subcategoriesForCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return subcategories.filter((s) => getCategoryId(s) === selectedCategory);
  }, [subcategories, selectedCategory]);

  useEffect(() => {
    if (selectedSubcategory) {
      const sub = subcategories.find((s) => s._id === selectedSubcategory);
      if (sub && getCategoryId(sub) !== selectedCategory) setSelectedCategory(getCategoryId(sub) ?? "");
    }
  }, [selectedSubcategory, subcategories, selectedCategory]);

  useEffect(() => {
    if (selectedCategory && !subcategoriesForCategory.some((s) => s._id === selectedSubcategory)) {
      setSelectedSubcategory("");
    }
  }, [selectedCategory, selectedSubcategory, subcategoriesForCategory]);

  const filteredServices = useMemo(() => {
    let result = services;

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s as any).shortDescription?.toLowerCase().includes(q)
      );
    }

    const catId = selectedSubcategory
      ? getCategoryId(subcategories.find((s) => s._id === selectedSubcategory)!) ?? selectedCategory
      : selectedCategory || null;
    if (catId) {
      result = result.filter((s) => getServiceCategoryId(s) === catId);
    }

    if (selectedSubcategory) {
      const selectedSub = subcategories.find((s) => s._id === selectedSubcategory);
      const selectedTokens = new Set(
        [
          selectedSubcategory,
          selectedSub?.name,
          selectedSub?.slug,
          selectedSub?.code,
        ]
          .map((v) => normalizeText(v))
          .filter(Boolean)
      );

      result = result.filter((s) => {
        const raw = (s as any).subcategoryId;
        const serviceTokens = new Set<string>();
        serviceTokens.add(normalizeText(getServiceSubcategoryId(s)));

        if (typeof raw === "string") serviceTokens.add(normalizeText(raw));
        if (typeof raw === "object" && raw) {
          serviceTokens.add(normalizeText((raw as any)._id));
          serviceTokens.add(normalizeText((raw as any).name));
          serviceTokens.add(normalizeText((raw as any).slug));
          serviceTokens.add(normalizeText((raw as any).code));
        }

        for (const token of selectedTokens) {
          if (token && serviceTokens.has(token)) return true;
        }
        return false;
      });
    }

    const min = priceMin !== "" ? parseFloat(priceMin) : null;
    const max = priceMax !== "" ? parseFloat(priceMax) : null;
    if (min !== null && !Number.isNaN(min)) {
      result = result.filter((s) => s.price >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      result = result.filter((s) => s.price <= max);
    }

    switch (sortBy) {
      case "price-low":
        return [...result].sort((a, b) => a.price - b.price);
      case "price-high":
        return [...result].sort((a, b) => b.price - a.price);
      case "rating":
        return [...result].sort(
          (a, b) => ((b as any).rating || 0) - ((a as any).rating || 0)
        );
      case "date-new":
        return [...result].sort((a, b) => {
          const da = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const db = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return db - da;
        });
      case "date-old":
        return [...result].sort((a, b) => {
          const da = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
          const db = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
          return da - db;
        });
      case "featured":
      default:
        return [...result].sort(
          (a, b) =>
            (Boolean((b as any).isFeatured) ? 1 : 0) - (Boolean((a as any).isFeatured) ? 1 : 0)
        );
    }
  }, [
    services,
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    subcategories,
    priceMin,
    priceMax,
    sortBy,
  ]);

  const activeCategory = useMemo(
    () => categories.find((c) => c._id === selectedCategory),
    [categories, selectedCategory]
  );

  const servicesByCategory = useMemo(() => {
    const catId = selectedSubcategory
      ? getCategoryId(subcategories.find((s) => s._id === selectedSubcategory)!) ?? selectedCategory
      : selectedCategory || null;

    if (catId) {
      const cat = categories.find((c) => c._id === catId) ?? {
        _id: catId,
        name: "Services",
        slug: "",
        code: "",
        isActive: true,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      };
      return [{ category: cat, services: filteredServices }];
    }

    const categoryIds = new Set(categories.map((c) => c._id));
    const uncategorized = filteredServices.filter((s) => {
      const cid = getServiceCategoryId(s);
      if (!cid) return true;
      return !categoryIds.has(cid); // Include orphaned (categoryId not in categories)
    });
    const categorized = categories.map((category) => ({
      category,
      services: filteredServices.filter((s) => getServiceCategoryId(s) === category._id),
    }));

    return [
      {
        category: {
          _id: "uncategorized",
          name: "All Services",
          code: "OTHER",
          slug: "other",
          isActive: true,
          sortOrder: 999,
          createdAt: "",
          updatedAt: "",
        } as any,
        services: uncategorized,
      },
      ...categorized,
    ];
  }, [
    selectedCategory,
    selectedSubcategory,
    subcategories,
    categories,
    filteredServices,
  ]);

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (selectedSubcategory ? 1 : 0) +
    (priceMin !== "" ? 1 : 0) +
    (priceMax !== "" ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory("");
    setSelectedSubcategory("");
    setPriceMin("");
    setPriceMax("");
  };

  const totalCount = services.length;
  const totalCategories = categories.length;
  const getCategoryName = (service: Service) => {
    const raw = (service as any).categoryId;
    if (typeof raw === "object" && raw?.name) return String(raw.name);
    const categoryId = getServiceCategoryId(service);
    return categories.find((c) => c._id === categoryId)?.name || String(raw || "—");
  };
  const getSubcategoryName = (service: Service) => {
    const raw = (service as any).subcategoryId;
    if (typeof raw === "object" && raw?.name) return String(raw.name);
    const subId = getServiceSubcategoryId(service);
    const byId = subcategories.find((s) => s._id === subId)?.name;
    if (byId) return byId;
    if (typeof raw === "string") {
      const rawNorm = normalizeText(raw);
      const byOther =
        subcategories.find(
          (s) =>
            normalizeText(s.name) === rawNorm ||
            normalizeText(s.slug) === rawNorm ||
            normalizeText(s.code) === rawNorm
        )?.name || raw;
      return byOther;
    }
    return "—";
  };

  return (
    <div className="space-y-8">
      {/* Hero + Stats */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Services Marketplace
          </h1>
          <p className="mt-2 max-w-2xl text-emerald-50/95 text-sm sm:text-base">
            Browse services to generate <span className="font-semibold text-white">Business Volume (BV)</span> and grow your referral income.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/15 backdrop-blur px-4 py-3">
              <Package className="h-8 w-8 text-white" />
              <div>
                <p className="text-2xl font-bold text-white">{totalCount}</p>
                <p className="text-xs font-medium text-emerald-100">Total services</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/15 backdrop-blur px-4 py-3">
              <TrendingUp className="h-8 w-8 text-white" />
              <div>
                <p className="text-2xl font-bold text-white">{totalCategories}</p>
                <p className="text-xs font-medium text-emerald-100">Categories</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white/15 backdrop-blur px-4 py-3">
              <Star className="h-8 w-8 text-white" />
              <div>
                <p className="text-2xl font-bold text-white">{filteredServices.length}</p>
                <p className="text-xs font-medium text-emerald-100">
                  {activeFilterCount > 0 ? "Matching filters" : "Showing"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter toggle (mobile + desktop) */}
      <button
        type="button"
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <Filter className="h-4 w-4" />
        {showFilters ? "Hide filters" : "Show filters"}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
          aria-hidden
        />
        {activeFilterCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Layout: sidebar + main */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left sidebar - Filters (collapsible on all screen sizes) */}
        <aside
          className={`w-full shrink-0 lg:sticky lg:top-6 lg:w-50 ${showFilters ? "" : "hidden"}`}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5 pt-2.5">
              {/* Search */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Name or description..."
                    className="w-full rounded-lg border border-slate-200 py-1.5 !pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory("");
                  }}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pr-7 pl-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Subcategory</label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  disabled={!selectedCategory || subcategoriesForCategory.length === 0}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pr-7 pl-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">All</option>
                  {subcategoriesForCategory.map((sub) => (
                    <option key={sub._id} value={sub._id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Min */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Min Price (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 py-1.5 !pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Price Max */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Max Price (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    placeholder="Any"
                    className="w-full rounded-lg border border-slate-200 py-1.5 !pl-8 pr-3 text-xs text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="w-full rounded-lg border border-slate-200 py-1.5 pr-7 pl-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low">Price: Low → High</option>
                  <option value="price-high">Price: High → Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="date-new">Newest First</option>
                  <option value="date-old">Oldest First</option>
                </select>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="w-full rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
              {filteredServices.length} of {totalCount} services
            </p>
          </div>
        </aside>

        {/* Main content - Services */}
        <div className="min-w-0 flex-1 space-y-8">
        {servicesByCategory.map(({ category, services: categoryServices }) => {
          if (!selectedCategory && categoryServices.length === 0) return null;

          return (
            <section key={category._id} className="space-y-5">
              {!selectedCategory ? (
                <div className="flex items-end justify-between gap-4">
                  <h2 className="text-lg font-bold text-slate-900">{category.name}</h2>
                  <span className="text-sm text-slate-500">{categoryServices.length} services</span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-900">{category.name}</h2>
                  <span className="text-sm font-medium text-emerald-600">
                    {categoryServices.length} services
                  </span>
                </div>
              )}

              {categoryServices.length > 0 ? (
                <ServicesGrid
                  services={categoryServices.map((s) => ({
                    ...s,
                    categoryName: getCategoryName(s),
                    subcategoryName: getSubcategoryName(s),
                  }))}
                  onSelectService={setSelectedService}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <Package className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">No services found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Try adjusting your filters or search terms.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {filteredServices.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No Services Found</h3>
            <p className="mt-1 mx-auto max-w-md text-sm text-slate-500">
              {searchTerm.trim()
                ? "Try adjusting your search or filters."
                : "Check back soon for new services."}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          </div>
        )}
        </div>
      </div>
      
      {/* Service details modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedService.name}</h2>
                {(selectedService as any).shortDescription && (
                  <p className="mt-1 text-sm text-slate-600">
                    {(selectedService as any).shortDescription}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dispatch(
                      addItem({
                        id: selectedService._id,
                        name: selectedService.name,
                        price: selectedService.price,
                        businessVolume: selectedService.businessVolume,
                        quantity: 1,
                      })
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 hover:cursor-pointer"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Add to cart
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 hover:cursor-pointer"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid flex-1 gap-6 border-b border-slate-100 px-6 py-5 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] overflow-y-auto">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[4/3]">
                    {selectedService.image &&
                    !selectedService.image.includes("default-service") &&
                    !selectedService.image.includes("no-image") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedService.image}
                        alt={selectedService.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                        <Package className="h-10 w-10" />
                        <span className="text-xs font-medium">No image</span>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedService as any).description && (
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {(selectedService as any).description}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Pricing
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex items-center gap-1 text-2xl font-bold text-slate-900">
                      <IndianRupee className="h-4 w-4" />
                      <span>{(selectedService.price ?? 0).toLocaleString("en-IN")}</span>
                    </div>
                    {(selectedService as any).originalPrice && (
                      <div className="text-sm text-slate-400 line-through">
                        <IndianRupee className="mr-1 inline h-3 w-3" />
                        {(selectedService as any).originalPrice.toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Business Volume (BV):{" "}
                    <span className="font-semibold text-emerald-700">
                      {selectedService.businessVolume}
                    </span>
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      {selectedService.status ?? "active"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Category</span>
                    <span className="text-xs font-medium text-slate-800">
                      {
                        (categories.find(
                          (c) => c._id === ((selectedService as any).categoryId as string)
                        )?.name ?? "—")
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 hover:cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
