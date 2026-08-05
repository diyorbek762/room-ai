import * as THREE from "three";
import type { Vector3Tuple } from "three";

const UP = new THREE.Vector3(0, 1, 0);
const FLOOR_RAISE = 0.01;

const MARKER_RADIUS = 0.05;
const LASER_RADIUS = 0.006;
const POLE_RADIUS = 0.006;
const POLE_HEIGHT = 0.25;

export class MeasurementVisualizer {
  private scene: THREE.Scene;
  private group: THREE.Group;

  private markerGeometry: THREE.SphereGeometry;
  private poleGeometry: THREE.CylinderGeometry;
  private laserGeometry: THREE.CylinderGeometry;
  private dotGeometry: THREE.SphereGeometry;

  private markerMaterial: THREE.MeshBasicMaterial;
  private laserMaterial: THREE.MeshBasicMaterial;
  private previewLaserMaterial: THREE.MeshBasicMaterial;
  private previewDotMaterial: THREE.MeshBasicMaterial;

  private markers: THREE.Mesh[] = [];
  private edges: THREE.Mesh[] = [];
  private previewLine: THREE.Mesh | null = null;
  private previewDot: THREE.Mesh | null = null;

  private corners: Vector3Tuple[] = [];
  private closed = false;

  private _scratchA = new THREE.Vector3();
  private _scratchB = new THREE.Vector3();
  private _scratchDir = new THREE.Vector3();
  private _scratchMid = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.markerGeometry = new THREE.SphereGeometry(MARKER_RADIUS, 16, 12);
    this.poleGeometry = new THREE.CylinderGeometry(POLE_RADIUS, POLE_RADIUS, 1, 8);
    this.laserGeometry = new THREE.CylinderGeometry(LASER_RADIUS, LASER_RADIUS, 1, 8);
    this.dotGeometry = new THREE.SphereGeometry(0.025, 12, 8);

    this.markerMaterial = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.laserMaterial = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    this.previewLaserMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.45,
    });
    this.previewDotMaterial = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.6,
    });

    this.group = new THREE.Group();
    this.group.renderOrder = 5;
    this.scene.add(this.group);
  }

  setCorners(corners: Vector3Tuple[]): void {
    this.corners = corners.map((c) => [c[0], c[1], c[2]]);
    this.rebuild();
  }

  setClosed(closed: boolean): void {
    this.closed = closed;
    this.rebuild();
  }

  /**
   * Update the live rubber-band preview from the last captured corner to the
   * current hit-test position. Pass null to hide it.
   */
  setPreview(from: Vector3Tuple | null, to: THREE.Vector3 | null): void {
    if (!from || !to) {
      if (this.previewLine) this.previewLine.visible = false;
      if (this.previewDot) this.previewDot.visible = false;
      return;
    }

    if (!this.previewLine || !this.previewDot) {
      this.previewLine = new THREE.Mesh(this.laserGeometry, this.previewLaserMaterial);
      this.previewDot = new THREE.Mesh(this.dotGeometry, this.previewDotMaterial);
      this.group.add(this.previewLine);
      this.group.add(this.previewDot);
    }

    const line = this.previewLine;
    const dot = this.previewDot;
    line.visible = true;
    dot.visible = true;

    this._scratchA.set(from[0], from[1] + FLOOR_RAISE, from[2]);
    this._scratchB.set(to.x, to.y + FLOOR_RAISE, to.z);

    this.layLaser(line, this._scratchA, this._scratchB);
    dot.position.copy(this._scratchB);
  }

  clear(): void {
    this.corners = [];
    this.closed = false;
    this.rebuild();
    this.previewLine = null;
    this.previewDot = null;
  }

  dispose(): void {
    this.clear();
    this.markerGeometry.dispose();
    this.poleGeometry.dispose();
    this.laserGeometry.dispose();
    this.dotGeometry.dispose();
    this.markerMaterial.dispose();
    this.laserMaterial.dispose();
    this.previewLaserMaterial.dispose();
    this.previewDotMaterial.dispose();
    this.scene.remove(this.group);
  }

  private rebuild(): void {
    // Remove old markers and edges
    for (const mesh of this.markers) {
      this.group.remove(mesh);
    }
    for (const mesh of this.edges) {
      this.group.remove(mesh);
    }
    this.markers = [];
    this.edges = [];

    for (const c of this.corners) {
      this.addMarker(c);
    }

    for (let i = 0; i < this.corners.length - 1; i++) {
      this.addEdge(this.corners[i], this.corners[i + 1]);
    }

    if (this.closed && this.corners.length >= 4) {
      this.addEdge(this.corners[this.corners.length - 1], this.corners[0]);
    }
  }

  private addMarker(c: Vector3Tuple): void {
    const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
    marker.position.set(c[0], c[1] + FLOOR_RAISE, c[2]);
    this.group.add(marker);
    this.markers.push(marker);

    const pole = new THREE.Mesh(this.poleGeometry, this.markerMaterial);
    this.layLaser(
      pole,
      this._scratchA.set(c[0], c[1] + FLOOR_RAISE, c[2]),
      this._scratchB.set(c[0], c[1] + FLOOR_RAISE + POLE_HEIGHT, c[2])
    );
    this.group.add(pole);
    this.markers.push(pole);
  }

  private addEdge(a: Vector3Tuple, b: Vector3Tuple): void {
    const laser = new THREE.Mesh(this.laserGeometry, this.laserMaterial);
    this._scratchA.set(a[0], a[1] + FLOOR_RAISE, a[2]);
    this._scratchB.set(b[0], b[1] + FLOOR_RAISE, b[2]);
    this.layLaser(laser, this._scratchA, this._scratchB);
    this.group.add(laser);
    this.edges.push(laser);
  }

  private layLaser(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    this._scratchDir.subVectors(b, a);
    const length = this._scratchDir.length();
    this._scratchMid.addVectors(a, b).multiplyScalar(0.5);

    mesh.position.copy(this._scratchMid);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(UP, this._scratchDir.normalize());
  }
}
