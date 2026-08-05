export interface SurfaceMaterialPreset {
  id: string;
  name: string;
  nameUz: string;
  type: "floor" | "wall";
  category: "parquet" | "tile" | "wallpaper" | "paint";
  pricePerM2: number; // in UZS
  color?: string; // Hex color for paint/procedural
  textureUrl?: string; // Seamless texture path if available
  roughness: number;
  metalness: number;
  repeatScale?: { u: number; v: number };
}

export const SURFACE_PRESETS: SurfaceMaterialPreset[] = [
  // --- FLOOR MATERIALS (PARQUET & TILES) ---
  {
    id: "parquet-natural-oak",
    name: "Natural Oak Parquet",
    nameUz: "Tabiiy eman parketi",
    type: "floor",
    category: "parquet",
    pricePerM2: 185000,
    color: "#c29b68",
    roughness: 0.45,
    metalness: 0.05,
    repeatScale: { u: 2.0, v: 2.0 }
  },
  {
    id: "parquet-dark-walnut",
    name: "Dark Walnut Herringbone",
    nameUz: "To'q yong'oq parket",
    type: "floor",
    category: "parquet",
    pricePerM2: 240000,
    color: "#5c3d24",
    roughness: 0.4,
    metalness: 0.05,
    repeatScale: { u: 2.5, v: 2.5 }
  },
  {
    id: "tile-calacatta-marble",
    name: "Calacatta Marble Tile",
    nameUz: "Marmar kafel (Calacatta)",
    type: "floor",
    category: "tile",
    pricePerM2: 310000,
    color: "#e8ecef",
    roughness: 0.15,
    metalness: 0.1,
    repeatScale: { u: 1.5, v: 1.5 }
  },
  {
    id: "tile-slate-grey",
    name: "Modern Slate Grey Tile",
    nameUz: "Zamonaviy kulrang kafel",
    type: "floor",
    category: "tile",
    pricePerM2: 165000,
    color: "#4a5056",
    roughness: 0.6,
    metalness: 0.05,
    repeatScale: { u: 2.0, v: 2.0 }
  },

  // --- WALL MATERIALS (WALLPAPERS / ABOY & PAINTS) ---
  {
    id: "aboy-japandi-linen",
    name: "Japandi Linen Wallpaper",
    nameUz: "Japandi zig'ir gulqog'oz (Aboy)",
    type: "wall",
    category: "wallpaper",
    pricePerM2: 95000,
    color: "#e6dfd5",
    roughness: 0.85,
    metalness: 0.0,
    repeatScale: { u: 1.0, v: 1.0 }
  },
  {
    id: "aboy-emerald-gold",
    name: "Emerald & Gold Leaf Wallpaper",
    nameUz: "Zümrad va oltin nishonli gulqog'oz",
    type: "wall",
    category: "wallpaper",
    pricePerM2: 145000,
    color: "#1c3b32",
    roughness: 0.6,
    metalness: 0.25,
    repeatScale: { u: 1.5, v: 1.5 }
  },
  {
    id: "paint-warm-beige",
    name: "Caparol Warm Beige Paint",
    nameUz: "Caparol iliq bej bo'yog'i",
    type: "wall",
    category: "paint",
    pricePerM2: 45000,
    color: "#d9cbbf",
    roughness: 0.9,
    metalness: 0.0
  },
  {
    id: "paint-terracotta-clay",
    name: "Terracotta Clay Paint",
    nameUz: "Terrakota gil bo'yog'i",
    type: "wall",
    category: "paint",
    pricePerM2: 52000,
    color: "#b85d43",
    roughness: 0.85,
    metalness: 0.0
  },
  {
    id: "paint-nordic-sage",
    name: "Nordic Sage Green Paint",
    nameUz: "Skandinaviya adaçayı bo'yog'i",
    type: "wall",
    category: "paint",
    pricePerM2: 48000,
    color: "#7a8b7b",
    roughness: 0.88,
    metalness: 0.0
  }
];
