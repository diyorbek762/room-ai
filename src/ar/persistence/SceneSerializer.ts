import * as THREE from "three";
import type { ObjectPlacer } from "../placement/ObjectPlacer";

export interface SerializedObject {
  id: string;
  productId: string;
  modelUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface SerializedScene {
  version: number;
  createdAt: string;
  objects: SerializedObject[];
}

export class SceneSerializer {
  private readonly VERSION = 1;

  serialize(
    placer: ObjectPlacer,
    modelUrls: Map<string, string>
  ): SerializedScene {
    const models = placer.getAllPlacedModels();
    const objects: SerializedObject[] = models.map((m) => ({
      id: m.id,
      productId: m.productId,
      modelUrl: modelUrls.get(m.id) || "",
      position: [
        m.model.position.x,
        m.model.position.y,
        m.model.position.z,
      ],
      rotation: [
        m.model.rotation.x,
        m.model.rotation.y,
        m.model.rotation.z,
      ],
      scale: [
        m.model.scale.x,
        m.model.scale.y,
        m.model.scale.z,
      ],
    }));

    return {
      version: this.VERSION,
      createdAt: new Date().toISOString(),
      objects,
    };
  }

  toJSON(scene: SerializedScene): string {
    return JSON.stringify(scene, null, 2);
  }

  fromJSON(json: string): SerializedScene | null {
    try {
      const parsed = JSON.parse(json) as SerializedScene;
      if (parsed.version !== this.VERSION) {
        console.warn("Scene version mismatch, attempting migration");
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async restoreScene(
    scene: SerializedScene,
    placer: ObjectPlacer
  ): Promise<void> {
    placer.clearAll();

    for (const obj of scene.objects) {
      const position = new THREE.Vector3(...obj.position);
      const euler = new THREE.Euler(...obj.rotation);
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      const scale = new THREE.Vector3(...obj.scale);

      await placer.placeObject(
        obj.id,
        obj.productId,
        obj.modelUrl,
        position,
        quaternion,
        scale
      );
    }
  }
}
