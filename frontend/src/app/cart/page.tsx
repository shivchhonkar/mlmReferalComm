"use client";

import Link from "next/link";
import { Package, ShoppingCart } from "lucide-react";

import { formatINR } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearCart, removeItem, updateQty } from "@/store/slices/cartSlice";

export default function CartPage() {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.cart);
  const items = Object.values(cart.items);

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-50 via-white to-zinc-100 px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-linear-to-r from-blue-50 to-gray-50 border border-blue-200 mb-4">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Shopping Cart</span>
            </div>
            <h1 className="text-4xl font-bold text-zinc-900">
              Your Cart ({cart.totalQuantity} {cart.totalQuantity === 1 ? 'item' : 'items'})
            </h1>
            <p className="mt-2 text-lg text-zinc-600">
              Review your selected services before checkout
            </p>
          </div>
          <Link 
            prefetch={false}
            className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 font-medium transition-colors" 
            href="/services"
          >
            Continue Shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-zinc-100 mb-8">
              <ShoppingCart className="w-12 h-12 text-zinc-600" />
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 mb-4">
              Your Cart is Empty
            </h3>
            <p className="text-lg text-zinc-600 max-w-md mx-auto mb-8">
              Looks like you haven't added any services yet. Browse our premium services to get started!
            </p>
            <Link
              prefetch={false}
              href="/services"
              className="inline-flex items-center gap-3 rounded-2xl bg-linear-to-r from-blue-600 to-blue-700 px-8 py-4 font-bold text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              <Package className="w-5 h-5" />
              Browse Services
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Cart Items */}
            <div className="space-y-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-3xl bg-white border border-zinc-200 p-6 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-zinc-900">
                            {item.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-3">
                            <span className="text-lg font-semibold text-zinc-900">
                              {formatINR(item.price)}
                            </span>
                            {typeof item.businessVolume === "number" && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                                {item.businessVolume} BV
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      className="text-zinc-600 transition-colors p-2"
                      onClick={() => dispatch(removeItem({ id: item.id }))}
                      type="button"
                      aria-label="Remove item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-xl border border-zinc-200 overflow-hidden">
                      <button
                        className="px-4 py-3 text-zinc-700 hover:bg-zinc-50 transition-colors"
                        type="button"
                        onClick={() =>
                          dispatch(
                            updateQty({
                              id: item.id,
                              quantity: Math.max(0, item.quantity - 1),
                            })
                          )
                        }
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <div className="px-6 py-3 bg-zinc-50 min-w-15 text-center">
                        <span className="text-lg font-bold text-zinc-900">{item.quantity}</span>
                      </div>
                      <button
                        className="px-4 py-3 text-zinc-700 hover:bg-zinc-50 transition-colors"
                        type="button"
                        onClick={() =>
                          dispatch(
                            updateQty({
                              id: item.id,
                              quantity: item.quantity + 1,
                            })
                          )
                        }
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-zinc-600 mb-1">Subtotal</div>
                      <div className="text-2xl font-bold text-zinc-900">
                        {formatINR(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="rounded-3xl bg-linear-to-br from-white to-zinc-50 border border-zinc-200 p-8 shadow-lg h-fit lg:sticky lg:top-8">
              <div className="text-xl font-bold text-zinc-900 mb-6">Order Summary</div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between py-3 border-b border-zinc-200">
                  <span className="text-zinc-600">Items</span>
                  <span className="font-semibold text-lg text-zinc-900">{cart.totalQuantity}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-200">
                  <span className="text-zinc-600">Subtotal</span>
                  <span className="font-semibold text-lg text-zinc-900">{formatINR(cart.totalAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  className="w-full rounded-2xl bg-linear-to-r from-green-600 to-emerald-600 px-6 py-4 font-bold text-white hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
                  type="button"
                  onClick={() => {
                    // Placeholder: integrate checkout / payment later
                    alert("Checkout coming soon! We'll notify you when payment processing is live.");
                  }}
                >
                  Proceed to Checkout
                </button>

                <button
                  className="w-full rounded-xl border border-zinc-200 px-6 py-3 font-semibold hover:bg-zinc-50 transition-all duration-300"
                  type="button"
                  onClick={() => dispatch(clearCart())}
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
