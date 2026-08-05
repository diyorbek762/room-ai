import * as THREE from "three";
import type { PlacedModel } from "./ObjectPlacer";

export interface CollisionResult {
  position: THREE.Vector3;
  collidedIds: string[];
}

const GAP = 0.01; // 1cm minimum separation

export class CollisionResolver {
  private scratchBox = new THREE.Box3();
  private scratchCenter = new THREE.Vector3();
  private scratchOther = new THREE.Box3();
  private result = new THREE.Vector3();

  /**
   * Given a dragged object, a candidate position, and all other placed objects,
   * return a position that slides around obstacles on the XZ plane (floor
   * dragging) while keeping a 1cm gap. Y-overlap is checked so tall objects
   * above/below the dragged object don't block it.
   */
  resolveFloorDrag(
    dragged: PlacedModel,
    candidatePos: THREE.Vector3,
    others: PlacedModel[]
  ): CollisionResult {
    const candidate = this.scratchBox.copy(dragged.boundingBox);
    const center = dragged.boundingBox.getCenter(this.scratchCenter);
    const offset = this.result.subVectors(candidatePos, center);
    candidate.translate(offset);

    const collidedIds: string[] = [];

    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const other of others) {
        if (other.id === dragged.id) continue;
        // Only collide with objects on the same vertical band (Y overlap > 1cm).
        this.scratchOther.copy(other.boundingBox);
        const yOverlap = this.yOverlap(candidate, this.scratchOther);
        if (yOverlap <= GAP) continue;

        const penetration = this.xzPenetration(candidate, this.scratchOther);
        if (penetration.x <= 0 || penetration.z <= 0) continue;

        if (!collidedIds.includes(other.id)) {
          collidedIds.push(other.id);
        }

        // Push out along the axis of least penetration.
        const pushX = penetration.x + GAP;
        const pushZ = penetration.z + GAP;
        if (pushX < pushZ) {
          const dir = candidate.max.x > this.scratchOther.max.x ? 1 : -1;
          candidate.translate(new THREE.Vector3(dir * pushX, 0, 0));
        } else {
          const dir = candidate.max.z > this.scratchOther.max.z ? 1 : -1;
          candidate.translate(new THREE.Vector3(0, 0, dir * pushZ));
        }
        moved = true;
      }
      if (!moved) break;
    }

    return {
      position: candidate.getCenter(this.result),
      collidedIds,
    };
  }

  /**
   * Check if placing a new object (box at candidate position) would intersect
   * any existing object. Used for the reticle pre-check.
   */
  wouldCollide(
    box: THREE.Box3,
    candidatePos: THREE.Vector3,
    others: PlacedModel[]
  ): string[] {
    const candidate = this.scratchBox.copy(box);
    const center = box.getCenter(this.scratchCenter);
    const offset = this.result.subVectors(candidatePos, center);
    candidate.translate(offset);

    const collidedIds: string[] = [];
    for (const other of others) {
      this.scratchOther.copy(other.boundingBox);
      const yOverlap = this.yOverlap(candidate, this.scratchOther);
      if (yOverlap <= GAP) continue;
      const penetration = this.xzPenetration(candidate, this.scratchOther);
      if (penetration.x > 0 && penetration.z > 0) {
        collidedIds.push(other.id);
      }
    }
    return collidedIds;
  }

  private yOverlap(a: THREE.Box3, b: THREE.Box3): number {
    return Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y));
  }

  private xzPenetration(a: THREE.Box3, b: THREE.Box3): { x: number; z: number } {
    const x = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const z = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
    return { x, z };
  }
}
