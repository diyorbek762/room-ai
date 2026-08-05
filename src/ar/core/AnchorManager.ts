import * as THREE from "three";
import type { PlacedModel } from "../placement/ObjectPlacer";

export class AnchorManager {
  private anchors: Map<string, XRAnchor> = new Map();
  private supported = false;

  constructor() {
    // Anchors are supported if the UA exposes the createAnchor method on XRFrame.
    // This is still a real runtime check; even when requested, some browsers
    // (or sessions) don't provide the API.
    this.supported =
      typeof XRFrame !== "undefined" && "createAnchor" in XRFrame.prototype;
  }

  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Create an anchor attached to a hit test result (most stable).
   * This is the primary drift fix: the object is locked to physical geometry
   * instead of raw hit-test coordinates.
   */
  async createAnchorFromHitTest(
    hitTestResult: XRHitTestResult,
    modelId: string
  ): Promise<void> {
    if (!this.supported) return;
    try {
      if (hitTestResult.createAnchor) {
        // Delete any previous anchor for this object to avoid leaks.
        this.deleteAnchor(modelId);
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
      this.deleteAnchor(modelId);
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
    placedModels: Map<string, PlacedModel>,
    onPoseApplied?: (modelId: string) => void
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
      // Skip objects currently being dragged; the anchor was deleted at drag start
      // and their pose is driven by the user's finger, not the anchor system.
      // (No explicit drag flag on PlacedModel; the anchor is deleted at drag start
      // and recreated at drag end, so no anchor exists while dragging.)

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
      if (!anchor) continue;

      // If the UA exposes trackedAnchors and our anchor is not in the set,
      // tracking is lost this frame; keep the last good pose rather than snapping.
      if (frame.trackedAnchors && !frame.trackedAnchors.has(anchor)) {
        continue;
      }

      const pose = frame.getPose(anchor.anchorSpace, referenceSpace);
      if (pose) {
        placed.model.matrix.fromArray(pose.transform.matrix);
        placed.model.matrix.decompose(
          placed.model.position,
          placed.model.quaternion,
          placed.model.scale
        );
        onPoseApplied?.(modelId);
      }
    }
  }
}
