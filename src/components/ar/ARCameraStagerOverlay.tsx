"use client";

import { useState } from "react";
import { cn, formatUZS } from "@/lib/format";
import { useARStore } from "@/store/useARStore";

export interface OverlayProduct {
  id: string;
  name: string;
  nameUz?: string;
  priceUZS: number;
  storeSlug: string;
  storeName: string;
  modelUrl: string;
  categorySlug: string;
  dimensions: { w: number; h: number; d: number };
  placement: "floor" | "wall" | "floor-wall";
  productClass: "mass" | "modular" | "surface";
}

export interface OverlayFinishItem {
  id: string;
  productId: string;
  name: string;
  priceUZS: number;
  storeName: string;
}

const storeColors: Record<string, string> = {
  asaxiy: "bg-blue-500/90",
  olcha: "bg-orange-500/90",
};

const categoryLabels: Record<string, string> = {
  sofas: "Sofas",
  chairs: "Chairs",
  tables: "Tables",
  beds: "Beds",
  shelving: "Shelving",
};

const CATEGORY_KEYS = ["sofas", "chairs", "tables", "beds", "shelving"] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface ARCameraStagerOverlayProps {
  statusMessage: string;
  hitTestReady: boolean;
  selectedObjectId: string | null;
  placedObjectsCount: number;
  totalPriceUZS: number;
  loadingCount: number;
  selectedProductName: string;
  scaleLocked: boolean;
  products: OverlayProduct[];

  marketOpen: boolean;
  onMarketOpenChange: (open: boolean) => void;
  onSelectProduct: (p: OverlayProduct) => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onClearScene: () => void;
  onExit: () => void;
  onSaveAndFinish: () => void;

  onNudge: (dx: number, dz: number) => void;
  onScaleUp: () => void;
  onScaleDown: () => void;
  onDeselect: () => void;

  finishOpen: boolean;
  finishItems: OverlayFinishItem[];
  onCloseFinish: () => void;
  onPlaceOrder: () => void;
}

export function ARCameraStagerOverlay(props: ARCameraStagerOverlayProps) {
  const {
    statusMessage,
    hitTestReady,
    selectedObjectId,
    placedObjectsCount,
    totalPriceUZS,
    loadingCount,
    selectedProductName,
    scaleLocked,
    products,
    marketOpen,
    onMarketOpenChange,
    onSelectProduct,
    onRotateLeft,
    onRotateRight,
    onDuplicateSelected,
    onDeleteSelected,
    onClearScene,
    onExit,
    onSaveAndFinish,
    onNudge,
    onScaleUp,
    onScaleDown,
    onDeselect,
    finishOpen,
    finishItems,
    onCloseFinish,
    onPlaceOrder,
  } = props;

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | "all">("all");
  const placedObjects = useARStore((s) => s.placedObjects);
  const scanStatus = useARStore((s) => s.scanStatus);

  const filteredMarket = products.filter((p) => {
    if (categoryFilter !== "all" && p.categorySlug !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.nameUz?.toLowerCase().includes(q) ?? false)) {
        return false;
      }
    }
    return true;
  });

  return (
    <>
      {/* LAYER 0: AR Price Tags (updated directly via DOM in render loop for 60fps) */}
      <div id="ar-price-tags-container" className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        {placedObjects.map((obj) => {
          const product = products.find((p) => p.id === obj.productId);
          if (!product) return null;
          return (
            <div
              key={obj.id}
              id={`ar-tag-${obj.id}`}
              className="absolute hidden -translate-x-1/2 -translate-y-full pb-2"
              style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
            >
              <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/20 px-3 py-1.5 shadow-xl flex flex-col items-center">
                <span className="text-white font-semibold text-xs whitespace-nowrap drop-shadow-md">
                  {formatUZS(product.priceUZS)}
                </span>
                <span className="text-slate-300 text-[10px] whitespace-nowrap">
                  {product.nameUz || product.name}
                </span>
              </div>
              {/* Little triangle pointing down */}
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/80 mx-auto" />
            </div>
          );
        })}
      </div>

      {/* LAYER 0.1: Dimension callout labels */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        <div
          id="callout-w"
          className="absolute hidden -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-900 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md shadow"
          style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
        />
        <div
          id="callout-d"
          className="absolute hidden -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-900 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md shadow"
          style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
        />
        <div
          id="callout-h"
          className="absolute hidden -translate-x-1/2 -translate-y-1/2 bg-white/90 text-slate-900 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md shadow"
          style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
        />
      </div>

      {/* LAYER 1: Floating Header */}
      <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between gap-2 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs text-slate-200 font-medium flex items-center gap-2 min-w-0 pointer-events-auto">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            {selectedObjectId ? (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            ) : hitTestReady && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            )}
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                selectedObjectId
                  ? "bg-emerald-400"
                  : hitTestReady
                    ? "bg-emerald-400"
                    : "bg-amber-400"
              )}
            />
          </span>
          <span className="truncate">
            {selectedObjectId
              ? `Editing: ${selectedProductName}`
              : hitTestReady
                ? "Tap or drag surface to place"
                : statusMessage}
            <span className="text-slate-400"> • </span>
            <span className="text-slate-400">Objects: {placedObjectsCount}</span>
            {loadingCount > 0 && (
              <>
                <span className="text-slate-400"> • </span>
                <span className="text-amber-300">Loading {loadingCount}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 pointer-events-auto">
          <button
            type="button"
            onClick={() => onMarketOpenChange(true)}
            className="bg-slate-900/80 backdrop-blur-md text-white font-bold px-4 py-2 rounded-xl border border-white/15 text-xs active:scale-95 transition-all hover:bg-slate-800"
          >
            Market
          </button>
          <button
            type="button"
            onClick={onExit}
            className="bg-red-500/80 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          >
            Exit
          </button>
        </div>
      </div>

      {/* PRICE SUMMARY PANEL */}
      {totalPriceUZS > 0 && (
        <div className="absolute bottom-28 right-4 z-30 bg-slate-900/90 backdrop-blur-md rounded-xl border border-white/20 p-3 flex flex-col items-end shadow-xl min-w-[160px] pointer-events-none">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Xona narxi</span>
          <span className="text-emerald-400 font-bold text-lg leading-none mb-1">
            {formatUZS(totalPriceUZS)}
          </span>
          <span className="text-[10px] text-slate-300/80">
            6 oy: {formatUZS(totalPriceUZS / 6)} / oy
          </span>
        </div>
      )}

      {/* LAYER 2: In-Camera Active Object Control Bar (Edit Mode) */}
      {selectedObjectId && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none w-[95vw] max-w-sm">
          {/* Row 1: Move arrows + Scale +/− */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-1.5 max-w-full overflow-x-auto scrollbar-hide pointer-events-auto">
            <button
              type="button"
              onClick={() => onNudge(-0.1, 0)}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 text-white text-base font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
              aria-label="Move left"
              title="Move left (←)"
            >
              ◀
            </button>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onNudge(0, -0.1)}
                className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 text-white text-base font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
                aria-label="Move forward"
                title="Move forward (↑)"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => onNudge(0, 0.1)}
                className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 text-white text-base font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
                aria-label="Move back"
                title="Move back (↓)"
              >
                ▼
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNudge(0.1, 0)}
              className="w-9 h-9 bg-slate-800/90 hover:bg-slate-700 text-white text-base font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
              aria-label="Move right"
              title="Move right (→)"
            >
              ▶
            </button>

            <div className="w-px h-6 bg-white/10 mx-1" />

            {scaleLocked ? (
              <div
                className="h-9 px-3 bg-slate-800/60 text-slate-300 text-sm font-bold rounded-lg border border-white/10 flex items-center justify-center select-none"
                title="1:1 factory scale locked"
              >
                🔒 1:1
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onScaleDown}
                  className="h-9 px-3 bg-slate-800/90 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
                  aria-label="Scale down"
                  title="Scale down"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={onScaleUp}
                  className="h-9 px-3 bg-slate-800/90 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
                  aria-label="Scale up"
                  title="Scale up"
                >
                  +
                </button>
              </>
            )}
          </div>

          {/* Row 2: Rotate, Delete, Deselect, Clear */}
          <div className="flex flex-wrap justify-center items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-1.5 w-full pointer-events-auto">
            <button
              type="button"
              onClick={onRotateLeft}
              className="h-9 px-3 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
            >
              ↺ L
            </button>
            <button
              type="button"
              onClick={onRotateRight}
              className="h-9 px-3 bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
            >
              ↻ R
            </button>
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="h-9 px-3 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg border border-white/10 active:scale-95 transition-all flex items-center justify-center"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              className="h-9 px-3 bg-red-600/90 hover:bg-red-500 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all flex items-center justify-center"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onDeselect}
              className="h-9 px-3 bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all flex items-center justify-center"
            >
              Deselect
            </button>
            <button
              type="button"
              onClick={onClearScene}
              className="h-9 px-3 bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg active:scale-95 transition-all flex items-center justify-center"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* LAYER 5: Bottom Primary Action Button */}
      {scanStatus === "ready" && !marketOpen && !finishOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-30 pointer-events-none flex justify-center">
          <button
            type="button"
            onClick={onSaveAndFinish}
            className="w-full max-w-sm bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition-all pointer-events-auto"
          >
            Save & Finish Staging
          </button>
        </div>
      )}

      {/* LAYER 4: In-Camera Market Drawer */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 h-[75vh] bg-slate-900/95 backdrop-blur-2xl border-t border-white/15 rounded-t-3xl p-5 shadow-2xl transition-transform duration-300 flex flex-col pointer-events-auto",
          marketOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-white font-bold text-base">Local Uzbek Market Catalog</h2>
          <button
            type="button"
            onClick={() => onMarketOpenChange(false)}
            className="text-slate-400 hover:text-white w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-xl"
            aria-label="Close market drawer"
          >
            ×
          </button>
        </div>

        <div className="relative mb-3 flex-shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sofas, tables, beds..."
            className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide flex-shrink-0">
          <CategoryPill
            label="All"
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
          />
          {CATEGORY_KEYS.map((key) => (
            <CategoryPill
              key={key}
              label={categoryLabels[key]}
              active={categoryFilter === key}
              onClick={() => setCategoryFilter(key)}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 content-start pr-1 -mr-1">
          {filteredMarket.length === 0 ? (
            <div className="col-span-2 text-center text-slate-500 py-12 text-sm">
              No products match your filters
            </div>
          ) : (
            filteredMarket.map((p) => {
              const w = Math.round(p.dimensions.w * 100);
              const h = Math.round(p.dimensions.h * 100);
              const d = Math.round(p.dimensions.d * 100);
              return (
                <div
                  key={p.id}
                  className="bg-slate-800/60 border border-white/10 rounded-xl p-2.5 flex flex-col"
                >
                  <div className="relative w-full aspect-square rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center mb-2 overflow-hidden">
                    <span className="text-slate-500 text-[10px] font-mono">3D</span>
                    <span
                      className={cn(
                        "absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider",
                        storeColors[p.storeSlug] || "bg-slate-500"
                      )}
                    >
                      {p.storeName}
                    </span>
                    {p.placement !== "floor" && (
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-800/80 text-blue-300 uppercase tracking-wider border border-blue-500/30">
                        {p.placement === "wall" ? "Wall Mount" : "Wall Snap"}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-xs font-semibold leading-tight line-clamp-2 mb-0.5 min-h-[28px]">
                    {p.nameUz || p.name}
                  </p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">
                    {p.storeName === "Asaxiy" ? "Asaxiy Store" : "Olcha.uz"}
                  </p>
                  <p className="text-slate-400 text-[10px] font-mono mb-1.5">
                    {w} × {d} × {h} cm
                  </p>
                  <p className="text-emerald-400 text-xs font-bold mb-2">
                    {formatUZS(p.priceUZS)}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProduct(p);
                      onMarketOpenChange(false);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold py-2 rounded-lg active:scale-95 transition-all"
                  >
                    Select & Stage in Room
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* LAYER 5 (modal part): In-Camera Finish Modal */}
      {finishOpen && (
        <FinishModalOverlay
          items={finishItems}
          onClose={onCloseFinish}
          onPlaceOrder={onPlaceOrder}
        />
      )}

      {/* LAYER 7: In-Camera Interaction Instructions (Top) */}
      {selectedProductName && !selectedObjectId && !marketOpen && !finishOpen && scanStatus === "ready" && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[90%] max-w-sm flex justify-center">
          <div className="bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-[11px] text-slate-200 text-center shadow-lg">
            <span className="text-emerald-400 block mb-0.5 font-semibold">▸ {selectedProductName}</span>
            <span className="text-slate-400">
              {products.find(p => (p.nameUz || p.name) === selectedProductName)?.placement === "wall"
                ? "point camera at a wall and tap to mount"
                : products.find(p => (p.nameUz || p.name) === selectedProductName)?.placement === "floor-wall"
                  ? "tap floor to place · drag near wall to snap"
                  : "tap or drag floor to place"}
            </span>
          </div>
        </div>
      )}

      {/* Hint in edit mode */}
      {selectedObjectId && !marketOpen && !finishOpen && scanStatus === "ready" && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[90%] max-w-sm flex justify-center">
          <div className="bg-emerald-500/20 backdrop-blur-md px-3 py-2 rounded-xl border border-emerald-400/40 text-[11px] text-emerald-200 text-center shadow-lg">
            <span className="text-emerald-300 font-semibold block mb-0.5">● Editing</span>
            <span className="text-emerald-200/80">
              {scaleLocked
                ? "drag, twist · 1:1 factory scale locked"
                : "drag, pinch, twist · tap empty floor to deselect"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function CategoryPill({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0",
        active ? "bg-blue-500 text-white" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
      )}
    >
      {label}
    </button>
  );
}

function FinishModalOverlay({
  items,
  onClose,
  onPlaceOrder,
}: {
  items: OverlayFinishItem[];
  onClose: () => void;
  onPlaceOrder: () => void;
}) {
  const total = items.reduce((sum, i) => sum + i.priceUZS, 0);
  const byStore = items.reduce<Record<string, OverlayFinishItem[]>>((acc, item) => {
    if (!acc[item.storeName]) acc[item.storeName] = [];
    acc[item.storeName].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm print:hidden" onClick={onClose} />

      <div id="print-modal" className="relative w-full max-w-sm bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Room Staged!</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-xl"
            aria-label="Close finish modal"
          >
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">
            No furniture was placed yet.
          </p>
        ) : (
          <>
            <div className="bg-slate-800/60 border border-white/10 rounded-xl p-3 mb-4 max-h-64 overflow-y-auto">
              {Object.entries(byStore).map(([store, storeItems]) => (
                <div key={store} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider",
                        store === "Asaxiy" ? "bg-blue-500/90" : "bg-orange-500/90"
                      )}
                    >
                      {store}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {storeItems.length} {storeItems.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  {storeItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0"
                    >
                      <span className="text-slate-200 truncate flex-1 pr-2">
                        {item.name}
                      </span>
                      <span className="text-emerald-400 font-semibold">
                        {formatUZS(item.priceUZS)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex justify-between items-baseline border-t border-white/15 pt-2.5 mt-2">
                <span className="text-white font-bold text-sm">Total Budget</span>
                <span className="text-emerald-400 font-bold text-lg">
                  {formatUZS(total)}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all print:hidden"
              >
                Save as PDF
              </button>
              <button
                type="button"
                onClick={onPlaceOrder}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-all print:hidden"
              >
                Place Order
              </button>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full text-slate-400 hover:text-white py-2 text-sm mt-2 print:hidden"
        >
          Back to AR
        </button>
      </div>
    </div>
  );
}

// Add print styles globally when this component mounts
if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @media print {
      body * {
        visibility: hidden;
      }
      #print-modal, #print-modal * {
        visibility: visible;
      }
      #print-modal {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: white !important;
        color: black !important;
        border: none !important;
        box-shadow: none !important;
        padding: 2cm !important;
      }
      #print-modal h2 {
        color: black !important;
      }
      #print-modal span {
        color: black !important;
      }
      .print\\:hidden {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}
