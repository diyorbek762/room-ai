import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Vector3Tuple } from "three";
import type { PlacedObject } from "@/types";

interface ARStoreState {
  isARActive: boolean;
  hitTestReady: boolean;
  scanStatus: "scanning" | "ready";
  reticlePose: Float32Array | null;
  placedObjects: PlacedObject[];
  selectedObjectId: string | null;

  setARActive: (active: boolean) => void;
  setHitTestReady: (ready: boolean) => void;
  setScanStatus: (status: "scanning" | "ready") => void;
  setReticlePose: (pose: Float32Array | null) => void;

  placeObject: (productId: string, modelUrl: string, position: Vector3Tuple) => void;
  removeObject: (id: string) => void;
  updateTransform: (id: string, patch: Partial<Pick<PlacedObject, "position" | "rotation" | "scale">>) => void;
  selectObject: (id: string | null) => void;

  loadScene: (objects: PlacedObject[]) => void;
  clearScene: () => void;
}

let nextId = 0;
function genId(): string {
  return `obj_${Date.now()}_${nextId++}`;
}

export const useARStore = create<ARStoreState>()(
  persist(
    (set) => ({
      isARActive: false,
      hitTestReady: false,
      scanStatus: "scanning",
      reticlePose: null,
      placedObjects: [],
      selectedObjectId: null,

      setARActive: (active) => set({ isARActive: active, scanStatus: "scanning" }), // Reset scan when starting AR
      setHitTestReady: (ready) => set({ hitTestReady: ready }),
      setScanStatus: (status) => set({ scanStatus: status }),
      setReticlePose: (pose) => set({ reticlePose: pose }),

      placeObject: (productId, modelUrl, position) =>
        set((state) => ({
          placedObjects: [
            ...state.placedObjects,
            {
              id: genId(),
              productId,
              modelUrl,
              position,
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            },
          ],
        })),

      removeObject: (id) =>
        set((state) => ({
          placedObjects: state.placedObjects.filter((o) => o.id !== id),
          selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
        })),

      updateTransform: (id, patch) =>
        set((state) => ({
          placedObjects: state.placedObjects.map((o) =>
            o.id === id ? { ...o, ...patch } : o
          ),
        })),

      selectObject: (id) => set({ selectedObjectId: id }),

      loadScene: (objects) => set({ placedObjects: objects }),
      clearScene: () => set({ placedObjects: [], selectedObjectId: null }),
    }),
    {
      name: "roomai-ar-scene",
      partialize: (state) => ({
        placedObjects: state.placedObjects,
      }),
    }
  )
);
