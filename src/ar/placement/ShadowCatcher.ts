import * as THREE from "three";

/**
 * A large invisible plane that only receives dynamic shadows from the
 * directional light. Combined with the baked contact-shadow blob, this gives
 * the IKEA-style look: soft ambient occlusion + sharp directional shadow.
 */
export class ShadowCatcher {
  private mesh: THREE.Mesh;
  private currentY = 0;
  private readonly threshold = 0.02;

  constructor(scene: THREE.Scene, size = 12) {
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.ShadowMaterial({
      opacity: 0.35,
      transparent: true,
    });
    // Prevent z-fighting with the baked contact shadow planes (renderOrder 1, depthWrite false)
    material.polygonOffset = true;
    material.polygonOffsetFactor = 1;
    material.polygonOffsetUnits = 1;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = this.currentY;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 0;
    scene.add(this.mesh);
  }

  /**
   * Move the catcher to the detected floor height. If no floor plane has been
   * detected yet, the local-floor reference space gives us y≈0, which is a
   * reasonable default.
   */
  update(floorY: number): void {
    if (Math.abs(floorY - this.currentY) > this.threshold) {
      this.currentY = floorY;
      this.mesh.position.y = floorY;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
