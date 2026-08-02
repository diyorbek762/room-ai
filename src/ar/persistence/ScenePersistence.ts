import { openDB, type IDBPDatabase } from "idb";
import type { SerializedScene } from "./SceneSerializer";

const DB_NAME = "roomai-scenes";
const STORE_NAME = "scenes";
const DB_VERSION = 1;

export interface SceneSlot {
  name: string;
  scene: SerializedScene;
  savedAt: string;
}

export class ScenePersistence {
  private db: IDBPDatabase | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 500;

  async init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "name" });
        }
      },
    });
  }

  async saveScene(name: string, scene: SerializedScene): Promise<void> {
    if (!this.db) await this.init();

    const slot: SceneSlot = {
      name,
      scene,
      savedAt: new Date().toISOString(),
    };

    await this.db!.put(STORE_NAME, slot);
  }

  async loadScene(name: string): Promise<SerializedScene | null> {
    if (!this.db) await this.init();

    const slot = await this.db!.get(STORE_NAME, name);
    return slot ? slot.scene : null;
  }

  async listScenes(): Promise<{ name: string; savedAt: string }[]> {
    if (!this.db) await this.init();

    const slots = await this.db!.getAll(STORE_NAME);
    return slots.map((s: SceneSlot) => ({ name: s.name, savedAt: s.savedAt }));
  }

  async deleteScene(name: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete(STORE_NAME, name);
  }

  autoSave(name: string, scene: SerializedScene): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.saveScene(name, scene).catch(console.error);
    }, this.DEBOUNCE_MS);
  }

  async saveToLocalStorage(key: string, scene: SerializedScene): Promise<void> {
    try {
      const json = JSON.stringify(scene);
      localStorage.setItem(key, json);
    } catch {
      console.warn("Failed to save to localStorage");
    }
  }

  loadFromLocalStorage(key: string): SerializedScene | null {
    try {
      const json = localStorage.getItem(key);
      if (!json) return null;
      return JSON.parse(json) as SerializedScene;
    } catch {
      return null;
    }
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
