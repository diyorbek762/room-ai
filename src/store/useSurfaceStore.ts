import { create } from "zustand";
import { SURFACE_PRESETS, type SurfaceMaterialPreset } from "@/ar/decor/surfacePresets";

interface SurfaceState {
  selectedFloorPreset: SurfaceMaterialPreset | null;
  selectedWallPreset: SurfaceMaterialPreset | null;
  surfaceModalOpen: boolean;
}

interface SurfaceActions {
  selectFloorPreset: (preset: SurfaceMaterialPreset | null) => void;
  selectWallPreset: (preset: SurfaceMaterialPreset | null) => void;
  setSurfaceModalOpen: (open: boolean) => void;
  calculateTotalMaterialCost: (floorAreaM2: number, wallAreaM2: number) => {
    floorCost: number;
    wallCost: number;
    totalCost: number;
    wallpaperRolls: number;
    paintBuckets: number;
    parquetPacks: number;
  };
}

export const useSurfaceStore = create<SurfaceState & SurfaceActions>((set, get) => ({
  selectedFloorPreset: SURFACE_PRESETS.find((p) => p.id === "parquet-natural-oak") || null,
  selectedWallPreset: SURFACE_PRESETS.find((p) => p.id === "aboy-japandi-linen") || null,
  surfaceModalOpen: false,

  selectFloorPreset: (preset) => set({ selectedFloorPreset: preset }),
  selectWallPreset: (preset) => set({ selectedWallPreset: preset }),
  setSurfaceModalOpen: (open) => set({ surfaceModalOpen: open }),

  calculateTotalMaterialCost: (floorAreaM2, wallAreaM2) => {
    const { selectedFloorPreset, selectedWallPreset } = get();
    const floorCost = selectedFloorPreset ? Math.round(floorAreaM2 * selectedFloorPreset.pricePerM2) : 0;
    const wallCost = selectedWallPreset ? Math.round(wallAreaM2 * selectedWallPreset.pricePerM2) : 0;
    
    // Estimates: 1 roll wallpaper = 5.3 m², 1 bucket paint = 25 m², 1 pack parquet = 2.4 m²
    const wallpaperRolls = wallAreaM2 > 0 ? Math.ceil(wallAreaM2 / 5.3) : 0;
    const paintBuckets = wallAreaM2 > 0 ? Math.ceil(wallAreaM2 / 25.0) : 0;
    const parquetPacks = floorAreaM2 > 0 ? Math.ceil(floorAreaM2 / 2.4) : 0;

    return {
      floorCost,
      wallCost,
      totalCost: floorCost + wallCost,
      wallpaperRolls,
      paintBuckets,
      parquetPacks,
    };
  },
}));

