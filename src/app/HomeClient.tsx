"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FurnitureCarousel } from "@/components/catalog/FurnitureCarousel";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { useCartStore } from "@/store";
import { startPreCaching, getCacheProgress } from "@/lib/modelCache";
import type { ProductDTO } from "@/lib/products";
import type { ProductCardData } from "@/components/catalog/ProductCard";

interface HomeClientProps {
  products: ProductDTO[];
  categories: { slug: string; name: string }[];
}

export function HomeClient({ products, categories }: HomeClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [cachePct, setCachePct] = useState(0);

  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

  useEffect(() => {
    if (typeof navigator !== "undefined" && "xr" in navigator) {
      navigator.xr!.isSessionSupported("immersive-ar").then(setIsSupported);
    } else {
      Promise.resolve().then(() => setIsSupported(false));
    }

    // Start pre-caching 3D models in background
    startPreCaching();
    const interval = setInterval(() => {
      const p = getCacheProgress();
      setCachePct(p.pct);
      if (p.done >= p.total) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredProducts: ProductCardData[] = products
    .filter((p) => !selectedCategory || p.categorySlug === selectedCategory)
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
    const slug = product.id;
    router.push(`/ar?place=${encodeURIComponent(slug)}&model=${encodeURIComponent(product.modelUrl || "")}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/30 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        </div>

        <header className="relative z-10 flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-bold text-xl">
              R
            </div>
            <span className="text-xl font-bold">RoomAI</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/catalog"
              className="text-white/80 hover:text-white text-sm font-medium hidden sm:inline"
            >
              Catalog
            </Link>
            <Link
              href="/ar"
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all"
            >
              Try AR
            </Link>
          </nav>
        </header>

        <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-12 sm:pb-20">
          <div className="max-w-3xl">
            <div className="inline-block px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-semibold mb-4">
              Powered by WebXR
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-4">
              Stage Your Room<br />
              <span className="text-emerald-400">in Augmented Reality</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/70 mb-8 max-w-xl">
              See real furniture from Asaxiy and Olcha in your space before you buy.
              Place, rotate, and arrange — all through your phone camera.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/ar"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/30"
              >
                {isSupported === false ? "View 3D Models" : "Start AR Experience"}
              </Link>
              <Link
                href="/catalog"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 active:scale-95 transition-all"
              >
                Browse Catalog
              </Link>
            </div>

            {cachePct > 0 && cachePct < 100 && (
              <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${cachePct}%` }}
                  />
                </div>
                <span>Loading 3D models... {cachePct}%</span>
              </div>
            )}
            {cachePct >= 100 && (
              <p className="mt-4 text-xs text-emerald-400/60">3D models ready</p>
            )}

            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/50">
              <span>✓ 18 demo products</span>
              <span>•</span>
              <span>✓ Real UZS pricing</span>
              <span>•</span>
              <span>✓ Multi-object placement</span>
              <span>•</span>
              <span>✓ Save & share scenes</span>
            </div>
          </div>
        </section>
      </div>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Featured Furniture</h2>
          <Link href="/catalog" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            View all →
          </Link>
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
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-3 gap-4">
          <FeatureCard
            icon="📱"
            title="WebXR Powered"
            description="Works on Android Chrome out of the box. No app download required."
          />
          <FeatureCard
            icon="🛋️"
            title="18 Real Products"
            description="Demo furniture from Asaxiy and Olcha with real dimensions and UZS pricing."
          />
          <FeatureCard
            icon="💾"
            title="Save Your Room"
            description="Save multiple room layouts. Continue staging later, share with family."
          />
        </div>
      </section>

      <footer className="border-t border-white/10 mt-12 py-6 text-center text-white/40 text-sm">
        RoomAI — Built for Uzbek furniture market · {new Date().getFullYear()}
      </footer>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5">
      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-white/60 text-sm">{description}</p>
    </div>
  );
}
