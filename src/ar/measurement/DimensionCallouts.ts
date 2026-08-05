import * as THREE from "three";

export interface CalloutAnchors {
  w: THREE.Vector3;
  d: THREE.Vector3;
  h: THREE.Vector3;
}

export class DimensionCallouts {
  private scene: THREE.Scene;
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshBasicMaterial;
  private lines: THREE.Mesh[] = [];
  private ticks: THREE.Mesh[] = [];
  private visible = false;

  private readonly offset = 0.06;
  private readonly tickLen = 0.04;

  private _box = new THREE.Box3();
  private _size = new THREE.Vector3();
  private _anchorW = new THREE.Vector3();
  private _anchorD = new THREE.Vector3();
  private _anchorH = new THREE.Vector3();
  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private _dir = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.CylinderGeometry(0.003, 0.003, 1, 6);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(this.geometry, this.material);
      line.renderOrder = 100;
      this.lines.push(line);
      this.scene.add(line);
    }
    for (let i = 0; i < 6; i++) {
      const tick = new THREE.Mesh(this.geometry, this.material);
      tick.renderOrder = 100;
      this.ticks.push(tick);
      this.scene.add(tick);
    }

    this.hide();
  }

  show(box: THREE.Box3): void {
    this.visible = true;
    this.update(box);
    for (const m of this.lines) m.visible = true;
    for (const m of this.ticks) m.visible = true;
  }

  update(box: THREE.Box3): void {
    this._box.copy(box);
    this._box.getSize(this._size);
    const min = this._box.min;
    const max = this._box.max;
    const o = this.offset;

    // Width line along X
    this.setLine(
      this.lines[0],
      this._a.set(min.x, min.y, min.z - o),
      this._b.set(max.x, min.y, min.z - o)
    );
    // Depth line along Z
    this.setLine(
      this.lines[1],
      this._a.set(min.x - o, min.y, min.z),
      this._b.set(min.x - o, min.y, max.z)
    );
    // Height line along Y
    this.setLine(
      this.lines[2],
      this._a.set(max.x + o, min.y, max.z + o),
      this._b.set(max.x + o, max.y, max.z + o)
    );

    // Ticks at each end of the dimension lines
    this.setTick(this.ticks[0], this._a.set(min.x, min.y, min.z - o), this._dir.set(0, 0, 1));
    this.setTick(this.ticks[1], this._a.set(max.x, min.y, min.z - o), this._dir.set(0, 0, 1));
    this.setTick(this.ticks[2], this._a.set(min.x - o, min.y, min.z), this._dir.set(1, 0, 0));
    this.setTick(this.ticks[3], this._a.set(min.x - o, min.y, max.z), this._dir.set(1, 0, 0));
    this.setTick(this.ticks[4], this._a.set(max.x + o, min.y, max.z + o), this._dir.set(1, 0, 0));
    this.setTick(this.ticks[5], this._a.set(max.x + o, max.y, max.z + o), this._dir.set(1, 0, 0));

    // Midpoints for DOM label anchors
    this._anchorW.set((min.x + max.x) * 0.5, min.y, min.z - o);
    this._anchorD.set(min.x - o, min.y, (min.z + max.z) * 0.5);
    this._anchorH.set(max.x + o, (min.y + max.y) * 0.5, max.z + o);
  }

  private setLine(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    this._dir.subVectors(b, a);
    const len = this._dir.length();
    mesh.scale.set(1, len, 1);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(this._up, this._dir.normalize());
  }

  private setTick(mesh: THREE.Mesh, center: THREE.Vector3, axis: THREE.Vector3): void {
    mesh.scale.set(1, this.tickLen, 1);
    mesh.position.copy(center);
    mesh.quaternion.setFromUnitVectors(this._up, axis.normalize());
  }

  hide(): void {
    this.visible = false;
    for (const m of this.lines) m.visible = false;
    for (const m of this.ticks) m.visible = false;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getAnchors(out: CalloutAnchors): boolean {
    if (!this.visible) return false;
    out.w.copy(this._anchorW);
    out.d.copy(this._anchorD);
    out.h.copy(this._anchorH);
    return true;
  }

  dispose(): void {
    for (const m of this.lines) this.scene.remove(m);
    for (const m of this.ticks) this.scene.remove(m);
    this.geometry.dispose();
    this.material.dispose();
    this.lines = [];
    this.ticks = [];
  }
}
