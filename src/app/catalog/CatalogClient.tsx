"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FurnitureCarousel } from "@/components/catalog/FurnitureCarousel";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCartStore } from "@/store";
import type { ProductDTO } from "@/lib/products";
import type { ProductCardData } from "@/components/catalog/ProductCard";

export function CatalogClient({
  products,
  categories,
}: {
  products: ProductDTO[];
  categories: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  const filteredProducts: ProductCardData[] = products
    .filter((p) => !selectedCategory || p.categorySlug === selectedCategory)
    .filter((p) => !selectedStore || p.storeSlug === selectedStore)
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.nameUz?.toLowerCase().includes(q) ?? false);
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      nameUz: p.nameUz,
      priceUZS: p.priceUZS,
      storeSlug: p.storeSlug,
      storeName: p.storeName,
      modelUrl: p.modelUrl,
      thumbnailUrl: p.thumbnailUrl,
      categorySlug: p.categorySlug || "other",
      dimensions: p.dimensions,
      isPlaceholder: p.isPlaceholder,
    }));

  const handlePlaceInAR = (product: ProductCardData) => {
    router.push(`/ar?place=${product.id}&model=${encodeURIComponent(product.modelUrl || "")}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto p-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold">
              R
            </div>
            <span className="font-bold hidden sm:inline">RoomAI</span>
          </Link>
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search furniture..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Catalog</h1>
            <p className="text-white/50 text-sm">{filteredProducts.length} products</p>
          </div>
          <div className="flex gap-2">
            <StoreFilterPill
              label="All Stores"
              active={selectedStore === null}
              onClick={() => setSelectedStore(null)}
            />
            <StoreFilterPill
              label="Asaxiy"
              active={selectedStore === "asaxiy"}
              onClick={() => setSelectedStore("asaxiy")}
              color="blue"
            />
            <StoreFilterPill
              label="Olcha"
              active={selectedStore === "olcha"}
              onClick={() => setSelectedStore("olcha")}
              color="orange"
            />
          </div>
        </div>

        <FurnitureCarousel
          products={filteredProducts}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onPlaceInAR={handlePlaceInAR}
          onAddToCart={() => {}}
          onOpenCart={() => setCartOpen(true)}
          cartCount={cartCount}
        />

        {filteredProducts.length === 0 && (
          <div className="text-center text-white/50 py-20">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-lg">No products match your filters</p>
            <button
              onClick={() => { setSearch(""); setSelectedCategory(null); setSelectedStore(null); }}
              className="mt-4 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function StoreFilterPill({ label, active, onClick, color }: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: "blue" | "orange";
}) {
  const colorClass = active
    ? color === "blue" ? "bg-blue-500 text-white" : color === "orange" ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"
    : "bg-white/10 text-white/70 hover:bg-white/20";

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${colorClass}`}
    >
      {label}
    </button>
  );
}
