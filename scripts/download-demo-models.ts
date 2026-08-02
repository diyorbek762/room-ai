import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("public", "models", "demo");
const THUMBNAIL_DIR = path.resolve("public", "thumbnails");

interface DownloadSource {
  filename: string;
  url: string;
  fallback: boolean;
}

const sources: DownloadSource[] = [
  {
    filename: "01-sofa-modern.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb",
    fallback: false,
  },
  {
    filename: "02-chair-accent.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb",
    fallback: false,
  },
  {
    filename: "03-chair-dining.glb",
    url: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    fallback: false,
  },
  {
    filename: "04-table-coffee.glb",
    url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb",
    fallback: false,
  },
  {
    filename: "05-table-dining.glb",
    url: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
    fallback: false,
  },
];

const PLACEHOLDER_GLB_MINIMAL = true;

async function downloadFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  Failed: ${res.status} ${res.statusText} for ${url}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    console.log(`  Downloaded: ${path.basename(dest)} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.warn(`  Error downloading ${url}:`, (err as Error).message);
    return false;
  }
}

function createPlaceholderGLB(dest: string, w: number, h: number, d: number, color: [number, number, number]): void {
  const gltfJson = {
    asset: { version: "2.0", generator: "RoomAI Placeholder Generator" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "PlaceholderBox" }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1 },
        indices: 2,
        material: 0,
      }],
    }],
    materials: [{
      pbrMetallicRoughness: {
        baseColorFactor: [color[0], color[1], color[2], 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.8,
      },
      name: "PlaceholderMaterial",
    }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        max: [w / 2, h, d / 2],
        min: [-w / 2, 0, -d / 2],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 24,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5123,
        count: 36,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 288 },
      { buffer: 0, byteOffset: 288, byteLength: 288 },
      { buffer: 0, byteOffset: 576, byteLength: 72 },
    ],
    buffers: [{ byteLength: 648 }],
  };

  const hw = w / 2;
  const hd = d / 2;

  const positions = new Float32Array([
    -hw,0,hd, hw,0,hd, hw,h,hd, -hw,h,hd,
    hw,0,-hd, -hw,0,-hd, -hw,h,-hd, hw,h,-hd,
    -hw,0,-hd, -hw,0,hd, -hw,h,hd, -hw,h,-hd,
    hw,0,hd, hw,0,-hd, hw,h,-hd, hw,h,hd,
    -hw,h,hd, hw,h,hd, hw,h,-hd, -hw,h,-hd,
    -hw,0,-hd, hw,0,-hd, hw,0,hd, -hw,0,hd,
  ]);

  const normals = new Float32Array([
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
  ]);

  const indices = new Uint16Array([
    0,1,2, 0,2,3,
    4,5,6, 4,6,7,
    8,9,10, 8,10,11,
    12,13,14, 12,14,15,
    16,17,18, 16,18,19,
    20,21,22, 20,22,23,
  ]);

  const binBuffer = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(normals.buffer),
    Buffer.from(indices.buffer),
  ]);

  const jsonStr = JSON.stringify(gltfJson);
  const jsonBuffer = Buffer.from(jsonStr, "utf8");
  const jsonPadded = Buffer.alloc(Math.ceil(jsonBuffer.length / 4) * 4, 0x20);
  jsonBuffer.copy(jsonPadded);

  const binPadded = Buffer.alloc(Math.ceil(binBuffer.length / 4) * 4, 0);
  binBuffer.copy(binPadded);

  const headerSize = 12;
  const jsonChunkHeaderSize = 8;
  const binChunkHeaderSize = 8;
  const totalLength = headerSize + jsonChunkHeaderSize + jsonPadded.length + binChunkHeaderSize + binPadded.length;

  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  glb.writeUInt32LE(0x46546C67, offset); offset += 4;
  glb.writeUInt32LE(2, offset); offset += 4;
  glb.writeUInt32LE(totalLength, offset); offset += 4;

  glb.writeUInt32LE(jsonPadded.length, offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4;
  jsonPadded.copy(glb, offset); offset += jsonPadded.length;

  glb.writeUInt32LE(binPadded.length, offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4;
  binPadded.copy(glb, offset);

  fs.writeFileSync(dest, glb);
  console.log(`  Generated placeholder: ${path.basename(dest)} (${w}x${h}x${d}m)`);
}

const placeholderColors: Record<string, [number, number, number]> = {
  sofas: [0.3, 0.5, 0.8],
  chairs: [0.8, 0.5, 0.3],
  tables: [0.6, 0.4, 0.2],
  beds: [0.5, 0.7, 0.5],
  shelving: [0.7, 0.6, 0.3],
};

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });

  console.log("=== RoomAI Demo Model Downloader ===\n");

  let downloaded = 0;
  let placeholders = 0;

  for (const src of sources) {
    const dest = path.join(OUTPUT_DIR, src.filename);
    console.log(`Fetching ${src.filename}...`);
    const ok = await downloadFile(src.url, dest);
    if (ok) {
      downloaded++;
    } else if (!src.fallback) {
      console.log(`  Using existing file or skipping: ${src.filename}`);
    }
  }

  const { default: catalog } = await import("../src/data/demo-catalog");

  for (const item of catalog) {
    const dest = path.join(OUTPUT_DIR, item.modelFile);
    if (!fs.existsSync(dest)) {
      const color = placeholderColors[item.category] || [0.5, 0.5, 0.5];
      createPlaceholderGLB(dest, item.dimensions.w, item.dimensions.h, item.dimensions.d, color);
      placeholders++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Downloaded: ${downloaded} models`);
  console.log(`Placeholders generated: ${placeholders} models`);
  console.log(`Total in ${OUTPUT_DIR}: ${fs.readdirSync(OUTPUT_DIR).length} files`);
}

main().catch(console.error);
