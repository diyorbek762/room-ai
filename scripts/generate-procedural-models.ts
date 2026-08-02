import fs from "node:fs";
import path from "node:path";
import {
  NodeIO,
  Document,
  type Primitive,
  type Mesh,
} from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";

type DocBuffer = ReturnType<Document["createBuffer"]>;

interface FurnitureSpec {
  productId: string;
  file: string;
  category: "sofas" | "chairs" | "tables" | "beds" | "shelving";
  w: number;
  h: number;
  d: number;
  build: (w: number, h: number, d: number, doc: Document, buffer: DocBuffer) => Mesh[];
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  sofas: [0.27, 0.53, 0.8], // blue
  chairs: [0.8, 0.53, 0.27], // warm
  tables: [0.6, 0.4, 0.2], // wood
  beds: [0.4, 0.67, 0.4], // green
  shelving: [0.67, 0.6, 0.27], // ochre
};

function buildBoxPrimitives(doc: Document, meshes: Mesh[]): void {
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const positions = prim.getAttribute("POSITION");
      const normals = prim.getAttribute("NORMAL");
      if (positions) positions.setType("VEC3");
      if (normals) normals.setType("VEC3");
      prim.setAttribute("POSITION", positions!);
      prim.setAttribute("NORMAL", normals!);
    }
  }
}

function createBoxPrimitive(
  doc: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  vertices: Float32Array,
  normals: Float32Array,
  indices: Uint32Array
): Primitive {
  const positionAccessor = doc
    .createAccessor("POSITION")
    .setType("VEC3")
    .setArray(vertices as Float32Array<ArrayBuffer>)
    .setBuffer(buffer);
  const normalAccessor = doc
    .createAccessor("NORMAL")
    .setType("VEC3")
    .setArray(normals as Float32Array<ArrayBuffer>)
    .setBuffer(buffer);
  const indexAccessor = doc
    .createAccessor("INDEX")
    .setType("SCALAR")
    .setArray(indices as Uint32Array<ArrayBuffer>)
    .setBuffer(buffer);
  return doc
    .createPrimitive()
    .setAttribute("POSITION", positionAccessor)
    .setAttribute("NORMAL", normalAccessor)
    .setIndices(indexAccessor);
}

function makeBox(
  doc: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number
): Primitive {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  const x0 = cx - hw, x1 = cx + hw;
  const y0 = cy - hh, y1 = cy + hh;
  const z0 = cz - hd, z1 = cz + hd;
  const vertices = new Float32Array([
    // Front (z1)
    x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,
    // Back (z0)
    x1, y0, z0,  x0, y0, z0,  x0, y1, z0,  x1, y1, z0,
    // Top (y1)
    x0, y1, z1,  x1, y1, z1,  x1, y1, z0,  x0, y1, z0,
    // Bottom (y0)
    x0, y0, z0,  x1, y0, z0,  x1, y0, z1,  x0, y0, z1,
    // Right (x1)
    x1, y0, z1,  x1, y0, z0,  x1, y1, z0,  x1, y1, z1,
    // Left (x0)
    x0, y0, z0,  x0, y0, z1,  x0, y1, z1,  x0, y1, z0,
  ]);
  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);
  const indices = new Uint32Array([
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);
  return createBoxPrimitive(doc, buffer, vertices, normals, indices);
}

function attachBox(doc: Document, mesh: Mesh, buffer: ReturnType<Document["createBuffer"]>, cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
  mesh.addPrimitive(makeBox(doc, buffer, cx, cy, cz, w, h, d));
}

const SPECS: FurnitureSpec[] = [
  {
    productId: "demo-006", file: "06-bed-king.glb", category: "beds",
    w: 2.0, h: 0.5, d: 2.2,
    build: (w, h, d, doc, buf) => {
      const mattress = doc.createMesh("mattress");
      attachBox(doc, mattress, buf, 0, h / 2, 0, w, h, d);
      const headboard = doc.createMesh("headboard");
      attachBox(doc, headboard, buf, 0, h + 0.5, -d / 2 + 0.05, w, 1.0, 0.1);
      return [mattress, headboard];
    },
  },
  {
    productId: "demo-007", file: "07-bed-single.glb", category: "beds",
    w: 1.0, h: 0.5, d: 2.0,
    build: (w, h, d, doc, buf) => {
      const mattress = doc.createMesh("mattress");
      attachBox(doc, mattress, buf, 0, h / 2, 0, w, h, d);
      const headboard = doc.createMesh("headboard");
      attachBox(doc, headboard, buf, 0, h + 0.4, -d / 2 + 0.05, w, 0.8, 0.1);
      return [mattress, headboard];
    },
  },
  {
    productId: "demo-008", file: "08-shelf-bookshelf.glb", category: "shelving",
    w: 0.8, h: 1.8, d: 0.35,
    build: (w, h, d, doc, buf) => {
      const shelf = doc.createMesh("bookshelf");
      attachBox(doc, shelf, buf, 0, h / 2, 0, w, h, d);
      for (let i = 1; i < 4; i++) {
        attachBox(doc, shelf, buf, 0, (h * i) / 4, 0, w - 0.04, 0.02, d - 0.02);
      }
      return [shelf];
    },
  },
  {
    productId: "demo-009", file: "09-shelf-wall.glb", category: "shelving",
    w: 1.2, h: 0.6, d: 0.25,
    build: (w, h, d, doc, buf) => {
      const shelf = doc.createMesh("wallshelf");
      attachBox(doc, shelf, buf, 0, h / 2, 0, w, h, d);
      return [shelf];
    },
  },
  {
    productId: "demo-010", file: "10-sofa-lshape.glb", category: "sofas",
    w: 2.8, h: 0.85, d: 1.8,
    build: (w, h, d, doc, buf) => {
      const long = doc.createMesh("sofa-long");
      attachBox(doc, long, buf, 0, h / 2, 0, w, h, d / 2);
      const short = doc.createMesh("sofa-short");
      attachBox(doc, short, buf, w / 2 - d / 4, h / 2, d / 4, d / 2, h, d / 2);
      return [long, short];
    },
  },
  {
    productId: "demo-011", file: "11-desk-office.glb", category: "tables",
    w: 1.4, h: 0.75, d: 0.7,
    build: (w, h, d, doc, buf) => {
      const top = doc.createMesh("desk-top");
      attachBox(doc, top, buf, 0, h - 0.04, 0, w, 0.04, d);
      const legL = doc.createMesh("desk-legs");
      const legPositions: [number, number, number][] = [
        [-w / 2 + 0.05, h / 2, -d / 2 + 0.05],
        [w / 2 - 0.05, h / 2, -d / 2 + 0.05],
        [-w / 2 + 0.05, h / 2, d / 2 - 0.05],
        [w / 2 - 0.05, h / 2, d / 2 - 0.05],
      ];
      for (const [x, y, z] of legPositions) {
        attachBox(doc, legL, buf, x, y, z, 0.05, h - 0.04, 0.05);
      }
      return [top, legL];
    },
  },
  {
    productId: "demo-012", file: "12-nightstand.glb", category: "tables",
    w: 0.5, h: 0.55, d: 0.4,
    build: (w, h, d, doc, buf) => {
      const body = doc.createMesh("nightstand");
      attachBox(doc, body, buf, 0, h / 2, 0, w, h, d);
      attachBox(doc, body, buf, 0, h / 2, d / 2 - 0.01, w - 0.04, h - 0.1, 0.01);
      return [body];
    },
  },
  {
    productId: "demo-013", file: "13-wardrobe.glb", category: "shelving",
    w: 1.2, h: 2.0, d: 0.6,
    build: (w, h, d, doc, buf) => {
      const body = doc.createMesh("wardrobe");
      attachBox(doc, body, buf, 0, h / 2, 0, w, h, d);
      attachBox(doc, body, buf, -w / 4, h / 2, d / 2 - 0.01, w / 2 - 0.02, h - 0.1, 0.01);
      attachBox(doc, body, buf, w / 4, h / 2, d / 2 - 0.01, w / 2 - 0.02, h - 0.1, 0.01);
      return [body];
    },
  },
  {
    productId: "demo-014", file: "14-lamp-floor.glb", category: "shelving",
    w: 0.35, h: 1.6, d: 0.35,
    build: (w, _h, d, doc, buf) => {
      const base = doc.createMesh("lamp-base");
      attachBox(doc, base, buf, 0, 0.02, 0, w, 0.04, d);
      const pole = doc.createMesh("lamp-pole");
      attachBox(doc, pole, buf, 0, 0.8, 0, 0.04, 1.5, 0.04);
      const shade = doc.createMesh("lamp-shade");
      attachBox(doc, shade, buf, 0, 1.55, 0, 0.3, 0.25, 0.3);
      return [base, pole, shade];
    },
  },
  {
    productId: "demo-015", file: "15-tv-stand.glb", category: "tables",
    w: 1.5, h: 0.5, d: 0.4,
    build: (w, h, d, doc, buf) => {
      const body = doc.createMesh("tv-stand");
      attachBox(doc, body, buf, 0, h / 2, 0, w, h, d);
      attachBox(doc, body, buf, 0, 0.05, 0, w - 0.04, 0.01, d - 0.04);
      return [body];
    },
  },
  {
    productId: "demo-016", file: "16-stool-bar.glb", category: "chairs",
    w: 0.4, h: 0.95, d: 0.4,
    build: (w, h, d, doc, buf) => {
      const seat = doc.createMesh("stool-seat");
      attachBox(doc, seat, buf, 0, h - 0.05, 0, w, 0.08, d);
      const pole = doc.createMesh("stool-pole");
      attachBox(doc, pole, buf, 0, h / 2, 0, 0.05, h - 0.1, 0.05);
      const base = doc.createMesh("stool-base");
      attachBox(doc, base, buf, 0, 0.02, 0, 0.35, 0.04, 0.35);
      return [seat, pole, base];
    },
  },
  {
    productId: "demo-017", file: "17-table-side.glb", category: "tables",
    w: 0.5, h: 0.55, d: 0.5,
    build: (w, h, d, doc, buf) => {
      const top = doc.createMesh("side-top");
      attachBox(doc, top, buf, 0, h - 0.03, 0, w, 0.04, d);
      const leg = doc.createMesh("side-leg");
      attachBox(doc, leg, buf, 0, h / 2 - 0.04, 0, 0.04, h - 0.1, 0.04);
      return [top, leg];
    },
  },
  {
    productId: "demo-018", file: "18-sofa-recliner.glb", category: "sofas",
    w: 2.2, h: 1.0, d: 0.95,
    build: (w, h, d, doc, buf) => {
      const base = doc.createMesh("recliner-base");
      attachBox(doc, base, buf, 0, 0.3, 0, w, 0.5, d);
      const back = doc.createMesh("recliner-back");
      attachBox(doc, back, buf, 0, 0.75, -d / 2 + 0.1, w, 0.8, 0.2);
      return [base, back];
    },
  },
];

async function generateModel(io: NodeIO, spec: FurnitureSpec, outputDir: string): Promise<{ bytes: number }> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const color = CATEGORY_COLORS[spec.category];
  const material = doc
    .createMaterial(spec.category)
    .setBaseColorFactor([color[0], color[1], color[2], 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.7);

  const meshes = spec.build(spec.w, spec.h, spec.d, doc, buffer);
  for (const mesh of meshes) {
    mesh.addPrimitive(mesh.listPrimitives()[0]!.setMaterial(material));
  }
  buildBoxPrimitives(doc, meshes);

  const node = doc.createNode(spec.file.replace(".glb", ""));
  for (const mesh of meshes) {
    const child = doc.createNode(mesh.getName()).setMesh(mesh);
    node.addChild(child);
  }
  const scene = doc.createScene("scene");
  scene.addChild(node);

  fs.mkdirSync(outputDir, { recursive: true });
  // Write the same procedural file to all three tiers (geometry is already minimum-poly)
  for (const tier of ["low", "med", "high"]) {
    const outPath = path.join(outputDir, spec.productId, `${tier}.glb`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await io.write(outPath, doc);
  }
  const samplePath = path.join(outputDir, spec.productId, "low.glb");
  return { bytes: fs.statSync(samplePath).size };
}

async function main() {
  const outputDir = "public/models";
  const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);

  console.error(`Generating ${SPECS.length} procedural models to ${outputDir}\n`);

  let totalBytes = 0;
  for (const spec of SPECS) {
    try {
      const { bytes } = await generateModel(io, spec, outputDir);
      totalBytes += bytes * 3;
      console.error(`  ${spec.productId}/${spec.file} (${spec.w}×${spec.h}×${spec.d}) → ${bytes} bytes × 3 tiers`);
    } catch (err) {
      console.error(`  FAILED ${spec.file}: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  console.error(`\nTotal procedural: ${(totalBytes / 1024).toFixed(0)} KB across ${SPECS.length} products × 3 tiers`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
