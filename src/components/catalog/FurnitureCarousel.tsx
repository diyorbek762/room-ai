"use client";

import { useRef, useState, useEffect } from "react";
import { ProductCard, type ProductCardData } from "./ProductCard";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/format";

export interface FurnitureCarouselProps {
  products: ProductCardData[];
  categories: { slug: string; name: string }[];
  selectedCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  onPlaceInAR: (product: ProductCardData) => void;
  onAddToCart: (product: ProductCardData) => void;
  onOpenCart?: () => void;
  cartCount: number;
  loading?: boolean;
}

export function FurnitureCarousel({
  products,
  categories,
  selectedCategory,
  onSelectCategory,
  onPlaceInAR,
  onAddToCart,
  onOpenCart,
  cartCount,
  loading = false,
}: FurnitureCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    setScrollProgress(
      el.scrollWidth > el.clientWidth
        ? el.scrollLeft / (el.scrollWidth - el.clientWidth)
        : 0
    );
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [products]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1 min-w-0">
          <CategoryPill
            label="All"
            active={selectedCategory === null}
            onClick={() => onSelectCategory(null)}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat.slug}
              label={cat.name}
              active={selectedCategory === cat.slug}
              onClick={() => onSelectCategory(cat.slug)}
            />
          ))}
        </div>

        {onOpenCart && (
          <button
            onClick={onOpenCart}
            className="relative bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white p-2.5 rounded-xl transition-all flex-shrink-0"
            aria-label="Open cart"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollBy("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center"
            aria-label="Scroll left"
          >
            ‹
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollBy("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center"
            aria-label="Scroll right"
          >
            ›
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="snap-start">
                <ProductCardSkeleton />
              </div>
            ))
          ) : products.length === 0 ? (
            <div className="w-full text-center text-white/50 py-12">
              No products found in this category
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="snap-start">
                <ProductCard
                  product={product}
                  onAddToCart={onAddToCart}
                  onPlaceInAR={onPlaceInAR}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {!loading && products.length > 4 && (
        <div className="h-1 mt-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all"
            style={{ width: "30%", transform: `translateX(${scrollProgress * 233}%)` }}
          />
        </div>
      )}
    </div>
  );
}

function CategoryPill({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all",
        active
          ? "bg-emerald-500 text-white"
          : "bg-white/10 text-white/70 hover:bg-white/20"
      )}
    >
      {label}
    </button>
  );
}
