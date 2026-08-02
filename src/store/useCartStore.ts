import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartEntry } from "@/types";

interface CartStoreState {
  items: CartEntry[];

  addItem: (entry: Omit<CartEntry, "id" | "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;

  getTotal: () => number;
  getItemsByStore: () => Record<string, CartEntry[]>;
}

let nextCartId = 0;

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (entry) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === entry.productId
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === entry.productId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...entry, id: `cart_${Date.now()}_${nextCartId++}`, quantity: 1 },
            ],
          };
        }),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        })),

      clearCart: () => set({ items: [] }),

      getTotal: () => get().items.reduce((sum, i) => sum + i.priceUZS * i.quantity, 0),

      getItemsByStore: () => {
        const grouped: Record<string, CartEntry[]> = {};
        for (const item of get().items) {
          if (!grouped[item.storeSlug]) grouped[item.storeSlug] = [];
          grouped[item.storeSlug].push(item);
        }
        return grouped;
      },
    }),
    {
      name: "roomai-cart",
    }
  )
);
