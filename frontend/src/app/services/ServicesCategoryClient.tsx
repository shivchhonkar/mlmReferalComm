"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingCart, Star, Heart, Plus, Minus, TrendingUp, Search } from "lucide-react";
import { formatINR } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem, removeItem, updateQty } from "@/store/slices/cartSlice";
import { setServices, type Service } from "@/store/slices/serviceSlice";
import { setCategories, type Category } from "@/store/slices/categorySlice";

export default function ServicesCategoryClient({ 
  services, 
  categories 
}: { 
  services: Service[]; 
  categories: Category[];
}) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"featured" | "price-low" | "price-high" | "rating">("featured");
  const [filteredServices, setFilteredServices] = useState<Service[]>(services);

  useEffect(() => {
    dispatch(setServices(services));
    dispatch(setCategories(categories));
  }, [dispatch, services, categories]);

  // Filter and sort services
  useEffect(() => {
    let result = services;

    // Filter by search term
    if (searchTerm.trim()) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.shortDescription?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((s) => s.categoryId === selectedCategory);
    }

    // Sort
    switch (sortBy) {
      case "price-low":
        result = [...result].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        result = [...result].sort((a, b) => b.price - a.price);
        break;
      case "rating":
        result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "featured":
      default:
        result = [...result].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    }

    setFilteredServices(result);
  }, [services, searchTerm, selectedCategory, sortBy]);

  const isInCart = (serviceId: string) => {
    return serviceId in cart.items;
  };

  const getQuantity = (serviceId: string) => {
    return cart.items[serviceId]?.quantity || 0;
  };

  const toggleWishlist = (serviceId: string) => {
    const newWishlist = new Set(wishlist);
    if (newWishlist.has(serviceId)) {
      newWishlist.delete(serviceId);
    } else {
      newWishlist.add(serviceId);
    }
    setWishlist(newWishlist);
  };

  const activeCategory = categories.find((c) => c._id === selectedCategory);
  const servicesByCategory = selectedCategory
    ? activeCategory ? [{ category: activeCategory, services: filteredServices }] : []
    : [
        // Add uncategorized services first
        {
          category: { _id: "uncategorized", name: "Other Services", code: "OTHER" },
          services: filteredServices.filter((s) => !s.categoryId),
        },
        // Then add services by category
        ...categories.map((category) => ({
          category,
          services: filteredServices.filter((s) => s.categoryId === category._id),
        })),
      ];

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
            <Package className="w-5 h-5" />
            <span className="text-sm font-semibold">Premium Services</span>
          </div>

          <h1 className="text-4xl font-bold">Our Services</h1>

          <p className="text-lg text-blue-100 max-w-3xl">
            Choose from our premium services to generate Business Volume (BV) and accelerate your income growth
          </p>

          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4" />
              <span>Quality Assured</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Instant BV</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-8 border border-gray-200 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-400 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
              <div className="relative">
                <Search className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 pointer-events-none transition-colors" />
                <input
                  type="text"
                  placeholder="Search services by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-4 pr-24 py-3 bg-white border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-gray-900 placeholder-gray-500 text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sort */}
          <div>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white text-gray-900 font-medium appearance-none cursor-pointer transition-all duration-200 hover:border-gray-300"
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-3 pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
              selectedCategory === null
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
            }`}
          >
            All Categories
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold">
              {services.length}
            </span>
          </button>
          {categories.map((cat) => {
            const count = services.filter((s) => s.categoryId === cat._id).length;
            return (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat._id)}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 whitespace-nowrap ${
                  selectedCategory === cat._id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                }`}
              >
                {cat.name}
                <span className={`ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                  selectedCategory === cat._id
                    ? "bg-white/30 text-white"
                    : "bg-gray-300 text-gray-700"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results Info */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm font-semibold text-gray-700">
            <span className="text-blue-600 font-bold text-lg">{filteredServices.length}</span>
            <span className="text-gray-600"> of </span>
            <span className="text-blue-600 font-bold text-lg">{services.length}</span>
            <span className="text-gray-600"> services found</span>
          </div>
          {searchTerm && (
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
              Search: "{searchTerm}"
            </span>
          )}
        </div>
      </div>

      {/* Services by Category */}
      <div className="space-y-12">
        {servicesByCategory.map(({ category, services: categoryServices }) => {
          if (categoryServices.length === 0 && !selectedCategory) return null;

          return (
            <div key={category?._id} className="space-y-6">
              {/* Category Header */}
              {!selectedCategory && (
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{category?.name}</h2>
                    <p className="text-gray-600 mt-1">{category?.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{categoryServices.length}</div>
                    <p className="text-gray-600 text-sm">Services</p>
                  </div>
                </div>
              )}

              {/* Selected Category Header */}
              {selectedCategory && category && (
                <div className="flex items-center justify-between bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
                    <p className="text-gray-600 text-sm mt-1">{category.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{categoryServices.length}</div>
                    <p className="text-gray-600 text-sm">Services</p>
                  </div>
                </div>
              )}

              {/* Services Grid */}
              {categoryServices.length > 0 ? (
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {categoryServices.map((s) => {
                    const inCart = isInCart(s._id);
                    const quantity = getQuantity(s._id);
                    const isWishlisted = wishlist.has(s._id);
                    const hasDiscount = s.originalPrice && s.originalPrice > s.price;
                    const discountPercent = hasDiscount
                      ? Math.round(((s.originalPrice! - s.price) / s.originalPrice!) * 100)
                      : 0;

                    return (
                      <div
                        key={s._id}
                        className="group bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                      >
                        {/* Image Container */}
                        <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 p-6 aspect-square flex items-center justify-center overflow-hidden">
                          {/* Badge */}
                          <div className="absolute top-4 left-4 z-10">
                            {s.isFeatured && (
                              <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                                Featured
                              </div>
                            )}
                          </div>

                          {/* Discount Badge */}
                          {hasDiscount && (
                            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                              {discountPercent}% OFF
                            </div>
                          )}

                          {/* Wishlist Button */}
                          <button
                            onClick={() => toggleWishlist(s._id)}
                            className="absolute bottom-4 right-4 p-2 rounded-full bg-white shadow-lg hover:scale-110 transition-transform duration-200 z-10"
                            aria-label="Toggle wishlist"
                          >
                            <Heart
                              className={`w-5 h-5 transition-colors duration-200 ${
                                isWishlisted ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-red-500"
                              }`}
                            />
                          </button>

                          {/* Service Icon */}
                          <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Package className="w-12 h-12" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                          {/* Title and Category */}
                          <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {s.name}
                            </h3>
                            {s.shortDescription && (
                              <p className="text-sm text-gray-600 line-clamp-2">{s.shortDescription}</p>
                            )}
                          </div>

                          {/* Rating and BV */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {s.rating && s.rating > 0 ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-4 h-4 ${
                                          i < Math.floor(s.rating || 0)
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-gray-300"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <span className="text-xs font-semibold text-gray-700">
                                    {s.rating.toFixed(1)}
                                  </span>
                                  {s.reviewCount && s.reviewCount > 0 && (
                                    <span className="text-xs text-gray-500">({s.reviewCount})</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-xs text-gray-500">No ratings yet</span>
                              )}
                            </div>
                            <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
                              {s.businessVolume} BV
                            </div>
                          </div>

                          {/* Price */}
                          <div className="space-y-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-gray-900">{formatINR(s.price)}</span>
                              {hasDiscount && s.originalPrice && (
                                <span className="text-lg text-gray-400 line-through">{formatINR(s.originalPrice)}</span>
                              )}
                            </div>
                            {s.currency && s.currency !== "INR" && (
                              <p className="text-xs text-gray-500">Currency: {s.currency}</p>
                            )}
                          </div>

                          {/* Add to Cart / Quantity */}
                          <div className="pt-2 space-y-2">
                            {!inCart ? (
                              <button
                                onClick={() =>
                                  dispatch(
                                    addItem({
                                      id: s._id,
                                      name: s.name,
                                      price: s.price,
                                      businessVolume: s.businessVolume,
                                      quantity: 1,
                                    })
                                  )
                                }
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                              >
                                <ShoppingCart className="w-5 h-5" />
                                Add to Cart
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                <button
                                  onClick={() =>
                                    dispatch(
                                      updateQty({
                                        id: s._id,
                                        quantity: Math.max(0, quantity - 1),
                                      })
                                    )
                                  }
                                  className="flex-1 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>

                                <div className="flex-1 text-center font-bold text-gray-900">{quantity}</div>

                                <button
                                  onClick={() =>
                                    dispatch(
                                      updateQty({
                                        id: s._id,
                                        quantity: quantity + 1,
                                      })
                                    )
                                  }
                                  className="flex-1 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                            {/* Availability */}
                            <div className="text-xs font-semibold text-center">
                              {s.status === "active" ? (
                                <span className="text-green-600">✓ In Stock</span>
                              ) : s.status === "out_of_stock" ? (
                                <span className="text-red-600">Out of Stock</span>
                              ) : (
                                <span className="text-gray-600">Available</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No services found in this category</p>
                </div>
              )}
            </div>
          );
        })}

        {/* No Results */}
        {filteredServices.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-xl">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-200 mb-6">
              <Package className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No Services Found</h3>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              {searchTerm ? "Try adjusting your search terms" : "Check back soon for new services!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
