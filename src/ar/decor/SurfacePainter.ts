import * as THREE from "three";
import type { SurfaceMaterialPreset } from "./surfacePresets";

export class SurfacePainter {
  private scene: THREE.Scene;
  private floorMesh: THREE.Mesh | null = null;
  private currentFloorPreset: SurfaceMaterialPreset | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Update the floor surface mesh matching the 4-corner floor perimeter.
   */
  updateFloorSurface(corners: THREE.Vector3Tuple[], preset: SurfaceMaterialPreset | null): void {
    this.currentFloorPreset = preset;

    if (!preset || corners.length < 3) {
      if (this.floorMesh) {
        this.scene.remove(this.floorMesh);
        this.floorMesh.geometry.dispose();
        (this.floorMesh.material as THREE.Material).dispose();
        this.floorMesh = null;
      }
      return;
    }

    const shape = new THREE.Shape();
    // Build 2D shape in X-Z space
    shape.moveTo(corners[0][0], -corners[0][2]);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i][0], -corners[i][2]);
    }
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    // Rotate ShapeGeometry so it lies flat on the horizontal X-Z floor plane
    geometry.rotateX(-Math.PI / 2);

    const material = this.createPBRMaterial(preset);

    if (this.floorMesh) {
      this.floorMesh.geometry.dispose();
      (this.floorMesh.material as THREE.Material).dispose();
      this.floorMesh.geometry = geometry;
      this.floorMesh.material = material;
    } else {
      this.floorMesh = new THREE.Mesh(geometry, material);
      // Ensure floor mesh renders behind 3D furniture models
      this.floorMesh.renderOrder = 1;
      this.floorMesh.receiveShadow = true;
      this.scene.add(this.floorMesh);
    }

    // Set position Y slightly above floor plane to prevent z-fighting with raw floor plane
    const avgY = corners.reduce((sum, c) => sum + c[1], 0) / corners.length;
    this.floorMesh.position.y = avgY + 0.002;
  }

  /**
   * Create PBR material for wallpaper (aboy), wall paint, or parquet floor.
   */
  private createPBRMaterial(preset: SurfaceMaterialPreset): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: preset.color ? new THREE.Color(preset.color) : 0xffffff,
      roughness: preset.roughness,
      metalness: preset.metalness,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
      transparent: true,
      opacity: 0.7,
    });

    return mat;
  }

  /**
   * Remove and dispose of all surface meshes.
   */
  dispose(): void {
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      (this.floorMesh.material as THREE.Material).dispose();
      this.floorMesh = null;
    }
  }
}

