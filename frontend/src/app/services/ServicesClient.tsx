"use client";

import { useEffect, useState } from "react";
import { Package, ShoppingCart, Star, Heart, Plus, Minus, TrendingUp } from "lucide-react";

import { formatINR } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem, removeItem, updateQty } from "@/store/slices/cartSlice";
import { setServices, type Service } from "@/store/slices/serviceSlice";

export default function ServicesClient({ services }: { services: Service[] }) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    dispatch(setServices(services));
  }, [dispatch, services]);

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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
          <Package className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">Premium Services</span>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900">
          Our Services
        </h1>
        
        <p className="text-lg text-gray-700 max-w-3xl mx-auto">
          Choose from our premium services to generate Business Volume (BV) and accelerate your income growth
        </p>

        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-gray-800">
            <Star className="w-4 h-4 text-blue-500" />
            <span>Quality Assured</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span>Instant BV</span>
          </div>
        </div>
      </div>

      {/* Services Grid - Ecommerce Style */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {services.map((s, idx) => {
          const inCart = isInCart(s._id);
          const quantity = getQuantity(s._id);
          const isWishlisted = wishlist.has(s._id);

          return (
            <div
              key={s._id}
              className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Wishlist Heart Icon */}
              <button
                onClick={() => toggleWishlist(s._id)}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-md hover:scale-110 transition-transform duration-200"
                aria-label="Toggle wishlist"
              >
                <Heart 
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isWishlisted 
                      ? 'fill-red-500 text-red-500' 
                      : 'text-zinc-600 hover:text-red-500'
                  }`}
                />
              </button>

              {/* Service Image */}
              <div className="aspect-square bg-gray-100 p-8 flex items-center justify-center">
                <div className="w-20 h-20 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Package className="w-10 h-10" />
                </div>
              </div>

              {/* Service Content */}
              <div className="p-6 space-y-4">
                {/* Service Title */}
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-zinc-900 uppercase tracking-wide">
                    {s.name}
                  </h3>
                  
                  {/* BV Badge */}
                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                    {s.businessVolume} BV
                  </div>
                </div>

                {/* Price */}
                <div className="text-2xl font-bold text-zinc-900">
                  {formatINR(s.price)}
                </div>

                {/* Add to Cart / Quantity Controls */}
                <div className="flex items-center justify-between gap-3">
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
                      className="flex-1 bg-linear-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <button
                        onClick={() =>
                          dispatch(
                            updateQty({
                              id: s._id,
                              quantity: Math.max(0, quantity - 1),
                            })
                          )
                        }
                        className="w-10 h-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      <div className="flex-1 text-center font-bold text-zinc-900">
                        {quantity}
                      </div>
                      
                      <button
                        onClick={() =>
                          dispatch(
                            updateQty({
                              id: s._id,
                              quantity: quantity + 1,
                            })
                          )
                        }
                        className="w-10 h-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="text-xs text-zinc-700 text-center">
                  {s.status === 'active' ? (
                    <span className="text-green-600">✓ Available</span>
                  ) : s.status ? (
                    <span>{s.status}</span>
                  ) : (
                    <span>Available</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {services.length === 0 && (
          <div className="col-span-full text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-zinc-100 mb-6">
              <Package className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-2xl font-bold text-zinc-900 mb-3">
              No Services Available
            </h3>
            <p className="text-lg text-zinc-600 max-w-md mx-auto">
              We're currently updating our service catalog. Please check back soon for exciting new offerings!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
