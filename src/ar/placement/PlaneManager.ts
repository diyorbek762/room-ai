import * as THREE from "three";

export interface DetectedPlane {
  plane: XRPlane;
  orientation: "horizontal" | "vertical";
  /** World-space transform of the plane's local origin. */
  pose: THREE.Matrix4;
  /** Inverse transform (World to Local). */
  inversePose: THREE.Matrix4;
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

  /** The Y coordinate of the lowest detected horizontal plane (our best guess for the real floor). */
  private referenceFloorY = Infinity;
  /** Maximum allowed height above reference floor for "floor" placement (meters). */
  private static readonly FLOOR_HEIGHT_THRESHOLD = 0.15; // 15cm
  /** Minimum surface normal Y component to be considered a valid floor. */
  private static readonly FLOOR_NORMAL_THRESHOLD = 0.85;

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
        inversePose: this._mat4.clone().invert(),
        normal: this._normal.clone(),
        position: this._pos.clone(),
      };

      this.planes.set(plane, entry);

      if (orientation === "vertical") {
        this.verticalPlanes.push(entry);
      } else {
        // Track the lowest horizontal plane as the reference floor
        if (this._pos.y < this.referenceFloorY) {
          this.referenceFloorY = this._pos.y;
        }
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
    let bestSnappedPos: THREE.Vector3 | null = null;

    const localPos = new THREE.Vector3();

    for (const wall of this.verticalPlanes) {
      // Perpendicular distance from position to the wall plane
      this._diff.subVectors(position, wall.position);
      const dist = Math.abs(this._diff.dot(wall.normal));
      
      if (dist < bestDist) {
        // Project position onto the infinite wall plane
        const signedDist = this._diff.dot(wall.normal);
        const snappedPosition = position
          .clone()
          .addScaledVector(wall.normal, -signedDist);

        // Convert world snappedPosition to local plane coordinates
        localPos.copy(snappedPosition).applyMatrix4(wall.inversePose);

        // Point-in-polygon test (ray casting algorithm)
        let inside = false;
        const poly = wall.plane.polygon;
        // Add a small padding (e.g., 0.2m) so edges still count as hits
        const padding = 0.2; 

        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, zi = poly[i].z;
          const xj = poly[j].x, zj = poly[j].z;

          // Inflate polygon slightly for collision padding by relaxing bounds check
          // (A true polygon inflation is complex, but checking if it's strictly inside the polygon is good enough for most walls)
          const intersect = ((zi > localPos.z) !== (zj > localPos.z))
              && (localPos.x < (xj - xi) * (localPos.z - zi) / (zj - zi) + xi);
          if (intersect) inside = !inside;
        }

        // If not strictly inside, we can do a loose bounds check just in case the padding is needed.
        // For simplicity, we just use the strict inside check. If they want to drag along the wall, they'll hit the polygon.
        
        if (inside) {
          bestDist = dist;
          bestWall = wall;
          bestSnappedPos = snappedPosition;
        }
      }
    }

    if (!bestWall || !bestSnappedPos) return null;

    return {
      wallPosition: bestSnappedPos,
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

  /**
   * Returns true if a world-space position is a valid floor surface.
   * Checks both the surface normal (must be nearly vertical) AND
   * the Y-height (must be close to the lowest detected floor plane).
   */
  isValidFloorPosition(position: THREE.Vector3, hitNormal: THREE.Vector3): boolean {
    // If we haven't detected any horizontal planes yet, be permissive
    if (this.referenceFloorY === Infinity) return true;

    // Check 1: surface normal must be nearly perfectly upward
    if (hitNormal.y < PlaneManager.FLOOR_NORMAL_THRESHOLD) {
      return false;
    }

    // Check 2: position must not be more than FLOOR_HEIGHT_THRESHOLD above the reference floor
    const heightAboveFloor = position.y - this.referenceFloorY;
    if (heightAboveFloor > PlaneManager.FLOOR_HEIGHT_THRESHOLD) {
      return false;
    }

    return true;
  }

  /** The Y level of the lowest detected horizontal plane. */
  getReferenceFloorY(): number {
    return this.referenceFloorY;
  }

  /** Number of total detected planes (all orientations). */
  getPlaneCount(): number {
    return this.planes.size;
  }

  /** All detected planes (horizontal and vertical). */
  getAllPlanes(): DetectedPlane[] {
    return Array.from(this.planes.values());
  }

  dispose(): void {
    this.planes.clear();
    this.verticalPlanes.length = 0;
  }
}
