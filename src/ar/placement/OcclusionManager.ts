import * as THREE from "three";
import type { PlaneManager, DetectedPlane } from "./PlaneManager";

/**
 * Tier-A real-world occlusion: invisible depth-writing meshes built from the
 * XRPlane polygons detected by ARCore. Virtual objects behind walls or
 * furniture-tops are depth-rejected, matching the behavior of high-end AR apps
 * on devices without the WebXR Depth API.
 *
 * Limitation: only planar surfaces are occluded. Irregular objects (e.g., a
 * physical bed with legs) require Tier-B depth sensing.
 */
export class OcclusionManager {
  private scene: THREE.Scene;
  private planeManager: PlaneManager | null = null;
  private occluders: Map<XRPlane, THREE.Mesh> = new Map();
  private lastChangedTimes: Map<XRPlane, number> = new Map();
  private material: THREE.MeshBasicMaterial;
  private maxPlanes: number;
  private offset: number;
  private enabled = true;

  private _shape = new THREE.Shape();
  private _scratch = new THREE.Vector3();

  constructor(scene: THREE.Scene, options: { maxPlanes?: number; offset?: number } = {}) {
    this.scene = scene;
    this.maxPlanes = options.maxPlanes ?? 16;
    this.offset = options.offset ?? 0.01;
    this.material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      transparent: false,
    });
  }

  setPlaneManager(pm: PlaneManager): void {
    this.planeManager = pm;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const mesh of this.occluders.values()) {
      mesh.visible = enabled;
    }
  }

  update(): void {
    if (!this.enabled || !this.planeManager) return;

    const detected = this.planeManager.getAllPlanes();
    const current = new Set<XRPlane>();

    // Limit to the largest planes to avoid GPU overhead.
    const sorted = detected
      .map((p) => ({ plane: p, area: this.polygonArea(p.plane.polygon) }))
      .sort((a, b) => b.area - a.area)
      .slice(0, this.maxPlanes)
      .map((entry) => entry.plane);

    for (const entry of sorted) {
      const plane = entry.plane;
      current.add(plane);

      const lastChanged = this.lastChangedTimes.get(plane);
      if (lastChanged === plane.lastChangedTime) {
        // Geometry hasn't changed; just update pose in case the plane moved.
        const mesh = this.occluders.get(plane);
        if (mesh) this.updateMeshPose(mesh, entry);
        continue;
      }

      this.lastChangedTimes.set(plane, plane.lastChangedTime);
      this.ensureOccluder(plane, entry);
    }

    // Remove stale occluders
    for (const [plane, mesh] of this.occluders.entries()) {
      if (!current.has(plane)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.occluders.delete(plane);
        this.lastChangedTimes.delete(plane);
      }
    }
  }

  private ensureOccluder(plane: XRPlane, entry: DetectedPlane): void {
    const polygon = plane.polygon;
    if (polygon.length < 3) return;

    this._shape = new THREE.Shape();
    this._shape.moveTo(polygon[0].x, -polygon[0].z);
    for (let i = 1; i < polygon.length; i++) {
      this._shape.lineTo(polygon[i].x, -polygon[i].z);
    }
    this._shape.closePath();

    const geometry = new THREE.ShapeGeometry(this._shape);
    geometry.rotateX(-Math.PI / 2);

    let mesh = this.occluders.get(plane);
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
    } else {
      mesh = new THREE.Mesh(geometry, this.material);
      mesh.renderOrder = -1;
      this.occluders.set(plane, mesh);
      this.scene.add(mesh);
    }
    this.updateMeshPose(mesh, entry);
  }

  private updateMeshPose(mesh: THREE.Mesh, entry: DetectedPlane): void {
    mesh.position.copy(entry.position).addScaledVector(entry.normal, -this.offset);
    mesh.quaternion.setFromRotationMatrix(entry.pose);
  }

  private polygonArea(polygon: ReadonlyArray<DOMPointReadOnly>): number {
    let area = 0;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      area += polygon[j].x * polygon[i].z;
      area -= polygon[i].x * polygon[j].z;
    }
    return Math.abs(area) * 0.5;
  }

  dispose(): void {
    for (const mesh of this.occluders.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.occluders.clear();
    this.lastChangedTimes.clear();
    this.material.dispose();
  }
}
