import * as THREE from "three";

export interface DetectedPlane {
  plane: XRPlane;
  orientation: "horizontal" | "vertical";
  /** World-space transform of the plane's local origin. */
  pose: THREE.Matrix4;
  /** Outward-facing normal of the plane in world space. */
  normal: THREE.Vector3;
  /** World-space position of the plane's center. */
  position: THREE.Vector3;
}

/**
 * Tracks detected XR planes each frame and provides wall-related queries
 * for the placement and interaction systems.
 *
 * `plane-detection` is requested as an optional WebXR feature by
 * ARSessionManager. If the device doesn't support it, `update()` becomes
 * a no-op and all queries return empty/null — zero visual regression.
 */
export class PlaneManager {
  private planes: Map<XRPlane, DetectedPlane> = new Map();
  private verticalPlanes: DetectedPlane[] = [];
  private supported = false;

  // Reusable scratch objects
  private _mat4 = new THREE.Matrix4();
  private _rotMat = new THREE.Matrix4();
  private _normal = new THREE.Vector3();
  private _pos = new THREE.Vector3();
  private _diff = new THREE.Vector3();

  /**
   * Read `frame.detectedPlanes` and rebuild the internal plane cache.
   * Call once per frame from the XR animation loop.
   */
  update(frame: XRFrame, refSpace: XRReferenceSpace): void {
    const detected = frame.detectedPlanes;
    if (!detected) {
      this.supported = false;
      return;
    }
    this.supported = true;

    this.planes.clear();
    this.verticalPlanes.length = 0;

    for (const plane of detected) {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) continue;

      this._mat4.fromArray(pose.transform.matrix);
      this._rotMat.extractRotation(this._mat4);

      // The plane's local Y-axis IS the normal (by WebXR spec)
      this._normal.set(0, 1, 0).applyMatrix4(this._rotMat);
      this._pos.setFromMatrixPosition(this._mat4);

      // Classify: if the world-space normal is mostly vertical → horizontal plane
      // otherwise → vertical (wall). Use plane.orientation when available.
      const orientation: "horizontal" | "vertical" =
        plane.orientation ??
        (Math.abs(this._normal.y) > 0.7 ? "horizontal" : "vertical");

      const entry: DetectedPlane = {
        plane,
        orientation,
        pose: this._mat4.clone(),
        normal: this._normal.clone(),
        position: this._pos.clone(),
      };

      this.planes.set(plane, entry);

      if (orientation === "vertical") {
        this.verticalPlanes.push(entry);
      }
    }
  }

  /**
   * Find the closest detected wall to a world-space position.
   * Uses perpendicular distance from the point to each wall plane.
   *
   * @param position  World-space position to test
   * @param maxDistance  Maximum perpendicular distance in meters (default 1.0)
   * @returns The closest wall info, or null if no wall is within range
   */
  findNearestWall(
    position: THREE.Vector3,
    maxDistance = 1.0
  ): {
    wallPosition: THREE.Vector3;
    wallNormal: THREE.Vector3;
    distance: number;
  } | null {
    if (this.verticalPlanes.length === 0) return null;

    let bestDist = maxDistance;
    let bestWall: DetectedPlane | null = null;

    for (const wall of this.verticalPlanes) {
      // Perpendicular distance from position to the wall plane
      this._diff.subVectors(position, wall.position);
      const dist = Math.abs(this._diff.dot(wall.normal));
      if (dist < bestDist) {
        bestDist = dist;
        bestWall = wall;
      }
    }

    if (!bestWall) return null;

    // Snap point: project position onto the wall plane
    this._diff.subVectors(position, bestWall.position);
    const signedDist = this._diff.dot(bestWall.normal);
    const snappedPosition = position
      .clone()
      .addScaledVector(bestWall.normal, -signedDist);

    return {
      wallPosition: snappedPosition,
      wallNormal: bestWall.normal.clone(),
      distance: bestDist,
    };
  }

  /**
   * Get the wall plane the camera is currently looking at, if any.
   * Used by HitTestManager to determine if the reticle should show on a wall.
   */
  getVerticalPlanes(): DetectedPlane[] {
    return this.verticalPlanes;
  }

  /** True if at least one vertical plane has been detected. */
  hasWalls(): boolean {
    return this.verticalPlanes.length > 0;
  }

  /** True if the device supports plane detection. */
  isSupported(): boolean {
    return this.supported;
  }

  /** Number of total detected planes (all orientations). */
  getPlaneCount(): number {
    return this.planes.size;
  }

  dispose(): void {
    this.planes.clear();
    this.verticalPlanes.length = 0;
  }
}
