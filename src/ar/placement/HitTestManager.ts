import * as THREE from "three";
import type { PlaneManager } from "./PlaneManager";

export class HitTestManager {
  private hitTestSource: XRHitTestSource | null = null;
  private reticle: THREE.Group;
  private reticleRing: THREE.Mesh;
  private reticleInnerRing: THREE.Mesh;
  private reticleDot: THREE.Mesh;
  private reticleVisible: boolean = false;
  private surfaceDetected: boolean = false;
  private hitPose: THREE.Matrix4 = new THREE.Matrix4();
  private _scratchQuat: THREE.Quaternion = new THREE.Quaternion();
  private _scratchPos: THREE.Vector3 = new THREE.Vector3();
  private _scratchHitQuat: THREE.Quaternion = new THREE.Quaternion();
  private _scratchHitPos: THREE.Vector3 = new THREE.Vector3();
  private lastDetectionTime: number = 0;
  private framesWithoutDetection: number = 0;
  private lastHitTestResult: XRHitTestResult | null = null;

  // Wall hit-test state
  private planeManager: PlaneManager | null = null;
  private aimingAtWall = false;
  private wallHitNormal = new THREE.Vector3();
  private wallHitPosition = new THREE.Vector3();

  // Colors
  private static readonly FLOOR_COLOR = 0x10b981; // emerald
  private static readonly WALL_COLOR = 0x3b82f6;  // blue
  private static readonly INVALID_COLOR = 0xef4444; // red — invalid surface

  constructor(scene: THREE.Scene) {
    const { group, ring, innerRing, dot } = this.createReticle();
    this.reticle = group;
    this.reticleRing = ring;
    this.reticleInnerRing = innerRing;
    this.reticleDot = dot;
    this.reticle.visible = false;
    scene.add(this.reticle);
  }

  /** Attach a PlaneManager for wall-aware hit testing. Optional. */
  setPlaneManager(pm: PlaneManager): void {
    this.planeManager = pm;
  }

  private createReticle(): {
    group: THREE.Group;
    ring: THREE.Mesh;
    innerRing: THREE.Mesh;
    dot: THREE.Mesh;
  } {
    const group = new THREE.Group();

    // Outer ring — larger, more visible
    const ringGeometry = new THREE.RingGeometry(0.12, 0.15, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: HitTestManager.FLOOR_COLOR,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    // Inner ring for depth perception
    const innerRingGeometry = new THREE.RingGeometry(0.05, 0.06, 32);
    const innerRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.001;
    group.add(innerRing);

    // Center dot
    const dotGeometry = new THREE.CircleGeometry(0.02, 24);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: HitTestManager.FLOOR_COLOR,
      side: THREE.DoubleSide,
    });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.y = 0.002;
    group.add(dot);

    return { group, ring, innerRing, dot };
  }

  async initHitTest(
    session: XRSession,
    _referenceSpace: XRReferenceSpace
  ): Promise<boolean> {
    // Try multiple reference spaces for best device compatibility
    const spaces = ["viewer", "local", "local-floor"];
    
    for (const spaceType of spaces) {
      try {
        const space = await session.requestReferenceSpace(spaceType);
        const source = await session.requestHitTestSource!({ space });
        if (source) {
          this.hitTestSource = source;
          return true;
        }
      } catch {
        // Try next space
      }
    }
    
    return false;
  }

  update(frame: XRFrame, referenceSpace: XRReferenceSpace): boolean {
    if (!this.hitTestSource) return false;

    const hitTestResults = frame.getHitTestResults(this.hitTestSource);

    if (hitTestResults.length > 0) {
      const hit = hitTestResults[0];
      this.lastHitTestResult = hit;
      const pose = hit.getPose(referenceSpace);

      if (pose) {
        this.hitPose.fromArray(pose.transform.matrix);
        this.reticle.position.setFromMatrixPosition(this.hitPose);

        this._scratchQuat.setFromRotationMatrix(this.hitPose);
        this.reticle.quaternion.copy(this._scratchQuat);

        // Determine if we're aiming at a wall via PlaneManager
        this.aimingAtWall = false;
        if (this.planeManager && this.planeManager.hasWalls()) {
          const hitPos = this.reticle.position;
          // Extract the hit normal from the pose (local Y-axis)
          const hitNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(this._scratchQuat);
          // If the hit normal is mostly horizontal → we're hitting a wall
          if (Math.abs(hitNormal.y) < 0.5) {
            this.aimingAtWall = true;
            this.wallHitNormal.copy(hitNormal);
            this.wallHitPosition.copy(hitPos);
          }
        }

        // Tint the reticle based on surface type
        this.updateReticleAppearance();

        this.reticle.visible = true;
        this.reticleVisible = true;
        this.surfaceDetected = true;
        this.framesWithoutDetection = 0;
        this.lastDetectionTime = performance.now();

        const time = frame.predictedDisplayTime;
        const pulse = Math.sin(time * 0.003) * 0.1 + 1.0;
        this.reticle.scale.setScalar(pulse);

        return true;
      }
    }

    // No detection this frame
    this.framesWithoutDetection++;
    
    // Keep reticle visible for 30 frames (~0.5s) after last detection
    if (this.framesWithoutDetection > 30) {
      this.reticle.visible = false;
      this.reticleVisible = false;
    }

    return false;
  }

  private updateReticleAppearance(): void {
    let color: number;
    if (this.aimingAtWall) {
      color = HitTestManager.WALL_COLOR;
    } else {
      // Check if this is a valid floor surface
      const hitNormal = this.getHitNormal();
      const hitPos = this.getHitPosition();
      if (this.planeManager && !this.planeManager.isValidFloorPosition(hitPos, hitNormal)) {
        color = HitTestManager.INVALID_COLOR;
      } else {
        color = HitTestManager.FLOOR_COLOR;
      }
    }
    (this.reticleRing.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.reticleDot.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  getHitPosition(): THREE.Vector3 {
    return this._scratchHitPos.setFromMatrixPosition(this.hitPose);
  }

  getHitQuaternion(): THREE.Quaternion {
    return this._scratchHitQuat.setFromRotationMatrix(this.hitPose);
  }

  /** Get the surface normal of the current hit (derived from the hit pose's local Y-axis). */
  getHitNormal(): THREE.Vector3 {
    const quat = this._scratchHitQuat.setFromRotationMatrix(this.hitPose);
    return new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  }

  getHitMatrix(): THREE.Matrix4 {
    return this.hitPose.clone();
  }

  /** True when the current hit result is on a vertical surface (wall). */
  isAimingAtWall(): boolean {
    return this.aimingAtWall;
  }

  /** Get the wall surface position (only valid when isAimingAtWall() === true). */
  getWallHitPosition(): THREE.Vector3 {
    return this.wallHitPosition.clone();
  }

  /** Get the wall outward normal (only valid when isAimingAtWall() === true). */
  getWallHitNormal(): THREE.Vector3 {
    return this.wallHitNormal.clone();
  }

  isReticleVisible(): boolean {
    return this.reticleVisible;
  }

  getLastHitTestResult(): XRHitTestResult | null {
    return this.lastHitTestResult;
  }

  hasEverDetected(): boolean {
    return this.surfaceDetected;
  }

  getTimeSinceLastDetection(): number {
    if (!this.surfaceDetected) return Infinity;
    return (performance.now() - this.lastDetectionTime) / 1000;
  }

  setReticleVisible(visible: boolean): void {
    this.reticle.visible = visible && this.reticleVisible;
  }

  getReticle(): THREE.Group {
    return this.reticle;
  }

  dispose(): void {
    this.reticle.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    this.hitTestSource = null;
    this.planeManager = null;
  }
}

