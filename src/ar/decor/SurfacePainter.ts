import * as THREE from "three";
import type { SurfaceMaterialPreset } from "./surfacePresets";

export class SurfacePainter {
  private scene: THREE.Scene;
  private floorMesh: THREE.Mesh | null = null;
  private wallMeshes: THREE.Mesh[] = [];

  private currentFloorPreset: SurfaceMaterialPreset | null = null;
  private currentWallPreset: SurfaceMaterialPreset | null = null;

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
   * Update 3D vertical wall meshes based on perimeter corners and wall height.
   */
  updateWallSurfaces(corners: THREE.Vector3Tuple[], wallHeight: number, preset: SurfaceMaterialPreset | null): void {
    this.currentWallPreset = preset;

    // Clear existing wall meshes
    for (const mesh of this.wallMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.wallMeshes.length = 0;

    if (!preset || corners.length < 3 || wallHeight <= 0) {
      return;
    }

    const n = corners.length;
    for (let i = 0; i < n; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % n];

      const dx = p2[0] - p1[0];
      const dz = p2[2] - p1[2];
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;

      const geometry = new THREE.PlaneGeometry(length, wallHeight);
      const material = this.createPBRMaterial(preset);

      const wallMesh = new THREE.Mesh(geometry, material);
      wallMesh.renderOrder = 1;
      wallMesh.receiveShadow = true;

      // Position center of wall quad at midpoint X/Z and Y = base + height/2
      const midX = (p1[0] + p2[0]) / 2;
      const midY = (p1[1] + p2[1]) / 2;
      const midZ = (p1[2] + p2[2]) / 2;

      wallMesh.position.set(midX, midY + wallHeight / 2, midZ);

      // Rotate plane to align along line p1 -> p2
      const angle = Math.atan2(dx, dz);
      wallMesh.rotation.y = angle + Math.PI / 2;

      this.scene.add(wallMesh);
      this.wallMeshes.push(wallMesh);
    }
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

    for (const mesh of this.wallMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.wallMeshes.length = 0;
  }
}

