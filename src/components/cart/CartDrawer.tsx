"use client";

import { useMemo } from "react";
import { useCartStore } from "@/store";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatUZS, cn } from "@/lib/format";

const storeColors: Record<string, string> = {
  asaxiy: "from-blue-500/30 to-blue-600/10 border-blue-400/30",
  olcha: "from-orange-500/30 to-orange-600/10 border-orange-400/30",
};

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);

  const grouped = useMemo(() => {
    const out: Record<string, typeof items> = {};
    for (const item of items) {
      if (!out[item.storeSlug]) out[item.storeSlug] = [];
      out[item.storeSlug].push(item);
    }
    return out;
  }, [items]);

  const total = items.reduce((sum, i) => sum + i.priceUZS * i.quantity, 0);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-96 bg-zinc-900/95 backdrop-blur-xl z-50 transition-transform duration-300 shadow-2xl border-l border-white/10 flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white text-lg font-bold">Your Cart</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1"
            aria-label="Close cart"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center text-white/50 py-12">
              <div className="text-5xl mb-3">🛒</div>
              <p>Your cart is empty</p>
              <p className="text-sm mt-1">Browse the catalog to add furniture</p>
            </div>
          ) : (
            Object.entries(grouped).map(([storeSlug, storeItems]) => (
              <GlassPanel
                key={storeSlug}
                variant="dark"
                blur="md"
                rounded="xl"
                className={cn(
                  "p-3 bg-gradient-to-br",
                  storeColors[storeSlug] || "from-zinc-700/30 to-zinc-800/10"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold capitalize">{storeItems[0].storeName}</h3>
                  <span className="text-white/50 text-xs">{storeItems.length} items</span>
                </div>

                <div className="space-y-2">
                  {storeItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 bg-black/30 rounded-lg">
                      <div className="w-12 h-12 rounded-lg bg-zinc-800 flex-shrink-0 flex items-center justify-center text-[10px] text-zinc-500">
                        3D
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{item.productName}</p>
                        <p className="text-emerald-400 text-xs font-semibold">
                          {formatUZS(item.priceUZS)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
                        >
                          −
                        </button>
                        <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        aria-label="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-white/60 text-sm">Total</span>
              <span className="text-emerald-400 text-xl font-bold">{formatUZS(total)}</span>
            </div>
            <a
              href="/checkout"
              onClick={onClose}
              className="block w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-center py-3 rounded-xl transition-all"
            >
              Checkout
            </a>
            <button
              onClick={clearCart}
              className="w-full text-white/50 hover:text-white/80 text-sm py-1"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
