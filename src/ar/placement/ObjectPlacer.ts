import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { getCachedModel } from "@/lib/modelCache";

export interface PlacedModel {
  id: string;
  productId: string;
  model: THREE.Group;
  /** Invisible enlarged box used as a forgiving raycast hit zone. */
  hitProxy: THREE.Mesh;
  /** Soft circular shadow disc rendered on the floor beneath the object. */
  contactShadow: THREE.Mesh | null;
  boundingBox: THREE.Box3;
  isPlaceholder: boolean;
  isLoading: boolean;
  /** Surface type this object was placed on. */
  surfaceType: "floor" | "wall";
  /** Wall normal (only set when surfaceType === "wall"). */
  wallNormal: THREE.Vector3 | null;
  needsNewAnchor?: boolean;
}

export type PlacerEvent =
  | { type: "model-loading"; id: string; productId: string }
  | { type: "model-loaded"; id: string; productId: string }
  | { type: "model-failed"; id: string; productId: string }
  | { type: "model-removed"; id: string }
  | { type: "scene-cleared" };

// Furniture dimensions (w, h, d) in meters — matching demo-catalog
const FURNITURE_DIMS: Record<string, [number, number, number]> = {
  "demo-001": [2.1, 0.85, 0.95],   // sofa
  "demo-002": [0.75, 0.9, 0.8],    // armchair
  "demo-003": [0.45, 0.85, 0.5],   // dining chair
  "demo-004": [1.2, 0.45, 0.6],    // coffee table
  "demo-005": [1.8, 0.75, 0.9],    // dining table
  "demo-006": [2.0, 0.5, 2.2],     // king bed
  "demo-007": [1.0, 0.5, 2.0],     // single bed
  "demo-008": [0.8, 1.8, 0.35],    // bookshelf
  "demo-009": [1.2, 0.6, 0.25],    // wall shelf
  "demo-010": [2.8, 0.85, 1.8],    // l-shape sofa
  "demo-011": [1.4, 0.75, 0.7],    // office desk
  "demo-012": [0.5, 0.55, 0.4],    // nightstand
  "demo-013": [1.2, 2.0, 0.6],     // wardrobe
  "demo-014": [0.35, 1.6, 0.35],   // floor lamp
  "demo-015": [1.5, 0.5, 0.4],     // tv stand
  "demo-016": [0.4, 0.95, 0.4],    // bar stool
  "demo-017": [0.5, 0.55, 0.5],    // side table
  "demo-018": [2.2, 1.0, 0.95],    // recliner
};

const CATEGORY_COLORS: Record<string, number> = {
  sofas: 0x4488cc,
  chairs: 0xcc8844,
  tables: 0x996633,
  beds: 0x66aa66,
  shelving: 0xaa9944,
};

export class ObjectPlacer {
  private scene: THREE.Scene;
  private gltfLoader: GLTFLoader;
  private placedModels: Map<string, PlacedModel> = new Map();
  private dracoLoader: DRACOLoader;
  private contactShadowTexture: THREE.CanvasTexture | null = null;
  private tempBox = new THREE.Box3();
  private tempVec = new THREE.Vector3();
  private events: EventTarget = new EventTarget();
  private productDimsResolver: ((productId: string) => { w: number; h: number; d: number } | null) | null = null;

  addEventListener(type: PlacerEvent["type"], handler: (e: Event) => void): void {
    this.events.addEventListener(type, handler);
  }

  removeEventListener(type: PlacerEvent["type"], handler: (e: Event) => void): void {
    this.events.removeEventListener(type, handler);
  }

  setProductDimsResolver(fn: (productId: string) => { w: number; h: number; d: number } | null): void {
    this.productDimsResolver = fn;
  }

  private emit(type: PlacerEvent["type"], detail: Omit<PlacerEvent, "type">): void {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /**
   * Multiplier for the hit-test proxy box. 1.4x the model bounds makes taps
   * near the silhouette (but not directly on a mesh triangle) still register
   * as a hit, so users don't accidentally place a duplicate when they meant
   * to select.
   */
  private static readonly HIT_PROXY_PADDING = 2.0;

  constructor(scene: THREE.Scene, contactShadowTexture?: THREE.CanvasTexture) {
    this.scene = scene;
    this.contactShadowTexture = contactShadowTexture ?? null;

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("/models/draco/");

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  placeObject(
    id: string,
    productId: string,
    modelUrl: string,
    position: THREE.Vector3,
    quaternion?: THREE.Quaternion,
    scale?: THREE.Vector3,
    surfaceType: "floor" | "wall" = "floor",
    wallNormal?: THREE.Vector3
  ): PlacedModel {
    const model = this.createPlaceholder(productId, surfaceType);
    model.position.copy(position);

    if (quaternion) {
      model.quaternion.copy(quaternion);
    }

    // For wall items, orient the model to face outward from the wall
    if (surfaceType === "wall" && wallNormal) {
      const lookTarget = position.clone().add(wallNormal);
      model.lookAt(lookTarget);
    }

    const targetScale = scale || new THREE.Vector3(1, 1, 1);
    model.scale.copy(targetScale);

    const boundingBox = new THREE.Box3().setFromObject(model);
    const hitProxy = this.createHitProxy(boundingBox);
    this.scene.add(hitProxy);

    // Wall-mounted items don't get a floor contact shadow
    let contactShadow: THREE.Mesh | null = null;
    if (surfaceType === "floor") {
      contactShadow = this.createContactShadow(boundingBox);
      this.scene.add(contactShadow);
    }

    const placedModel: PlacedModel = {
      id,
      productId,
      model,
      hitProxy,
      contactShadow,
      boundingBox,
      isPlaceholder: true,
      isLoading: true,
      surfaceType,
      wallNormal: wallNormal?.clone() ?? null,
    };

    this.placedModels.set(id, placedModel);
    this.scene.add(model);

    this.emit("model-loading", { id, productId });
    this.loadRealModel(id, productId, modelUrl, model);

    return placedModel;
  }

  private createHitProxy(box: THREE.Box3): THREE.Mesh {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const paddedSize = size.multiplyScalar(ObjectPlacer.HIT_PROXY_PADDING);
    paddedSize.set(
      Math.max(paddedSize.x, 0.3),
      Math.max(paddedSize.y, 0.3),
      Math.max(paddedSize.z, 0.3)
    );
    const geometry = new THREE.BoxGeometry(paddedSize.x, paddedSize.y, paddedSize.z);
    // Fully transparent material that doesn't render at all. The proxy is
    // a standalone scene object whose geometry is in world space — its
    // position is the AABB center of the model, not the model's own
    // position (which is usually a corner, e.g. the floor contact point).
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.userData.isHitProxy = true;
    mesh.frustumCulled = false; // never cull; the proxy must always be raycast-able
    return mesh;
  }

  private createContactShadow(box: THREE.Box3): THREE.Mesh {
    // Use the longer horizontal extent of the model as the shadow diameter.
    const size = new THREE.Vector3();
    box.getSize(size);
    const diameter = Math.max(size.x, size.z) * 1.2;
    const geometry = new THREE.PlaneGeometry(diameter, diameter);
    const material = new THREE.MeshBasicMaterial({
      map: this.contactShadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    // Place the shadow slightly above the floor to avoid z-fighting
    mesh.position.set(box.getCenter(this.tempVec).x, 0.005, box.getCenter(new THREE.Vector3()).z);
    mesh.position.y = 0.005;
    mesh.renderOrder = 1;
    return mesh;
  }

  private updateHitProxy(placedModel: PlacedModel): void {
    this.syncHitProxyTransform(placedModel);
  }

  private async loadRealModel(
    id: string,
    productId: string,
    modelUrl: string,
    placeholder: THREE.Group
  ): Promise<void> {
    try {
      // Try cache first — instant if pre-cached
      const buffer = await getCachedModel(modelUrl);
      let arrayBuffer: ArrayBuffer;

      if (buffer) {
        arrayBuffer = buffer;
      } else {
        const response = await fetch(modelUrl);
        if (!response.ok) throw new Error(`Failed to fetch ${modelUrl}: ${response.status}`);
        arrayBuffer = await response.arrayBuffer();
      }

      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);

      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });

      URL.revokeObjectURL(url);

      const realModel = gltf.scene as THREE.Group;
      const pos = placeholder.position.clone();
      const quat = placeholder.quaternion.clone();
      const scl = placeholder.scale.clone();

      realModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      // Compute local-space bounding box BEFORE applying world transform.
      // This gives us the true bottom of the model geometry.
      const localBBox = new THREE.Box3().setFromObject(realModel);
      const localMinY = localBBox.min.y;

      // Normalize off-scale GLBs against catalog dimensions.
      const expected = this.productDimsResolver?.(productId);
      if (expected) {
        localBBox.getSize(this.tempVec);
        const dev = Math.abs(this.tempVec.x - expected.w) / expected.w;
        if (dev > 0.15) {
          const factor = expected.w / this.tempVec.x;
          scl.multiplyScalar(factor);
        }
      }

      realModel.position.copy(pos);
      realModel.quaternion.copy(quat);
      realModel.scale.copy(scl);

      // Adjust Y so the bottom of the model sits exactly on the placement surface.
      // localMinY is the model's lowest point in its own coordinate system.
      // We subtract it so the bottom aligns with the hit-test position.
      if (Math.abs(localMinY) > 0.001) {
        realModel.position.y -= localMinY * scl.y;
      }

      // Cross-fade swap: 150ms. Real model starts at opacity 0; placeholder
      // fades to 0 simultaneously. Then real is added at full opacity and
      // the placeholder is disposed. The "model-loaded" event fires from
      // inside crossFadeSwap when the fade completes.
      this.crossFadeSwap(id, placeholder, realModel, 150);
    } catch {
      const placedModel = this.placedModels.get(id);
      if (placedModel) {
        placedModel.isLoading = false;
        this.emit("model-failed", { id, productId });
      }
    }
  }

  /**
   * Cross-fade swap between a placeholder and a real model over `durationMs`.
   * The real model starts at opacity 0; the placeholder fades to 0. When
   * the fade completes the placeholder is removed and disposed.
   *
   * Materials are cloned so the fade is independent per object. The materials
   * are restored to opaque (opacity = 1) at the end of the fade.
   */
  private crossFadeSwap(
    id: string,
    placeholder: THREE.Group,
    realModel: THREE.Group,
    durationMs: number
  ): void {
    // Clone materials on the real model so we can fade them independently
    const realMats: THREE.Material[] = [];
    realModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const m = child.material;
        const clone = (Array.isArray(m) ? m : [m]).map((orig) => orig.clone());
        child.material = Array.isArray(m) ? clone : clone[0];
        for (const c of clone) {
          c.transparent = true;
          c.opacity = 0;
          realMats.push(c);
        }
      }
    });
    this.scene.add(realModel);

    const start = performance.now();
    const placeholderMats: THREE.Material[] = [];
    placeholder.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          m.transparent = true;
          placeholderMats.push(m);
        }
      }
    });

    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / durationMs);
      const ease = 1 - Math.pow(1 - t, 2); // ease-out-quad
      for (const m of realMats) m.opacity = ease;
      for (const m of placeholderMats) m.opacity = 1 - ease;
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Restore real model materials to opaque (perf: avoid transparent sorting)
        for (const m of realMats) {
          m.opacity = 1;
          m.transparent = false;
          m.needsUpdate = true;
        }
        // Remove the placeholder
        this.scene.remove(placeholder);
        placeholder.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        // Update tracking
        const placedModel = this.placedModels.get(id);
        if (placedModel) {
          placedModel.model = realModel;
          placedModel.boundingBox = new THREE.Box3().setFromObject(realModel);
          placedModel.isPlaceholder = false;
          placedModel.isLoading = false;
          this.updateHitProxy(placedModel);
          this.syncContactShadow(placedModel);
          this.emit("model-loaded", { id, productId: placedModel.productId });
        }
      }
    };
    requestAnimationFrame(tick);
  }

  removeObject(id: string): boolean {
    const placedModel = this.placedModels.get(id);
    if (!placedModel) return false;

    this.scene.remove(placedModel.model);
    this.scene.remove(placedModel.hitProxy);
    if (placedModel.contactShadow) {
      this.scene.remove(placedModel.contactShadow);
      (placedModel.contactShadow.geometry as THREE.PlaneGeometry).dispose();
      (placedModel.contactShadow.material as THREE.Material).dispose();
    }
    (placedModel.hitProxy.geometry as THREE.BoxGeometry).dispose();
    (placedModel.hitProxy.material as THREE.Material).dispose();

    placedModel.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.placedModels.delete(id);
    this.emit("model-removed", { id });
    return true;
  }

  getPlacedModel(id: string): PlacedModel | undefined {
    return this.placedModels.get(id);
  }

  getAllPlacedModels(): PlacedModel[] {
    return Array.from(this.placedModels.values());
  }

  getAllPlacedModelsMap(): Map<string, PlacedModel> {
    return this.placedModels;
  }

  getModelRadius(id: string): number {
    const model = this.placedModels.get(id);
    if (!model) return 0.2; // default radius
    const size = new THREE.Vector3();
    model.boundingBox.getSize(size);
    // Multiply by object's world scale, assuming uniform
    const scale = model.model.scale.x; 
    return (Math.max(size.x, size.z) / 2) * scale;
  }

  getPlacedModelByProduct(productId: string): PlacedModel | undefined {
    for (const model of this.placedModels.values()) {
      if (model.productId === productId) return model;
    }
    return undefined;
  }

  updateTransform(
    id: string,
    position?: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ): void {
    const placedModel = this.placedModels.get(id);
    if (!placedModel) return;

    if (position) {
      placedModel.model.position.copy(position);
    }
    if (rotation) {
      placedModel.model.rotation.copy(rotation);
    }
    if (scale) {
      placedModel.model.scale.copy(scale);
    }

    // Reuse Box3 to avoid allocation
    this.tempBox.setFromObject(placedModel.model);
    placedModel.boundingBox.copy(this.tempBox);

    // The proxy follows the model: position = model's world position,
    // rotation = identity (AABB-based hit zone, doesn't need to track
    // model rotation), and its geometry is recomputed to match the new
    // padded AABB. The proxy has no own scale — its geometry already
    // reflects the world-space size.
    if (position || rotation || scale) {
      this.syncHitProxyTransform(placedModel);
      this.syncContactShadow(placedModel);
    }
  }

  private syncContactShadow(placedModel: PlacedModel): void {
    if (!placedModel.contactShadow) return;
    // Shadow follows the model's footprint center on the floor
    placedModel.contactShadow.position.x = placedModel.boundingBox.getCenter(this.tempVec).x;
    placedModel.contactShadow.position.z = placedModel.boundingBox.getCenter(new THREE.Vector3()).z;
    // Match the shadow size to the current model footprint
    const newDiameter = Math.max(placedModel.boundingBox.max.x - placedModel.boundingBox.min.x, placedModel.boundingBox.max.z - placedModel.boundingBox.min.z) * 1.2;
    const oldGeo = placedModel.contactShadow.geometry as THREE.PlaneGeometry;
    if (Math.abs(oldGeo.parameters.width - newDiameter) > 0.05) {
      oldGeo.dispose();
      placedModel.contactShadow.geometry = new THREE.PlaneGeometry(newDiameter, newDiameter);
    }
  }

  private syncHitProxyTransform(placedModel: PlacedModel): void {
    const box = new THREE.Box3().setFromObject(placedModel.model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const paddedSize = size.multiplyScalar(ObjectPlacer.HIT_PROXY_PADDING);
    paddedSize.set(
      Math.max(paddedSize.x, 0.2),
      Math.max(paddedSize.y, 0.2),
      Math.max(paddedSize.z, 0.2)
    );

    placedModel.hitProxy.position.copy(center);
    placedModel.hitProxy.rotation.set(0, 0, 0);
    placedModel.hitProxy.scale.set(1, 1, 1);

    const oldGeo = placedModel.hitProxy.geometry as THREE.BoxGeometry;
    if (
      Math.abs(oldGeo.parameters.width - paddedSize.x) > 0.01 ||
      Math.abs(oldGeo.parameters.height - paddedSize.y) > 0.01 ||
      Math.abs(oldGeo.parameters.depth - paddedSize.z) > 0.01
    ) {
      oldGeo.dispose();
      placedModel.hitProxy.geometry = new THREE.BoxGeometry(paddedSize.x, paddedSize.y, paddedSize.z);
    }
  }

  getRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [];
    for (const placedModel of this.placedModels.values()) {
      // Prefer the enlarged hit proxy (forgiving hit zone); fall back to the
      // model mesh for users who tap deep inside the visible geometry.
      targets.push(placedModel.hitProxy);
    }
    return targets;
  }

  private createPlaceholder(productId: string, _surfaceType: "floor" | "wall" = "floor"): THREE.Group {
    const group = new THREE.Group();
    const dims = FURNITURE_DIMS[productId] || [0.5, 0.5, 0.5];
    const [w, h, d] = dims;

    const categoryMap: Record<string, string> = {
      "01": "sofas", "02": "chairs", "03": "chairs", "04": "tables",
      "05": "tables", "06": "beds", "07": "beds", "08": "shelving",
      "09": "shelving", "10": "sofas", "11": "tables", "12": "tables",
      "13": "shelving", "14": "shelving", "15": "shelving", "16": "chairs",
      "17": "tables", "18": "sofas",
    };
    const category = categoryMap[productId] || "shelving";
    const color = CATEGORY_COLORS[category] || 0x888888;

    // Main box with correct dimensions
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      roughness: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    group.add(mesh);

    // Wireframe outline
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
    const wireframe = new THREE.LineSegments(edges, lineMaterial);
    wireframe.position.copy(mesh.position);
    group.add(wireframe);

    // Loading pulse ring
    const ringGeo = new THREE.RingGeometry(Math.max(w, d) * 0.6, Math.max(w, d) * 0.65, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    ring.name = "loading-ring";
    group.add(ring);

    return group;
  }

  clearAll(): void {
    for (const id of Array.from(this.placedModels.keys())) {
      this.removeObject(id);
    }
    this.emit("scene-cleared", {});
  }

  /**
   * Animate the loading-state placeholders. Call from the render loop with
   * the current time in seconds. Pulses the loading ring on every model
   * that is still loading.
   */
  updateLoadingAnimation(timeSec: number): void {
    for (const placed of this.placedModels.values()) {
      if (!placed.isLoading) continue;
      placed.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name === "loading-ring") {
          const pulse = 0.85 + Math.sin(timeSec * 4) * 0.15;
          child.scale.set(pulse, pulse, 1);
          (child.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(timeSec * 4) * 0.2;
        }
      });
    }
  }

  dispose(): void {
    this.clearAll();
    this.dracoLoader.dispose();
  }
}
