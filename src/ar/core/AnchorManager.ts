import * as THREE from "three";
import type { PlacedModel } from "../placement/ObjectPlacer";

export class AnchorManager {
  private anchors: Map<string, XRAnchor> = new Map();
  private supported = false;

  constructor() {
    this.supported = true; // Set to true since it's enabled in session reqs
  }

  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Create an anchor attached to a hit test result (most stable).
   */
  async createAnchorFromHitTest(
    hitTestResult: XRHitTestResult,
    modelId: string
  ): Promise<void> {
    if (!this.supported) return;
    try {
      if (hitTestResult.createAnchor) {
        const anchor = await hitTestResult.createAnchor();
        this.anchors.set(modelId, anchor);
      }
    } catch (e) {
      console.warn("Failed to create anchor from hit test:", e);
    }
  }

  /**
   * Create a free-floating anchor at a specific pose (used after dragging).
   */
  async createAnchorFromPose(
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    modelId: string
  ): Promise<void> {
    if (!this.supported || !frame.createAnchor) return;
    try {
      const transform = new XRRigidTransform(
        { x: position.x, y: position.y, z: position.z },
        { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
      );
      const anchor = await frame.createAnchor(transform, referenceSpace);
      this.anchors.set(modelId, anchor);
    } catch (e) {
      console.warn("Failed to create anchor from pose:", e);
    }
  }

  deleteAnchor(modelId: string): void {
    const anchor = this.anchors.get(modelId);
    if (anchor) {
      anchor.delete();
      this.anchors.delete(modelId);
    }
  }

  clear(): void {
    for (const anchor of this.anchors.values()) {
      anchor.delete();
    }
    this.anchors.clear();
  }

  update(
    frame: XRFrame,
    referenceSpace: XRReferenceSpace,
    placedModels: Map<string, PlacedModel>
  ): void {
    if (!this.supported) return;

    // Cleanup stale anchors
    for (const modelId of this.anchors.keys()) {
      if (!placedModels.has(modelId)) {
        this.deleteAnchor(modelId);
      }
    }

    // Process all placed models
    for (const [modelId, placed] of placedModels.entries()) {
      if (placed.needsNewAnchor) {
        placed.needsNewAnchor = false;
        // The object was moved, so its current Three.js matrix needs to become its new anchor
        this.createAnchorFromPose(
          frame,
          referenceSpace,
          placed.model.position,
          placed.model.quaternion,
          modelId
        );
        continue;
      }

      const anchor = this.anchors.get(modelId);
      if (anchor) {
        const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
        if (pose) {
          placed.model.matrix.fromArray(pose.transform.matrix);
          placed.model.matrix.decompose(
            placed.model.position,
            placed.model.quaternion,
            placed.model.scale
          );
        }
      }
    }
  }
}
