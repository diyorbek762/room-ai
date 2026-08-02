import type { Vector3Tuple } from "three";

export interface PlacedObject {
  id: string;
  productId: string;
  modelUrl: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
}

export interface ARSceneState {
  isARActive: boolean;
  hitTestReady: boolean;
  reticlePose: Float32Array | null;
  placedObjects: PlacedObject[];
  selectedObjectId: string | null;
}

export interface CatalogFilters {
  search: string;
  categorySlug: string | null;
  storeSlug: string | null;
  priceMin: number | null;
  priceMax: number | null;
  page: number;
}

export interface CartEntry {
  id: string;
  productId: string;
  productName: string;
  storeSlug: string;
  storeName: string;
  priceUZS: number;
  thumbnailUrl: string | null;
  quantity: number;
}

export interface ProductDimensions {
  w: number;
  h: number;
  d: number;
}

export type PlacementType = "floor" | "wall" | "floor-wall";

export interface DemoCatalogEntry {
  id: string;
  name: string;
  nameUz: string;
  category: string;
  store: string;
  priceUZS: number;
  modelFile: string;
  dimensions: ProductDimensions;
  source: string;
  license: string;
  /** Where this item can be placed in AR. Defaults to "floor" when absent. */
  placement?: PlacementType;
}
