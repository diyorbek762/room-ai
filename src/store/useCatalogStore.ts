import { create } from "zustand";
import type { CatalogFilters } from "@/types";

interface CatalogStoreState {
  filters: CatalogFilters;
  setFilter: <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) => void;
  resetFilters: () => void;
}

const defaultFilters: CatalogFilters = {
  search: "",
  categorySlug: null,
  storeSlug: null,
  priceMin: null,
  priceMax: null,
  page: 1,
};

export const useCatalogStore = create<CatalogStoreState>()((set) => ({
  filters: { ...defaultFilters },

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value, page: key === "page" ? (value as number) : 1 },
    })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),
}));
