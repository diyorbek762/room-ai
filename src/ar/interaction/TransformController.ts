import * as THREE from "three";
import type { ObjectPlacer, PlacedModel } from "../placement/ObjectPlacer";
import type { PlaneManager } from "../placement/PlaneManager";
import type { AnchorManager } from "../core/AnchorManager";
import type { ProductClass } from "@/types";
import { DimensionCallouts, type CalloutAnchors } from "../ui/DimensionCallouts";
import { CollisionResolver } from "../placement/CollisionResolver";

export interface GestureState {
  isDragging: boolean;
  isRotating: boolean;
  isScaling: boolean;
  lastTouchX: number;
  lastTouchY: number;
  lastPinchDist: number;
  lastTwistAngle: number;
}

export class TransformController {
  private placer: ObjectPlacer;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private planeManager: PlaneManager | null = null;
  private anchorManager: AnchorManager | null = null;
  private productClassResolver: ((productId: string) => ProductClass) | null = null;
  private raycaster: THREE.Raycaster;
  private floorPlane: THREE.Plane;
  private wallPlane: THREE.Plane = new THREE.Plane();
  private selectedId: string | null = null;
  private gestureState: GestureState;
  private highlightMesh: THREE.LineSegments | null = null;
  private highlightBaseSize: THREE.Vector3 = new THREE.Vector3();
  private highlightCenter: THREE.Vector3 = new THREE.Vector3();
  private highlightPulsePhase: number = 0;
  private scene: THREE.Scene;
  private callouts: DimensionCallouts;
  private collisionResolver = new CollisionResolver();
  private collisionActive = false;
  private gestureSnapshot: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
  } | null = null;

  // Reusable objects to avoid per-frame allocations
  private _mouse = new THREE.Vector2();
  private _intersection = new THREE.Vector3();
  private _size = new THREE.Vector3();
  private _center = new THREE.Vector3();
  private _projected = new THREE.Vector3();
  private _tempEuler = new THREE.Euler();
  private _deltaVec = new THREE.Vector3();
  private _newScale = new THREE.Vector3();

  private readonly MIN_SCALE = 0.3;
  private readonly MAX_SCALE = 3.0;
  private readonly ROTATE_SENSITIVITY = 0.01;
  private readonly NUDGE_STEP = 0.1; // meters per arrow tap
  private readonly SCALE_STEP = 1.1; // multiplicative per +/- tap

  constructor(
    placer: ObjectPlacer,
    renderer: THREE.WebGLRenderer,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene
  ) {
    this.placer = placer;
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;
    this.callouts = new DimensionCallouts(scene);
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.gestureState = {
      isDragging: false,
      isRotating: false,
      isScaling: false,
      lastTouchX: 0,
      lastTouchY: 0,
      lastPinchDist: 0,
      lastTwistAngle: 0,
    };
  }

  setPlaneManager(pm: PlaneManager): void {
    this.planeManager = pm;
  }

  setAnchorManager(am: AnchorManager): void {
    this.anchorManager = am;
  }

  setProductClassResolver(fn: (productId: string) => ProductClass): void {
    this.productClassResolver = fn;
  }

  isScaleLocked(): boolean {
    if (!this.selectedId || !this.productClassResolver) return false;
    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (!placedModel) return false;
    return this.productClassResolver(placedModel.productId) === "mass";
  }

  selectObject(id: string | null): void {
    if (id === this.selectedId) return;
    this.removeHighlight();
    this.selectedId = id;
    this.collisionActive = false;

    if (id) {
      const placedModel = this.placer.getPlacedModel(id);
      if (placedModel) {
        this.addHighlight(placedModel);
      }
    }
  }

  getSelectedId(): string | null {
    return this.selectedId;
  }

  getCalloutAnchors(out: CalloutAnchors): boolean {
    return this.callouts.getAnchors(out);
  }

  private getActiveCamera(): THREE.Camera {
    return this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera;
  }

  // Reusable arrays for raycast target collection (avoid per-tap allocation)
  private _meshTargets: THREE.Object3D[] = [];
  private _proxyTargets: THREE.Object3D[] = [];
  private _screenAABB = new THREE.Box2();

  /**
   * Cast a screen-space ray and find the topmost placed object under the cursor.
   * Priority: 1) actual visible mesh triangles, 2) tight hit proxy, 3) screen-space
   * fallback constrained to the model's projected AABB. This prevents the old
   * "fat finger" bug where a huge invisible proxy swallowed taps on empty floor.
   * Returns the model id or null if no object was hit.
   */
  hitTestObject(screenX: number, screenY: number): string | null {
    this._mouse.set(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );

    const camera = this.getActiveCamera();
    this.raycaster.setFromCamera(this._mouse, camera);
    const models = this.placer.getAllPlacedModels();
    if (models.length === 0) return null;

    // 1. Precise geometry raycast against visible meshes.
    this._meshTargets.length = 0;
    for (const placed of models) this._meshTargets.push(placed.model);
    const meshHits = this.raycaster.intersectObjects(this._meshTargets, true);
    if (meshHits.length > 0) {
      let obj: THREE.Object3D | null = meshHits[0].object;
      while (obj) {
        for (const placed of models) {
          if (placed.model === obj) return placed.id;
        }
        obj = obj.parent;
      }
    }

    // 2. Tight hit-proxy raycast.
    this._proxyTargets.length = 0;
    for (const placed of models) this._proxyTargets.push(placed.hitProxy);
    const proxyHits = this.raycaster.intersectObjects(this._proxyTargets, true);
    if (proxyHits.length > 0) {
      let obj: THREE.Object3D | null = proxyHits[0].object;
      while (obj) {
        for (const placed of models) {
          if (placed.hitProxy === obj) return placed.id;
        }
        obj = obj.parent;
      }
    }

    // 3. Screen-space fallback: tap must be inside the projected AABB and
    // closest to its center. Threshold tightened from 12% to 8%.
    return this.screenSpaceHitTest(screenX, screenY, camera, models);
  }

  /**
   * Project each placed model's bounding box to screen space. Only consider
   * taps that fall inside the 2D AABB, then pick the closest center. This
   * gives fat-finger forgiveness without selecting a neighbor when the user
   * taps empty floor to place a new object.
   */
  private screenSpaceHitTest(
    screenX: number,
    screenY: number,
    camera: THREE.Camera,
    models: PlacedModel[]
  ): string | null {
    if (models.length === 0) return null;

    // Threshold scales with screen size: ~8% of the smaller dimension
    const threshold = Math.min(window.innerWidth, window.innerHeight) * 0.08;

    let bestId: string | null = null;
    let bestDist = threshold;

    for (const placed of models) {
      // Build 2D screen-space AABB from the bounding box corners
      this._screenAABB.makeEmpty();
      const min = placed.boundingBox.min;
      const max = placed.boundingBox.max;
      for (let ix = 0; ix <= 1; ix++) {
        for (let iy = 0; iy <= 1; iy++) {
          for (let iz = 0; iz <= 1; iz++) {
            this._projected.set(
              ix ? max.x : min.x,
              iy ? max.y : min.y,
              iz ? max.z : min.z
            ).project(camera);
            if (this._projected.z > 1) continue;
            this._projected.x = (this._projected.x * 0.5 + 0.5) * window.innerWidth;
            this._projected.y = (-this._projected.y * 0.5 + 0.5) * window.innerHeight;
            this._screenAABB.expandByPoint(this._projected);
          }
        }
      }

      if (this._screenAABB.isEmpty()) continue;
      if (
        screenX < this._screenAABB.min.x ||
        screenX > this._screenAABB.max.x ||
        screenY < this._screenAABB.min.y ||
        screenY > this._screenAABB.max.y
      ) {
        continue;
      }

      const center = placed.boundingBox.getCenter(this._center).project(camera);
      if (center.z > 1) continue;
      const px = (center.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-center.y * 0.5 + 0.5) * window.innerHeight;
      const dx = px - screenX;
      const dy = py - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = placed.id;
      }
    }

    return bestId;
  }

  onDragStart(screenX: number, screenY: number): void {
    if (!this.selectedId) return;
    this.gestureState.isDragging = true;
    this.gestureState.lastTouchX = screenX;
    this.gestureState.lastTouchY = screenY;

    if (this.anchorManager) {
      this.anchorManager.deleteAnchor(this.selectedId);
    }
    
    // Update floor plane height to match the object's current height, 
    // so dragging feels mathematically accurate and doesn't drift.
    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (placedModel && placedModel.surfaceType !== "wall") {
      this.floorPlane.constant = -placedModel.model.position.y;
    }
  }

  onDragMove(screenX: number, screenY: number): void {
    if (!this.gestureState.isDragging || !this.selectedId) return;

    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (!placedModel) return;

    this._mouse.set(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(this._mouse, this.getActiveCamera());

    if (placedModel.surfaceType === "wall" && placedModel.wallNormal) {
      // Wall-mounted item: drag along the wall plane
      this.wallPlane.setFromNormalAndCoplanarPoint(
        placedModel.wallNormal,
        placedModel.model.position
      );
      
      const hit = this.raycaster.ray.intersectPlane(this.wallPlane, this._intersection);
      if (hit) {
        this.placer.updateTransform(this.selectedId, this._intersection);
        this.updateHighlightPosition(placedModel);
      }
    } else {
      // Floor item: drag along the floor plane
      const hit = this.raycaster.ray.intersectPlane(this.floorPlane, this._intersection);

      if (hit) {
        // Object-to-object collision: slide around other floor objects.
        const others = this.placer.getAllPlacedModels().filter((m) => m.id !== this.selectedId);
        const resolved = this.collisionResolver.resolveFloorDrag(
          placedModel,
          this._intersection,
          others,
          this.planeManager
        );
        const wasColliding = this.collisionActive;
        this.collisionActive = resolved.collidedIds.length > 0;
        if (!wasColliding && this.collisionActive) {
          try {
            navigator.vibrate?.(10);
          } catch {
            // ignore
          }
        }
        this.placer.updateTransform(this.selectedId, resolved.position);
        this.updateHighlightPosition(placedModel);
        this.setHighlightColor(this.collisionActive ? 0xef4444 : 0x10b981);
      }
    }

    this.gestureState.lastTouchX = screenX;
    this.gestureState.lastTouchY = screenY;
  }

  onDragEnd(): void {
    if (this.gestureState.isDragging && this.selectedId) {
       // Drag finished, recreate anchor at new pose
       if (this.anchorManager) {
         const placedModel = this.placer.getPlacedModel(this.selectedId);
         if (placedModel) {
           // We can't access `frame` directly here, but we can emit an event or let page.tsx handle it.
           // Actually, since TransformController doesn't have frame, it's easier to just flag it 
           // and have page.tsx re-anchor it on the next frame.
           // Or we pass `frame` and `refSpace` to `onDragEnd`? It's easier to set a flag on the model.
           placedModel.needsNewAnchor = true;
         }
       }
    }
    this.gestureState.isDragging = false;
  }

  onRotateStart(angle: number): void {
    if (!this.selectedId) return;
    this.gestureState.isRotating = true;
    this.gestureState.lastTwistAngle = angle;
    this.takeGestureSnapshot();
  }

  onRotateMove(angle: number): void {
    if (!this.gestureState.isRotating || !this.selectedId) return;

    const deltaAngle = angle - this.gestureState.lastTwistAngle;
    const placedModel = this.placer.getPlacedModel(this.selectedId);

    if (placedModel) {
      const currentRotation = placedModel.model.rotation.y;
      const newRotation = currentRotation + deltaAngle * this.ROTATE_SENSITIVITY;
      placedModel.model.rotation.y = newRotation;
      this.updateHighlightPosition(placedModel);
    }

    this.gestureState.lastTwistAngle = angle;
  }

  onRotateEnd(): void {
    this.gestureState.isRotating = false;
    this.resolveGestureCollision();
  }

  onScaleStart(distance: number): void {
    if (!this.selectedId || this.isScaleLocked()) return;
    this.gestureState.isScaling = true;
    this.gestureState.lastPinchDist = distance;
    this.takeGestureSnapshot();
  }

  onScaleMove(distance: number): void {
    if (!this.gestureState.isScaling || !this.selectedId || this.isScaleLocked()) return;

    const scaleFactor = distance / this.gestureState.lastPinchDist;
    const placedModel = this.placer.getPlacedModel(this.selectedId);

    if (placedModel) {
      const currentScale = placedModel.model.scale;
      this._newScale.set(
        THREE.MathUtils.clamp(currentScale.x * scaleFactor, this.MIN_SCALE, this.MAX_SCALE),
        THREE.MathUtils.clamp(currentScale.y * scaleFactor, this.MIN_SCALE, this.MAX_SCALE),
        THREE.MathUtils.clamp(currentScale.z * scaleFactor, this.MIN_SCALE, this.MAX_SCALE)
      );

      this.placer.updateTransform(this.selectedId, undefined, undefined, this._newScale);
      this.updateHighlightPosition(placedModel);
    }

    this.gestureState.lastPinchDist = distance;
  }

  onScaleEnd(): void {
    this.gestureState.isScaling = false;
    this.resolveGestureCollision();
  }

  private takeGestureSnapshot(): void {
    if (!this.selectedId) return;
    const placed = this.placer.getPlacedModel(this.selectedId);
    if (!placed) return;
    this.gestureSnapshot = {
      position: placed.model.position.clone(),
      rotation: placed.model.rotation.clone(),
      scale: placed.model.scale.clone(),
    };
  }

  private resolveGestureCollision(): void {
    if (!this.selectedId || !this.gestureSnapshot) return;
    const placed = this.placer.getPlacedModel(this.selectedId);
    if (!placed || placed.surfaceType === "wall") {
      this.gestureSnapshot = null;
      return;
    }
    // Update bounding box after rotation/scale before checking.
    this.placer.updateTransform(this.selectedId);
    const colliders = this.placer.wouldCollide(this.selectedId, placed.model.position);
    if (colliders.length > 0) {
      // Revert to pre-gesture transform and push out if possible.
      this.placer.updateTransform(
        this.selectedId,
        this.gestureSnapshot.position,
        this.gestureSnapshot.rotation,
        this.gestureSnapshot.scale
      );
      const resolved = this.collisionResolver.resolveFloorDrag(
        placed,
        placed.model.position,
        this.placer.getAllPlacedModels().filter((m) => m.id !== this.selectedId),
        this.planeManager
      );
      this.placer.updateTransform(this.selectedId, resolved.position);
      this.collisionActive = resolved.collidedIds.length > 0;
    } else {
      this.collisionActive = false;
    }
    this.setHighlightColor(this.collisionActive ? 0xef4444 : 0x10b981);
    this.updateHighlightPosition(placed);
    this.gestureSnapshot = null;
  }

  private setHighlightColor(colorHex: number): void {
    if (!this.highlightMesh) return;
    const mat = this.highlightMesh.material as THREE.LineDashedMaterial;
    mat.color.setHex(colorHex);
  }

  rotateSelectedByAngle(angleRad: number): void {
    if (!this.selectedId) return;
    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (placedModel) {
      placedModel.model.rotation.y += angleRad;
      this.updateHighlightPosition(placedModel);
    }
  }

  /**
   * Move the selected object by (dx, dz) meters on the floor plane.
   * No-op if nothing is selected.
   */
  nudgePosition(dx: number, dz: number): void {
    if (!this.selectedId) return;
    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (!placedModel) return;
    this._deltaVec.set(dx, 0, dz);
    placedModel.model.position.add(this._deltaVec);
    this.placer.updateTransform(this.selectedId, placedModel.model.position);
    this.updateHighlightPosition(placedModel);
  }

  /**
   * Scale the selected object by a multiplicative factor.
   * Clamped to [MIN_SCALE, MAX_SCALE].
   * Returns the actual scale factor applied (may differ from `factor` if clamped).
   */
  scaleBy(factor: number): number {
    if (!this.selectedId || this.isScaleLocked()) return 1;
    const placedModel = this.placer.getPlacedModel(this.selectedId);
    if (!placedModel) return 1;
    const current = placedModel.model.scale;
    const targetX = THREE.MathUtils.clamp(current.x * factor, this.MIN_SCALE, this.MAX_SCALE);
    const actualFactor = targetX / current.x;
    this._newScale.set(targetX, targetX, targetX);
    this.placer.updateTransform(this.selectedId, undefined, undefined, this._newScale);
    this.updateHighlightPosition(placedModel);
    return actualFactor;
  }

  /**
   * Deselect the current object. Keeps the object in the scene.
   */
  deselect(): void {
    this.removeHighlight();
    this.selectedId = null;
  }

  deleteSelected(): string | null {
    if (!this.selectedId) return null;
    const id = this.selectedId;
    this.removeHighlight();
    this.placer.removeObject(id);
    this.selectedId = null;
    return id;
  }

  /**
   * Update the pulsing animation of the highlight. Call from the render loop.
   * @param dtSec seconds since last frame
   */
  updateHighlightAnimation(dtSec: number): void {
    if (!this.highlightMesh) return;
    this.highlightPulsePhase += dtSec;
    const pulse = 1.08 + Math.sin(this.highlightPulsePhase * 4) * 0.04;
    this.highlightMesh.scale.set(
      this.highlightBaseSize.x * pulse,
      this.highlightBaseSize.y * pulse,
      this.highlightBaseSize.z * pulse
    );
  }

  private addHighlight(placedModel: PlacedModel): void {
    this.removeHighlight();

    const box = new THREE.Box3().setFromObject(placedModel.model);
    this.callouts.show(box);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.highlightBaseSize.copy(size);
    this.highlightCenter.copy(center);

    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineDashedMaterial({
      color: 0x10b981,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      dashSize: 0.06,
      gapSize: 0.04,
    });

    this.highlightMesh = new THREE.LineSegments(edges, material);
    this.highlightMesh.position.copy(center);
    this.highlightMesh.scale.set(size.x * 1.08, size.y * 1.08, size.z * 1.08);
    this.highlightMesh.computeLineDistances();
    this.scene.add(this.highlightMesh);
  }

  private updateHighlightPosition(placedModel: PlacedModel): void {
    if (!this.highlightMesh) return;

    const box = new THREE.Box3().setFromObject(placedModel.model);
    const center = box.getCenter(this._center);
    const size = box.getSize(this._size);

    this.highlightMesh.position.copy(center);
    this.highlightBaseSize.copy(size);
    this.highlightCenter.copy(center);
    this.callouts.update(box);
  }

  private removeHighlight(): void {
    this.callouts.hide();
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
      this.highlightMesh = null;
    }
  }

  dispose(): void {
    this.removeHighlight();
    this.callouts.dispose();
    this.selectedId = null;
  }
}
