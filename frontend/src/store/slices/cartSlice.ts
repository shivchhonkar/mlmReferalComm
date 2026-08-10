import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  businessVolume?: number;
  bvPercentage?: number;
  quantity: number;
  paymentType?: "fixed_upi" | "dynamic_link";
  fixedUpiId?: string;
};

export type CartState = {
  items: Record<string, CartItem>;
  totalQuantity: number;
  totalAmount: number;
};

const initialState: CartState = {
  items: {},
  totalQuantity: 0,
  totalAmount: 0,
};

/** Returns another distinct service already in the cart, if any. */
export function getConflictingCartItem(
  items: Record<string, CartItem>,
  serviceId: string
): CartItem | null {
  for (const item of Object.values(items)) {
    if (item.id !== serviceId) return item;
  }
  return null;
}

export function singleServiceCartMessage(existingServiceName: string): string {
  return `Only one service can be in your cart at a time because payment methods may differ. "${existingServiceName}" is already selected. Remove it first, or increase its quantity.`;
}

function recalc(state: CartState) {
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const item of Object.values(state.items)) {
    totalQuantity += item.quantity;
    totalAmount += item.price * item.quantity;
  }

  state.totalQuantity = totalQuantity;
  state.totalAmount = totalAmount;
}

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    hydrateCart: (_state, action: PayloadAction<CartState>) => {
      return action.payload;
    },
    addItem: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        price: number;
        businessVolume?: number;
        bvPercentage?: number;
        quantity?: number;
        paymentType?: "fixed_upi" | "dynamic_link";
        fixedUpiId?: string;
      }>
    ) => {
      const {
        id,
        name,
        price,
        businessVolume,
        bvPercentage,
        quantity = 1,
        paymentType,
        fixedUpiId,
      } = action.payload;
      const existing = state.items[id];

      if (existing) {
        existing.quantity += quantity;
        if (bvPercentage !== undefined) existing.bvPercentage = bvPercentage;
        if (paymentType) existing.paymentType = paymentType;
      } else {
        // Cart may only hold one distinct service (qty of that service can increase).
        if (getConflictingCartItem(state.items, id)) {
          return;
        }
        state.items[id] = {
          id,
          name,
          price,
          businessVolume,
          bvPercentage,
          quantity,
          paymentType,
          fixedUpiId,
        };
      }

      recalc(state);
    },
    removeItem: (state, action: PayloadAction<{ id: string }>) => {
      delete state.items[action.payload.id];
      recalc(state);
    },
    updateQty: (
      state,
      action: PayloadAction<{ id: string; quantity: number }>
    ) => {
      const { id, quantity } = action.payload;
      const item = state.items[id];
      if (!item) return;

      if (quantity <= 0) {
        delete state.items[id];
      } else {
        item.quantity = quantity;
      }

      recalc(state);
    },
    clearCart: (state) => {
      state.items = {};
      recalc(state);
    },
  },
});

export const { hydrateCart, addItem, removeItem, updateQty, clearCart } =
  cartSlice.actions;

export default cartSlice.reducer;
