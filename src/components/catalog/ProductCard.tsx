"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatUZS, cn } from "@/lib/format";
import { useCartStore } from "@/store";

export interface ProductCardData {
  id: string;
  name: string;
  nameUz?: string | null;
  priceUZS: number;
  storeSlug: string;
  storeName: string;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  categorySlug: string;
  dimensions: { w: number; h: number; d: number };
  isPlaceholder: boolean;
}

const storeColors: Record<string, string> = {
  asaxiy: "bg-blue-500/90",
  olcha: "bg-orange-500/90",
};

export function ProductCard({ product, onAddToCart, onPlaceInAR, loading }: {
  product: ProductCardData;
  onAddToCart?: (p: ProductCardData) => void;
  onPlaceInAR?: (p: ProductCardData) => void;
  loading?: boolean;
}) {
  const addItem = useCartStore((s) => s.addItem);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product.id,
      productName: product.nameUz || product.name,
      storeSlug: product.storeSlug,
      storeName: product.storeName,
      priceUZS: product.priceUZS,
      thumbnailUrl: product.thumbnailUrl,
    });
    onAddToCart?.(product);
  };

  const handlePlaceInAR = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlaceInAR?.(product);
  };

  if (loading) {
    return (
      <div className="flex-shrink-0 w-56 sm:w-64 p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg">
        <Skeleton variant="rect" className="w-full aspect-square mb-2 rounded-xl" />
        <div className="px-1 space-y-2">
          <Skeleton variant="text" className="w-full" />
          <Skeleton variant="text" className="w-3/4" />
          <Skeleton variant="text" className="w-1/2 h-3" />
          <Skeleton variant="text" className="w-20 h-5" />
          <div className="flex gap-2">
            <Skeleton variant="rect" className="flex-1 h-9 rounded-lg" />
            <Skeleton variant="rect" className="w-10 h-9 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <GlassPanel
      variant="dark"
      rounded="2xl"
      className="flex-shrink-0 w-56 sm:w-64 p-3 select-none"
    >
      <div className="relative w-full aspect-square mb-2 rounded-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
        {product.thumbnailUrl ? (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
            3D Preview
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
            No Image
          </div>
        )}

        <div
          className={cn(
            "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider",
            storeColors[product.storeSlug] || "bg-zinc-500"
          )}
        >
          {product.storeName}
        </div>

        {product.isPlaceholder && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-purple-500/90 uppercase tracking-wider">
            Demo
          </div>
        )}
      </div>

      <div className="px-1">
        <h3 className="text-white text-sm font-semibold leading-tight line-clamp-2 mb-1">
          {product.nameUz || product.name}
        </h3>

        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2">
          {product.dimensions.w.toFixed(2)}×{product.dimensions.h.toFixed(2)}×{product.dimensions.d.toFixed(2)} m
        </p>

        <div className="flex items-baseline justify-between mb-3">
          <span className="text-emerald-400 font-bold text-sm">
            {formatUZS(product.priceUZS)}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePlaceInAR}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-semibold py-2 px-2 rounded-lg transition-all"
          >
            Place in AR
          </button>
          <button
            onClick={handleAddToCart}
            className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2 rounded-lg transition-all"
            aria-label="Add to cart"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </GlassPanel>
  );
}
