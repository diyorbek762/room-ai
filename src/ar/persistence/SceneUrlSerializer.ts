import type { SurfaceMaterialPreset } from "@/ar/decor/surfacePresets";

export interface SerializedSceneState {
  version: number;
  floorPresetId?: string;
  wallPresetId?: string;
  objects: {
    id: string;
    productId: string;
    pos: [number, number, number];
    rot: [number, number, number];
    scale: [number, number, number];
  }[];
}

export class SceneUrlSerializer {
  /**
   * Serialize active room state to a URL query parameter string.
   */
  static serialize(
    placedObjects: Array<{
      id: string;
      productId: string;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }>,
    floorPreset: SurfaceMaterialPreset | null,
    wallPreset: SurfaceMaterialPreset | null
  ): string {
    const state: SerializedSceneState = {
      version: 1,
      floorPresetId: floorPreset?.id,
      wallPresetId: wallPreset?.id,
      objects: placedObjects.map((obj) => ({
        id: obj.id,
        productId: obj.productId,
        pos: [
          Number(obj.position[0].toFixed(3)),
          Number(obj.position[1].toFixed(3)),
          Number(obj.position[2].toFixed(3)),
        ],
        rot: [
          Number(obj.rotation[0].toFixed(3)),
          Number(obj.rotation[1].toFixed(3)),
          Number(obj.rotation[2].toFixed(3)),
        ],
        scale: [
          Number(obj.scale[0].toFixed(3)),
          Number(obj.scale[1].toFixed(3)),
          Number(obj.scale[2].toFixed(3)),
        ],
      })),
    };

    try {
      const jsonStr = JSON.stringify(state);
      const b64 = btoa(encodeURIComponent(jsonStr));
      return b64;
    } catch {
      return "";
    }
  }

  /**
   * Deserialize a URL query parameter string into scene state.
   */
  static deserialize(encoded: string): SerializedSceneState | null {
    try {
      const jsonStr = decodeURIComponent(atob(encoded));
      const state = JSON.parse(jsonStr) as SerializedSceneState;
      if (state && typeof state.version === "number" && Array.isArray(state.objects)) {
        return state;
      }
    } catch {
      // Invalid format
    }
    return null;
  }

  /**
   * Generates full shareable URL with ?scene= query parameter.
   */
  static createShareableUrl(
    placedObjects: Array<{
      id: string;
      productId: string;
      position: [number, number, number];
      rotation: [number, number, number];
      scale: [number, number, number];
    }>,
    floorPreset: SurfaceMaterialPreset | null,
    wallPreset: SurfaceMaterialPreset | null
  ): string {
    const code = this.serialize(placedObjects, floorPreset, wallPreset);
    if (!code) return typeof window !== "undefined" ? window.location.href : "";
    const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "https://roomai.uz");
    return `${origin}/ar?scene=${code}`;
  }
}
