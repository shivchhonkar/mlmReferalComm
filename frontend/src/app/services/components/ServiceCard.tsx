"use client";

import { useState } from "react";
import { Package, ShoppingCart, Heart, Plus, Minus } from "lucide-react";

import { formatINR } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addItem, removeItem, updateQty } from "@/store/slices/cartSlice";
import type { Service } from "@/store/slices/serviceSlice";

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const isInCart = service._id in cart.items;
  const quantity = cart.items[service._id]?.quantity || 0;

  const toggleWishlist = () => {
    setIsWishlisted(!isWishlisted);
  };

  const handleAddToCart = () => {
    dispatch(
      addItem({
        id: service._id,
        name: service.name,
        price: service.price,
        businessVolume: service.businessVolume,
        quantity: 1,
      })
    );
  };

  const handleIncreaseQty = () => {
    dispatch(
      updateQty({
        id: service._id,
        quantity: quantity + 1,
      })
    );
  };

  const handleDecreaseQty = () => {
    if (quantity <= 1) {
      dispatch(removeItem({ id: service._id }));
    } else {
      dispatch(
        updateQty({
          id: service._id,
          quantity: quantity - 1,
        })
      );
    }
  };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Wishlist Heart Icon */}
      <button
        onClick={toggleWishlist}
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
            {service.name}
          </h3>
          
          {/* BV Badge */}
          <div className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            {service.businessVolume} BV
          </div>
        </div>

        {/* Price */}
        <div className="text-2xl font-bold text-zinc-900">
          {formatINR(service.price)}
        </div>

        {/* Add to Cart / Quantity Controls */}
        <div className="flex items-center justify-between gap-3">
          {isInCart ? (
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={handleDecreaseQty}
                className="w-10 h-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              
              <div className="flex-1 text-center font-bold text-zinc-900">
                {quantity}
              </div>
              
              <button
                onClick={handleIncreaseQty}
                className="w-10 h-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-linear-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-xs text-zinc-700 text-center">
          {service.status === 'active' ? (
            <span className="text-green-600">✓ Available</span>
          ) : service.status ? (
            <span>{service.status}</span>
          ) : (
            <span>Available</span>
          )}
        </div>
      </div>
    </div>
  );
}
