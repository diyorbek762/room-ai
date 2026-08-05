"use client";

import { useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useSurfaceStore } from "@/store/useSurfaceStore";
import { useMeasurementStore } from "@/store/useMeasurementStore";
import { SURFACE_PRESETS } from "@/ar/decor/surfacePresets";
import { formatM2 } from "@/lib/measurementMath";

export function SurfacePickerModal() {
  const {
    selectedFloorPreset,
    selectedWallPreset,
    surfaceModalOpen,
    selectFloorPreset,
    selectWallPreset,
    setSurfaceModalOpen,
    calculateTotalMaterialCost,
  } = useSurfaceStore();

  const metrics = useMeasurementStore((s) => s.metrics);

  const [activeTab, setActiveTab] = useState<"floor" | "wall">("floor");

  if (!surfaceModalOpen) return null;

  const floorAreaM2 = metrics?.floorAreaM2 || 0;
  const wallAreaM2 = metrics?.wallAreaM2 || 0;

  const { floorCost, wallCost, totalCost, wallpaperRolls, paintBuckets, parquetPacks } = calculateTotalMaterialCost(floorAreaM2, wallAreaM2);

  const filteredPresets = SURFACE_PRESETS.filter((p) => p.type === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <GlassPanel className="w-full max-w-lg p-5 rounded-3xl border border-white/20 shadow-2xl flex flex-col max-h-[85vh] text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>🎨</span> Surface Decorator
            </h2>
            <p className="text-xs text-white/60">
              Pick parquet, wallpapers (aboy) or paint colors for your room
            </p>
          </div>
          <button
            onClick={() => setSurfaceModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition-all"
          >
            ✕
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl mb-4 border border-white/10">
          <button
            onClick={() => setActiveTab("floor")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "floor"
                ? "bg-emerald-500 text-white shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            🪵 Floor (Pol & Parquet)
          </button>
          <button
            onClick={() => setActiveTab("wall")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "wall"
                ? "bg-emerald-500 text-white shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            🎨 Walls (Aboy & Paint)
          </button>
        </div>

        {/* Material Presets Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-3 mb-4">
          {filteredPresets.map((preset) => {
            const isSelected =
              preset.type === "floor"
                ? selectedFloorPreset?.id === preset.id
                : selectedWallPreset?.id === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => {
                  if (preset.type === "floor") selectFloorPreset(preset);
                  else selectWallPreset(preset);
                }}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-500/20 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-6 h-6 rounded-full border border-white/20 shadow-inner flex-shrink-0"
                    style={{ backgroundColor: preset.color || "#cccccc" }}
                  />
                  <span className="text-xs font-semibold line-clamp-1">{preset.nameUz}</span>
                </div>
                <div className="text-xs text-white/50">
                  {preset.pricePerM2.toLocaleString()} UZS / m²
                </div>
              </button>
            );
          })}
        </div>

        {/* Material Cost Estimation Footer */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Floor Area ({formatM2(floorAreaM2)}):</span>
            <span className="font-semibold">{floorCost.toLocaleString()} UZS {parquetPacks > 0 ? `(~${parquetPacks} packs)` : ""}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>Wall Area ({formatM2(wallAreaM2)}):</span>
            <span className="font-semibold">
              {wallCost.toLocaleString()} UZS{" "}
              {selectedWallPreset?.category === "wallpaper" && wallpaperRolls > 0
                ? `(~${wallpaperRolls} rolls)`
                : selectedWallPreset?.category === "paint" && paintBuckets > 0
                ? `(~${paintBuckets} buckets)`
                : ""}
            </span>
          </div>
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-300">Total Materials Estimate:</span>
            <span className="text-base font-bold text-emerald-400">
              {totalCost.toLocaleString()} UZS
            </span>
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={() => setSurfaceModalOpen(false)}
          className="mt-4 w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl active:scale-95 transition-all text-sm shadow-lg shadow-emerald-500/30"
        >
          Apply Surface Materials
        </button>
      </GlassPanel>
    </div>
  );
}
